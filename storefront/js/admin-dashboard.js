/* Admin dashboard overview */

async function loadDashboard() {
  document.getElementById('todayDate').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  try {
    const [orders, products] = await Promise.all([
      apiGetAll('orders'),
      apiGetAll('products')
    ]);

    const totalRevenue = orders.reduce(function (sum, o) { return sum + (o.total || 0); }, 0);
    const pendingCj = orders.filter(function (o) { return !o.cj_order_placed && o.order_status !== 'Cancelled'; });

    document.getElementById('statTotalOrders').textContent = orders.length;
    document.getElementById('statRevenue').textContent = formatMoney(totalRevenue);
    document.getElementById('statPendingCj').textContent = pendingCj.length;
    document.getElementById('statProducts').textContent = products.length;

    // Pricing/margin health check
    const noCostSet = products.filter(function (p) { return p.cj_cost_price == null && p.cj_shipping_cost == null; });
    const losingMoney = products.filter(function (p) {
      if (p.cj_cost_price == null && p.cj_shipping_cost == null) return false;
      const landed = (parseFloat(p.cj_cost_price) || 0) + (parseFloat(p.cj_shipping_cost) || 0);
      return (parseFloat(p.price) || 0) <= landed;
    });
    const marginCard = document.getElementById('marginAlertCard');
    if (marginCard) {
      if (losingMoney.length === 0 && noCostSet.length === 0) {
        marginCard.innerHTML = '<h3 style="margin-bottom:6px;"><i class="fa-solid fa-circle-check" style="color:var(--color-success);"></i> Pricing looks healthy</h3><p style="color:var(--color-muted); font-size:0.88rem; margin:0;">Every product has a CJ cost on file and a selling price above your landed cost.</p>';
      } else {
        let html = '<h3 style="margin-bottom:6px;"><i class="fa-solid fa-triangle-exclamation" style="color:var(--color-accent);"></i> Pricing needs attention</h3>';
        if (losingMoney.length > 0) {
          html += '<p style="color:var(--color-danger); font-weight:700; font-size:0.9rem; margin:10px 0 4px;">' + losingMoney.length + ' product' + (losingMoney.length !== 1 ? 's are' : ' is') + ' priced at or below CJ cost \u2014 you would LOSE money on every sale:</p>';
          html += '<ul style="margin:0 0 10px; padding-left:18px; font-size:0.85rem;">' + losingMoney.slice(0, 6).map(function (p) { return '<li>' + escapeHtml(p.name) + '</li>'; }).join('') + '</ul>';
        }
        if (noCostSet.length > 0) {
          html += '<p style="color:var(--color-muted); font-size:0.88rem; margin:6px 0 0;">' + noCostSet.length + ' product' + (noCostSet.length !== 1 ? 's have' : ' has') + ' no CJ cost entered yet, so their margin is unknown.</p>';
        }
        html += '<a href="products.html" class="btn btn-outline btn-sm" style="margin-top:14px;">Review Product Pricing <i class="fa-solid fa-arrow-right"></i></a>';
        marginCard.innerHTML = html;
      }
    }

    // Sort orders by created_at desc
    const sorted = orders.slice().sort(function (a, b) { return (b.created_at || 0) - (a.created_at || 0); });

    // Pending CJ table (top 8)
    const pendingBody = document.getElementById('pendingCjTableBody');
    const pendingSorted = pendingCj.slice().sort(function (a, b) { return (b.created_at || 0) - (a.created_at || 0); }).slice(0, 8);
    if (pendingSorted.length === 0) {
      pendingBody.innerHTML = '<tr class="empty-row"><td colspan="7">🎉 All caught up — no pending CJ reorders.</td></tr>';
    } else {
      pendingBody.innerHTML = pendingSorted.map(function (o) {
        const items = parseOrderItems(o);
        return (
          '<tr>' +
          '  <td><strong>' + escapeHtml(o.order_number || '') + '</strong></td>' +
          '  <td>' + escapeHtml(o.customer_name || '') + '</td>' +
          '  <td>' + items.length + ' item' + (items.length !== 1 ? 's' : '') + '</td>' +
          '  <td>' + formatMoney(o.total || 0) + '</td>' +
          '  <td>' + formatDate(o.created_at) + '</td>' +
          '  <td>' + statusBadgeHtml(o.order_status) + '</td>' +
          '  <td><a href="orders.html?open=' + o.id + '" class="table-action-btn">Reorder on CJ →</a></td>' +
          '</tr>'
        );
      }).join('');
    }

    // Recent orders table (top 8)
    const recentBody = document.getElementById('recentOrdersTableBody');
    const recent = sorted.slice(0, 8);
    if (recent.length === 0) {
      recentBody.innerHTML = '<tr class="empty-row"><td colspan="6">No orders yet.</td></tr>';
    } else {
      recentBody.innerHTML = recent.map(function (o) {
        return (
          '<tr>' +
          '  <td><a href="orders.html?open=' + o.id + '"><strong>' + escapeHtml(o.order_number || '') + '</strong></a></td>' +
          '  <td>' + escapeHtml(o.customer_name || '') + '</td>' +
          '  <td>' + formatMoney(o.total || 0) + '</td>' +
          '  <td>' + formatDate(o.created_at) + '</td>' +
          '  <td>' + statusBadgeHtml(o.order_status) + '</td>' +
          '  <td>' + (o.cj_order_placed ? '<span class="cj-badge-yes"><i class="fa-solid fa-circle-check"></i> Yes</span>' : '<span class="cj-badge-no"><i class="fa-solid fa-circle-exclamation"></i> No</span>') + '</td>' +
          '</tr>'
        );
      }).join('');
    }
  } catch (err) {
    console.error('Failed to load dashboard', err);
  }
}

document.addEventListener('DOMContentLoaded', loadDashboard);
