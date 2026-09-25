/**
 * Stetho MD - Patients, Clinical Cases & Timeline Module
 */

let casesState = {
  cases: [],
  patients: [],
  unsubscriber: null
};

function initRealtimeCases() {
  if (!db) return;

  db.collection('cases').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
    casesState.cases = [];
    snapshot.forEach(doc => {
      casesState.cases.push({ id: doc.id, ...doc.data() });
    });
    renderCasesTable();
  }, err => console.error('Error fetching cases:', err));
}

function renderCasesTable() {
  const tbody = document.getElementById('cases-table-body');
  if (!tbody) return;

  if (casesState.cases.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-5 text-muted">
          <i class="bi bi-folder2-open fs-1 d-block mb-2 text-secondary"></i>
          No clinical cases recorded yet.
        </td>
      </tr>`;
    return;
  }

  let html = '';
  casesState.cases.forEach(c => {
    html += `
      <tr>
        <td><strong>#${c.caseNumber || c.id.slice(0, 8)}</strong></td>
        <td>${c.patientName}</td>
        <td>${c.treatmentType || 'Weight Loss'}</td>
        <td><span class="badge bg-light text-dark border">${c.location || 'Tampa'}</span></td>
        <td>${new Date(c.createdAt).toLocaleDateString()}</td>
        <td><span class="badge bg-success">${c.status || 'ACTIVE'}</span></td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary" onclick="viewCaseDetails('${c.id}')"><i class="bi bi-eye"></i></button>
        </td>
      </tr>`;
  });
  tbody.innerHTML = html;
}

async function createNewCase(caseData) {
  if (!db) return;
  try {
    const docRef = db.collection('cases').doc();
    const caseNumber = `CASE-${Date.now().toString().slice(-4)}`;
    await docRef.set({
      id: docRef.id,
      caseNumber: caseNumber,
      ...caseData,
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    });
    showToast(`✅ Case #${caseNumber} created successfully.`, 'success');
    closeModal('newCaseModal');
  } catch (err) {
    showToast(`Error: ${err.message}`, 'danger');
  }
}
