function getSession() {
  try { return JSON.parse(sessionStorage.getItem('folioUser')); } catch { return null; }
}
function saveSession(user) {
  sessionStorage.setItem('folioUser', JSON.stringify(user));
}
function clearSession() {
  sessionStorage.removeItem('folioUser');
}
function requireAuth(requiredRole) {
  const user = getSession();
  if (!user) { location.href = 'index.html'; return null; }
  if (requiredRole) {
    const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!allowed.includes(user.role)) { location.href = 'index.html'; return null; }
  }
  return user;
}
function logout() {
  clearSession();
  location.href = 'index.html';
}
function setNavUser(user) {
  const el = document.getElementById('navUserName');
  const rl = document.getElementById('navRole');
  if (el) el.textContent = user.displayName || user.username;
  const roleLabel = { admin: 'Admin', staff: 'Staff', user: 'User' };
  if (rl) rl.textContent = roleLabel[user.role] || user.role;
}

// สร้าง nav tabs ตาม role
function buildNavTabs(activePage) {
  const user = getSession();
  if (!user) return '';
  const isAdmin = user.role === 'admin';
  const isStaff = user.role === 'staff';

  const tabs = [];
  if (isAdmin || isStaff) {
    tabs.push({ href: 'admin-today.html',  label: '📋 งานวันนี้',     id: 'today'  });
    tabs.push({ href: 'admin-assign.html', label: '📝 มอบหมายงาน',   id: 'assign' });
  }
  if (isAdmin) {
    tabs.push({ href: 'admin-summary.html', label: '📊 สรุปผล',       id: 'summary' });
    tabs.push({ href: 'admin-base.html',    label: '⚙️ จัดการระบบ',   id: 'base'   });
    tabs.push({ href: 'admin-users.html',   label: '👤 จัดการ User',  id: 'users'  });
  }

  return tabs.map(t =>
    `<a href="${t.href}" class="tab-link${activePage === t.id ? ' active' : ''}">${t.label}</a>`
  ).join('');
}

function renderNav(activePage) {
  const el = document.getElementById('navTabs');
  if (el) el.innerHTML = buildNavTabs(activePage);
}
