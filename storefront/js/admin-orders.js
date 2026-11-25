/* Admin Orders page: list, filter, and CJ Dropshipping reorder workflow */

let ALL_ORDERS = [];

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function matchesFilters(o, search, status, cj) {
  if (status && o.order_status !== status) return false;
  if (cj === 'pending' && o.cj_order_placed) return false;
  if (cj === 'done' && !o.cj_order_placed) return false;
  if (search) {
    const hay = ((o.order_number || '') + ' ' + (o.customer_name || '') + ' ' + (o.customer_email || '')).toLowerCase();
    if (!hay.includes(search.toLowerCase())) return false;
  }
  return true;
}

function renderOrdersTable() {
  const search = document.getElementById('orderSearch').value.trim();
  const status = document.getElementById('statusFilter').value;
  const cj = document.getElementById('cjFilter').value;

  const filtered = ALL_ORDERS
    .filter(function (o) { return matchesFilters(o, search, status, cj); })
    .sort(function (a, b) { return (b.created_at || 0) - (a.created_at || 0); });

  const body = document.getElementById('ordersTableBody');
  if (filtered.length === 0) {
    body.innerHTML = '<tr class="empty-row"><td colspan="9">No orders match your filters.</td></tr>';
    return;
  }

  body.innerHTML = filtered.map(function (o) {
    const items = parseOrderItems(o);
    return (
      '<tr>' +
      '  <td><strong>' + escapeHtml(o.order_number || '') + '</strong></td>' +
      '  <td>' + escapeHtml(o.customer_name || '') + '<br><span style="color:var(--color-muted);font-size:0.78rem;">' + escapeHtml(o.customer_email || '') + '</span></td>' +
      '  <td>' + items.length + '</td>' +
      '  <td>' + formatMoney(o.total || 0) + '</td>' +
      '  <td>' + escapeHtml(o.payment_method || '') + '</td>' +
      '  <td>' + formatDate(o.created_at) + '</td>' +
      '  <td>' + statusBadgeHtml(o.order_status) + '</td>' +
      '  <td>' + (o.cj_order_placed ? '<span class="cj-badge-yes"><i class="fa-solid fa-circle-check"></i> Yes</span>' : '<span class="cj-badge-no"><i class="fa-solid fa-circle-exclamation"></i> No</span>') + '</td>' +
      '  <td><button class="table-action-btn" onclick="openOrderModal(\'' + o.id + '\')">View / Reorder</button></td>' +
      '</tr>'
    );
  }).join('');
}

function openOrderModal(orderId) {
  const order = ALL_ORDERS.find(function (o) { return o.id === orderId; });
  if (!order) return;
  const items = parseOrderItems(order);

  const itemsHtml = items.map(function (item) {
    const cjUrl = item.cj_product_url || '#';
    const hasCj = !!item.cj_product_url;
    return (
      '<div class="modal-item-row">' +
      '  <img src="' + (item.image_url || '') + '" alt="' + escapeHtml(item.name || '') + '">' +
      '  <div class="info">' +
      '    <div><strong>' + escapeHtml(item.name || '') + '</strong></div>' +
      '    <div>Qty: ' + item.qty + ' × ' + formatMoney(item.price) + ' = ' + formatMoney(item.qty * item.price) + '</div>' +
      '    <div style="color:var(--color-muted);">SKU: ' + escapeHtml(item.sku || '—') + '</div>' +
      '  </div>' +
      (hasCj ?
        '  <a href="' + cjUrl + '" target="_blank" class="btn btn-sm btn-secondary">Open on CJ <i class="fa-solid fa-arrow-up-right-from-square"></i></a>' :
        '  <span style="font-size:0.78rem;color:var(--color-danger);">No CJ link set</span>') +
      '</div>'
    );
  }).join('');

  const content =
    '<div style="margin-bottom:16px;">' +
    '  <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;">' +
    '    <div><strong style="font-size:1.1rem;">' + escapeHtml(order.order_number || '') + '</strong></div>' +
    '    <div>' + statusBadgeHtml(order.order_status) + '</div>' +
    '  </div>' +
    '  <p style="color:var(--color-muted);font-size:0.85rem;margin-top:6px;">Placed ' + formatDateTime(order.created_at) + '</p>' +
    '</div>' +
    '<div style="background:var(--color-light-bg);padding:14px 16px;border-radius:8px;margin-bottom:16px;font-size:0.88rem;">' +
    '  <div><strong>Customer:</strong> ' + escapeHtml(order.customer_name || '') + ' — ' + escapeHtml(order.customer_email || '') + ' — ' + escapeHtml(order.customer_phone || '') + '</div>' +
    '  <div style="margin-top:6px;"><strong>Ship to:</strong> ' + escapeHtml(order.shipping_address || '') + ', ' + escapeHtml(order.shipping_city || '') + ', ' + escapeHtml(order.shipping_state || '') + ' ' + escapeHtml(order.shipping_zip || '') + ', ' + escapeHtml(order.shipping_country || '') + '</div>' +
    (order.notes ? '  <div style="margin-top:6px;"><strong>Notes:</strong> ' + escapeHtml(order.notes) + '</div>' : '') +
    '</div>' +
    '<h4 style="margin-bottom:6px;">Items to Reorder on CJ Dropshipping</h4>' +
    '<div class="modal-items-list">' + itemsHtml + '</div>' +
    '<div style="border-top:1px solid var(--color-border);padding-top:16px;margin-top:10px;">' +
    '  <div class="form-group">' +
    '    <label>Order Status</label>' +
    '    <select id="modalStatusSelect">' +
    ['New', 'Processing', 'Ordered on CJ', 'Shipped', 'Delivered', 'Cancelled'].map(function (s) {
      return '<option value="' + s + '"' + (order.order_status === s ? ' selected' : '') + '>' + s + '</option>';
    }).join('') +
    '    </select>' +
    '  </div>' +
    '  <div class="form-group">' +
    '    <label>CJ Dropshipping Order ID (once placed)</label>' +
    '    <input type="text" id="modalCjOrderId" placeholder="e.g. CJ20260812001" value="' + escapeHtml(order.cj_order_id || '') + '">' +
    '  </div>' +
    '  <label style="display:flex;align-items:center;gap:8px;font-size:0.9rem;font-weight:600;margin-bottom:16px;">' +
    '    <input type="checkbox" id="modalCjPlaced" ' + (order.cj_order_placed ? 'checked' : '') + ' style="width:auto;"> Mark as reordered on CJ Dropshipping' +
    '  </label>' +
    '  <button class="btn btn-primary btn-block" onclick="saveOrderChanges(\'' + order.id + '\')"><i class="fa-solid fa-floppy-disk"></i> Save Changes</button>' +
    '</div>';

  document.getElementById('modalOrderContent').innerHTML = content;
  document.getElementById('orderModal').classList.add('open');
}

function closeOrderModal() {
  document.getElementById('orderModal').classList.remove('open');
}

async function saveOrderChanges(orderId) {
  const status = document.getElementById('modalStatusSelect').value;
  const cjOrderId = document.getElementById('modalCjOrderId').value.trim();
  const cjPlaced = document.getElementById('modalCjPlaced').checked;

  try {
    await apiUpdate('orders', orderId, {
      order_status: status,
      cj_order_id: cjOrderId,
      cj_order_placed: cjPlaced
    });
    showToast('Order updated');
    closeOrderModal();
    await loadOrders();
  } catch (err) {
    console.error(err);
    showToast('Failed to save changes');
  }
}

async function loadOrders() {
  try {
    ALL_ORDERS = await apiGetAll('orders');
    renderOrdersTable();

    const openId = getQueryParam('open');
    if (openId) {
      openOrderModal(openId);
    }
  } catch (err) {
    console.error('Failed to load orders', err);
    document.getElementById('ordersTableBody').innerHTML = '<tr class="empty-row"><td colspan="9">Could not load orders.</td></tr>';
  }
}

function initOrdersPage() {
  const filterParam = getQueryParam('filter');
  if (filterParam === 'pending_cj') {
    document.getElementById('cjFilter').value = 'pending';
  }
  document.getElementById('orderSearch').addEventListener('input', renderOrdersTable);
  document.getElementById('statusFilter').addEventListener('change', renderOrdersTable);
  document.getElementById('cjFilter').addEventListener('change', renderOrdersTable);
  loadOrders();
}

document.addEventListener('DOMContentLoaded', initOrdersPage);
