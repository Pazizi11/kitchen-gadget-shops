/* Product detail page */

let CURRENT_PRODUCT = null;

/*
 * Safely prepare CJ/Medusa product descriptions for display.
 * Keeps useful formatting while removing potentially unsafe elements
 * and attributes.
 */
function sanitizeProductDescription(html) {
  if (!html) return '';

  const wrapper = document.createElement('div');
  wrapper.innerHTML = String(html);

  // Remove elements that should never be rendered from product content.
  wrapper.querySelectorAll(
    'script, iframe, object, embed, form, input, button, textarea, select, style, link, meta'
  ).forEach(function (el) {
    el.remove();
  });

  // Only allow safe formatting/content elements.
  const allowedTags = new Set([
    'P',
    'BR',
    'B',
    'STRONG',
    'I',
    'EM',
    'U',
    'UL',
    'OL',
    'LI',
    'H2',
    'H3',
    'H4',
    'DIV',
    'SPAN',
    'IMG'
  ]);

  wrapper.querySelectorAll('*').forEach(function (el) {
    if (!allowedTags.has(el.tagName)) {
      el.replaceWith(document.createTextNode(el.textContent || ''));
      return;
    }

    // Remove every attribute first.
    Array.from(el.attributes).forEach(function (attr) {
      el.removeAttribute(attr.name);
    });

    // Keep only safe image source information.
    if (el.tagName === 'IMG') {
      const originalSrc =
        el.getAttribute('src') ||
        el.src ||
        '';

      if (
        originalSrc &&
        /^https?:\/\//i.test(originalSrc)
      ) {
        el.setAttribute('src', originalSrc);
        el.setAttribute('alt', 'Product image');
        el.setAttribute('loading', 'lazy');
        el.setAttribute('referrerpolicy', 'no-referrer');
      } else {
        el.remove();
      }
    }
  });

  return wrapper.innerHTML.trim();
}

function getProductIdFromUrl() {
  return new URLSearchParams(window.location.search).get('id');
}

function renderProductDetail(p) {
  const discount = p.compare_at_price && p.compare_at_price > p.price
    ? Math.round(100 - (p.price / p.compare_at_price) * 100)
    : 0;

  const images = [
    p.image_url || p.thumbnail,
    p.image_url_2,
    p.image_url_3,
    p.image_url_4
  ].filter(Boolean);

  const stockClass =
    p.stock_status === 'Low Stock' ||
    p.stock_status === 'Out of Stock'
      ? 'low'
      : '';

  const stockIcon =
    p.stock_status === 'Out of Stock'
      ? 'fa-circle-xmark'
      : 'fa-circle-check';

  const productDescription =
    p.description || p.short_description || '';

  const safeDescription =
    sanitizeProductDescription(productDescription);

  const html =
    '<div class="pd-gallery">' +
    '  <div class="pd-gallery-main">' +
    '    <img id="pdMainImg" src="' + (images[0] || '') +
    '" alt="' + escapeHtml(p.name) + '">' +
    '  </div>' +

    (images.length > 1
      ? '<div class="pd-thumbs">' +
        images.map(function (img, i) {
          return '<img src="' + escapeHtml(img) +
            '" class="' + (i === 0 ? 'active' : '') +
            '" onclick="switchPdImage(this, \'' +
            escapeHtml(img).replace(/'/g, "\\'") +
            '\')">';
        }).join('') +
        '</div>'
      : '') +

    '</div>' +

    '<div class="pd-info">' +

    '  <div class="product-cat">' +
    escapeHtml(p.category || '') +
    '</div>' +

    '  <h1>' +
    escapeHtml(p.name) +
    '</h1>' +

    '  <div class="product-rating">' +
    '    <span class="stars">' +
    starHtml(p.rating) +
    '</span> ' +
    (p.rating || 0).toFixed(1) +
    ' (' +
    (p.review_count || 0) +
    ' reviews)' +
    '  </div>' +

    '  <div class="pd-price-row">' +

    '    <span class="price-now">' +
    formatMoney(p.price) +
    '</span>' +

    (
      p.compare_at_price &&
      p.compare_at_price > p.price
        ? '<span class="price-was">' +
          formatMoney(p.compare_at_price) +
          '</span>'
        : ''
    ) +

    (
      discount > 0
        ? '<span class="price-save">Save ' +
          discount +
          '%</span>'
        : ''
    ) +

    '  </div>' +

    '  <div class="pd-stock ' +
    stockClass +
    '">' +
    '<i class="fa-solid ' +
    stockIcon +
    '"></i> ' +
    escapeHtml(p.stock_status || 'In Stock') +
    '</div>' +

    /*
     * IMPORTANT:
     * Do NOT use escapeHtml() here.
     * CJ supplies formatted HTML descriptions containing
     * paragraphs, bold text, line breaks and product images.
     */
    '  <div class="pd-desc product-description">' +
    safeDescription +
    '</div>' +

    '  <div class="pd-qty-row">' +

    '    <div class="qty-selector">' +

    '      <button onclick="changePdQty(-1)">' +
    '<i class="fa-solid fa-minus"></i>' +
    '</button>' +

    '      <input type="text" id="pdQty" value="1" readonly>' +

    '      <button onclick="changePdQty(1)">' +
    '<i class="fa-solid fa-plus"></i>' +
    '</button>' +

    '    </div>' +

    '  </div>' +

    '  <div class="pd-actions">' +

    '    <button class="btn btn-primary btn-block" ' +
    'onclick="addCurrentToCart()" ' +
    (
      p.stock_status === 'Out of Stock'
        ? 'disabled'
        : ''
    ) +
    '>' +
    '<i class="fa-solid fa-cart-plus"></i> Add to Cart' +
    '</button>' +

    '    <button class="btn btn-outline" ' +
    'onclick="buyNow()" ' +
    (
      p.stock_status === 'Out of Stock'
        ? 'disabled'
        : ''
    ) +
    '>' +
    '<i class="fa-solid fa-bolt"></i> Buy Now' +
    '</button>' +

    '  </div>' +

    '  <div class="pd-meta-list">' +

    '    <div>' +
    '<span>SKU</span>' +
    '<span>' +
    escapeHtml(p.sku || '—') +
    '</span>' +
    '</div>' +

    '    <div>' +
    '<span>Category</span>' +
    '<span>' +
    escapeHtml(p.category || '—') +
    '</span>' +
    '</div>' +

    '    <div>' +
    '<span>Shipping</span>' +
    '<span>7–15 business days worldwide</span>' +
    '</div>' +

    '    <div>' +
    '<span>Returns</span>' +
    '<span>30-day money-back guarantee</span>' +
    '</div>' +

    '  </div>' +

    '</div>';

  document.getElementById('productDetailRoot').innerHTML = html;

  document.getElementById('breadcrumbCurrent').textContent = p.name;

  document.getElementById('pageTitleTag').textContent =
    p.name + ' — Kitchen Gadget Shops';
}

function switchPdImage(el, src) {
  document.getElementById('pdMainImg').src = src;

  document.querySelectorAll('.pd-thumbs img').forEach(function (img) {
    img.classList.remove('active');
  });

  el.classList.add('active');
}

function changePdQty(delta) {
  const input = document.getElementById('pdQty');

  const val = Math.max(
    1,
    parseInt(input.value || '1', 10) + delta
  );

  input.value = val;
}

function addCurrentToCart() {
  if (!CURRENT_PRODUCT) return;

  const qty = parseInt(
    document.getElementById('pdQty').value || '1',
    10
  );

  addToCart(CURRENT_PRODUCT, qty);
}

function buyNow() {
  if (!CURRENT_PRODUCT) return;

  const qty = parseInt(
    document.getElementById('pdQty').value || '1',
    10
  );

  addToCart(CURRENT_PRODUCT, qty);

  window.location.href = 'cart.html';
}

async function initProductPage() {
  const id = getProductIdFromUrl();

  if (!id) {
    document.getElementById('productDetailRoot').innerHTML =
      '<p style="grid-column:1/-1;">' +
      'Product not found. ' +
      '<a href="products.html">Back to shop</a>' +
      '</p>';

    return;
  }

  try {
    const p = await apiGetOne('products', id);

    CURRENT_PRODUCT = p;

    window._productCache[p.id] = p;

    renderProductDetail(p);

    loadRelatedProducts(p);

  } catch (err) {
    console.error(err);

    document.getElementById('productDetailRoot').innerHTML =
      '<p style="grid-column:1/-1;">' +
      'Sorry, we could not find that product. ' +
      '<a href="products.html">Back to shop</a>' +
      '</p>';
  }
}

async function loadRelatedProducts(current) {
  try {
    const all = await apiGetAll('products');

    all.forEach(function (p) {
      window._productCache[p.id] = p;
    });

    const related = all
      .filter(function (p) {
        return (
          p.id !== current.id &&
          p.category === current.category
        );
      })
      .slice(0, 4);

    const fallback = related.length
      ? related
      : all
          .filter(function (p) {
            return p.id !== current.id;
          })
          .slice(0, 4);

    document.getElementById('relatedGrid').innerHTML =
      fallback.map(productCardHtml).join('');

  } catch (err) {
    console.error(
      'Failed to load related products',
      err
    );
  }
}

document.addEventListener(
  'DOMContentLoaded',
  initProductPage
);