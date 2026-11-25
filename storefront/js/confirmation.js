/* Order confirmation page — reads the completed Medusa order saved by checkout. */
function getOrderIdFromUrl() { return new URLSearchParams(window.location.search).get('order'); }

async function initConfirmationPage() {
  const orderId = getOrderIdFromUrl();
  const root = document.getElementById('confirmRoot');
  let order = null;
  try { order = JSON.parse(sessionStorage.getItem('kgs_last_order') || 'null'); } catch (e) { order = null; }

  if (!order || (orderId && order.id !== orderId)) {
    root.innerHTML = '<div class="confirm-icon" style="background:#fbe1e1;color:var(--color-danger);"><i class="fa-solid fa-triangle-exclamation"></i></div><h1>We could not find that order</h1><p style="color:var(--color-muted);">If you just placed an order, please check your confirmation email or contact support.</p><a href="products.html" class="btn btn-primary" style="margin-top:20px;">Continue Shopping</a>';
    return;
  }

  const items = order.items || [];
  const address = order.shipping_address || {};
  const firstName = address.first_name || (order.email ? order.email.split('@')[0] : 'there');
  const displayId = order.display_id || order.id || '';
  const paymentStatus = order.payment_collections && order.payment_collections[0] && order.payment_collections[0].status || 'authorized';

  root.innerHTML =
    '<div class="confirm-icon"><i class="fa-solid fa-check"></i></div>' +
    '<h1>Thank you, ' + escapeHtml(firstName) + '!</h1>' +
    '<p style="color:var(--color-muted);">Your order has been received and created in Medusa. A confirmation email can be sent by your backend/email integration.</p>' +
    '<div class="confirm-order-box">' +
    '  <div class="row"><span>Order Number</span><strong>' + escapeHtml(displayId) + '</strong></div>' +
    '  <div class="row"><span>Items</span><span>' + items.length + '</span></div>' +
    '  <div class="row"><span>Shipping Address</span><span>' + escapeHtml(address.address_1 || '') + ', ' + escapeHtml(address.city || '') + ', ' + escapeHtml(address.province || '') + ' ' + escapeHtml(address.postal_code || '') + '</span></div>' +
    '  <div class="row"><span>Payment</span><span>Stripe (' + escapeHtml(paymentStatus) + ')</span></div>' +
    '  <div class="row"><span>Estimated Delivery</span><span>7–15 business days</span></div>' +
    '  <div class="row"><span><strong>Order Total</strong></span><strong>' + formatMoney(order.total || 0) + '</strong></div>' +
    '</div>' +
    '<div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap;"><a href="products.html" class="btn btn-primary">Continue Shopping</a><a href="index.html" class="btn btn-outline">Back to Home</a></div>';
}

document.addEventListener('DOMContentLoaded', initConfirmationPage);
