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
  if (rl) rl.textContent = user.role === 'admin' ? 'Admin' : 'User';
}
