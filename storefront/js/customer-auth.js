
/* Kitchen Gadget Shops â€” Medusa customer authentication */

const CUSTOMER_AUTH_KEY =
  (window.KGS_CONFIG && KGS_CONFIG.CUSTOMER_AUTH_STORAGE_KEY) ||
  'kgs_customer_auth_v1';

function getCustomerAuth() {
  try {
    return JSON.parse(
      localStorage.getItem(CUSTOMER_AUTH_KEY) || 'null'
    );
  } catch (e) {
    return null;
  }
}

function getCustomerToken() {
  const auth = getCustomerAuth();
  return auth && auth.token ? auth.token : '';
}

function setCustomerAuth(token, customer) {
  localStorage.setItem(
    CUSTOMER_AUTH_KEY,
    JSON.stringify({
      token: token || '',
      customer: customer || null
    })
  );
}

function clearCustomerAuth() {
  localStorage.removeItem(CUSTOMER_AUTH_KEY);
}

function isCustomerLoggedIn() {
  return !!getCustomerToken();
}

/*
 * Build headers for all Medusa customer/auth requests.
 *
 * IMPORTANT:
 * Every Store API request must include:
 * x-publishable-api-key
 *
 * The products and regions requests are already proving that
 * KGS_CONFIG.MEDUSA_PUBLISHABLE_KEY is working correctly.
 */
function customerAuthHeaders(extra) {
  const headers = Object.assign({}, extra || {});

  const publishableKey =
    window.KGS_CONFIG && KGS_CONFIG.MEDUSA_PUBLISHABLE_KEY;

  if (publishableKey) {
    headers['x-publishable-api-key'] = publishableKey;
  }

  const token = getCustomerToken();

  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  return headers;
}

async function customerAuthFetch(path, options) {
  options = options || {};

  options.headers = customerAuthHeaders(
    Object.assign(
      {
        'Content-Type': 'application/json'
      },
      options.headers || {}
    )
  );

  const res = await fetch(medusaUrl(path), options);

  const text = await res.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = null;
  }

  if (!res.ok) {
    const message =
      data && data.message
        ? data.message
        : data && data.error
        ? data.error.message || data.error
        : 'Request failed: ' + res.status;

    const err = new Error(message);
    err.status = res.status;
    err.data = data;

    throw err;
  }

  return data;
}

async function registerCustomerAccount(data) {
  /*
   * Step 1:
   * Register the customer's email/password authentication identity.
   */
  const auth = await customerAuthFetch(
    'auth/customer/emailpass/register',
    {
      method: 'POST',
      body: JSON.stringify({
        email: data.email,
        password: data.password
      })
    }
  );

  const token =
    typeof auth === 'string'
      ? auth
      : auth && (auth.token || auth.access_token);

  if (!token) {
    throw new Error(
      'Medusa did not return a registration token.'
    );
  }

  /*
   * Step 2:
   * Create the actual Store customer record.
   *
   * customerAuthHeaders() now automatically adds:
   * x-publishable-api-key
   */
  const customerResult = await customerAuthFetch(
    'store/customers',
    {
      method: 'POST',

      headers: {
        Authorization: 'Bearer ' + token
      },

      body: JSON.stringify({
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone || ''
      })
    }
  );

  /*
   * A registration token may not be the long-lived login token.
   * Log in after registration.
   */
  const login = await loginCustomer(
    data.email,
    data.password,
    false
  );

  return (
    login || {
      customer: customerResult.customer
    }
  );
}

async function loginCustomer(email, password, persist) {
  const auth = await customerAuthFetch(
    'auth/customer/emailpass',
    {
      method: 'POST',

      body: JSON.stringify({
        email: email,
        password: password
      })
    }
  );

  const token =
    typeof auth === 'string'
      ? auth
      : auth && (auth.token || auth.access_token);

  if (!token) {
    throw new Error(
      'Medusa did not return a login token.'
    );
  }

  /*
   * Keep the existing behavior.
   */
  setCustomerAuth(token, null);

  const customer = await getCurrentCustomer();

  setCustomerAuth(token, customer);

  return {
    token: token,
    customer: customer
  };
}

async function getCurrentCustomer() {
  if (!getCustomerToken()) {
    return null;
  }

  try {
    const result = await customerAuthFetch(
      'store/customers/me'
    );

    return result.customer || null;
  } catch (e) {
    if (e.status === 401) {
      clearCustomerAuth();
    }

    throw e;
  }
}

async function refreshCurrentCustomer() {
  const customer = await getCurrentCustomer();

  const auth = getCustomerAuth();

  if (auth) {
    setCustomerAuth(auth.token, customer);
  }

  return customer;
}

async function updateCurrentCustomer(data) {
  const result = await customerAuthFetch(
    'store/customers/me',
    {
      method: 'POST',
      body: JSON.stringify(data)
    }
  );

  const customer = result.customer || null;

  const auth = getCustomerAuth();

  if (auth) {
    setCustomerAuth(auth.token, customer);
  }

  return customer;
}

async function requestCustomerPasswordReset(email) {
  return customerAuthFetch(
    'auth/customer/emailpass/reset-password',
    {
      method: 'POST',

      body: JSON.stringify({
        identifier: email
      })
    }
  );
}

async function resetCustomerPassword(
  token,
  email,
  password
) {
  return customerAuthFetch(
    'auth/customer/emailpass/update',
    {
      method: 'POST',

      headers: {
        Authorization: 'Bearer ' + token
      },

      body: JSON.stringify({
        email: email,
        password: password
      })
    }
  );
}

async function logoutCustomer() {
  /*
   * JWT storefront authentication is client-side token based;
   * clearing the token logs out this browser.
   */
  clearCustomerAuth();

  return true;
}

async function getCustomerOrders() {
  return customerAuthFetch(
    'store/orders?limit=100&offset=0'
  ).then(function (r) {
    return r.orders || [];
  });
}

function customerDisplayName(customer) {
  if (!customer) {
    return 'Account';
  }

  const name = [
    customer.first_name,
    customer.last_name
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  return name || customer.email || 'Account';
}

async function ensureCartBelongsToCustomer(cart) {
  const auth = getCustomerAuth();

  if (
    !auth ||
    !auth.customer ||
    !auth.customer.id ||
    !cart
  ) {
    return cart;
  }

  if (cart.customer_id === auth.customer.id) {
    return cart;
  }

  try {
    const result = await medusaFetch(
      'store/carts/' +
        encodeURIComponent(cart.id) +
        '/customer',
      {
        method: 'POST',
        body: JSON.stringify({})
      }
    );

    return result.cart || cart;
  } catch (e) {
    console.warn(
      'Could not associate cart with logged-in customer:',
      e
    );

    return cart;
  }
}


/* ============================================================
 * Google customer authentication
 * ============================================================ */

async function startGoogleCustomerAuth(callbackUrl) {
  const url = callbackUrl ||
    (window.location.origin + '/google-callback.html');

  const response = await customerAuthFetch(
    'auth/customer/google',
    {
      method: 'POST',
      body: JSON.stringify({
        callback_url: url
      })
    }
  );

  if (!response || !response.location) {
    throw new Error(
      'Google sign-in could not be started.'
    );
  }

  /*
   * Keep the requested destination so the callback page
   * knows where to send the customer after authentication.
   */
  try {
    sessionStorage.setItem(
      'kgs_google_auth_return_url',
      new URLSearchParams(window.location.search).get('next') ||
        'account.html'
    );
  } catch (e) {
    console.warn(
      'Could not save Google authentication return URL:',
      e
    );
  }

  window.location.href = response.location;
}

function decodeGoogleJwtPayload(token) {
  if (!token || typeof token !== 'string') {
    throw new Error(
      'Google authentication returned an invalid token.'
    );
  }

  const parts = token.split('.');

  if (parts.length < 2) {
    throw new Error(
      'Google authentication returned an invalid JWT.'
    );
  }

  try {
    const base64 = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const padded =
      base64 +
      '='.repeat((4 - (base64.length % 4)) % 4);

    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map(function (char) {
          return '%' +
            ('00' + char.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );

    return JSON.parse(json);

  } catch (error) {
    console.error(
      'Could not decode Google authentication token:',
      error
    );

    throw new Error(
      'Google authentication returned an unreadable token.'
    );
  }
}

async function refreshGoogleCustomerToken(token) {
  /*
   * The refresh endpoint uses the Google callback token
   * from the Authorization header.
   */
  const response = await customerAuthFetch(
    'auth/token/refresh',
    {
      method: 'POST',

      headers: {
        Authorization: 'Bearer ' + token
      }
    }
  );

  const refreshedToken =
    response &&
    (response.token || response.access_token);

  if (!refreshedToken) {
    throw new Error(
      'Google authentication could not refresh the customer session.'
    );
  }

  return refreshedToken;
}

async function completeGoogleCustomerAuth() {
  const params = new URLSearchParams(window.location.search);

  if (!params.get('code')) {
    throw new Error(
      params.get('error_description') ||
      params.get('error') ||
      'Google authentication did not return an authorization code.'
    );
  }

  /*
   * Step 1:
   * Validate the Google callback with Medusa.
   */
  const response = await customerAuthFetch(
    'auth/customer/google/callback?' +
      params.toString(),
    {
      method: 'POST'
    }
  );

  const callbackToken =
    response &&
    (response.token || response.access_token);

  if (!callbackToken) {
    throw new Error(
      'Google authentication did not return a customer token.'
    );
  }

  /*
   * Step 2:
   * Decode the callback JWT.
   *
   * Medusa uses actor_id to indicate whether the
   * Google identity is already connected to a customer.
   */
  const decodedToken =
    decodeGoogleJwtPayload(callbackToken);

  const actorId =
    decodedToken && decodedToken.actor_id;

  /*
   * Step 3:
   * Store the callback token temporarily so that
   * customerAuthFetch() can authenticate the next request.
   */
  setCustomerAuth(callbackToken, null);

  /*
   * Step 4:
   * First-time Google customer.
   *
   * No customer actor is attached to the Google
   * authentication identity yet.
   */
  if (!actorId) {
    const metadata =
      decodedToken &&
      decodedToken.user_metadata
        ? decodedToken.user_metadata
        : {};

    const email =
      metadata.email ||
      metadata.email_address ||
      '';

    if (!email) {
      throw new Error(
        'Google did not provide an email address for this customer.'
      );
    }

    const firstName =
      metadata.first_name ||
      metadata.given_name ||
      '';

    const lastName =
      metadata.last_name ||
      metadata.family_name ||
      '';

    /*
     * Create the Medusa Store customer using
     * the Google callback token.
     */
    const customerResult = await customerAuthFetch(
      'store/customers',
      {
        method: 'POST',

        headers: {
          Authorization: 'Bearer ' + callbackToken
        },

        body: JSON.stringify({
          email: email,
          first_name: firstName,
          last_name: lastName
        })
      }
    );

    if (
      !customerResult ||
      !customerResult.customer
    ) {
      throw new Error(
        'Google authentication succeeded, but the customer account could not be created.'
      );
    }

    /*
     * The callback token was created before the customer
     * actor existed, so refresh it now so actor_id and
     * customer information are populated.
     */
    const refreshedToken =
      await refreshGoogleCustomerToken(
        callbackToken
      );

    setCustomerAuth(refreshedToken, null);
  }

  /*
   * Step 5:
   * Retrieve the authenticated Store customer using
   * the final customer token.
   */
  const customer =
    await getCurrentCustomer();

  if (!customer) {
    throw new Error(
      'Google authentication succeeded, but the customer account could not be loaded.'
    );
  }

  /*
   * Step 6:
   * Store the final authenticated customer session
   * using the same storage model as email/password login.
   */
  const auth =
    getCustomerAuth() || {};

  setCustomerAuth(auth.token, customer);

  return {
    token: auth.token,
    customer: customer
  };
}

function getGoogleAuthReturnUrl() {
  try {
    const saved =
      sessionStorage.getItem(
        'kgs_google_auth_return_url'
      );

    if (saved) {
      sessionStorage.removeItem(
        'kgs_google_auth_return_url'
      );
    }

    return saved || 'account.html';
  } catch (e) {
    return 'account.html';
  }
}





