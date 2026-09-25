/**
 * Stetho MD - Pharmacy Orders & Delivery Auto-Stocking Module
 * Real-time Firestore sync with partial delivery support and PDF receipt export.
 */

let ordersState = {
  orders: [],
  unsubscriber: null,
  activeFilter: 'ALL'
};

/**
 * Initializes real-time listener for pharmacy orders
 */
function initRealtimeOrders() {
  if (!db) return;

  if (ordersState.unsubscriber) {
    ordersState.unsubscriber();
  }

  ordersState.unsubscriber = db.collection('pharmacyOrders').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
    ordersState.orders = [];
    snapshot.forEach(doc => {
      ordersState.orders.push({ id: doc.id, ...doc.data() });
    });
    console.log(`⚡ [Realtime] Synced ${ordersState.orders.length} pharmacy orders.`);
    renderOrdersTable();
  }, err => {
    console.error('Firestore pharmacyOrders subscription error:', err);
  });
}

/**
 * Renders the Pharmacy Orders Table
 */
function renderOrdersTable() {
  const tbody = document.getElementById('orders-table-body');
  if (!tbody) return;

  let list = ordersState.orders;
  if (ordersState.activeFilter !== 'ALL') {
    list = list.filter(o => o.status === ordersState.activeFilter);
  }

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-5 text-muted">
          <i class="bi bi-truck fs-1 d-block mb-2 text-secondary"></i>
          No pharmacy orders found.
        </td>
      </tr>`;
    return;
  }

  let html = '';
  list.forEach(ord => {
    const receivedDateFormatted = ord.receivedDate ? new Date(ord.receivedDate).toLocaleDateString() : 'Pending';
    const isCompleted = ord.status === 'RECEIVED' || ord.status === 'COMPLETED';
    const isPartial = ord.status === 'PARTIALLY_RECEIVED';

    let statusBadge = `<span class="badge bg-warning text-dark">PENDING</span>`;
    if (isCompleted) statusBadge = `<span class="badge bg-success">RECEIVED</span>`;
    else if (isPartial) statusBadge = `<span class="badge bg-info text-dark">PARTIAL</span>`;

    // Summary of items
    const itemsSummary = (ord.items || []).map(i => {
      const rec = i.receivedQty !== undefined ? ` (Rec: ${i.receivedQty}/${i.orderedQty})` : ` (${i.orderedQty} vials)`;
      return `${i.itemName}${rec}`;
    }).join(', ');

    html += `
      <tr>
        <td><strong>#${ord.orderNumber || ord.id.slice(0, 8)}</strong></td>
        <td>${receivedDateFormatted}</td>
        <td>
          <div class="fw-bold">${ord.vendor || 'Empower Pharmacy'}</div>
          <small class="text-muted"><i class="bi bi-geo-alt me-1"></i>${ord.location || 'Tampa'}</small>
        </td>
        <td><span class="small">${itemsSummary}</span></td>
        <td><span class="fw-bold text-dark">${ord.staffName || ord.receivedBy || '—'}</span></td>
        <td>$${Number(ord.totalAmount || 0).toFixed(2)}</td>
        <td>${statusBadge}</td>
        <td class="text-end">
          <div class="btn-group">
            ${!isCompleted ? `
              <button class="btn btn-sm btn-outline-success" title="Receive Shipment / Partial Delivery" onclick="openReceiveOrderModal('${ord.id}')">
                <i class="bi bi-box-seam me-1"></i>Receive
              </button>
            ` : ''}
            <button class="btn btn-sm btn-outline-secondary" title="View & Print Order Invoice" onclick="printOrderInvoice('${ord.id}')">
              <i class="bi bi-printer"></i>
            </button>
          </div>
        </td>
      </tr>`;
  });

  tbody.innerHTML = html;
}

/**
 * Creates a new Pharmacy Order
 */
async function createPharmacyOrder(orderData) {
  if (!db) {
    showToast('Firestore not configured.', 'danger');
    return;
  }

  try {
    const orderRef = db.collection('pharmacyOrders').doc();
    const orderNumber = `ORD-${Date.now().toString().slice(-5)}`;

    const newOrder = {
      id: orderRef.id,
      orderNumber: orderNumber,
      receivedDate: orderData.receivedDate || new Date().toISOString().split('T')[0],
      staffName: orderData.staffName || 'Staff Member',
      vendor: orderData.vendor || 'Empower Pharmacy',
      location: orderData.location || 'Tampa',
      items: orderData.items || [],
      totalAmount: Number(orderData.totalAmount || 0),
      status: 'PENDING',
      notes: orderData.notes || '',
      createdAt: new Date().toISOString()
    };

    await orderRef.set(newOrder);
    showToast(`✅ Order #${orderNumber} created successfully!`, 'success');
    closeModal('newOrderModal');
  } catch (err) {
    console.error('Error creating order:', err);
    showToast(`Error: ${err.message}`, 'danger');
  }
}

/**
 * Records Received Delivery (Supports full and partial quantities, and auto-credits Closed Stock)
 */
async function receivePharmacyOrder(orderId, receivedItems, receivedByStaff, notes = '') {
  if (!db) return;

  try {
    const orderRef = db.collection('pharmacyOrders').doc(orderId);

    await db.runTransaction(async transaction => {
      const orderDoc = await transaction.get(orderRef);
      if (!orderDoc.exists) throw new Error("Order not found.");

      const orderData = orderDoc.data();
      const clinicLocation = orderData.location || 'Tampa';
      let allFullyReceived = true;

      const updatedItems = (orderData.items || []).map(existingItem => {
        const matchingReceived = receivedItems.find(r => r.itemName === existingItem.itemName);
        const newlyReceivedQty = matchingReceived ? Number(matchingReceived.receivedQty || 0) : 0;
        const totalReceived = Number(existingItem.receivedQty || 0) + newlyReceivedQty;

        if (totalReceived < Number(existingItem.orderedQty || 0)) {
          allFullyReceived = false;
        }

        return {
          ...existingItem,
          receivedQty: totalReceived
        };
      });

      // 1. Update Order status
      transaction.update(orderRef, {
        items: updatedItems,
        receivedBy: receivedByStaff || orderData.staffName,
        receivedDate: new Date().toISOString().split('T')[0],
        status: allFullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED',
        lastUpdated: new Date().toISOString()
      });

      // 2. Increment Closed Stock in Inventory & Log to OfficeStockLog
      for (const recItem of receivedItems) {
        const qtyToAdd = Number(recItem.receivedQty || 0);
        if (qtyToAdd > 0) {
          const invQuery = await db.collection('inventory')
            .where('itemName', '==', recItem.itemName)
            .where('location', '==', clinicLocation)
            .limit(1)
            .get();

          if (!invQuery.empty) {
            const itemDoc = invQuery.docs[0];
            const currentClosed = Number(itemDoc.data().closedCount || 0);
            
            transaction.update(itemDoc.ref, {
              closedCount: currentClosed + qtyToAdd,
              lastUpdated: new Date().toISOString()
            });

            // Log entry
            const logRef = db.collection('officeStockLog').doc();
            transaction.set(logRef, {
              id: logRef.id,
              timestamp: new Date().toISOString(),
              inventoryId: itemDoc.id,
              itemName: recItem.itemName,
              location: clinicLocation,
              changeType: 'ORDER_DELIVERY_RECEIVED',
              deltaClosed: qtyToAdd,
              notes: `Order #${orderData.orderNumber} received (+${qtyToAdd} sealed vials). Received by: ${receivedByStaff}`,
              user: receivedByStaff
            });
          }
        }
      }
    });

    showToast('✅ Order delivery received and closed inventory updated!', 'success');
    closeModal('receiveOrderModal');
  } catch (err) {
    console.error('Error receiving order:', err);
    showToast(`Error: ${err.message}`, 'danger');
  }
}

/**
 * Displays and prints the Order Invoice / Supply Log Paper
 */
function printOrderInvoice(orderId) {
  const order = ordersState.orders.find(o => o.id === orderId);
  if (!order) return;

  const container = document.getElementById('printable-order-container');
  if (!container) return;

  let itemsRows = '';
  (order.items || []).forEach((item, index) => {
    itemsRows += `
      <tr>
        <td>${index + 1}</td>
        <td><strong>${item.itemName}</strong></td>
        <td>${item.vendorSku || '—'}</td>
        <td class="text-center">${item.orderedQty || 0}</td>
        <td class="text-center fw-bold">${item.receivedQty !== undefined ? item.receivedQty : item.orderedQty}</td>
        <td class="text-end">$${Number(item.unitPrice || 0).toFixed(2)}</td>
        <td class="text-end">$${(Number(item.orderedQty || 0) * Number(item.unitPrice || 0)).toFixed(2)}</td>
      </tr>`;
  });

  container.innerHTML = `
    <div class="supply-order-log-paper p-4 mx-auto my-3">
      <div class="d-flex justify-content-between align-items-start border-bottom pb-3 mb-3">
        <div>
          <h3 class="fw-bold mb-1" style="color: #0369a1;">Stetho MD Pharmacy Supply Order</h3>
          <div class="text-muted">Clinic Location: <strong>${order.location || 'Tampa'}</strong></div>
          <div class="text-muted">Vendor: <strong>${order.vendor || 'Empower Pharmacy'}</strong></div>
        </div>
        <div class="text-end">
          <h5 class="fw-bold mb-1">Order #${order.orderNumber || order.id.slice(0, 8)}</h5>
          <div><strong>Received Date:</strong> ${order.receivedDate || 'Pending'}</div>
          <div><strong>Received By / Staff:</strong> ${order.receivedBy || order.staffName || '—'}</div>
          <div><strong>Status:</strong> <span class="badge bg-dark">${order.status}</span></div>
        </div>
      </div>

      <table class="supply-log-table mb-4">
        <thead>
          <tr>
            <th>#</th>
            <th>Item Description</th>
            <th>Vendor SKU</th>
            <th class="text-center">Ordered Qty</th>
            <th class="text-center">Received Qty</th>
            <th class="text-end">Unit Price</th>
            <th class="text-end">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
        <tfoot>
          <tr>
            <th colspan="6" class="text-end">Grand Total:</th>
            <th class="text-end fw-bold fs-6">$${Number(order.totalAmount || 0).toFixed(2)}</th>
          </tr>
        </tfoot>
      </table>

      <div class="row pt-4 border-top">
        <div class="col-6">
          <small class="text-muted d-block">Received By (Signature):</small>
          <div class="border-bottom border-dark mt-4" style="width: 250px;"></div>
          <small class="fw-bold">${order.receivedBy || order.staffName || 'Staff Member'}</small>
        </div>
        <div class="col-6 text-end">
          <small class="text-muted d-block">Verified & Reconciled Date:</small>
          <div class="mt-4 fw-bold">${new Date().toLocaleDateString()}</div>
        </div>
      </div>
    </div>`;

  window.print();
}
