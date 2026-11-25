/* Checkout: local UI cart -> Medusa cart -> Stripe -> Medusa order */

let STRIPE = null;
let STRIPE_ELEMENTS = null;
let STRIPE_PAYMENT_ELEMENT = null;
let MEDUSA_CHECKOUT_CART = null;
let STRIPE_CLIENT_SECRET = '';
let CHECKOUT_INITIALIZED = false;
let CHECKOUT_BUSY = false;
let PAYMENT_PROCESSING = false;

const KGS_STRIPE_SECRET_KEY = 'kgs_stripe_client_secret';
const KGS_STRIPE_CART_ID_KEY = 'kgs_stripe_medusa_cart_id';

function setPaymentStatus(message, isError) {
  const el = document.getElementById('paymentStatus');
  if (!el) return;
  el.textContent = message || '';
  el.style.color = isError ? 'var(--color-danger)' : 'var(--color-muted)';
}

function setCheckoutButton(label, disabled) {
  const btn = document.getElementById('placeOrderBtn');
  if (!btn) return;
  btn.disabled = !!disabled;
  btn.innerHTML = label;
}

function readyButton() {
  setCheckoutButton('<i class="fa-solid fa-lock"></i> Pay & Place Order', false);
}

function paymentReturnUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set('payment_return', '1');
  url.hash = '';
  return url.toString();
}

function clearStripeCheckoutSession() {
  sessionStorage.removeItem(KGS_STRIPE_SECRET_KEY);
  sessionStorage.removeItem(KGS_STRIPE_CART_ID_KEY);
}

function renderMiniCart() {
  const cart = getCart();
  const wrap = document.getElementById('miniCartItems');
  wrap.innerHTML = cart.map(function (item) {
    return '<div class="mini-cart-item"><img src="' + item.image_url + '" alt="' + escapeHtml(item.name) + '"><div><div class="name">' + escapeHtml(item.name) + '</div><div class="qty">Qty: ' + item.qty + '</div></div><div class="price">' + formatMoney(item.qty * item.price) + '</div></div>';
  }).join('');

  const subtotal = cartSubtotal();
  const shipping = computeShipping(subtotal);
  const tax = computeTax(subtotal);
  const total = subtotal + shipping + tax;

  document.getElementById('sumSubtotal').textContent = formatMoney(subtotal);
  document.getElementById('sumShipping').textContent = formatMoney(shipping);
  document.getElementById('sumTaxRow').style.display = tax > 0 ? 'flex' : 'none';
  if (tax > 0) document.getElementById('sumTax').textContent = formatMoney(tax);
  document.getElementById('sumTotal').textContent = formatMoney(total);
}

async function syncLocalCartToMedusa(cart) {
  let medusaCart = await ensureMedusaCart();

  if (medusaCart.items && medusaCart.items.length) {
    for (const line of medusaCart.items) {
      await removeMedusaLineItem(medusaCart.id, line.id);
    }
    medusaCart = await getMedusaCart();
  }

  for (const item of cart) {
    const variantId = await resolveVariantId(item);
    medusaCart = await addMedusaLineItem(medusaCart.id, variantId, item.qty);
  }

  return getMedusaCart();
}

function countryToIso2(country) {
  const map = {
    'United States': 'us',
    'Canada': 'ca',
    'United Kingdom': 'gb',
    'Australia': 'au',
    'Germany': 'de',
    'France': 'fr'
  };
  return map[country] || 'us';
}

async function updateCheckoutCartDetails() {
  const cart = MEDUSA_CHECKOUT_CART;
  const countryName = document.getElementById('shippingCountry').value;
  const name = document.getElementById('customerName').value.trim();
  const nameParts = name.split(/\s+/).filter(Boolean);

  const address = {
    first_name: nameParts[0] || name,
    last_name: nameParts.slice(1).join(' ') || '',
    address_1: document.getElementById('shippingAddress').value.trim(),
    city: document.getElementById('shippingCity').value.trim(),
    province: document.getElementById('shippingState').value.trim(),
    postal_code: document.getElementById('shippingZip').value.trim(),
    country_code: countryToIso2(countryName),
    phone: document.getElementById('customerPhone').value.trim()
  };

  return updateMedusaCart(cart.id, {
    email: document.getElementById('customerEmail').value.trim(),
    shipping_address: address,
    billing_address: address,
    metadata: {
      store: 'Kitchen Gadget Shops',
      order_notes: document.getElementById('orderNotes').value.trim()
    }
  });
}

async function configureShipping(cart) {
  const options = await getMedusaShippingOptions(cart.id);

  if (!options.length) {
    throw new Error('No shipping option is available for this delivery address.');
  }

  const freeOption = options.find(function (option) {
    const amount = option.calculated_price &&
      option.calculated_price.calculated_amount;

    return amount !== undefined &&
      amount !== null &&
      Number(amount) === 0;
  });

  if (!freeOption) {
    throw new Error('Free shipping is not available for this cart. Checkout has been stopped to prevent a shipping charge.');
  }

  await addMedusaShippingMethod(cart.id, freeOption.id);
  return getMedusaCart();
}

function getStripeClient() {
  if (!window.Stripe) {
    throw new Error('Stripe.js could not be loaded. Check your internet connection and try again.');
  }

  const stripeKey = (window.KGS_CONFIG && KGS_CONFIG.STRIPE_PUBLISHABLE_KEY) || '';
  if (!stripeKey || stripeKey.indexOf('PASTE_') === 0) {
    throw new Error('Add your Stripe Publishable Key (pk_live_...) to js/config.js before using checkout.');
  }

  STRIPE = STRIPE || window.Stripe(stripeKey);
  return STRIPE;
}

function mountStripePaymentElement(clientSecret) {
  const stripe = getStripeClient();
  const mountPoint = document.getElementById('payment-element');

  if (!mountPoint) {
    throw new Error('The secure payment form could not be found on this page.');
  }

  // Avoid mounting a second Payment Element over an existing one.
  if (STRIPE_PAYMENT_ELEMENT) {
    try {
      STRIPE_PAYMENT_ELEMENT.unmount();
    } catch (_) {}
    STRIPE_PAYMENT_ELEMENT = null;
  }

  STRIPE_CLIENT_SECRET = clientSecret;
  STRIPE_ELEMENTS = stripe.elements({
    clientSecret: clientSecret,
    appearance: { theme: 'stripe' }
  });

  STRIPE_PAYMENT_ELEMENT = STRIPE_ELEMENTS.create('payment');
  STRIPE_PAYMENT_ELEMENT.mount('#payment-element');
  CHECKOUT_INITIALIZED = true;
}

async function initializeStripePayment(cart) {
  const stripe = getStripeClient();
  const paymentCollection = await initiateMedusaPayment(cart.id, 'pp_stripe_stripe');

  const session = (paymentCollection.payment_sessions || []).find(function (s) {
    return s.provider_id === 'pp_stripe_stripe';
  });

  const clientSecret = session && session.data && session.data.client_secret;
  if (!clientSecret) {
    throw new Error('Medusa initialized Stripe, but no Stripe client secret was returned. Check that Stripe is enabled for the cart region.');
  }

  // Keep the existing payment session available if Stripe redirects for authentication.
  STRIPE_CLIENT_SECRET = clientSecret;
  sessionStorage.setItem(KGS_STRIPE_SECRET_KEY, clientSecret);
  sessionStorage.setItem(KGS_STRIPE_CART_ID_KEY, cart.id);

  mountStripePaymentElement(clientSecret);
  setPaymentStatus('Secure payment form is ready. Enter your payment details, then select Pay & Place Order.');
}

async function prepareCheckout() {
  const localCart = getCart();

  setPaymentStatus('Preparing secure checkout...');
  MEDUSA_CHECKOUT_CART = await syncLocalCartToMedusa(localCart);
  MEDUSA_CHECKOUT_CART = await updateCheckoutCartDetails();
  MEDUSA_CHECKOUT_CART = await configureShipping(MEDUSA_CHECKOUT_CART);

  renderMiniCart();
  await initializeStripePayment(MEDUSA_CHECKOUT_CART);
}

async function completeVerifiedPayment(paymentIntent) {
  if (!paymentIntent || !paymentIntent.id) {
    throw new Error('Stripe did not return a verifiable PaymentIntent. The order has not been completed.');
  }

  if (paymentIntent.status !== 'requires_capture' && paymentIntent.status !== 'succeeded') {
    if (paymentIntent.status === 'processing') {
      PAYMENT_PROCESSING = true;
      setCheckoutButton('<i class="fa-solid fa-clock"></i> Payment Processing', true);
      setPaymentStatus('Your payment is still processing. Please do not submit another payment. The order will not be completed until Stripe confirms authorization.', false);
      return;
    }

    throw new Error('Stripe has not confirmed an authorized or successful payment. Current payment status: ' + paymentIntent.status + '. The order has not been completed.');
  }

  if (!MEDUSA_CHECKOUT_CART || !MEDUSA_CHECKOUT_CART.total) {
    throw new Error('Cannot verify the Medusa cart total. Order completion stopped.');
  }

  const expectedAmount = Math.round(Number(MEDUSA_CHECKOUT_CART.total));
  const actualAmount = Number(paymentIntent.amount);
  const expectedCurrency = String(MEDUSA_CHECKOUT_CART.currency_code || '').toLowerCase();
  const actualCurrency = String(paymentIntent.currency || '').toLowerCase();

  if (
    !Number.isFinite(expectedAmount) ||
    expectedAmount <= 0 ||
    actualAmount !== expectedAmount ||
    !expectedCurrency ||
    actualCurrency !== expectedCurrency
  ) {
    throw new Error('Stripe payment amount or currency does not match the Medusa cart. Order completion stopped. Contact support before retrying.');
  }

  if (CHECKOUT_BUSY) return;
  CHECKOUT_BUSY = true;

  try {
    setPaymentStatus('Stripe has confirmed payment authorization. Completing your Medusa order...');
    const completed = await completeMedusaCart(MEDUSA_CHECKOUT_CART.id);

    if (completed.type === 'cart') {
      throw new Error((completed.error && completed.error.message) || 'Medusa could not complete the cart.');
    }

    if (completed.type !== 'order' || !completed.order) {
      throw new Error('Medusa did not return a completed order.');
    }

    const order = completed.order;

    clearCart();
    clearMedusaCartId();
    clearStripeCheckoutSession();

    sessionStorage.setItem('kgs_last_order', JSON.stringify(order));
    window.location.href = 'order-confirmation.html?order=' + encodeURIComponent(order.id);
  } catch (err) {
    CHECKOUT_BUSY = false;
    throw err;
  }
}

async function retrieveAndHandleExistingPayment(isReturn) {
  const savedSecret = sessionStorage.getItem(KGS_STRIPE_SECRET_KEY);
  const savedCartId = sessionStorage.getItem(KGS_STRIPE_CART_ID_KEY);

  if (!savedSecret || !savedCartId) {
    if (isReturn) {
      setPaymentStatus('We could not find this checkout session in this browser. Please contact support before attempting another payment.', true);
      setCheckoutButton('<i class="fa-solid fa-lock"></i> Payment Requires Review', true);
      return true;
    }
    return false;
  }

  getStripeClient();

  const cart = await getMedusaCart();
  if (!cart || cart.id !== savedCartId) {
    throw new Error('The saved Medusa checkout cart could not be verified. Please contact support before attempting another payment.');
  }

  MEDUSA_CHECKOUT_CART = cart;
  STRIPE_CLIENT_SECRET = savedSecret;

  const result = await STRIPE.retrievePaymentIntent(savedSecret);
  if (result.error) {
    throw new Error(result.error.message || 'Stripe could not retrieve the existing payment.');
  }

  const paymentIntent = result.paymentIntent;
  if (!paymentIntent) {
    throw new Error('Stripe did not return the existing PaymentIntent.');
  }

  if (paymentIntent.status === 'requires_capture' || paymentIntent.status === 'succeeded') {
    await completeVerifiedPayment(paymentIntent);
    return true;
  }

  if (
    paymentIntent.status === 'requires_payment_method' ||
    paymentIntent.status === 'requires_confirmation' ||
    paymentIntent.status === 'requires_action'
  ) {
    mountStripePaymentElement(savedSecret);
    readyButton();
    setPaymentStatus(
      paymentIntent.status === 'requires_payment_method'
        ? 'Your previous payment attempt was not completed. Enter your payment details and try again.'
        : 'Your payment needs another confirmation step. Follow the instructions in the secure payment form.',
      false
    );
    return true;
  }

  if (paymentIntent.status === 'processing') {
    PAYMENT_PROCESSING = true;
    setCheckoutButton('<i class="fa-solid fa-clock"></i> Payment Processing', true);
    setPaymentStatus('Your payment is still processing. Please do not submit another payment. We will not complete the order until Stripe confirms the payment.', false);
    return true;
  }

  setPaymentStatus('The existing Stripe payment is in status "' + paymentIntent.status + '". Do not submit another payment yet. Please contact support so the payment can be checked.', true);
  setCheckoutButton('<i class="fa-solid fa-lock"></i> Payment Requires Review', true);
  return true;
}

async function handleCheckoutSubmit(evt) {
  evt.preventDefault();

  const cart = getCart();
  if (!cart.length) {
    showToast('Your cart is empty');
    return;
  }

  if (CHECKOUT_BUSY || PAYMENT_PROCESSING) return;

  setCheckoutButton('<i class="fa-solid fa-spinner fa-spin"></i> Processing...', true);

  try {
    // First click only prepares the cart and mounts the payment form.
    if (!CHECKOUT_INITIALIZED) {
      await prepareCheckout();
      readyButton();
      setPaymentStatus('Secure payment form is ready. Enter your payment details, then select Pay & Place Order.');
      return;
    }

    MEDUSA_CHECKOUT_CART = await updateCheckoutCartDetails();

    const submitResult = await STRIPE_ELEMENTS.submit();
    if (submitResult.error) {
      throw new Error(submitResult.error.message);
    }

    setPaymentStatus('Confirming your payment securely...');

    const result = await STRIPE.confirmPayment({
      elements: STRIPE_ELEMENTS,
      clientSecret: STRIPE_CLIENT_SECRET,
      confirmParams: {
        return_url: paymentReturnUrl()
      },
      redirect: 'if_required'
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    // Some redirect/payment flows may not return the PaymentIntent directly.
    let paymentIntent = result.paymentIntent;
    if (!paymentIntent) {
      const retrieved = await STRIPE.retrievePaymentIntent(STRIPE_CLIENT_SECRET);
      if (retrieved.error) {
        throw new Error(retrieved.error.message || 'Could not verify the Stripe payment status.');
      }
      paymentIntent = retrieved.paymentIntent;
    }

    await completeVerifiedPayment(paymentIntent);

    if (!CHECKOUT_BUSY && !PAYMENT_PROCESSING) {
      readyButton();
    }
  } catch (err) {
    console.error('Checkout failed', err);
    setPaymentStatus(err.message || 'Payment failed. Please try again.', true);

    if (!CHECKOUT_BUSY && !PAYMENT_PROCESSING) {
      readyButton();
    }

    showToast(err.message || 'Something went wrong during checkout.');
  }
}

async function initCheckoutPage() {
  const cart = getCart();

  if (!cart.length) {
    document.getElementById('checkoutEmptyState').style.display = 'block';
    document.getElementById('checkoutForm').style.display = 'none';
    return;
  }

  document.getElementById('checkoutForm').style.display = 'grid';
  renderMiniCart();

  const form = document.getElementById('checkoutForm');
  form.addEventListener('submit', handleCheckoutSubmit);

  const url = new URL(window.location.href);
  const isReturn = url.searchParams.get('payment_return') === '1';

  if (isReturn) {
    // Remove the return marker so a refresh does not repeatedly process the same URL.
    url.searchParams.delete('payment_return');
    window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
  }

  try {
    const restored = await retrieveAndHandleExistingPayment(isReturn);
    if (restored) return;
  } catch (err) {
    console.error('Could not restore Stripe checkout session', err);
    setPaymentStatus(err.message || 'Could not restore the existing payment session.', true);
    setCheckoutButton('<i class="fa-solid fa-lock"></i> Payment Requires Review', true);
  }
}

document.addEventListener('DOMContentLoaded', initCheckoutPage);
