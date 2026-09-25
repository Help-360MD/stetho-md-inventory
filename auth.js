/**
 * Stetho MD - Authentication, RBAC & User Management Module
 */

let authState = {
  currentUser: null,
  users: [],
  unsubscriber: null
};

/**
 * Initializes Authentication State
 */
function initAuth() {
  const cached = localStorage.getItem('stetho_user_session');
  if (cached) {
    try {
      authState.currentUser = JSON.parse(cached);
      updateUserInterfaceForAuth();
    } catch (e) {}
  } else {
    // Default fallback demo user for testing before login
    authState.currentUser = {
      id: 'user_admin',
      username: 'admin',
      fullName: 'Dr. Smith (Admin)',
      role: 'Administrator',
      location: 'All'
    };
    updateUserInterfaceForAuth();
  }

  // Subscribe to users collection if admin
  if (db) {
    db.collection('users').onSnapshot(snapshot => {
      authState.users = [];
      snapshot.forEach(doc => {
        authState.users.push({ id: doc.id, ...doc.data() });
      });
      renderUsersTable();
    }, err => console.error('Error fetching users:', err));
  }
}

function getCurrentUser() {
  return authState.currentUser;
}

function loginUser(username, password) {
  const user = authState.users.find(u => u.username === username);
  if (!user || user.passwordHash !== password) {
    // Check demo credentials
    if (username === 'admin' && password === 'admin123') {
      authState.currentUser = { id: 'admin', username: 'admin', fullName: 'Dr. Smith', role: 'Administrator', location: 'All' };
    } else if (username === 'tampa_nurse' && password === 'nurse123') {
      authState.currentUser = { id: 'nurse1', username: 'tampa_nurse', fullName: 'Sarah Jenkins, RN', role: 'Nurse', location: 'Tampa' };
    } else {
      showToast('Invalid username or password.', 'danger');
      return false;
    }
  } else {
    authState.currentUser = user;
  }

  localStorage.setItem('stetho_user_session', JSON.stringify(authState.currentUser));
  updateUserInterfaceForAuth();
  showToast(`Welcome back, ${authState.currentUser.fullName}!`, 'success');
  closeModal('loginModal');
  return true;
}

function logoutUser() {
  localStorage.removeItem('stetho_user_session');
  authState.currentUser = null;
  location.reload();
}

function updateUserInterfaceForAuth() {
  const user = authState.currentUser;
  if (!user) return;

  const userNameEl = document.getElementById('sidebar-user-name');
  const userRoleEl = document.getElementById('sidebar-user-role');
  const userAvatarEl = document.getElementById('sidebar-user-avatar');

  if (userNameEl) userNameEl.textContent = user.fullName;
  if (userRoleEl) userRoleEl.textContent = `${user.role} (${user.location})`;
  if (userAvatarEl) userAvatarEl.textContent = user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  // Non-admins location enforcement
  if (user.role !== 'Administrator' && user.role !== 'Inventory Manager' && user.location !== 'All') {
    inventoryState.activeLocation = user.location;
    // Hide master view button
    const masterBtn = document.querySelector('[data-location="MASTER"]');
    if (masterBtn) masterBtn.style.display = 'none';
  }
}

function renderUsersTable() {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;

  if (authState.users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No staff users found.</td></tr>`;
    return;
  }

  let html = '';
  authState.users.forEach(u => {
    html += `
      <tr>
        <td class="fw-bold">${u.fullName}</td>
        <td><code>${u.username}</code></td>
        <td><span class="badge bg-primary-subtle text-primary">${u.role}</span></td>
        <td><span class="badge bg-info-subtle text-dark border">${u.location || 'All'}</span></td>
        <td><span class="badge bg-success">${u.status || 'ACTIVE'}</span></td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-danger" onclick="deleteUserDoc('${u.id}')"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`;
  });
  tbody.innerHTML = html;
}

async function createUserDoc(userData) {
  if (!db) return;
  try {
    const docRef = db.collection('users').doc();
    await docRef.set({
      id: docRef.id,
      ...userData,
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    });
    showToast('✅ Staff user created successfully.', 'success');
    closeModal('createUserModal');
  } catch (err) {
    showToast(`Error: ${err.message}`, 'danger');
  }
}

async function deleteUserDoc(userId) {
  if (!confirm('Are you sure you want to delete this staff user?')) return;
  if (!db) return;
  try {
    await db.collection('users').doc(userId).delete();
    showToast('User deleted.', 'info');
  } catch (err) {
    showToast(`Error: ${err.message}`, 'danger');
  }
}
