/* Cart page rendering */

function renderCartPage() {
  const cart = getCart();
  const root = document.getElementById('cartRoot');

  if (cart.length === 0) {
    root.innerHTML =
      '<div class="empty-state">' +
      '  <i class="fa-solid fa-cart-shopping"></i>' +
      '  <h2>Your cart is empty</h2>' +
      '  <p>Looks like you haven\'t added any gadgets yet.</p>' +
      '  <a href="products.html" class="btn btn-primary">Start Shopping</a>' +
      '</div>';
    return;
  }

  const subtotal = cartSubtotal();
  const shipping = computeShipping(subtotal);
  const tax = computeTax(subtotal);
  const total = subtotal + shipping + tax;

  const rows = cart.map(function (item) {
    return (
      '<tr>' +
      '  <td>' +
      '    <div class="cart-item-info">' +
      '      <img src="' + item.image_url + '" alt="' + escapeHtml(item.name) + '">' +
      '      <div>' +
      '        <div class="name">' + escapeHtml(item.name) + '</div>' +
      '        <button class="cart-remove" onclick="removeCartItem(\'' + item.id + '\')"><i class="fa-solid fa-trash"></i> Remove</button>' +
      '      </div>' +
      '    </div>' +
      '  </td>' +
      '  <td>' + formatMoney(item.price) + '</td>' +
      '  <td>' +
      '    <div class="qty-selector">' +
      '      <button onclick="changeCartQty(\'' + item.id + '\', -1)"><i class="fa-solid fa-minus"></i></button>' +
      '      <input type="text" value="' + item.qty + '" readonly>' +
      '      <button onclick="changeCartQty(\'' + item.id + '\', 1)"><i class="fa-solid fa-plus"></i></button>' +
      '    </div>' +
      '  </td>' +
      '  <td><strong>' + formatMoney(item.qty * item.price) + '</strong></td>' +
      '</tr>'
    );
  }).join('');

  root.innerHTML =
    '<div class="cart-layout">' +
    '  <div>' +
    '    <table class="cart-table">' +
    '      <thead><tr><th>Product</th><th>Price</th><th>Quantity</th><th>Subtotal</th></tr></thead>' +
    '      <tbody>' + rows + '</tbody>' +
    '    </table>' +
    '    <div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;">' +
    '      <a href="products.html" class="btn btn-outline btn-sm"><i class="fa-solid fa-arrow-left"></i> Continue Shopping</a>' +
    '      <button type="button" class="btn btn-outline btn-sm" onclick="clearCartPage()"><i class="fa-solid fa-trash"></i> Clear Cart</button>' +
    '    </div>' +
    '  </div>' +
    '  <div class="cart-summary">' +
    '    <h3>Order Summary</h3>' +
    '    <div class="summary-row"><span>Subtotal</span><span>' + formatMoney(subtotal) + '</span></div>' +
    '    <div class="summary-row"><span>Shipping</span><span>' + formatMoney(shipping) + '</span></div>' +
    (tax > 0 ? '<div class="summary-row"><span>Tax</span><span>' + formatMoney(tax) + '</span></div>' : '') +
    '    <div class="summary-row total"><span>Total</span><span>' + formatMoney(total) + '</span></div>' +
    '    <a href="checkout.html" class="btn btn-primary btn-block" style="margin-top:18px;">Proceed to Checkout <i class="fa-solid fa-arrow-right"></i></a>' +
    '    <div class="badge-lock" style="justify-content:center;margin-top:14px;"><i class="fa-solid fa-lock"></i> Secure checkout</div>' +
    '  </div>' +
    '</div>';
}

function removeCartItem(id) {
  removeFromCart(id);
  renderCartPage();
  showToast('Item removed from cart');
}

function changeCartQty(id, delta) {
  const cart = getCart();
  const item = cart.find(function (i) { return i.id === id; });
  if (!item) return;
  const newQty = item.qty + delta;
  if (newQty <= 0) {
    removeCartItem(id);
    return;
  }
  updateCartQty(id, newQty);
  renderCartPage();
}

function clearCartPage() {
  if (!confirm('Are you sure you want to clear your cart?')) {
    return;
  }

  localStorage.removeItem('kgs_cart_v1');

  renderCartPage();
  showToast('Cart cleared');
}

document.addEventListener('DOMContentLoaded', renderCartPage);