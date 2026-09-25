/**
 * Stetho MD Medication Tracking & Dispensing System
 * Standalone Real-Time Client Controller for GitHub Pages & Firebase
 */

// Global App State
var STATE = {
  sessionToken: null,
  user: null,
  products: [],
  currentView: 'dashboard',
  previousView: 'dashboard',
  selectedPatient: null,
  selectedCaseId: null,
  reportsData: null,
  reportsChart: null,
  pendingCasesTimer: null,
  pharmacyOrders: [],
  activeOrderFilter: 'all',
  selectedOrderId: null,
  inOfficeInventory: [],
  openedVials: [],
  transfers: [],
  auditLogs: [],
  activeInventoryCategory: 'ALL',
  activeLocation: 'Tampa',
  masterInventory: []
};

// Bootstrap Modal References
var modals = {};

// Initialize app on DOM Load
window.addEventListener('DOMContentLoaded', function() {
  // Initialize Bootstrap Modals
  var modalIds = [
    'dispenseModal', 'caseNoteModal', 'caseDetailsModal', 'inventoryModal', 
    'createUserModal', 'resetPasswordModal', 'newOrderModal', 'orderDetailsModal', 
    'supplyOrderLogModal', 'quickShiftAuditModal', 'itemCountAuditModal', 
    'administerModal', 'editItemModal', 'stockAuditHistoryModal', 'useUnitsModal', 
    'transferStockModal', 'singleAuditModal', 'receiveOrderModal', 'syncGoogleSheetModal'
  ];

  modalIds.forEach(function(id) {
    var el = document.getElementById(id);
    if (el && typeof bootstrap !== 'undefined') {
      modals[id] = new bootstrap.Modal(el);
    }
  });

  // Initialize Barcode Scanner
  initBarcodeScannerListener();

  // Initialize Firebase Realtime Listeners
  if (initFirebase()) {
    initFirestoreSubscriptions();
  }

  // Check for existing session in localStorage
  var savedUser = localStorage.getItem('stetho_session_user');
  if (savedUser) {
    try {
      STATE.user = JSON.parse(savedUser);
      setupAppShell(STATE.user);
      switchView('dashboard');
    } catch (e) {
      showDefaultAdminSession();
    }
  } else {
    showDefaultAdminSession();
  }
});

function showDefaultAdminSession() {
  STATE.user = {
    id: 'user_admin',
    username: 'admin',
    fullName: 'Dr. Smith (Medical Director)',
    role: 'Administrator',
    location: 'All'
  };
  setupAppShell(STATE.user);
  switchView('dashboard');
}

/**
 * Configure view visibility and navigation highlights.
 */
function switchView(viewName) {
  if (STATE.pendingCasesTimer) {
    clearInterval(STATE.pendingCasesTimer);
    STATE.pendingCasesTimer = null;
  }
  
  STATE.previousView = STATE.currentView;
  STATE.currentView = viewName;
  
  // Hide all panels
  var panels = document.querySelectorAll('.view-panel');
  panels.forEach(p => p.classList.add('d-none'));
  
  // Hide login view by default
  var loginEl = document.getElementById('view-login');
  if (loginEl) loginEl.classList.add('d-none');
  
  // Remove navigation highlights
  var navItems = document.querySelectorAll('.sidebar-menu-item');
  navItems.forEach(n => n.classList.remove('active'));
  
  if (viewName === 'login') {
    document.getElementById('view-app-shell').classList.add('d-none');
    if (loginEl) loginEl.classList.remove('d-none');
  } else {
    document.getElementById('view-app-shell').classList.remove('d-none');
    var targetPanel = document.getElementById('panel-' + viewName);
    if (targetPanel) {
      targetPanel.classList.remove('d-none');
    }
    
    // Highlight sidebar menu
    var activeNav = document.getElementById('nav-' + viewName);
    if (activeNav) {
      activeNav.classList.add('active');
    }
    
    // Trigger loader functions
    if (viewName === 'dashboard') loadDashboard();
    else if (viewName === 'cases') loadPendingCases();
    else if (viewName === 'patient') loadPatientView();
    else if (viewName === 'inventory') renderInventoryView();
    else if (viewName === 'orders') renderPharmacyOrders();
    else if (viewName === 'reports') loadReportsData();
    else if (viewName === 'settings') loadSettings();
  }
}

function goBackToPreviousView() {
  if (STATE.previousView) {
    switchView(STATE.previousView);
  } else {
    switchView('dashboard');
  }
}

function setupAppShell(user) {
  if (!user) return;
  var nameEl = document.getElementById('user-display-name');
  var roleEl = document.getElementById('user-display-role');
  var initialsEl = document.getElementById('user-initials');

  if (nameEl) nameEl.textContent = user.fullName || user.name || 'Staff User';
  if (roleEl) roleEl.textContent = `${user.role || 'Staff'} (${user.location || 'All'})`;
  if (initialsEl) {
    var parts = (user.fullName || user.name || 'Dr Smith').split(' ');
    initialsEl.textContent = parts.map(p => p[0]).join('').slice(0, 2).toUpperCase();
  }

  // RBAC Location lock
  if (user.role !== 'Administrator' && user.role !== 'Inventory Manager' && user.location && user.location !== 'All') {
    STATE.activeLocation = user.location;
    var masterBtn = document.querySelector('[data-location="MASTER"]');
    if (masterBtn) masterBtn.style.display = 'none';
  }
}

/**
 * Firestore Real-time Subscriptions
 */
function initFirestoreSubscriptions() {
  if (!db) return;

  // 1. Inventory subscription
  db.collection('inventory').onSnapshot(snapshot => {
    STATE.inOfficeInventory = [];
    snapshot.forEach(doc => {
      STATE.inOfficeInventory.push({ id: doc.id, ...doc.data() });
    });
    renderInventoryView();
    updateDashboardStats();
  });

  // 2. Opened Vials subscription
  db.collection('openedVials').where('status', '==', 'ACTIVE').onSnapshot(snapshot => {
    STATE.openedVials = [];
    snapshot.forEach(doc => {
      STATE.openedVials.push({ id: doc.id, ...doc.data() });
    });
    renderInventoryView();
    updateDashboardStats();
  });

  // 3. Pharmacy Orders subscription
  db.collection('pharmacyOrders').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
    STATE.pharmacyOrders = [];
    snapshot.forEach(doc => {
      STATE.pharmacyOrders.push({ id: doc.id, ...doc.data() });
    });
    renderPharmacyOrders();
    updateDashboardStats();
  });

  // 4. Cases subscription
  db.collection('cases').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
    STATE.cases = [];
    snapshot.forEach(doc => {
      STATE.cases.push({ id: doc.id, ...doc.data() });
    });
    renderPendingCasesTable();
    updateDashboardStats();
  });

  // 5. Stock Transfers subscription
  db.collection('stockTransfers').orderBy('timestamp', 'desc').limit(50).onSnapshot(snapshot => {
    STATE.transfers = [];
    snapshot.forEach(doc => {
      STATE.transfers.push({ id: doc.id, ...doc.data() });
    });
    renderTransfersTable();
  });
}

/**
 * Dashboard Loader & Real-time Stats
 */
function loadDashboard() {
  var dateEl = document.getElementById('dashboard-date-str');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
  updateDashboardStats();
}

function updateDashboardStats() {
  var totalSales = (STATE.cases || []).length;
  var totalRevenue = (STATE.cases || []).reduce((sum, c) => sum + Number(c.amountPaid || 0), 0);
  var pendingCases = (STATE.cases || []).filter(c => c.status === 'Pending').length;
  var completedCases = (STATE.cases || []).filter(c => c.status === 'Completed').length;

  var salesEl = document.getElementById('stat-today-sales');
  var revEl = document.getElementById('stat-today-revenue');
  var pendEl = document.getElementById('stat-pending-cases');
  var compEl = document.getElementById('stat-completed-cases');

  if (salesEl) salesEl.textContent = totalSales;
  if (revEl) revEl.textContent = '$' + totalRevenue.toFixed(2);
  if (pendEl) pendEl.textContent = pendingCases;
  if (compEl) compEl.textContent = completedCases;

  // Render Low Stock Table on Dashboard
  renderDashboardLowStock();
}

function renderDashboardLowStock() {
  var tbody = document.getElementById('dashboard-low-stock-rows');
  if (!tbody) return;

  var lowItems = (STATE.inOfficeInventory || []).filter(i => Number(i.closedCount || 0) <= Number(i.minThreshold || 3));
  if (lowItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-3 text-muted">All inventory stock levels are healthy!</td></tr>`;
    return;
  }

  tbody.innerHTML = lowItems.map(item => `
    <tr>
      <td class="fw-bold">${item.itemName}</td>
      <td><span class="badge bg-light text-dark border">${item.location || 'Tampa'}</span></td>
      <td><span class="badge bg-danger">${item.closedCount || 0} Sealed</span></td>
      <td>${item.minThreshold || 3}</td>
      <td><span class="badge bg-warning text-dark">Reorder Soon</span></td>
    </tr>
  `).join('');
}

/**
 * In-Office Inventory Module
 */
function setInventoryLocation(location) {
  var user = STATE.user;
  if (user && user.role !== 'Administrator' && user.role !== 'Inventory Manager') {
    if (user.location !== 'All' && location !== user.location) {
      showToast(`Access Restricted: Assigned to ${user.location} clinic.`, 'warning');
      return;
    }
  }

  STATE.activeLocation = location;
  document.querySelectorAll('.btn-loc-switcher').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.location === location);
    btn.classList.toggle('btn-stetho-primary', btn.dataset.location === location);
    btn.classList.toggle('btn-outline-secondary', btn.dataset.location !== location);
  });
  renderInventoryView();
}

function setInventoryCategory(category) {
  STATE.activeInventoryCategory = category;
  document.querySelectorAll('.btn-cat-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === category);
    btn.classList.toggle('btn-dark', btn.dataset.category === category);
    btn.classList.toggle('btn-outline-secondary', btn.dataset.category !== category);
  });
  renderInventoryView();
}

function renderInventoryView() {
  var loc = STATE.activeLocation;
  var isMaster = (loc === 'MASTER');

  var regularView = document.getElementById('location-inventory-view');
  var masterView = document.getElementById('master-inventory-view');
  var titleBadge = document.getElementById('inventory-current-location-badge');

  if (titleBadge) {
    titleBadge.textContent = isMaster ? 'Master Overview (Tampa + Zephyrhills Combined)' : `${loc} Clinic Inventory`;
  }

  if (isMaster) {
    if (regularView) regularView.classList.add('d-none');
    if (masterView) masterView.classList.remove('d-none');
    renderMasterInventoryTable();
  } else {
    if (masterView) masterView.classList.add('d-none');
    if (regularView) regularView.classList.remove('d-none');
    renderLocationInventoryTable();
  }
}

function renderLocationInventoryTable() {
  var tbody = document.getElementById('inventory-table-body');
  if (!tbody) return;

  var loc = STATE.activeLocation;
  var cat = STATE.activeInventoryCategory;
  var items = (STATE.inOfficeInventory || []).filter(i => i.location === loc);

  if (cat !== 'ALL') {
    items = items.filter(i => i.category === cat);
  }

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-5 text-muted">
          <i class="material-icons fs-1 d-block mb-2 text-secondary">inventory_2</i>
          <div>No inventory items found for <strong>${loc}</strong>.</div>
          <div class="mt-3 d-flex justify-content-center gap-2">
            <button class="btn btn-sm btn-primary" onclick="triggerDatabaseSeed()">
              <i class="material-icons" style="font-size: 1rem;">auto_awesome</i>
              <span>Seed Catalog (Tampa & Zephyrhills)</span>
            </button>
            <button class="btn btn-sm btn-outline-success" onclick="openModal('syncGoogleSheetModal')">
              <i class="material-icons" style="font-size: 1rem;">cloud_download</i>
              <span>Import from Google Sheet</span>
            </button>
          </div>
        </td>
      </tr>`;
    return;
  }

  var html = '';
  items.forEach(item => {
    var openVials = (STATE.openedVials || []).filter(v => v.inventoryId === item.id);
    var totalOpenUnits = openVials.reduce((s, v) => s + Number(v.unitsRemaining || 0), 0);
    var unitsPerVial = Number(item.unitsPerVial || (item.vialSizeML ? item.vialSizeML * 100 : 100));
    var totalUnits = (Number(item.closedCount || 0) * unitsPerVial) + totalOpenUnits;

    var isLow = Number(item.closedCount || 0) <= Number(item.minThreshold || 3);

    var openVialsHtml = '';
    if (openVials.length === 0) {
      openVialsHtml = `<span class="badge badge-zero-stock">0 Active Open</span>`;
    } else {
      openVials.forEach(v => {
        var rem = Number(v.unitsRemaining || 0);
        var cap = Number(v.totalUnits || unitsPerVial);
        var pct = Math.min(100, Math.max(0, Math.round((rem / cap) * 100)));
        var color = pct <= 25 ? 'bg-danger' : pct <= 50 ? 'bg-warning' : 'bg-success';

        openVialsHtml += `
          <div class="vial-card-pill mb-2">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="badge bg-success-subtle text-success border border-success-subtle fw-bold" style="font-size: 0.75rem;">
                <i class="bi bi-droplet-half me-1"></i>Vial #${v.id.slice(-4)}
              </span>
              <span class="fw-bold text-dark" style="font-size: 0.8rem;">${rem} / ${cap} u (${pct}%)</span>
            </div>
            <div class="vial-progress-container">
              <div class="vial-progress-bar ${color}" style="width: ${pct}%;"></div>
            </div>
            <div class="d-flex justify-content-between align-items-center mt-1">
              <small class="text-muted" style="font-size: 0.7rem;">Opened: ${new Date(v.dateOpened).toLocaleDateString()}</small>
              <button class="btn btn-sm btn-outline-primary py-0 px-2" style="font-size: 0.72rem;" onclick="openUseUnitsModal('${v.id}')">
                <i class="bi bi-dash-circle me-1"></i>Use Units
              </button>
            </div>
          </div>`;
      });
    }

    html += `
      <tr id="row-inv-${item.id}">
        <td>
          <div class="fw-bold text-dark">${item.itemName}</div>
          <div class="small text-muted">
            <span class="badge bg-light text-secondary border me-1">${item.category}</span>
            ${item.vialSizeML ? `<span class="me-2">${item.vialSizeML} mL (${unitsPerVial} u)</span>` : ''}
            ${item.barcode ? `<span class="text-muted"><i class="bi bi-upc-scan me-1"></i>${item.barcode}</span>` : ''}
          </div>
        </td>
        <td>
          <span class="badge badge-closed-stock ${isLow ? 'border-danger text-danger bg-danger-subtle' : ''}">
            ${item.closedCount || 0} Sealed
          </span>
        </td>
        <td style="min-width: 220px;">
          ${openVialsHtml}
        </td>
        <td>
          <div class="fw-bold text-dark">${totalUnits.toLocaleString()} units</div>
          <small class="text-muted">(${item.closedCount || 0} sealed + ${totalOpenUnits} open)</small>
        </td>
        <td>
          <span class="small text-muted d-block">${item.defaultVendor || 'Empower Pharmacy'}</span>
          <code class="small text-secondary">${item.vendorSku || '—'}</code>
        </td>
        <td class="text-end">
          <div class="btn-group">
            <button class="btn btn-sm btn-outline-success" onclick="promptOpenVial('${item.id}', '${item.itemName}')" title="Open New Sealed Vial">
              <i class="material-icons" style="font-size: 1rem;">unarchive</i>
              <span>Open Vial</span>
            </button>
            <button class="btn btn-sm btn-outline-secondary" onclick="openSingleAuditModal('${item.id}')" title="Count Audit">
              <i class="material-icons" style="font-size: 1rem;">fact_check</i>
            </button>
            <button class="btn btn-sm btn-outline-primary" onclick="openEditItemModal('${item.id}')" title="Edit Catalog Item">
              <i class="material-icons" style="font-size: 1rem;">edit</i>
            </button>
          </div>
        </td>
      </tr>`;
  });

  tbody.innerHTML = html;
}

function renderMasterInventoryTable() {
  var tbody = document.getElementById('master-inventory-table-body');
  if (!tbody) return;

  var grouped = {};
  (STATE.inOfficeInventory || []).forEach(item => {
    var key = item.itemName;
    if (!grouped[key]) {
      grouped[key] = {
        itemName: item.itemName,
        category: item.category,
        vialSizeML: item.vialSizeML,
        unitsPerVial: Number(item.unitsPerVial || (item.vialSizeML ? item.vialSizeML * 100 : 100)),
        tampa: { closed: 0, open: 0, openUnits: 0, totalUnits: 0 },
        zephyr: { closed: 0, open: 0, openUnits: 0, totalUnits: 0 }
      };
    }

    var target = item.location === 'Tampa' ? grouped[key].tampa : grouped[key].zephyr;
    target.closed = Number(item.closedCount || 0);

    var openVials = (STATE.openedVials || []).filter(v => v.inventoryId === item.id);
    target.open = openVials.length;
    target.openUnits = openVials.reduce((s, v) => s + Number(v.unitsRemaining || 0), 0);
    target.totalUnits = (target.closed * grouped[key].unitsPerVial) + target.openUnits;
  });

  var keys = Object.keys(grouped);
  if (keys.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No master inventory data found.</td></tr>`;
    return;
  }

  tbody.innerHTML = keys.map(key => {
    var p = grouped[key];
    var totalClosed = p.tampa.closed + p.zephyr.closed;
    var totalOpen = p.tampa.open + p.zephyr.open;
    var totalUnits = p.tampa.totalUnits + p.zephyr.totalUnits;

    return `
      <tr class="hover-master-row">
        <td>
          <div class="product-hover-trigger">
            <span class="fw-bold text-dark text-decoration-underline">${p.itemName}</span>
            <div class="inventory-hover-tooltip">
              <div class="fw-bold border-bottom border-secondary pb-1 mb-2 text-info">
                <i class="bi bi-geo-alt-fill me-1"></i>${p.itemName} Breakdown
              </div>
              <div class="row g-2 mb-2">
                <div class="col-6">
                  <div class="text-uppercase text-muted" style="font-size: 0.7rem;">Tampa Clinic</div>
                  <div class="text-white fw-bold">${p.tampa.closed} sealed, ${p.tampa.open} open</div>
                  <div class="text-info fw-semibold">${p.tampa.totalUnits.toLocaleString()} units</div>
                </div>
                <div class="col-6">
                  <div class="text-uppercase text-muted" style="font-size: 0.7rem;">Zephyrhills Clinic</div>
                  <div class="text-white fw-bold">${p.zephyr.closed} sealed, ${p.zephyr.open} open</div>
                  <div class="text-info fw-semibold">${p.zephyr.totalUnits.toLocaleString()} units</div>
                </div>
              </div>
              <div class="border-top border-secondary pt-1 text-light d-flex justify-content-between">
                <span>Grand Total:</span>
                <span class="fw-bold text-warning">${totalUnits.toLocaleString()} units</span>
              </div>
            </div>
          </div>
          <div class="small text-muted">${p.category} &bull; ${p.vialSizeML ? `${p.vialSizeML} mL` : 'Item'}</div>
        </td>
        <td>
          <div class="fw-semibold text-dark">${p.tampa.closed} sealed <span class="text-muted">(${p.tampa.open} open)</span></div>
          <div class="small text-info fw-bold">${p.tampa.totalUnits.toLocaleString()} u</div>
        </td>
        <td>
          <div class="fw-semibold text-dark">${p.zephyr.closed} sealed <span class="text-muted">(${p.zephyr.open} open)</span></div>
          <div class="small text-info fw-bold">${p.zephyr.totalUnits.toLocaleString()} u</div>
        </td>
        <td>
          <span class="badge bg-primary fs-6 px-2 py-1">${totalClosed} Sealed</span>
          <span class="badge bg-success-subtle text-success border border-success ms-1">${totalOpen} Open</span>
        </td>
        <td><div class="fw-bold text-dark fs-6">${totalUnits.toLocaleString()} units</div></td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary" onclick="openTransferModalForProduct('${p.itemName}')">
            <i class="material-icons" style="font-size: 1rem;">swap_horiz</i>
            <span>Transfer</span>
          </button>
        </td>
      </tr>`;
  }).join('');
}

/**
 * Pharmacy Orders Module
 */
function renderPharmacyOrders() {
  var tbody = document.getElementById('pharmacy-orders-rows');
  if (!tbody) return;

  var orders = STATE.pharmacyOrders || [];
  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-muted">No pharmacy orders logged yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(ord => {
    var recDate = ord.receivedDate || ord.orderDate || 'Pending';
    var isReceived = ord.status === 'RECEIVED' || ord.status === 'COMPLETED' || ord.status === 'Fully Received';
    var badgeClass = isReceived ? 'bg-success' : 'bg-warning text-dark';

    var itemsSummary = (ord.items || []).map(i => `${i.itemName} (${i.receivedQty || 0}/${i.orderedQty || 0})`).join(', ') || ord.itemName || 'Medication Order';

    return `
      <tr>
        <td><strong>#${ord.orderNumber || ord.id.slice(0, 8)}</strong></td>
        <td>${recDate}</td>
        <td>${ord.vendor || ord.pharmacy || 'Empower Pharmacy'}</td>
        <td>${itemsSummary}</td>
        <td class="text-center fw-bold">${ord.totalQty || (ord.items ? ord.items.reduce((s, i) => s + (i.orderedQty || 0), 0) : 10)}</td>
        <td>${ord.expDate || '—'}</td>
        <td><span class="fw-bold text-dark">${ord.staffName || ord.receivedBy || 'Staff'}</span></td>
        <td>0 days</td>
        <td><span class="badge ${badgeClass}">${ord.status || 'PENDING'}</span></td>
        <td class="text-end">
          <div class="btn-group">
            ${!isReceived ? `
              <button class="btn btn-sm btn-outline-success" onclick="openReceiveOrderModal('${ord.id}')">
                <i class="material-icons" style="font-size: 1rem;">done_all</i>
                <span>Receive</span>
              </button>
            ` : ''}
            <button class="btn btn-sm btn-outline-secondary" onclick="printOrderInvoice('${ord.id}')">
              <i class="material-icons" style="font-size: 1rem;">print</i>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

/**
 * 1-Click Import Data from Google Sheet
 */
async function importDataFromGoogleSheetUrl(webAppUrl) {
  if (!webAppUrl) {
    showToast('Please enter your Google Apps Script Web App URL.', 'warning');
    return;
  }

  showToast('Connecting to Google Sheet...', 'info');
  try {
    const res = await fetch(webAppUrl);
    const json = await res.json();
    if (json.status !== 'success' || !json.data) {
      throw new Error("Invalid response format from Google Sheet.");
    }

    const data = json.data;
    const batch = db.batch();
    let totalImported = 0;

    // 1. Import Inventory
    if (data.Inventory) {
      data.Inventory.forEach(row => {
        const docId = row.ID || `inv_${(row.Location || 'Tampa').toLowerCase()}_${(row['Item Name'] || '').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
        const ref = db.collection('inventory').doc(docId);
        batch.set(ref, {
          id: docId,
          itemName: row['Item Name'],
          category: row.Category || 'Weight Loss',
          vialSizeML: Number(row['ML Size'] || row['Vial Size (mL)'] || 0),
          unitsPerVial: Number(row['Total Units Per Vial'] || 100),
          closedCount: Number(row['Closed Count'] || row['Current Stock'] || 0),
          openCount: Number(row['Open Count'] || 0),
          location: row.Location || 'Tampa',
          defaultVendor: row['Default Vendor'] || 'Empower Pharmacy',
          vendorSku: row['Vendor SKU'] || '',
          barcode: row['Barcode / NDC'] || '',
          minThreshold: Number(row['Min Threshold'] || 3),
          lastUpdated: new Date().toISOString()
        }, { merge: true });
        totalImported++;
      });
    }

    // 2. Import Users
    if (data.Users) {
      data.Users.forEach(row => {
        const docId = row.ID || `user_${(row.Username || '').toLowerCase()}`;
        const ref = db.collection('users').doc(docId);
        batch.set(ref, {
          id: docId,
          username: row.Username,
          fullName: row['Full Name'] || row.Name,
          role: row.Role || 'Nurse',
          location: row.Location || 'All',
          status: 'ACTIVE'
        }, { merge: true });
        totalImported++;
      });
    }

    // 3. Import Orders
    if (data.PharmacyOrders) {
      data.PharmacyOrders.forEach(row => {
        const docId = row.ID || `ord_${row['Order Number'] || Date.now()}`;
        const ref = db.collection('pharmacyOrders').doc(docId);
        batch.set(ref, {
          id: docId,
          orderNumber: row['Order Number'],
          receivedDate: row['Received Date'] || row['Order Date'],
          staffName: row['Staff Name'] || row['Received By'],
          vendor: row['Pharmacy / Vendor'] || row.Vendor,
          location: row.Location || 'Tampa',
          status: row.Status || 'RECEIVED',
          totalAmount: Number(row['Total Cost'] || 0),
          createdAt: new Date().toISOString()
        }, { merge: true });
        totalImported++;
      });
    }

    await batch.commit();
    showToast(`🎉 Successfully imported ${totalImported} records from Google Sheets into Firebase!`, 'success');
    closeModal('syncGoogleSheetModal');
  } catch (err) {
    console.error('Error importing from Google Sheet:', err);
    showToast(`Import error: ${err.message}`, 'danger');
  }
}

/**
 * Toast Helper
 */
function showToast(msg, type = 'info') {
  var container = document.getElementById('toast-container');
  if (!container) return;

  var toastEl = document.createElement('div');
  toastEl.className = `toast align-items-center text-white bg-${type === 'danger' ? 'danger' : type === 'success' ? 'success' : type === 'warning' ? 'warning text-dark' : 'primary'} border-0 show stetho-toast mb-2`;
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body fw-medium">${msg}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" onclick="this.closest('.toast').remove()"></button>
    </div>`;

  container.appendChild(toastEl);
  setTimeout(() => toastEl.remove(), 4000);
}

function openModal(id) {
  if (modals[id]) modals[id].show();
  else {
    var el = document.getElementById(id);
    if (el) new bootstrap.Modal(el).show();
  }
}

function closeModal(id) {
  if (modals[id]) modals[id].hide();
  else {
    var el = document.getElementById(id);
    if (el) {
      var inst = bootstrap.Modal.getInstance(el);
      if (inst) inst.hide();
    }
  }
}
