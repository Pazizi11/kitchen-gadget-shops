/* Products listing page: search, category filter, sort */

let ALL_PRODUCTS = [];
const CATEGORIES_ORDER = ['Cooking Tools', 'Storage & Organization', 'Bakeware', 'Kitchen Utensils & Serving', 'Small Appliances', 'Gadgets & Tools', 'Coffee & Tea'];

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function renderCategoryScroller(activeCategory) {
  const el = document.getElementById('categoryScroller');
  if (!el) return;
  let html = '<a href="products.html" class="category-pill' + (!activeCategory ? ' active' : '') + '">All</a>';
  CATEGORIES_ORDER.forEach(function (cat) {
    const isActive = activeCategory === cat;
    html += '<a href="products.html?category=' + encodeURIComponent(cat) + '" class="category-pill' + (isActive ? ' active' : '') + '">' + cat + '</a>';
  });
  el.innerHTML = html;
}

function applyFiltersAndRender() {
  const search = (document.getElementById('searchInput').value || '').trim().toLowerCase();
  const sort = document.getElementById('sortSelect').value;
  const category = getQueryParam('category');

  let list = ALL_PRODUCTS.slice();

  if (category) {
    list = list.filter(function (p) { return p.category === category; });
  }
  if (search) {
    list = list.filter(function (p) {
      return (p.name || '').toLowerCase().includes(search) ||
             (p.short_description || '').toLowerCase().includes(search) ||
             (p.category || '').toLowerCase().includes(search);
    });
  }

  switch (sort) {
    case 'price-asc': list.sort(function (a, b) { return a.price - b.price; }); break;
    case 'price-desc': list.sort(function (a, b) { return b.price - a.price; }); break;
    case 'rating': list.sort(function (a, b) { return (b.rating || 0) - (a.rating || 0); }); break;
    case 'newest': list.sort(function (a, b) { return (b.created_at || 0) - (a.created_at || 0); }); break;
    default: list.sort(function (a, b) { return (b.featured ? 1 : 0) - (a.featured ? 1 : 0); });
  }

  const grid = document.getElementById('productGrid');
  const empty = document.getElementById('emptyState');
  const countEl = document.getElementById('resultCount');

  if (list.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    countEl.textContent = '';
  } else {
    empty.style.display = 'none';
    grid.innerHTML = list.map(productCardHtml).join('');
    countEl.textContent = list.length + ' product' + (list.length !== 1 ? 's' : '') + ' found';
  }
}

async function initProductsPage() {
  const category = getQueryParam('category');
  renderCategoryScroller(category);

  if (category) {
    document.getElementById('pageTitle').textContent = category;
    document.getElementById('breadcrumbCurrent').textContent = category;
    document.title = category + ' — Kitchen Gadget Shops';
  }

  try {
    ALL_PRODUCTS = await apiGetAll('products');
    ALL_PRODUCTS.forEach(function (p) { window._productCache[p.id] = p; });
    applyFiltersAndRender();
  } catch (err) {
    console.error('Failed to load products', err);
    document.getElementById('productGrid').innerHTML = '<p style="color:var(--color-muted);">Could not load products right now. Please try again later.</p>';
  }

  document.getElementById('searchInput').addEventListener('input', applyFiltersAndRender);
  document.getElementById('sortSelect').addEventListener('change', applyFiltersAndRender);

  const initialSearch = getQueryParam('search');
  if (initialSearch) {
    document.getElementById('searchInput').value = initialSearch;
    applyFiltersAndRender();
  }
}

document.addEventListener('DOMContentLoaded', initProductsPage);
