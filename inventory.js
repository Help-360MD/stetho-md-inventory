/**
 * Stetho MD - In-Office Real-Time Inventory & Opened Vial Micro-Unit Engine
 * Powered by Firebase Firestore for sub-second multi-user synchronization.
 */

// In-Memory Real-Time State (Updated continuously via Firestore onSnapshot)
let inventoryState = {
  items: [],
  openedVials: [],
  transfers: [],
  auditLogs: [],
  activeLocation: 'Tampa', // 'Tampa', 'Zephyrhills', or 'MASTER'
  activeCategory: 'ALL',
  searchQuery: '',
  unsubscribers: []
};

/**
 * Initializes real-time Firestore listeners for Inventory, Opened Vials, Transfers & Logs
 */
function initRealtimeInventory() {
  if (!db) {
    console.warn('Firestore not connected. Running in offline/demo mode.');
    return;
  }

  // Detach previous listeners if any
  inventoryState.unsubscribers.forEach(unsub => unsub());
  inventoryState.unsubscribers = [];

  // 1. Subscribe to Inventory collection
  const unsubInv = db.collection('inventory').onSnapshot(snapshot => {
    inventoryState.items = [];
    snapshot.forEach(doc => {
      inventoryState.items.push({ id: doc.id, ...doc.data() });
    });
    console.log(`⚡ [Realtime] Synced ${inventoryState.items.length} inventory items.`);
    renderInventoryView();
    updateDashboardMetrics();
  }, err => {
    console.error('Firestore inventory subscription error:', err);
  });
  inventoryState.unsubscribers.push(unsubInv);

  // 2. Subscribe to Opened Vials collection (Active Vials)
  const unsubVials = db.collection('openedVials').where('status', '==', 'ACTIVE').onSnapshot(snapshot => {
    inventoryState.openedVials = [];
    snapshot.forEach(doc => {
      inventoryState.openedVials.push({ id: doc.id, ...doc.data() });
    });
    console.log(`⚡ [Realtime] Synced ${inventoryState.openedVials.length} active open vials.`);
    renderInventoryView();
  }, err => {
    console.error('Firestore openedVials subscription error:', err);
  });
  inventoryState.unsubscribers.push(unsubVials);

  // 3. Subscribe to Stock Transfers (Recent 50)
  const unsubTransfers = db.collection('stockTransfers').orderBy('timestamp', 'desc').limit(50).onSnapshot(snapshot => {
    inventoryState.transfers = [];
    snapshot.forEach(doc => {
      inventoryState.transfers.push({ id: doc.id, ...doc.data() });
    });
    renderTransfersTable();
  }, err => {
    console.error('Firestore stockTransfers subscription error:', err);
  });
  inventoryState.unsubscribers.push(unsubTransfers);

  // 4. Subscribe to Office Stock Audit Logs (Recent 50)
  const unsubLogs = db.collection('officeStockLog').orderBy('timestamp', 'desc').limit(50).onSnapshot(snapshot => {
    inventoryState.auditLogs = [];
    snapshot.forEach(doc => {
      inventoryState.auditLogs.push({ id: doc.id, ...doc.data() });
    });
    renderAuditLogsTable();
  }, err => {
    console.error('Firestore officeStockLog subscription error:', err);
  });
  inventoryState.unsubscribers.push(unsubLogs);
}

/**
 * Sets the active location filter and re-renders
 */
function setInventoryLocation(location) {
  const user = getCurrentUser();
  if (user && user.role !== 'Administrator' && user.role !== 'Inventory Manager') {
    // Non-admin staff are strictly locked to their assigned physical clinic
    if (user.location !== 'All' && location !== user.location) {
      showToast(`Access Restricted: You are assigned to ${user.location} clinic.`, 'warning');
      return;
    }
  }

  inventoryState.activeLocation = location;
  
  // Update location switcher UI
  document.querySelectorAll('.btn-loc-switcher').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.location === location);
    btn.classList.toggle('btn-stetho-primary', btn.dataset.location === location);
    btn.classList.toggle('btn-outline-secondary', btn.dataset.location !== location);
  });

  renderInventoryView();
}

/**
 * Sets the active category filter and re-renders
 */
function setInventoryCategory(category) {
  inventoryState.activeCategory = category;
  document.querySelectorAll('.btn-cat-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === category);
    btn.classList.toggle('btn-dark', btn.dataset.category === category);
    btn.classList.toggle('btn-outline-secondary', btn.dataset.category !== category);
  });
  renderInventoryView();
}

/**
 * Main Render Router for Inventory View
 */
function renderInventoryView() {
  const loc = inventoryState.activeLocation;
  const isMaster = (loc === 'MASTER');

  const regularView = document.getElementById('location-inventory-view');
  const masterView = document.getElementById('master-inventory-view');
  const titleBadge = document.getElementById('inventory-current-location-badge');

  if (titleBadge) {
    titleBadge.textContent = isMaster ? 'Master Overview (Tampa + Zephyrhills)' : `${loc} Clinic Inventory`;
  }

  if (isMaster) {
    if (regularView) regularView.style.display = 'none';
    if (masterView) masterView.style.display = 'block';
    renderMasterInventoryTable();
  } else {
    if (masterView) masterView.style.display = 'none';
    if (regularView) regularView.style.display = 'block';
    renderLocationInventoryTable();
  }
}

/**
 * Renders Single-Location Inventory Table with Opened Vial Micro-Unit Progress
 */
function renderLocationInventoryTable() {
  const tbody = document.getElementById('inventory-table-body');
  if (!tbody) return;

  const loc = inventoryState.activeLocation;
  const cat = inventoryState.activeCategory;
  const query = inventoryState.searchQuery.toLowerCase();
  const user = getCurrentUser();
  const canManage = user && (user.role === 'Administrator' || user.role === 'Inventory Manager');

  let items = inventoryState.items.filter(item => item.location === loc);

  if (cat !== 'ALL') {
    items = items.filter(item => item.category === cat);
  }
  if (query) {
    items = items.filter(item => 
      item.itemName.toLowerCase().includes(query) || 
      (item.barcode && item.barcode.includes(query)) ||
      (item.vendorSku && item.vendorSku.toLowerCase().includes(query))
    );
  }

  if (items.length === 0) {
    const isTotallyEmpty = inventoryState.items.length === 0;
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-5 text-muted">
          <i class="bi bi-inbox fs-1 d-block mb-2 text-secondary"></i>
          <div>No inventory items found for <strong>${loc}</strong> under category <strong>${cat}</strong>.</div>
          ${isTotallyEmpty ? `
            <div class="mt-3">
              <button class="btn btn-sm btn-primary" onclick="triggerDatabaseSeed()">
                <i class="bi bi-database-gear me-1"></i>Seed Clinic Catalog (Tampa & Zephyrhills)
              </button>
            </div>
          ` : ''}
        </td>
      </tr>`;
    return;
  }

  let html = '';
  items.forEach(item => {
    // Find active open vials for this item
    const openVials = inventoryState.openedVials.filter(v => v.inventoryId === item.id);
    const totalOpenRemainingUnits = openVials.reduce((sum, v) => sum + Number(v.unitsRemaining || 0), 0);
    const unitsPerVial = Number(item.unitsPerVial || (item.vialSizeML ? item.vialSizeML * 100 : 100));
    const totalAvailableUnits = (Number(item.closedCount || 0) * unitsPerVial) + totalOpenRemainingUnits;

    const isLowStock = Number(item.closedCount || 0) <= Number(item.minThreshold || 3);

    // Build Open Vials cards
    let openVialsHtml = '';
    if (openVials.length === 0) {
      openVialsHtml = `<span class="badge badge-zero-stock">0 Active Open</span>`;
    } else {
      openVials.forEach(v => {
        const remaining = Number(v.unitsRemaining || 0);
        const capacity = Number(v.totalUnits || unitsPerVial);
        const pct = Math.min(100, Math.max(0, Math.round((remaining / capacity) * 100)));
        let colorClass = 'bg-success';
        if (pct <= 25) colorClass = 'bg-danger';
        else if (pct <= 50) colorClass = 'bg-warning';

        openVialsHtml += `
          <div class="vial-card-pill">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="badge bg-success-subtle text-success border border-success-subtle fw-bold" style="font-size: 0.75rem;">
                <i class="bi bi-droplet-half me-1"></i>Vial #${v.id.slice(-4)}
              </span>
              <span class="fw-bold text-dark" style="font-size: 0.8rem;">${remaining} / ${capacity} u (${pct}%)</span>
            </div>
            <div class="vial-progress-container">
              <div class="vial-progress-bar ${colorClass}" style="width: ${pct}%;"></div>
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
            ${item.vialSizeML ? `<span class="me-2"><i class="bi bi-box me-1"></i>${item.vialSizeML} mL (${unitsPerVial} u)</span>` : ''}
            ${item.barcode ? `<span class="text-muted"><i class="bi bi-upc-scan me-1"></i>${item.barcode}</span>` : ''}
          </div>
        </td>
        <td>
          <span class="badge badge-closed-stock ${isLowStock ? 'border-danger text-danger bg-danger-subtle' : ''}">
            ${item.closedCount || 0} Sealed
          </span>
          ${isLowStock ? '<div class="text-danger fw-bold mt-1" style="font-size: 0.7rem;"><i class="bi bi-exclamation-triangle-fill me-1"></i>Low Stock</div>' : ''}
        </td>
        <td style="min-width: 200px;">
          ${openVialsHtml}
        </td>
        <td>
          <div class="fw-bold text-dark">${totalAvailableUnits.toLocaleString()} units</div>
          <small class="text-muted">(${item.closedCount || 0} sealed + ${totalOpenRemainingUnits} open)</small>
        </td>
        <td>
          <span class="small text-muted d-block">${item.defaultVendor || 'Empower Pharmacy'}</span>
          <code class="small text-secondary">${item.vendorSku || '—'}</code>
        </td>
        <td class="text-end">
          <div class="btn-group">
            <button class="btn btn-sm btn-outline-success" title="Open New Vial" onclick="promptOpenVial('${item.id}', '${item.itemName}')">
              <i class="bi bi-box-arrow-up-right me-1"></i>Open Vial
            </button>
            <button class="btn btn-sm btn-outline-secondary" title="Quick Count Audit" onclick="openSingleAuditModal('${item.id}')">
              <i class="bi bi-clipboard-check"></i>
            </button>
            ${canManage ? `
              <button class="btn btn-sm btn-outline-primary" title="Edit Catalog Item" onclick="openEditItemModal('${item.id}')">
                <i class="bi bi-pencil"></i>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>`;
  });

  tbody.innerHTML = html;
}

/**
 * Renders Aggregated Master Inventory View with Interactive Popover Tooltips
 */
function renderMasterInventoryTable() {
  const tbody = document.getElementById('master-inventory-table-body');
  if (!tbody) return;

  const cat = inventoryState.activeCategory;
  const query = inventoryState.searchQuery.toLowerCase();

  // Group items across Tampa and Zephyrhills by itemName
  const grouped = {};

  inventoryState.items.forEach(item => {
    const key = item.itemName;
    if (!grouped[key]) {
      grouped[key] = {
        itemName: item.itemName,
        category: item.category,
        vialSizeML: item.vialSizeML,
        unitsPerVial: Number(item.unitsPerVial || (item.vialSizeML ? item.vialSizeML * 100 : 100)),
        defaultVendor: item.defaultVendor,
        vendorSku: item.vendorSku,
        barcode: item.barcode,
        tampa: { closed: 0, open: 0, openUnits: 0, totalUnits: 0, itemId: null },
        zephyr: { closed: 0, open: 0, openUnits: 0, totalUnits: 0, itemId: null }
      };
    }

    const targetLoc = item.location === 'Tampa' ? grouped[key].tampa : grouped[key].zephyr;
    targetLoc.closed = Number(item.closedCount || 0);
    targetLoc.itemId = item.id;

    // Calculate active open vial units for this item
    const openVials = inventoryState.openedVials.filter(v => v.inventoryId === item.id);
    targetLoc.open = openVials.length;
    targetLoc.openUnits = openVials.reduce((sum, v) => sum + Number(v.unitsRemaining || 0), 0);
    targetLoc.totalUnits = (targetLoc.closed * grouped[key].unitsPerVial) + targetLoc.openUnits;
  });

  let productKeys = Object.keys(grouped);

  if (cat !== 'ALL') {
    productKeys = productKeys.filter(key => grouped[key].category === cat);
  }
  if (query) {
    productKeys = productKeys.filter(key => 
      key.toLowerCase().includes(query) || 
      (grouped[key].barcode && grouped[key].barcode.includes(query))
    );
  }

  if (productKeys.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-5 text-muted">
          <i class="bi bi-inbox fs-1 d-block mb-2 text-secondary"></i>
          No products found in Master Inventory.
        </td>
      </tr>`;
    return;
  }

  let html = '';
  productKeys.forEach(key => {
    const prod = grouped[key];
    const totalClosed = prod.tampa.closed + prod.zephyr.closed;
    const totalOpen = prod.tampa.open + prod.zephyr.open;
    const totalUnits = prod.tampa.totalUnits + prod.zephyr.totalUnits;

    html += `
      <tr class="hover-master-row">
        <td>
          <div class="product-hover-trigger">
            <span class="fw-bold text-dark text-decoration-underline">${prod.itemName}</span>
            
            <!-- Interactive Hover Popover Tooltip -->
            <div class="inventory-hover-tooltip">
              <div class="fw-bold border-bottom border-secondary pb-1 mb-2 text-info">
                <i class="bi bi-geo-alt-fill me-1"></i>${prod.itemName} Breakdown
              </div>
              <div class="row g-2 mb-2">
                <div class="col-6">
                  <div class="text-uppercase text-muted" style="font-size: 0.7rem;">Tampa Clinic</div>
                  <div class="text-white fw-bold">${prod.tampa.closed} sealed, ${prod.tampa.open} open</div>
                  <div class="text-info fw-semibold">${prod.tampa.totalUnits.toLocaleString()} units</div>
                </div>
                <div class="col-6">
                  <div class="text-uppercase text-muted" style="font-size: 0.7rem;">Zephyrhills Clinic</div>
                  <div class="text-white fw-bold">${prod.zephyr.closed} sealed, ${prod.zephyr.open} open</div>
                  <div class="text-info fw-semibold">${prod.zephyr.totalUnits.toLocaleString()} units</div>
                </div>
              </div>
              <div class="border-top border-secondary pt-1 text-light d-flex justify-content-between">
                <span>Grand Total:</span>
                <span class="fw-bold text-warning">${totalUnits.toLocaleString()} units</span>
              </div>
            </div>
          </div>
          <div class="small text-muted">${prod.category} &bull; ${prod.vialSizeML ? `${prod.vialSizeML} mL (${prod.unitsPerVial} u)` : 'Item'}</div>
        </td>
        <td>
          <div class="fw-semibold text-dark">${prod.tampa.closed} sealed <span class="text-muted">(${prod.tampa.open} open)</span></div>
          <div class="small text-info fw-bold">${prod.tampa.totalUnits.toLocaleString()} u</div>
        </td>
        <td>
          <div class="fw-semibold text-dark">${prod.zephyr.closed} sealed <span class="text-muted">(${prod.zephyr.open} open)</span></div>
          <div class="small text-info fw-bold">${prod.zephyr.totalUnits.toLocaleString()} u</div>
        </td>
        <td>
          <span class="badge bg-primary fs-6 px-2 py-1">${totalClosed} Sealed</span>
          <span class="badge bg-success-subtle text-success border border-success ms-1">${totalOpen} Open</span>
        </td>
        <td>
          <div class="fw-bold text-dark fs-6">${totalUnits.toLocaleString()} units</div>
        </td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary" title="Transfer Stock Between Clinics" onclick="openTransferModalForProduct('${prod.itemName}')">
            <i class="bi bi-arrow-left-right me-1"></i>Transfer
          </button>
        </td>
      </tr>`;
  });

  tbody.innerHTML = html;
}

/**
 * Opens a New Sealed Vial (Atomically decrements closed count, increments open count, initializes openedVials)
 */
async function openNewVial(inventoryId, notes = '') {
  if (!db) {
    showToast('Cannot open vial: Firestore is not configured.', 'danger');
    return;
  }

  const user = getCurrentUser();
  const userName = user ? user.fullName : 'Staff Member';

  try {
    const invRef = db.collection('inventory').doc(inventoryId);
    
    await db.runTransaction(async transaction => {
      const invDoc = await transaction.get(invRef);
      if (!invDoc.exists) throw new Error("Inventory item not found.");
      
      const invData = invDoc.data();
      const currentClosed = Number(invData.closedCount || 0);
      if (currentClosed <= 0) {
        throw new Error("No sealed vials available in closed stock to open.");
      }

      const currentOpen = Number(invData.openCount || 0);
      const unitsPerVial = Number(invData.unitsPerVial || (invData.vialSizeML ? invData.vialSizeML * 100 : 100));

      // 1. Decrement closed count, increment open count
      transaction.update(invRef, {
        closedCount: currentClosed - 1,
        openCount: currentOpen + 1,
        lastUpdated: new Date().toISOString()
      });

      // 2. Create row in openedVials
      const vialRef = db.collection('openedVials').doc();
      transaction.set(vialRef, {
        id: vialRef.id,
        inventoryId: inventoryId,
        itemName: invData.itemName,
        location: invData.location,
        vialSizeML: invData.vialSizeML || 0,
        totalUnits: unitsPerVial,
        unitsRemaining: unitsPerVial,
        dateOpened: new Date().toISOString(),
        openedBy: userName,
        status: 'ACTIVE',
        notes: notes || 'Opened for clinic usage'
      });

      // 3. Log to officeStockLog
      const logRef = db.collection('officeStockLog').doc();
      transaction.set(logRef, {
        id: logRef.id,
        timestamp: new Date().toISOString(),
        inventoryId: inventoryId,
        itemName: invData.itemName,
        location: invData.location,
        previousClosed: currentClosed,
        newClosed: currentClosed - 1,
        previousOpen: currentOpen,
        newOpen: currentOpen + 1,
        changeType: 'VIAL_OPENED',
        deltaClosed: -1,
        deltaOpen: +1,
        notes: notes || `Vial unsealed (${unitsPerVial} units initialized)`,
        user: userName
      });
    });

    showToast('✅ Vial unsealed successfully! Units initialized in active stock.', 'success');
  } catch (err) {
    console.error('Error opening vial:', err);
    showToast(`Error: ${err.message}`, 'danger');
  }
}

/**
 * Deducts micro-units used from an active open vial (e.g. 200 - 35 = 165 units)
 */
async function useUnitsFromOpenVial(vialId, unitsUsed, patientName = '', notes = '') {
  if (!db) {
    showToast('Cannot deduct units: Firestore not configured.', 'danger');
    return;
  }

  const user = getCurrentUser();
  const userName = user ? user.fullName : 'Staff Member';
  const unitsToDeduct = Number(unitsUsed);

  if (isNaN(unitsToDeduct) || unitsToDeduct <= 0) {
    showToast('Please enter a valid positive number of units.', 'warning');
    return;
  }

  try {
    const vialRef = db.collection('openedVials').doc(vialId);

    await db.runTransaction(async transaction => {
      const vialDoc = await transaction.get(vialRef);
      if (!vialDoc.exists) throw new Error("Active open vial not found.");

      const vialData = vialDoc.data();
      const currentUnits = Number(vialData.unitsRemaining || 0);

      if (unitsToDeduct > currentUnits) {
        throw new Error(`Cannot deduct ${unitsToDeduct} units. Vial only has ${currentUnits} units remaining.`);
      }

      const remainingUnits = currentUnits - unitsToDeduct;
      const isDepleted = (remainingUnits === 0);

      // 1. Update OpenedVial document
      transaction.update(vialRef, {
        unitsRemaining: remainingUnits,
        status: isDepleted ? 'DEPLETED' : 'ACTIVE',
        lastUsed: new Date().toISOString()
      });

      // 2. If depleted, update parent inventory openCount
      const invRef = db.collection('inventory').doc(vialData.inventoryId);
      const invDoc = await transaction.get(invRef);
      if (invDoc.exists && isDepleted) {
        const invData = invDoc.data();
        transaction.update(invRef, {
          openCount: Math.max(0, Number(invData.openCount || 1) - 1),
          lastUpdated: new Date().toISOString()
        });
      }

      // 3. Log to dispenseLog
      const dispenseRef = db.collection('dispenseLog').doc();
      transaction.set(dispenseRef, {
        id: dispenseRef.id,
        timestamp: new Date().toISOString(),
        patientName: patientName || 'In-Office Patient',
        itemName: vialData.itemName,
        location: vialData.location,
        vialSource: `Open Vial #${vialId.slice(-4)}`,
        doseAmount: unitsToDeduct,
        doseUnit: 'units',
        openVialId: vialId,
        unitsRemainingAfter: remainingUnits,
        administeredBy: userName,
        notes: notes || `Dose administered (${unitsToDeduct}u)`
      });

      // 4. Log to officeStockLog
      const logRef = db.collection('officeStockLog').doc();
      transaction.set(logRef, {
        id: logRef.id,
        timestamp: new Date().toISOString(),
        inventoryId: vialData.inventoryId,
        itemName: vialData.itemName,
        location: vialData.location,
        changeType: isDepleted ? 'VIAL_DEPLETED' : 'UNIT_USAGE',
        notes: `Deducted ${unitsToDeduct} units (${currentUnits} -> ${remainingUnits} u). ${isDepleted ? 'Vial fully depleted.' : ''}`,
        user: userName
      });
    });

    showToast(`✅ Recorded ${unitsToDeduct} units used. Remaining: ${unitsUsed} units.`, 'success');
    closeModal('useUnitsModal');
  } catch (err) {
    console.error('Error using units:', err);
    showToast(`Error: ${err.message}`, 'danger');
  }
}

/**
 * Transfers sealed stock between Tampa and Zephyrhills clinics
 */
async function transferStock(inventoryId, sourceLocation, destinationLocation, quantity, notes = '') {
  if (!db) {
    showToast('Cannot transfer stock: Firestore not configured.', 'danger');
    return;
  }

  const user = getCurrentUser();
  const userName = user ? user.fullName : 'Admin User';
  const qty = parseInt(quantity, 10);

  if (isNaN(qty) || qty <= 0) {
    showToast('Please enter a valid transfer quantity.', 'warning');
    return;
  }
  if (sourceLocation === destinationLocation) {
    showToast('Source and destination clinics must be different.', 'warning');
    return;
  }

  try {
    const srcDocRef = db.collection('inventory').doc(inventoryId);
    
    await db.runTransaction(async transaction => {
      const srcDoc = await transaction.get(srcDocRef);
      if (!srcDoc.exists) throw new Error("Source inventory item not found.");

      const srcData = srcDoc.data();
      const srcClosed = Number(srcData.closedCount || 0);

      if (srcClosed < qty) {
        throw new Error(`Insufficient stock in ${sourceLocation}. Available: ${srcClosed}, Requested: ${qty}`);
      }

      // Find destination item by matching itemName
      const destQuery = await db.collection('inventory')
        .where('itemName', '==', srcData.itemName)
        .where('location', '==', destinationLocation)
        .limit(1)
        .get();

      let destDocRef;
      let destClosed = 0;

      if (!destQuery.empty) {
        destDocRef = destQuery.docs[0].ref;
        destClosed = Number(destQuery.docs[0].data().closedCount || 0);
      } else {
        // Create destination item if not already present
        destDocRef = db.collection('inventory').doc(`inv_${destinationLocation.toLowerCase()}_${srcData.itemName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`);
      }

      // 1. Decrement source closed stock
      transaction.update(srcDocRef, {
        closedCount: srcClosed - qty,
        lastUpdated: new Date().toISOString()
      });

      // 2. Increment destination closed stock
      if (!destQuery.empty) {
        transaction.update(destDocRef, {
          closedCount: destClosed + qty,
          lastUpdated: new Date().toISOString()
        });
      } else {
        transaction.set(destDocRef, {
          ...srcData,
          id: destDocRef.id,
          location: destinationLocation,
          closedCount: qty,
          openCount: 0,
          openUnitsRemaining: 0,
          lastUpdated: new Date().toISOString()
        });
      }

      // 3. Record in stockTransfers
      const transferRef = db.collection('stockTransfers').doc();
      const transferId = `TRF-${Date.now().toString().slice(-4)}`;
      transaction.set(transferRef, {
        id: transferRef.id,
        transferId: transferId,
        timestamp: new Date().toISOString(),
        inventoryId: inventoryId,
        itemName: srcData.itemName,
        sourceLocation: sourceLocation,
        destinationLocation: destinationLocation,
        quantity: qty,
        transferredBy: userName,
        status: 'COMPLETED',
        notes: notes || 'Cross-clinic stock balancing'
      });

      // 4. Log to officeStockLog
      const logRef = db.collection('officeStockLog').doc();
      transaction.set(logRef, {
        id: logRef.id,
        timestamp: new Date().toISOString(),
        inventoryId: inventoryId,
        itemName: srcData.itemName,
        location: `${sourceLocation} -> ${destinationLocation}`,
        changeType: 'STOCK_TRANSFER',
        deltaClosed: -qty,
        notes: `Transferred ${qty} vials from ${sourceLocation} to ${destinationLocation}. ${notes}`,
        user: userName
      });
    });

    showToast(`✅ Successfully transferred ${qty} vials to ${destinationLocation}!`, 'success');
    closeModal('transferStockModal');
  } catch (err) {
    console.error('Error transferring stock:', err);
    showToast(`Error: ${err.message}`, 'danger');
  }
}

/**
 * Saves or updates a catalog item
 */
async function saveInventoryItem(itemData) {
  if (!db) {
    showToast('Firestore not configured.', 'danger');
    return;
  }

  try {
    const docId = itemData.id || `inv_${itemData.location.toLowerCase()}_${itemData.itemName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
    const invRef = db.collection('inventory').doc(docId);
    
    // Auto-compute units per vial based on mL size ($1 mL = 100 units$)
    let unitsPerVial = Number(itemData.unitsPerVial);
    if (!unitsPerVial && itemData.vialSizeML) {
      unitsPerVial = Number(itemData.vialSizeML) * 100;
    }

    await invRef.set({
      ...itemData,
      id: docId,
      unitsPerVial: unitsPerVial || 100,
      lastUpdated: new Date().toISOString()
    }, { merge: true });

    showToast('✅ Inventory item saved successfully.', 'success');
    closeModal('editItemModal');
  } catch (err) {
    console.error('Error saving inventory item:', err);
    showToast(`Error: ${err.message}`, 'danger');
  }
}

/**
 * Performs a Count Audit for an item
 */
async function performCountAudit(inventoryId, closedCount, openCount, notes = '') {
  if (!db) return;
  const user = getCurrentUser();
  const userName = user ? user.fullName : 'Staff Member';

  try {
    const invRef = db.collection('inventory').doc(inventoryId);
    const invDoc = await invRef.get();
    if (!invDoc.exists) throw new Error("Item not found");

    const invData = invDoc.data();
    const prevClosed = Number(invData.closedCount || 0);
    const prevOpen = Number(invData.openCount || 0);

    await invRef.update({
      closedCount: Number(closedCount),
      openCount: Number(openCount),
      lastUpdated: new Date().toISOString()
    });

    await db.collection('officeStockLog').add({
      timestamp: new Date().toISOString(),
      inventoryId: inventoryId,
      itemName: invData.itemName,
      location: invData.location,
      previousClosed: prevClosed,
      newClosed: Number(closedCount),
      previousOpen: prevOpen,
      newOpen: Number(openCount),
      changeType: 'PHYSICAL_AUDIT',
      deltaClosed: Number(closedCount) - prevClosed,
      deltaOpen: Number(openCount) - prevOpen,
      notes: notes || 'Physical shift count audit',
      user: userName
    });

    showToast('✅ Count audit saved successfully.', 'success');
    closeModal('singleAuditModal');
  } catch (err) {
    console.error('Error performing audit:', err);
    showToast(`Error: ${err.message}`, 'danger');
  }
}

/**
 * Render Stock Transfers table
 */
function renderTransfersTable() {
  const tbody = document.getElementById('transfers-table-body');
  if (!tbody) return;

  if (inventoryState.transfers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No transfer history recorded.</td></tr>`;
    return;
  }

  let html = '';
  inventoryState.transfers.forEach(t => {
    html += `
      <tr>
        <td><code>${t.transferId || t.id.slice(0, 8)}</code></td>
        <td>${new Date(t.timestamp).toLocaleString()}</td>
        <td class="fw-bold">${t.itemName}</td>
        <td><span class="badge bg-secondary">${t.sourceLocation}</span> &rarr; <span class="badge bg-info text-dark">${t.destinationLocation}</span></td>
        <td class="fw-bold">${t.quantity} vials</td>
        <td>${t.transferredBy}</td>
        <td><span class="badge bg-success">${t.status}</span></td>
      </tr>`;
  });
  tbody.innerHTML = html;
}

/**
 * Render Audit Logs table
 */
function renderAuditLogsTable() {
  const tbody = document.getElementById('audit-logs-table-body');
  if (!tbody) return;

  if (inventoryState.auditLogs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No stock logs found.</td></tr>`;
    return;
  }

  let html = '';
  inventoryState.auditLogs.forEach(log => {
    html += `
      <tr>
        <td>${new Date(log.timestamp).toLocaleString()}</td>
        <td class="fw-bold">${log.itemName || '—'}</td>
        <td><span class="badge bg-light text-dark border">${log.location || '—'}</span></td>
        <td><span class="badge bg-primary-subtle text-primary">${log.changeType || 'LOG'}</span></td>
        <td>${log.notes || '—'}</td>
        <td>${log.user || 'System'}</td>
      </tr>`;
  });
  tbody.innerHTML = html;
}
