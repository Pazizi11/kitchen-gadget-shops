/* Shared admin utilities: auth guard, status badge rendering, item parsing */

(function guardAdminAccess() {
  if (!sessionStorage.getItem('kgs_admin_token')) {
    window.location.href = 'login.html';
  }
})();

function adminLogout() {
  sessionStorage.removeItem('kgs_admin_token');
  window.location.href = 'login.html';
}

const STATUS_CLASS_MAP = {
  'New': 'status-new',
  'Processing': 'status-processing',
  'Ordered on CJ': 'status-ordered',
  'Shipped': 'status-shipped',
  'Delivered': 'status-delivered',
  'Cancelled': 'status-cancelled'
};

function statusBadgeHtml(status) {
  const cls = STATUS_CLASS_MAP[status] || 'status-new';
  return '<span class="status-badge ' + cls + '">' + escapeHtml(status || 'New') + '</span>';
}

function parseOrderItems(order) {
  try { return JSON.parse(order.items || '[]'); } catch (e) { return []; }
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
