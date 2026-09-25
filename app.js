/**
 * Stetho MD - Core Application Controller & UI Router
 */

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  initAuth();
  initBarcodeScanner();
  
  if (initFirebase()) {
    initRealtimeInventory();
    initRealtimeOrders();
    initRealtimeCases();
  } else {
    showFirebaseSetupBanner();
  }

  // Setup navigation
  document.querySelectorAll('.sidebar-menu-item a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.getAttribute('data-page');
      navigateToPage(page);
    });
  });

  // Default page
  navigateToPage('inventory');
}

/**
 * Page Navigation Controller
 */
function navigateToPage(pageId) {
  document.querySelectorAll('.sidebar-menu-item').forEach(item => {
    item.classList.remove('active');
  });

  const activeNav = document.querySelector(`.sidebar-menu-item a[data-page="${pageId}"]`);
  if (activeNav) {
    activeNav.closest('.sidebar-menu-item').classList.add('active');
  }

  document.querySelectorAll('.page-view').forEach(view => {
    view.style.display = 'none';
  });

  const targetView = document.getElementById(`view-${pageId}`);
  if (targetView) {
    targetView.style.display = 'block';
  }

  if (pageId === 'inventory') renderInventoryView();
  if (pageId === 'orders') renderOrdersTable();
  if (pageId === 'cases') renderCasesTable();
  if (pageId === 'reports') renderAnalyticsReport();
  if (pageId === 'settings') renderUsersTable();
  if (pageId === 'dashboard') updateDashboardMetrics();
}

/**
 * Hardware Barcode Scanner Listener (Captures rapid keystroke bursts < 45ms ending in Enter)
 */
let barcodeBuffer = '';
let lastKeyTime = 0;

function initBarcodeScanner() {
  window.addEventListener('keydown', (e) => {
    // Ignore keystrokes inside regular input fields
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      return;
    }

    const now = Date.now();
    const interval = now - lastKeyTime;
    lastKeyTime = now;

    if (e.key === 'Enter') {
      if (barcodeBuffer.length >= 3) {
        handleScannedBarcode(barcodeBuffer.trim());
        barcodeBuffer = '';
      }
      return;
    }

    if (e.key.length === 1) {
      if (interval > 55) {
        barcodeBuffer = ''; // Reset buffer if typing manually
      }
      barcodeBuffer += e.key;
    }
  });
}

function handleScannedBarcode(barcode) {
  console.log('📡 [Hardware Scanner] Scanned Barcode / NDC:', barcode);
  
  const item = inventoryState.items.find(i => 
    (i.barcode && i.barcode === barcode) || 
    (i.vendorSku && i.vendorSku === barcode)
  );

  if (item) {
    showToast(`🔍 Barcode Matched: ${item.itemName}`, 'info');
    navigateToPage('inventory');
    
    // Switch to item's location if user has permissions
    if (inventoryState.activeLocation !== item.location && inventoryState.activeLocation !== 'MASTER') {
      setInventoryLocation(item.location);
    }

    setTimeout(() => {
      const row = document.getElementById(`row-inv-${item.id}`);
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        row.classList.add('scanned-highlight');
        setTimeout(() => row.classList.remove('scanned-highlight'), 3000);
      }
      openSingleAuditModal(item.id);
    }, 200);
  } else {
    showToast(`⚠️ No catalog item found for barcode: ${barcode}`, 'warning');
  }
}

/**
 * Toast Notification System
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toastEl = document.createElement('div');
  toastEl.className = `toast align-items-center text-white bg-${type === 'danger' ? 'danger' : type === 'success' ? 'success' : type === 'warning' ? 'warning text-dark' : 'primary'} border-0 show stetho-toast mb-2`;
  toastEl.setAttribute('role', 'alert');
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body fw-medium">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" onclick="this.closest('.toast').remove()"></button>
    </div>`;

  container.appendChild(toastEl);
  setTimeout(() => toastEl.remove(), 4000);
}

/**
 * Modal Management Helpers
 */
function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) {
    const modal = bootstrap.Modal.getOrCreateInstance(el);
    modal.show();
  }
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) {
    const modal = bootstrap.Modal.getInstance(el);
    if (modal) modal.hide();
  }
}

/**
 * Modal Launchers for Inventory Operations
 */
function promptOpenVial(itemId, itemName) {
  const item = inventoryState.items.find(i => i.id === itemId);
  if (!item) return;

  if (confirm(`Open a new sealed vial of ${itemName}?\n\nThis will move 1 vial from Closed Stock into Active Open Stock with full units initialized.`)) {
    openNewVial(itemId);
  }
}

function openUseUnitsModal(vialId) {
  const vial = inventoryState.openedVials.find(v => v.id === vialId);
  if (!vial) return;

  document.getElementById('use-units-vial-id').value = vialId;
  document.getElementById('use-units-item-name').textContent = vial.itemName;
  document.getElementById('use-units-location-badge').textContent = vial.location;
  document.getElementById('use-units-current-remaining').textContent = `${vial.unitsRemaining} / ${vial.totalUnits} units`;
  document.getElementById('use-units-amount-input').value = '';
  document.getElementById('use-units-calc-preview').textContent = `Remaining after: ${vial.unitsRemaining} units`;

  // Attach live calculation listener
  const input = document.getElementById('use-units-amount-input');
  input.oninput = () => {
    const used = Number(input.value || 0);
    const rem = vial.unitsRemaining - used;
    const preview = document.getElementById('use-units-calc-preview');
    if (rem < 0) {
      preview.innerHTML = `<span class="text-danger fw-bold">Cannot deduct more units than remaining!</span>`;
    } else {
      preview.innerHTML = `Calculation: <strong>${vial.unitsRemaining} - ${used} = ${rem} units remaining</strong> ${rem === 0 ? '(Vial will be marked depleted)' : ''}`;
    }
  };

  openModal('useUnitsModal');
}

function submitUseUnitsForm() {
  const vialId = document.getElementById('use-units-vial-id').value;
  const unitsUsed = document.getElementById('use-units-amount-input').value;
  const patient = document.getElementById('use-units-patient-input').value;
  const notes = document.getElementById('use-units-notes-input').value;

  useUnitsFromOpenVial(vialId, unitsUsed, patient, notes);
}

function openTransferModalForProduct(productName) {
  const pSelect = document.getElementById('transfer-product-select');
  if (pSelect) {
    pSelect.value = productName;
  }
  openModal('transferStockModal');
}

function submitTransferStockForm() {
  const productName = document.getElementById('transfer-product-select').value;
  const fromLoc = document.getElementById('transfer-from-location').value;
  const toLoc = document.getElementById('transfer-to-location').value;
  const qty = document.getElementById('transfer-qty-input').value;
  const notes = document.getElementById('transfer-notes-input').value;

  const item = inventoryState.items.find(i => i.itemName === productName && i.location === fromLoc);
  if (!item) {
    showToast(`No item found for ${productName} in ${fromLoc}`, 'danger');
    return;
  }

  transferStock(item.id, fromLoc, toLoc, qty, notes);
}

function openSingleAuditModal(itemId) {
  const item = inventoryState.items.find(i => i.id === itemId);
  if (!item) return;

  document.getElementById('audit-item-id').value = itemId;
  document.getElementById('audit-item-name').textContent = item.itemName;
  document.getElementById('audit-item-location').textContent = item.location;
  document.getElementById('audit-closed-count-input').value = item.closedCount || 0;
  document.getElementById('audit-open-count-input').value = item.openCount || 0;
  document.getElementById('audit-notes-input').value = '';

  openModal('singleAuditModal');
}

function submitSingleAuditForm() {
  const itemId = document.getElementById('audit-item-id').value;
  const closed = document.getElementById('audit-closed-count-input').value;
  const open = document.getElementById('audit-open-count-input').value;
  const notes = document.getElementById('audit-notes-input').value;

  performCountAudit(itemId, closed, open, notes);
}

function openEditItemModal(itemId) {
  const item = inventoryState.items.find(i => i.id === itemId);
  if (!item) return;

  document.getElementById('edit-item-id').value = item.id;
  document.getElementById('edit-item-name').value = item.itemName;
  document.getElementById('edit-item-category').value = item.category;
  document.getElementById('edit-item-location').value = item.location;
  document.getElementById('edit-item-ml').value = item.vialSizeML || '';
  document.getElementById('edit-item-units').value = item.unitsPerVial || '';
  document.getElementById('edit-item-vendor').value = item.defaultVendor || '';
  document.getElementById('edit-item-sku').value = item.vendorSku || '';
  document.getElementById('edit-item-barcode').value = item.barcode || '';
  document.getElementById('edit-item-threshold').value = item.minThreshold || 3;

  openModal('editItemModal');
}

function submitEditItemForm() {
  const itemData = {
    id: document.getElementById('edit-item-id').value,
    itemName: document.getElementById('edit-item-name').value,
    category: document.getElementById('edit-item-category').value,
    location: document.getElementById('edit-item-location').value,
    vialSizeML: Number(document.getElementById('edit-item-ml').value || 0),
    unitsPerVial: Number(document.getElementById('edit-item-units').value || 0),
    defaultVendor: document.getElementById('edit-item-vendor').value,
    vendorSku: document.getElementById('edit-item-sku').value,
    barcode: document.getElementById('edit-item-barcode').value,
    minThreshold: Number(document.getElementById('edit-item-threshold').value || 3)
  };

  saveInventoryItem(itemData);
}

function openReceiveOrderModal(orderId) {
  const order = ordersState.orders.find(o => o.id === orderId);
  if (!order) return;

  document.getElementById('receive-order-id').value = orderId;
  document.getElementById('receive-order-number').textContent = `#${order.orderNumber || order.id.slice(0, 8)}`;
  document.getElementById('receive-order-vendor').textContent = order.vendor;
  document.getElementById('receive-staff-name-input').value = order.staffName || '';

  const tbody = document.getElementById('receive-items-table-body');
  tbody.innerHTML = (order.items || []).map((item, idx) => `
    <tr>
      <td><strong>${item.itemName}</strong></td>
      <td class="text-center">${item.orderedQty}</td>
      <td class="text-center text-success fw-bold">${item.receivedQty || 0}</td>
      <td>
        <input type="number" class="form-control form-control-sm text-center rec-qty-input" 
          data-item-name="${item.itemName}" 
          value="${Math.max(0, Number(item.orderedQty || 0) - Number(item.receivedQty || 0))}" min="0">
      </td>
    </tr>
  `).join('');

  openModal('receiveOrderModal');
}

function submitReceiveOrderForm() {
  const orderId = document.getElementById('receive-order-id').value;
  const staffName = document.getElementById('receive-staff-name-input').value;

  const receivedItems = [];
  document.querySelectorAll('.rec-qty-input').forEach(input => {
    receivedItems.push({
      itemName: input.getAttribute('data-item-name'),
      receivedQty: Number(input.value || 0)
    });
  });

  receivePharmacyOrder(orderId, receivedItems, staffName);
}

/**
 * Firebase Setup Modal & Local Config Wizard
 */
function showFirebaseSetupBanner() {
  const banner = document.getElementById('firebase-setup-banner');
  if (banner) banner.style.display = 'block';
}

function saveLocalFirebaseConfig() {
  const raw = document.getElementById('firebase-config-json-input').value;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.apiKey || !parsed.projectId) {
      throw new Error("Missing apiKey or projectId in configuration JSON.");
    }
    localStorage.setItem('stetho_firebase_config', JSON.stringify(parsed));
    showToast('✅ Firebase Config saved! Initializing live connection...', 'success');
    setTimeout(() => location.reload(), 1000);
  } catch (e) {
    alert("Invalid Firebase Configuration JSON: " + e.message);
  }
}

async function triggerDatabaseSeed() {
  if (confirm("Populate Firestore with standard Tampa & Zephyrhills Tirzepatide (1–5+ mL), Semaglutide (5 mL), Vaccines, Supplies, and staff accounts?")) {
    try {
      await seedFirestoreDatabase();
      showToast('🎉 Clinic catalog and demo accounts populated successfully!', 'success');
    } catch (err) {
      showToast(`Error seeding data: ${err.message}`, 'danger');
    }
  }
}
