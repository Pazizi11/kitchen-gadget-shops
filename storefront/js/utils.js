/* ==========================================================================
   Kitchen Gadget Shops â€” Shared Utilities
   Local UI cart + Medusa Store API checkout helpers
   ========================================================================== */

const CART_KEY = 'kgs_cart_v1';
const MEDUSA_CART_KEY = 'kgs_medusa_cart_id';

const TAX_RATE = 0.0;

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
}

function getMedusaCartId() {
  return localStorage.getItem(MEDUSA_CART_KEY) || '';
}

function setMedusaCartId(id) {
  if (id) localStorage.setItem(MEDUSA_CART_KEY, id);
}

function clearMedusaCartId() {
  localStorage.removeItem(MEDUSA_CART_KEY);
}

function addToCart(product, qty) {
  qty = qty || 1;

  const cart = getCart();
  const variant = (product.variants && product.variants[0]) || {};
  const variantId = product.variant_id || variant.id || '';

  const existing = cart.find(function (item) {
    return item.id === product.id;
  });

  if (existing) {
    existing.qty += qty;

    if (!existing.variant_id && variantId) {
      existing.variant_id = variantId;
    }
  } else {
    cart.push({
      id: product.id,
      variant_id: variantId,
      name: product.name,
      price: Number(product.price || 0),
      image_url: product.image_url,
      sku: product.sku,
      cj_product_url: product.cj_product_url,
      qty: qty
    });
  }

  saveCart(cart);
  showToast(product.name + ' added to cart');
}

function updateCartQty(productId, qty) {
  const cart = getCart();

  const item = cart.find(function (i) {
    return i.id === productId;
  });

  if (item) {
    item.qty = Math.max(1, qty);
    saveCart(cart);
  }
}

function removeFromCart(productId) {
  saveCart(
    getCart().filter(function (i) {
      return i.id !== productId;
    })
  );
}

function clearCart() {
  localStorage.removeItem(CART_KEY);
  updateCartBadge();
}

function cartCount() {
  return getCart().reduce(function (sum, i) {
    return sum + i.qty;
  }, 0);
}

function cartSubtotal() {
  return getCart().reduce(function (sum, i) {
    return sum + i.qty * Number(i.price || 0);
  }, 0);
}

function computeShipping(subtotal) {
  return 0;
}

function computeTax(subtotal) {
  return +(subtotal * TAX_RATE).toFixed(2);
}

function updateCartBadge() {
  document.querySelectorAll('.cart-count').forEach(function (b) {
    const count = cartCount();

    b.textContent = count;
    b.style.display = count > 0 ? 'flex' : 'none';
  });
}

function formatMoney(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency:
      (window.KGS_CONFIG && KGS_CONFIG.CURRENCY) || 'USD'
  }).format(Number(n || 0));
}

function calculateStorePrice(cjProductPrice, markupPercent) {
  const cost = Number(cjProductPrice || 0);

  const markup = Number(
    markupPercent == null
      ? ((window.KGS_CONFIG && KGS_CONFIG.CJ_MARKUP_PERCENT) || 30)
      : markupPercent
  );

  return +(cost * (1 + markup / 100)).toFixed(2);
}

function starHtml(rating) {
  rating = rating || 0;

  const full = Math.round(rating);
  let html = '';

  for (let i = 0; i < 5; i++) {
    html +=
      i < full
        ? '<i class="fa-solid fa-star"></i>'
        : '<i class="fa-regular fa-star"></i>';
  }

  return html;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';

  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(message) {
  let toast = document.querySelector('.toast');

  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }

  toast.innerHTML =
    '<i class="fa-solid fa-circle-check"></i><span></span>';

  toast.querySelector('span').textContent = message;

  toast.classList.add('show');

  clearTimeout(toast._timer);

  toast._timer = setTimeout(function () {
    toast.classList.remove('show');
  }, 2600);
}


/* ==========================================================================
   MEDUSA STORE API
   ========================================================================== */

const MEDUSA_ROOT =
  ((window.KGS_CONFIG && KGS_CONFIG.MEDUSA_BACKEND_URL) || '')
    .replace(/\/$/, '');

const MEDUSA_PUBLISHABLE_KEY =
  (window.KGS_CONFIG && KGS_CONFIG.MEDUSA_PUBLISHABLE_KEY) || '';

function medusaUrl(path) {
  return (
    MEDUSA_ROOT +
    '/' +
    String(path || '').replace(/^\//, '')
  );
}

async function medusaFetch(path, options) {
  options = options || {};

  options.headers = Object.assign(
    {
      'Content-Type': 'application/json',
      'x-publishable-api-key': MEDUSA_PUBLISHABLE_KEY
    },
    options.headers || {}
  );

  if (
    typeof getCustomerToken === 'function' &&
    getCustomerToken()
  ) {
    options.headers.Authorization =
      'Bearer ' + getCustomerToken();
  }

  if (!MEDUSA_ROOT) {
    throw new Error('Medusa backend URL is not configured.');
  }

  if (
    !MEDUSA_PUBLISHABLE_KEY ||
    MEDUSA_PUBLISHABLE_KEY.indexOf('PASTE_') === 0
  ) {
    throw new Error(
      'Medusa publishable API key is not configured in js/config.js.'
    );
  }

  const res = await fetch(medusaUrl(path), options);

  if (!res.ok) {
    const text = await res.text().catch(function () {
      return '';
    });

    const err = new Error(
      'Medusa API request failed: ' +
        res.status +
        (text ? ' ' + text : '')
    );

    err.status = res.status;
    err.body = text;

    throw err;
  }

  if (res.status === 204) return null;

  return res.json();
}


/* ==========================================================================
   MEDUSA PRODUCT MAPPING
   IMPORTANT:
   Medusa amounts are returned in the smallest currency unit.
   For USD:
   321 cents = $3.21
   247 cents = $2.47
   ========================================================================== */

function mapMedusaProduct(p) {
  p = p || {};

  const variant =
    (p.variants && p.variants[0]) || {};

  const cp =
    variant.calculated_price || {};


  // FIX:
  // Medusa calculated_amount is in cents.
  // 321 must become 3.21, not 321.00.
  const price =
    cp.calculated_amount != null
      ? Number(cp.calculated_amount) / 100
      : (
          variant.prices &&
          variant.prices[0]
            ? Number(variant.prices[0].amount || 0) / 100
            : 0
        );


  // FIX:
  // original_amount is also returned in cents.
  const original =
    cp.original_amount != null
      ? Number(cp.original_amount) / 100
      : null;


  /*
   * Medusa normally returns images as:
   *   { url: "https://..." }
   *
   * Some CJ-imported products may contain a JSON array inside
   * the image URL field, for example:
   *   "[\"https://image1.jpg\",\"https://image2.jpg\"]"
   *
   * Normalize both formats into individual image URLs so the
   * browser never tries to request the whole JSON array as a URL.
   */
  const imageUrls = [];

  (p.images || []).forEach(function (x) {
    if (!x || !x.url) return;

    const rawUrl = String(x.url).trim();

    // CJ may store several image URLs as a JSON string.
    if (rawUrl.startsWith('[') && rawUrl.endsWith(']')) {
      try {
        const parsed = JSON.parse(rawUrl);

        if (Array.isArray(parsed)) {
          parsed.forEach(function (url) {
            if (
              typeof url === 'string' &&
              /^https?:\/\//i.test(url.trim())
            ) {
              imageUrls.push(url.trim());
            }
          });

          return;
        }
      } catch (err) {
        console.warn('Could not parse CJ image URL array:', err);
      }
    }

    // Normal Medusa image URL.
    if (/^https?:\/\//i.test(rawUrl)) {
      imageUrls.push(rawUrl);
    }
  });

  // Remove duplicate image URLs while preserving their order.
  const uniqueImageUrls = imageUrls.filter(function (url, index) {
    return imageUrls.indexOf(url) === index;
  });


  return {
    id: p.id,

    name: p.title || p.name || '',

    title: p.title || p.name || '',

    description: p.description || '',

    short_description:
      p.subtitle || p.description || '',

    price: price,

    compare_at_price:
      original && original > price
        ? original
        : null,

    currency:
      cp.currency_code ||
      KGS_CONFIG.CURRENCY,

    category:
      (p.categories &&
        p.categories[0] &&
        p.categories[0].name) ||
      'Gadgets & Tools',

    image_url:
      uniqueImageUrls[0] ||
      (p.thumbnail && /^https?:\/\//i.test(p.thumbnail)
        ? p.thumbnail
        : ''),

    image_url_2:
      uniqueImageUrls[1] || '',

    image_url_3:
      uniqueImageUrls[2] || '',

    image_url_4:
      uniqueImageUrls[3] || '',

    sku:
      variant.sku || '',

    variant_id:
      variant.id || '',

    stock_status:
      variant.manage_inventory === false ||
      (
        variant.inventory_quantity == null ||
        variant.inventory_quantity > 0
      )
        ? 'In Stock'
        : 'Out of Stock',

    rating:
      Number(
        (p.metadata && p.metadata.rating) || 0
      ),

    review_count:
      Number(
        (p.metadata && p.metadata.review_count) || 0
      ),

    featured:
      Boolean(
        p.metadata && p.metadata.featured
      ),

    badge:
      (p.metadata && p.metadata.badge) || '',

    created_at:
      p.created_at || '',

    variants:
      p.variants || []
  };
}


/* ==========================================================================
   MEDUSA PRODUCTS
   ========================================================================== */

async function apiGetAll(table, extraParams) {
  extraParams = extraParams || {};

  if (table !== 'products') {
    throw new Error(
      'This frontend adapter currently supports products through Medusa.'
    );
  }

  const params = new URLSearchParams();

  params.set(
    'limit',
    String(extraParams.limit || 100)
  );

  params.set(
    'offset',
    String(extraParams.offset || 0)
  );

  params.set(
    'fields',
    '*variants.calculated_price,*categories'
  );

  try {
    params.set(
      'region_id',
      (await findUsdRegion()).id
    );
  } catch (e) {}

  if (extraParams.category) {
    params.set(
      'category_id',
      extraParams.category
    );
  }

  const result = await medusaFetch(
    'store/products?' + params.toString()
  );

  return (result.products || []).map(
    mapMedusaProduct
  );
}

async function apiGetOne(table, id) {
  if (table !== 'products') {
    throw new Error(
      'This frontend adapter currently supports products through Medusa.'
    );
  }

  const params = new URLSearchParams();

  params.set(
    'fields',
    '*variants.calculated_price,*categories'
  );

  try {
    params.set(
      'region_id',
      (await findUsdRegion()).id
    );
  } catch (e) {}

  const result = await medusaFetch(
    'store/products/' +
      encodeURIComponent(id) +
      '?' +
      params.toString()
  );

  return mapMedusaProduct(result.product);
}


/* ==========================================================================
   MEDUSA REGIONS
   ========================================================================== */

async function getMedusaRegions() {
  const result =
    await medusaFetch(
      'store/regions?limit=100'
    );

  return result.regions || [];
}

async function findUsdRegion() {
  const regions =
    await getMedusaRegions();

  const region =
    regions.find(function (r) {
      return (
        String(r.currency_code || '')
          .toLowerCase() === 'usd'
      );
    }) ||
    regions[0];

  if (!region) {
    throw new Error(
      'No Medusa region is configured. Create a USD region in Medusa Admin first.'
    );
  }

  return region;
}


/* ==========================================================================
   MEDUSA CART
   ========================================================================== */

async function createMedusaCart() {
  const region =
    await findUsdRegion();

  const payload = {
    region_id: region.id
  };


  if (
    window.KGS_CONFIG &&
    KGS_CONFIG.MEDUSA_SALES_CHANNEL_ID
  ) {
    payload.sales_channel_id =
      KGS_CONFIG.MEDUSA_SALES_CHANNEL_ID;
  }

  const result =
    await medusaFetch(
      'store/carts',
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    );

  setMedusaCartId(
    result.cart.id
  );

  return result.cart;
}

async function getMedusaCart() {
  const id =
    getMedusaCartId();

  if (!id) return null;

  try {
    const result =
      await medusaFetch(
        'store/carts/' +
          encodeURIComponent(id)
      );

    return result.cart || null;
  } catch (e) {
    if (e.status === 404) {
      clearMedusaCartId();
    }

    return null;
  }
}

async function ensureMedusaCart() {
  const existing =
    await getMedusaCart();

  if (existing) {
    return ensureCartBelongsToCustomer(existing);
  }

  return createMedusaCart();
}

async function resolveVariantId(item) {
  if (item.variant_id) {
    return item.variant_id;
  }

  const product =
    await apiGetOne(
      'products',
      item.id
    );

  if (!product.variant_id) {
    throw new Error(
      'No purchasable variant was found for ' +
        item.name +
        '.'
    );
  }

  item.variant_id =
    product.variant_id;

  saveCart(getCart());

  return product.variant_id;
}

async function addMedusaLineItem(
  cartId,
  variantId,
  quantity
) {
  const result =
    await medusaFetch(
      'store/carts/' +
        encodeURIComponent(cartId) +
        '/line-items',
      {
        method: 'POST',

        body: JSON.stringify({
          variant_id: variantId,
          quantity: quantity
        })
      }
    );

  return result.cart;
}

async function updateMedusaLineItem(
  cartId,
  lineItemId,
  quantity
) {
  const result =
    await medusaFetch(
      'store/carts/' +
        encodeURIComponent(cartId) +
        '/line-items/' +
        encodeURIComponent(lineItemId),
      {
        method: 'POST',

        body: JSON.stringify({
          quantity: quantity
        })
      }
    );

  return result.cart;
}

async function removeMedusaLineItem(
  cartId,
  lineItemId
) {
  const result =
    await medusaFetch(
      'store/carts/' +
        encodeURIComponent(cartId) +
        '/line-items/' +
        encodeURIComponent(lineItemId),
      {
        method: 'DELETE'
      }
    );

  return result.cart;
}

async function updateMedusaCart(
  cartId,
  data
) {
  const result =
    await medusaFetch(
      'store/carts/' +
        encodeURIComponent(cartId),
      {
        method: 'POST',
        body: JSON.stringify(data)
      }
    );

  return result.cart;
}


/* ==========================================================================
   MEDUSA SHIPPING
   ========================================================================== */

async function addMedusaShippingMethod(
  cartId,
  optionId
) {
  const result =
    await medusaFetch(
      'store/carts/' +
        encodeURIComponent(cartId) +
        '/shipping-methods',
      {
        method: 'POST',

        body: JSON.stringify({
          option_id: optionId
        })
      }
    );

  return result.cart;
}

async function getMedusaShippingOptions(
  cartId
) {
  const result =
    await medusaFetch(
      'store/shipping-options?cart_id=' +
        encodeURIComponent(cartId)
    );

  return result.shipping_options || [];
}


/* ==========================================================================
   MEDUSA PAYMENTS
   ========================================================================== */

async function initiateMedusaPayment(
  cartId,
  providerId
) {
  const collectionResult = await medusaFetch(
    'store/payment-collections',
    {
      method: 'POST',
      body: JSON.stringify({
        cart_id: cartId
      })
    }
  );

  const paymentCollection = collectionResult.payment_collection;

  if (!paymentCollection || !paymentCollection.id) {
    throw new Error('Medusa did not return a payment collection.');
  }

  const sessionResult = await medusaFetch(
    'store/payment-collections/' +
      encodeURIComponent(paymentCollection.id) +
      '/payment-sessions',
    {
      method: 'POST',
      body: JSON.stringify({
        provider_id: providerId
      })
    }
  );

  return sessionResult.payment_collection;
}

async function completeMedusaCart(
  cartId
) {
  return medusaFetch(
    'store/carts/' +
      encodeURIComponent(cartId) +
      '/complete',
    {
      method: 'POST',
      body: JSON.stringify({})
    }
  );
}


/* ==========================================================================
   NEWSLETTER / ORDER HELPERS
   ========================================================================== */

async function subscribeNewsletter(email, form) {
  const submitButton = form
    ? form.querySelector('button[type="submit"]')
    : null;

  if (submitButton && submitButton.disabled) {
    return false;
  }

  const originalButtonContent = submitButton
    ? submitButton.innerHTML
    : '';

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.setAttribute('aria-busy', 'true');
    submitButton.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i>';
  }

  try {
    await medusaFetch('store/newsletter/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email: email })
    });

    if (form) {
      form.reset();
    }

    showToast('Thanks for subscribing!');
    return true;
  } catch (error) {
    console.error('Newsletter subscription failed:', error);
    showToast(
      'Unable to subscribe right now. Please try again.'
    );
    return false;
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.removeAttribute('aria-busy');
      submitButton.innerHTML = originalButtonContent;
    }
  }
}

function generateOrderNumber() {
  const rand =
    Math.floor(
      10000 + Math.random() * 89999
    );

  return 'KGS-' + rand;
}


/* ==========================================================================
   ADMIN MUTATIONS
   ========================================================================== */

// Admin mutations intentionally remain disabled
// in the public storefront.

async function apiCreate(table) {
  throw new Error(
    'Direct browser order creation is disabled. Checkout now uses the Medusa cart/payment flow.'
  );
}

async function apiUpdate(table) {
  throw new Error(
    'Admin mutations must be performed through Medusa Admin/server-side integration.'
  );
}

async function apiDelete(table) {
  throw new Error(
    'Admin mutations must be performed through Medusa Admin/server-side integration.'
  );
}


document.addEventListener(
  'DOMContentLoaded',
  updateCartBadge
);




