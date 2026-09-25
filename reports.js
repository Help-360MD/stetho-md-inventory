/**
 * Stetho MD - Analytics Reports & Dashboard Metrics
 */

function updateDashboardMetrics() {
  const items = inventoryState.items || [];
  const openVials = inventoryState.openedVials || [];

  let totalClosed = 0;
  let totalOpen = openVials.length;
  let lowStockCount = 0;
  let totalUnits = 0;

  items.forEach(item => {
    const closed = Number(item.closedCount || 0);
    const unitsPerVial = Number(item.unitsPerVial || (item.vialSizeML ? item.vialSizeML * 100 : 100));
    totalClosed += closed;
    totalUnits += (closed * unitsPerVial);

    if (closed <= Number(item.minThreshold || 3)) {
      lowStockCount++;
    }
  });

  openVials.forEach(v => {
    totalUnits += Number(v.unitsRemaining || 0);
  });

  const totalClosedEl = document.getElementById('metric-total-closed');
  const totalOpenEl = document.getElementById('metric-total-open');
  const lowStockEl = document.getElementById('metric-low-stock');
  const totalUnitsEl = document.getElementById('metric-total-units');

  if (totalClosedEl) totalClosedEl.textContent = totalClosed.toLocaleString();
  if (totalOpenEl) totalOpenEl.textContent = totalOpen.toLocaleString();
  if (lowStockEl) lowStockEl.textContent = lowStockCount.toString();
  if (totalUnitsEl) totalUnitsEl.textContent = totalUnits.toLocaleString();
}

function renderAnalyticsReport() {
  const container = document.getElementById('analytics-content');
  if (!container) return;

  const items = inventoryState.items || [];
  const tampaItems = items.filter(i => i.location === 'Tampa');
  const zephyrItems = items.filter(i => i.location === 'Zephyrhills');

  container.innerHTML = `
    <div class="row g-4 mb-4">
      <div class="col-md-6">
        <div class="card glass-card p-4">
          <h5 class="fw-bold mb-3"><i class="bi bi-geo-alt-fill text-primary me-2"></i>Tampa Clinic Summary</h5>
          <div class="d-flex justify-content-between py-2 border-bottom">
            <span>Total Catalog Items:</span>
            <strong>${tampaItems.length}</strong>
          </div>
          <div class="d-flex justify-content-between py-2 border-bottom">
            <span>Total Sealed Vials:</span>
            <strong>${tampaItems.reduce((s, i) => s + Number(i.closedCount || 0), 0)}</strong>
          </div>
          <div class="d-flex justify-content-between py-2">
            <span>Active Open Vials:</span>
            <strong>${inventoryState.openedVials.filter(v => v.location === 'Tampa').length}</strong>
          </div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="card glass-card p-4">
          <h5 class="fw-bold mb-3"><i class="bi bi-geo-alt-fill text-info me-2"></i>Zephyrhills Clinic Summary</h5>
          <div class="d-flex justify-content-between py-2 border-bottom">
            <span>Total Catalog Items:</span>
            <strong>${zephyrItems.length}</strong>
          </div>
          <div class="d-flex justify-content-between py-2 border-bottom">
            <span>Total Sealed Vials:</span>
            <strong>${zephyrItems.reduce((s, i) => s + Number(i.closedCount || 0), 0)}</strong>
          </div>
          <div class="d-flex justify-content-between py-2">
            <span>Active Open Vials:</span>
            <strong>${inventoryState.openedVials.filter(v => v.location === 'Zephyrhills').length}</strong>
          </div>
        </div>
      </div>
    </div>`;
}
