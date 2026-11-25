/* Admin Products page: list, filter, and edit CJ link / stock / price / margin */

let ALL_ADMIN_PRODUCTS = [];

function computeMargin(p) {
  const cost = (parseFloat(p.cj_cost_price) || 0) + (parseFloat(p.cj_shipping_cost) || 0);
  const price = parseFloat(p.price) || 0;
  const hasCost = !!(p.cj_cost_price || p.cj_shipping_cost);
  const profit = price - cost;
  const marginPct = price > 0 ? (profit / price) * 100 : 0;
  return { cost: cost, profit: profit, marginPct: marginPct, hasCost: hasCost };
}

function marginBadgeHtml(p) {
  const m = computeMargin(p);
  if (!m.hasCost) {
    return '<span style="color:var(--color-muted);font-size:0.8rem;"><i class="fa-solid fa-circle-question"></i> No CJ cost set</span>';
  }
  if (m.profit <= 0) {
    return '<span style="color:var(--color-danger);font-weight:700;font-size:0.82rem;"><i class="fa-solid fa-triangle-exclamation"></i> Loss ' + formatMoney(m.profit) + '</span>';
  }
  const color = m.marginPct < 20 ? '#b8860b' : 'var(--color-success)';
  return '<span style="color:' + color + ';font-weight:700;font-size:0.82rem;">' + formatMoney(m.profit) + ' (' + m.marginPct.toFixed(0) + '%)</span>';
}

function renderProductsTable() {
  const search = document.getElementById('productSearch').value.trim().toLowerCase();
  const stock = document.getElementById('stockFilter').value;

  const filtered = ALL_ADMIN_PRODUCTS.filter(function (p) {
    if (stock && p.stock_status !== stock) return false;
    if (search) {
      const hay = ((p.name || '') + ' ' + (p.sku || '')).toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  const body = document.getElementById('productsTableBody');
  if (filtered.length === 0) {
    body.innerHTML = '<tr class="empty-row"><td colspan="9">No products match your filters.</td></tr>';
    return;
  }

  const stockClass = { 'In Stock': 'status-delivered', 'Low Stock': 'status-processing', 'Out of Stock': 'status-cancelled' };

  body.innerHTML = filtered.map(function (p) {
    return (
      '<tr>' +
      '  <td><img src="' + p.image_url + '" alt="" style="width:48px;height:48px;border-radius:6px;object-fit:cover;"></td>' +
      '  <td><strong>' + escapeHtml(p.name) + '</strong></td>' +
      '  <td>' + escapeHtml(p.sku || '—') + '</td>' +
      '  <td>' + escapeHtml(p.category || '—') + '</td>' +
      '  <td>' + formatMoney(p.price) + '</td>' +
      '  <td>' + marginBadgeHtml(p) + '</td>' +
      '  <td><span class="status-badge ' + (stockClass[p.stock_status] || 'status-new') + '">' + escapeHtml(p.stock_status || 'In Stock') + '</span></td>' +
      '  <td>' + (p.cj_product_url ? '<a href="' + p.cj_product_url + '" target="_blank" style="color:var(--color-primary);font-weight:600;font-size:0.82rem;">Open on CJ <i class="fa-solid fa-arrow-up-right-from-square"></i></a>' : '<span style="color:var(--color-danger);font-size:0.8rem;">Not set</span>') + '</td>' +
      '  <td><button class="table-action-btn" onclick="openProductModal(\'' + p.id + '\')">Edit</button></td>' +
      '</tr>'
    );
  }).join('');
}

function openProductModal(productId) {
  const p = ALL_ADMIN_PRODUCTS.find(function (x) { return x.id === productId; });
  if (!p) return;

  const content =
    '<div style="display:flex;gap:16px;margin-bottom:18px;">' +
    '  <img src="' + p.image_url + '" style="width:80px;height:80px;border-radius:10px;object-fit:cover;">' +
    '  <div><strong style="font-size:1.05rem;">' + escapeHtml(p.name) + '</strong><br><span style="color:var(--color-muted);font-size:0.85rem;">SKU: ' + escapeHtml(p.sku || '—') + '</span></div>' +
    '</div>' +
    '<div class="form-row">' +
    '  <div class="form-group"><label>Your Selling Price ($)</label><input type="number" step="0.01" id="modalPrice" oninput="updateModalMarginPreview()" value="' + p.price + '"></div>' +
    '  <div class="form-group"><label>Compare-at Price ($)</label><input type="number" step="0.01" id="modalComparePrice" value="' + (p.compare_at_price || '') + '"></div>' +
    '</div>' +
    '<div style="background:var(--color-cream-warm);border-radius:var(--radius-sm);padding:14px 16px;margin-bottom:16px;">' +
    '  <div style="font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:0.03em;color:var(--color-muted);margin-bottom:10px;"><i class="fa-solid fa-truck-fast"></i> CJ Dropshipping Cost (enter the real numbers from CJ so we can calculate your profit)</div>' +
    '  <div class="form-row" style="margin-bottom:8px;">' +
    '    <div class="form-group" style="margin-bottom:0;"><label>CJ Item Cost ($)</label><input type="number" step="0.01" id="modalCjCost" oninput="updateModalMarginPreview()" placeholder="e.g. 8.50" value="' + (p.cj_cost_price != null ? p.cj_cost_price : '') + '"></div>' +
    '    <div class="form-group" style="margin-bottom:0;"><label>CJ Shipping Cost ($)</label><input type="number" step="0.01" id="modalCjShipping" oninput="updateModalMarginPreview()" placeholder="e.g. 3.20" value="' + (p.cj_shipping_cost != null ? p.cj_shipping_cost : '') + '"></div>' +
    '  </div>' +
    '  <div id="modalMarginPreview" style="font-weight:700;font-size:0.95rem;margin-top:10px;"></div>' +
    '</div>' +
    '<div class="form-group">' +
    '  <label>Stock Status</label>' +
    '  <select id="modalStock">' +
    ['In Stock', 'Low Stock', 'Out of Stock'].map(function (s) {
      return '<option value="' + s + '"' + (p.stock_status === s ? ' selected' : '') + '>' + s + '</option>';
    }).join('') +
    '  </select>' +
    '</div>' +
    '<div class="form-group"><label>Product Video URL</label><input type="text" id="modalVideoUrl" placeholder="https://...mp4" value="' + escapeHtml(p.video_url || '') + '"></div>' +
    '<div class="form-group">' +
    '  <label>CJ Dropshipping Product URL</label>' +
    '  <input type="text" id="modalCjUrl" placeholder="https://cjdropshipping.com/product/..." value="' + escapeHtml(p.cj_product_url || '') + '">' +
    '</div>' +
    '<div class="form-group">' +
    '  <label>CJ Product ID / PID</label>' +
    '  <input type="text" id="modalCjId" placeholder="e.g. 1234567890" value="' + escapeHtml(p.cj_product_id || '') + '">' +
    '</div>' +
    '<div class="form-group">' +
    '  <label>Featured on Homepage</label>' +
    '  <select id="modalFeatured">' +
    '    <option value="true"' + (p.featured ? ' selected' : '') + '>Yes</option>' +
    '    <option value="false"' + (!p.featured ? ' selected' : '') + '>No</option>' +
    '  </select>' +
    '</div>' +
    '<button class="btn btn-primary btn-block" onclick="saveProductChanges(\'' + p.id + '\')"><i class="fa-solid fa-floppy-disk"></i> Save Changes</button>';

  document.getElementById('modalProductContent').innerHTML = content;
  document.getElementById('productModal').classList.add('open');
  updateModalMarginPreview();
}

function updateModalMarginPreview() {
  const priceEl = document.getElementById('modalPrice');
  const costEl = document.getElementById('modalCjCost');
  const shipEl = document.getElementById('modalCjShipping');
  const previewEl = document.getElementById('modalMarginPreview');
  if (!priceEl || !previewEl) return;

  const price = parseFloat(priceEl.value) || 0;
  const cjCost = parseFloat(costEl.value) || 0;
  const cjShip = parseFloat(shipEl.value) || 0;
  const landedCost = cjCost + cjShip;
  const profit = price - landedCost;
  const marginPct = price > 0 ? (profit / price) * 100 : 0;

  if (!cjCost && !cjShip) {
    previewEl.innerHTML = '<span style="color:var(--color-muted);font-weight:400;font-size:0.85rem;">Enter CJ cost & shipping to see your profit margin.</span>';
    return;
  }

  const color = profit <= 0 ? 'var(--color-danger)' : (marginPct < 20 ? '#b8860b' : 'var(--color-success)');
  const icon = profit <= 0 ? 'fa-triangle-exclamation' : 'fa-circle-check';
  const label = profit <= 0 ? 'You would LOSE ' + formatMoney(Math.abs(profit)) + ' per unit at this price!' : 'Profit: ' + formatMoney(profit) + ' per unit (' + marginPct.toFixed(0) + '% margin)';
  previewEl.innerHTML = '<span style="color:' + color + ';"><i class="fa-solid ' + icon + '"></i> ' + label + '</span> <span style="color:var(--color-muted);font-weight:400;font-size:0.82rem;">(landed cost: ' + formatMoney(landedCost) + ')</span>';
}

function closeProductModal() {
  document.getElementById('productModal').classList.remove('open');
}

async function saveProductChanges(productId) {
  const price = parseFloat(document.getElementById('modalPrice').value) || 0;
  const comparePrice = parseFloat(document.getElementById('modalComparePrice').value) || null;
  const cjCost = document.getElementById('modalCjCost').value === '' ? null : parseFloat(document.getElementById('modalCjCost').value);
  const cjShipping = document.getElementById('modalCjShipping').value === '' ? null : parseFloat(document.getElementById('modalCjShipping').value);
  const stock = document.getElementById('modalStock').value;
  const videoUrl = document.getElementById('modalVideoUrl').value.trim();
  const cjUrl = document.getElementById('modalCjUrl').value.trim();
  const cjId = document.getElementById('modalCjId').value.trim();
  const featured = document.getElementById('modalFeatured').value === 'true';

  if (cjCost != null && price > 0 && price <= (cjCost + (cjShipping || 0))) {
    const proceed = confirm('Warning: your selling price ($' + price.toFixed(2) + ') is at or below your CJ landed cost ($' + (cjCost + (cjShipping || 0)).toFixed(2) + '). You would lose money on every sale. Save anyway?');
    if (!proceed) return;
  }

  try {
    await apiUpdate('products', productId, {
      price: price,
      compare_at_price: comparePrice,
      cj_cost_price: cjCost,
      cj_shipping_cost: cjShipping,
      stock_status: stock,
      video_url: videoUrl,
      cj_product_url: cjUrl,
      cj_product_id: cjId,
      featured: featured
    });
    showToast('Product updated');
    closeProductModal();
    await loadAdminProducts();
  } catch (err) {
    console.error(err);
    showToast('Failed to save changes');
  }
}

async function loadAdminProducts() {
  try {
    ALL_ADMIN_PRODUCTS = await apiGetAll('products');
    renderProductsTable();
  } catch (err) {
    console.error('Failed to load products', err);
    document.getElementById('productsTableBody').innerHTML = '<tr class="empty-row"><td colspan="9">Could not load products.</td></tr>';
  }
}

function initProductsAdminPage() {
  document.getElementById('productSearch').addEventListener('input', renderProductsTable);
  document.getElementById('stockFilter').addEventListener('change', renderProductsTable);
  loadAdminProducts();
}

document.addEventListener('DOMContentLoaded', initProductsAdminPage);

/* ===================== Add New Product (from CJ Dropshipping) ===================== */

const CATEGORY_OPTIONS = [
  'Cooking Tools', 'Gadgets & Tools', 'Storage & Organization', 'Bakeware',
  'Kitchen Utensils & Serving', 'Small Appliances', 'Coffee & Tea'
];

function nextSuggestedSku() {
  // Suggest the next KGS-### number based on existing SKUs like KGS-051
  let maxNum = 0;
  ALL_ADMIN_PRODUCTS.forEach(function (p) {
    const m = /KGS-(\d{2,})$/.exec(p.sku || '');
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  });
  const next = maxNum + 1;
  return 'KGS-' + String(next).padStart(3, '0');
}

function openAddProductModal() {
  const suggestedSku = nextSuggestedSku();
  const content =
    '<p style="color:var(--color-muted);font-size:0.85rem;margin:-4px 0 18px;"><i class="fa-solid fa-circle-info"></i> Copy the details from the CJ Dropshipping product page and paste them in below. Your default 30% markup on the CJ item price will be calculated automatically. Shipping is tracked separately for true profit margin.</p>' +

    '<div class="form-group"><label>Product Name *</label><input type="text" id="newName" placeholder="e.g. Stainless Steel Citrus Zester"></div>' +

    '<div class="form-group"><label>Short Description</label><input type="text" id="newShortDesc" placeholder="One-line summary shown on product cards"></div>' +

    '<div class="form-group"><label>Full Description</label><textarea id="newDescription" rows="3" placeholder="Longer description shown on the product page"></textarea></div>' +

    '<div class="form-row">' +
    '  <div class="form-group"><label>Category</label><select id="newCategory">' +
    CATEGORY_OPTIONS.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('') +
    '  </select></div>' +
    '  <div class="form-group"><label>SKU</label><input type="text" id="newSku" value="' + suggestedSku + '"></div>' +
    '</div>' +

    '<div style="background:var(--color-cream-warm);border-radius:var(--radius-sm);padding:14px 16px;margin-bottom:16px;">' +
    '  <div style="font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:0.03em;color:var(--color-muted);margin-bottom:10px;"><i class="fa-solid fa-truck-fast"></i> CJ Dropshipping Cost</div>' +
    '  <div class="form-row" style="margin-bottom:8px;">' +
    '    <div class="form-group" style="margin-bottom:0;"><label>CJ Item Cost ($) *</label><input type="number" step="0.01" id="newCjCost" oninput="applyMarkupToNewProduct()" placeholder="e.g. 8.50"></div>' +
    '    <div class="form-group" style="margin-bottom:0;"><label>CJ Shipping Cost ($)</label><input type="number" step="0.01" id="newCjShipping" oninput="applyMarkupToNewProduct()" placeholder="e.g. 3.20"></div>' +
    '  </div>' +
    '  <div class="form-row" style="margin-bottom:0;align-items:end;">' +
    '    <div class="form-group" style="margin-bottom:0;"><label>Markup % (applied to CJ item price)</label><input type="number" step="1" id="newMarkupPct" value="30" oninput="applyMarkupToNewProduct()"></div>' +
    '    <div class="form-group" style="margin-bottom:0;"><button type="button" class="btn" style="width:100%;background:#fff;border:1.5px solid var(--color-border);" onclick="applyMarkupToNewProduct()"><i class="fa-solid fa-calculator"></i> Auto-fill Price from Markup</button></div>' +
    '  </div>' +
    '</div>' +

    '<div class="form-row">' +
    '  <div class="form-group"><label>Your Selling Price ($) *</label><input type="number" step="0.01" id="newPrice" oninput="updateNewMarginPreview()" placeholder="e.g. 12.99"></div>' +
    '  <div class="form-group"><label>Compare-at Price ($)</label><input type="number" step="0.01" id="newComparePrice" placeholder="Optional \"was\" price"></div>' +
    '</div>' +
    '<div id="newMarginPreview" style="font-weight:700;font-size:0.95rem;margin:-6px 0 16px;"></div>' +

    '<div class="form-group"><label>Product Image URL *</label><input type="text" id="newImageUrl" placeholder="https://..."></div>' +
    '<div class="form-group"><label>Second Image URL (optional)</label><input type="text" id="newImageUrl2" placeholder="https://..."></div>' +
    '<div class="form-group"><label>Third Image URL (optional)</label><input type="text" id="newImageUrl3" placeholder="https://..."></div>' +
    '<div class="form-group"><label>Fourth Image URL (optional)</label><input type="text" id="newImageUrl4" placeholder="https://..."></div>' +
    '<div class="form-group"><label>Product Video URL (optional, from CJ API)</label><input type="text" id="newVideoUrl" placeholder="https://...mp4"></div>' +

    '<div class="form-group"><label>CJ Dropshipping Product URL</label><input type="text" id="newCjUrl" placeholder="https://cjdropshipping.com/product/..."></div>' +
    '<div class="form-group"><label>CJ Product ID / PID</label><input type="text" id="newCjId" placeholder="e.g. 1234567890"></div>' +

    '<div class="form-row">' +
    '  <div class="form-group"><label>Stock Status</label><select id="newStock">' +
    '    <option>In Stock</option><option>Low Stock</option><option>Out of Stock</option>' +
    '  </select></div>' +
    '  <div class="form-group"><label>Featured on Homepage</label><select id="newFeatured">' +
    '    <option value="false">No</option><option value="true">Yes</option>' +
    '  </select></div>' +
    '</div>' +

    '<button class="btn btn-primary btn-block" onclick="createNewProduct()"><i class="fa-solid fa-plus"></i> Add Product to Store</button>';

  document.getElementById('addProductContent').innerHTML = content;
  document.getElementById('addProductModal').classList.add('open');
}

function closeAddProductModal() {
  document.getElementById('addProductModal').classList.remove('open');
}

function applyMarkupToNewProduct() {
  const cjCost = parseFloat(document.getElementById('newCjCost').value) || 0;
  const cjShip = parseFloat(document.getElementById('newCjShipping').value) || 0;
  const markupPct = parseFloat(document.getElementById('newMarkupPct').value);
  const landed = cjCost + cjShip;
  if (landed > 0 && !isNaN(markupPct)) {
    const suggestedPrice = cjCost * (1 + markupPct / 100);
    document.getElementById('newPrice').value = suggestedPrice.toFixed(2);
  }
  updateNewMarginPreview();
}

function updateNewMarginPreview() {
  const priceEl = document.getElementById('newPrice');
  const previewEl = document.getElementById('newMarginPreview');
  if (!priceEl || !previewEl) return;

  const price = parseFloat(priceEl.value) || 0;
  const cjCost = parseFloat(document.getElementById('newCjCost').value) || 0;
  const cjShip = parseFloat(document.getElementById('newCjShipping').value) || 0;
  const landedCost = cjCost + cjShip;
  const profit = price - landedCost;
  const marginPct = price > 0 ? (profit / price) * 100 : 0;

  if (!cjCost && !cjShip) {
    previewEl.innerHTML = '<span style="color:var(--color-muted);font-weight:400;font-size:0.85rem;">Enter CJ cost to see your profit margin.</span>';
    return;
  }

  const color = profit <= 0 ? 'var(--color-danger)' : (marginPct < 20 ? '#b8860b' : 'var(--color-success)');
  const icon = profit <= 0 ? 'fa-triangle-exclamation' : 'fa-circle-check';
  const label = profit <= 0 ? 'You would LOSE ' + formatMoney(Math.abs(profit)) + ' per unit at this price!' : 'Profit: ' + formatMoney(profit) + ' per unit (' + marginPct.toFixed(0) + '% margin)';
  previewEl.innerHTML = '<span style="color:' + color + ';"><i class="fa-solid ' + icon + '"></i> ' + label + '</span> <span style="color:var(--color-muted);font-weight:400;font-size:0.82rem;">(landed cost: ' + formatMoney(landedCost) + ')</span>';
}

async function createNewProduct() {
  const name = document.getElementById('newName').value.trim();
  const shortDesc = document.getElementById('newShortDesc').value.trim();
  const description = document.getElementById('newDescription').value.trim();
  const category = document.getElementById('newCategory').value;
  const sku = document.getElementById('newSku').value.trim();
  const cjCost = document.getElementById('newCjCost').value === '' ? null : parseFloat(document.getElementById('newCjCost').value);
  const cjShipping = document.getElementById('newCjShipping').value === '' ? null : parseFloat(document.getElementById('newCjShipping').value);
  const price = parseFloat(document.getElementById('newPrice').value) || 0;
  const comparePrice = document.getElementById('newComparePrice').value === '' ? null : parseFloat(document.getElementById('newComparePrice').value);
  const imageUrl = document.getElementById('newImageUrl').value.trim();
  const imageUrl2 = document.getElementById('newImageUrl2').value.trim();
  const imageUrl3 = document.getElementById('newImageUrl3').value.trim();
  const imageUrl4 = document.getElementById('newImageUrl4').value.trim();
  const videoUrl = document.getElementById('newVideoUrl').value.trim();
  const cjUrl = document.getElementById('newCjUrl').value.trim();
  const cjId = document.getElementById('newCjId').value.trim();
  const stock = document.getElementById('newStock').value;
  const featured = document.getElementById('newFeatured').value === 'true';

  if (!name) { showToast('Please enter a product name'); return; }
  if (!imageUrl) { showToast('Please enter a product image URL'); return; }
  if (!price || price <= 0) { showToast('Please enter a selling price'); return; }

  if (cjCost != null && price <= (cjCost + (cjShipping || 0))) {
    const proceed = confirm('Warning: your selling price ($' + price.toFixed(2) + ') is at or below your CJ landed cost ($' + (cjCost + (cjShipping || 0)).toFixed(2) + '). You would lose money on every sale. Add anyway?');
    if (!proceed) return;
  }

  try {
    await apiCreate('products', {
      name: name,
      short_description: shortDesc,
      description: description,
      category: category,
      sku: sku,
      price: price,
      compare_at_price: comparePrice,
      image_url: imageUrl,
      image_url_2: imageUrl2,
      image_url_3: imageUrl3,
      image_url_4: imageUrl4,
      video_url: videoUrl,
      markup_percent: Number((window.KGS_CONFIG && KGS_CONFIG.CJ_MARKUP_PERCENT) || 30),
      currency: 'USD',
      cj_cost_price: cjCost,
      cj_shipping_cost: cjShipping,
      cj_product_url: cjUrl,
      cj_product_id: cjId,
      stock_status: stock,
      rating: 0,
      review_count: 0,
      featured: featured,
      badge: 'New'
    });
    showToast('Product added to your store!');
    closeAddProductModal();
    await loadAdminProducts();
  } catch (err) {
    console.error(err);
    showToast('Failed to add product');
  }
}


/* ===================== Backend CJ API importer ===================== */
async function searchCjCatalog() {
  const query = document.getElementById('cjSearchQuery').value.trim();
  const category = document.getElementById('cjImportCategory').value;
  const results = document.getElementById('cjSearchResults');
  if (!query) { showToast('Enter a kitchen product search term'); return; }
  results.innerHTML = '<p><i class="fa-solid fa-spinner fa-spin"></i> Searching CJ...</p>';
  try {
    const data = await apiFetchPath('cj/products/search?' + new URLSearchParams({ q: query, category: category, limit: 12 }).toString());
    const rows = Array.isArray(data) ? data : (data.data || data.products || []);
    if (!rows.length) { results.innerHTML = '<p>No CJ products found.</p>'; return; }
    results.innerHTML = '<div class="cj-import-grid">' + rows.map(function (p) {
      const pid = p.pid || p.id || p.productId || '';
      const image = p.image || p.image_url || p.productImage || '';
      const name = p.name || p.productNameEn || p.productName || 'CJ product';
      const cost = Number(p.price || p.sellPrice || p.productPrice || 0);
      const storePrice = calculateStorePrice(cost, KGS_CONFIG.CJ_MARKUP_PERCENT);
      return '<div class="cj-import-card">' +
        (image ? '<img src="' + escapeHtml(image) + '" alt="">' : '') +
        '<h4>' + escapeHtml(name) + '</h4>' +
        '<p>CJ: ' + formatMoney(cost) + ' · Store: ' + formatMoney(storePrice) + ' (+30%)</p>' +
        '<button class="btn btn-primary btn-sm" onclick="importCjProduct(\'' + escapeHtml(pid) + '\', \'' + escapeHtml(category) + '\')">Import as Draft</button>' +
        '</div>';
    }).join('') + '</div>';
  } catch (err) {
    results.innerHTML = '<p style="color:var(--color-danger);">CJ importer backend is not running yet. Start the Node.js backend on port 5000 and configure CJ API credentials.</p>';
  }
}

async function importCjProduct(pid, category) {
  try {
    await apiFetchPath('cj/products/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cj_product_id: pid, category: category, markup_percent: 30, currency: 'USD', status: 'draft' })
    });
    showToast('CJ product imported as draft with 30% markup');
    await loadAdminProducts();
  } catch (err) {
    showToast('CJ import needs the backend and CJ API credentials');
  }
}
