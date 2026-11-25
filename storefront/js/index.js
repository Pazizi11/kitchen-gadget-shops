/* Homepage dynamic content: categories, best sellers, new arrivals */

const CATEGORY_ICONS = {
  'Cooking Tools': 'fa-solid fa-utensils',
  'Storage & Organization': 'fa-solid fa-box-archive',
  'Bakeware': 'fa-solid fa-cookie',
  'Kitchen Utensils & Serving': 'fa-solid fa-spoon',
  'Small Appliances': 'fa-solid fa-blender',
  'Gadgets & Tools': 'fa-solid fa-screwdriver-wrench',
  'Coffee & Tea': 'fa-solid fa-mug-hot'
};

function productCardHtml(p) {
  const discount = p.compare_at_price && p.compare_at_price > p.price
    ? Math.round(100 - (p.price / p.compare_at_price) * 100)
    : 0;
  return (
    '<div class="product-card">' +
    '  <a href="product.html?id=' + p.id + '">' +
    '    <div class="product-thumb">' +
    (p.badge ? '<span class="product-badge">' + escapeHtml(p.badge) + '</span>' : '') +
    '      <img src="' + p.image_url + '" alt="' + escapeHtml(p.name) + '">' +
    '    </div>' +
    '  </a>' +
    '  <button class="product-quick-add" title="Add to cart" onclick="quickAdd(event, \'' + p.id + '\')"><i class="fa-solid fa-cart-plus"></i></button>' +
    '  <div class="product-info">' +
    '    <div class="product-cat">' + escapeHtml(p.category || '') + '</div>' +
    '    <a href="product.html?id=' + p.id + '"><h3 class="product-name">' + escapeHtml(p.name) + '</h3></a>' +
    '    <div class="product-rating"><span class="stars">' + starHtml(p.rating) + '</span> (' + (p.review_count || 0) + ')</div>' +
    '    <div class="product-price-row">' +
    '      <span class="price-now">' + formatMoney(p.price) + '</span>' +
    (p.compare_at_price && p.compare_at_price > p.price ? '<span class="price-was">' + formatMoney(p.compare_at_price) + '</span>' : '') +
    (discount > 0 ? '<span class="price-save">Save ' + discount + '%</span>' : '') +
    '    </div>' +
    '  </div>' +
    '</div>'
  );
}

window._productCache = window._productCache || {};

async function quickAdd(evt, productId) {
  evt.preventDefault();
  evt.stopPropagation();
  let product = window._productCache[productId];
  if (!product) {
    try { product = await apiGetOne('products', productId); } catch (e) { showToast('Could not add item'); return; }
  }
  addToCart(product, 1);
}

async function loadHomepageData() {
  try {
    const products = await apiGetAll('products');
    products.forEach(function (p) { window._productCache[p.id] = p; });

    // Categories
    const cats = {};
    products.forEach(function (p) {
      if (!p.category) return;
      cats[p.category] = (cats[p.category] || 0) + 1;
    });
    const catGrid = document.getElementById('categoryGrid');
    if (catGrid) {
      catGrid.innerHTML = Object.keys(cats).map(function (cat) {
        const icon = CATEGORY_ICONS[cat] || 'fa-solid fa-tag';
        return (
          '<a href="products.html?category=' + encodeURIComponent(cat) + '" class="feature-card" style="text-decoration:none;">' +
          '  <div class="feature-icon"><i class="' + icon + '"></i></div>' +
          '  <h3>' + escapeHtml(cat) + '</h3>' +
          '  <p>' + cats[cat] + ' products</p>' +
          '</a>'
        );
      }).join('');
    }

    // Best sellers (featured)
    const featured = products.filter(function (p) { return p.featured; }).slice(0, 8);
    const featuredGrid = document.getElementById('featuredGrid');
    if (featuredGrid) {
      featuredGrid.innerHTML = (featured.length ? featured : products.slice(0, 8))
        .map(productCardHtml).join('');
    }

    // New arrivals — newest Medusa products first
    const sorted = products.slice().sort(function (a, b) {
      const dateA = Date.parse(a.created_at || '') || 0;
      const dateB = Date.parse(b.created_at || '') || 0;
      return dateB - dateA;
    });
    const newGrid = document.getElementById('newGrid');
    if (newGrid) {
      newGrid.innerHTML = sorted.slice(0, 4).map(productCardHtml).join('');
    }
  } catch (err) {
    console.error('Failed to load homepage data', err);
  }
}

document.addEventListener('DOMContentLoaded', loadHomepageData);
