/* Kitchen Gadget Shops â€” Medusa frontend runtime configuration */
(function () {
  const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

  window.KGS_CONFIG = Object.freeze({
    STORE_NAME: 'Kitchen Gadget Shops',
    STORE_DOMAIN: 'bykitchengadgetshops.com',
    CURRENCY: 'USD',
    CJ_MARKUP_PERCENT: 835,
    NEWSLETTER_EMAIL: 'hello@bykitchengadgetshops.com',

    // Paste your Medusa Publishable API Key here.
    // Example format: pk_...
    MEDUSA_PUBLISHABLE_KEY: 'pk_af280eda053160b13e3fe5ccda7b5099dc995f70c83657bf314377f1381a38cc',

    // Medusa backend is normally port 9000 in local development.
    MEDUSA_BACKEND_URL: isLocal ? 'http://localhost:9000' : 'https://api.bykitchengadgetshops.com',

    // Stripe publishable key belongs to the browser; never put STRIPE_API_KEY here.
    STRIPE_PUBLISHABLE_KEY: 'pk_live_51PX3p1RvCJuMwBWvhc1tE7zVvJddTPpMmn5MuoFkdUZ7NwBHwYaOTmIJVrU9D4dP7jLyThsKPc0SybNuaM61m1ck00khoYz0j6',

    // Medusa customer authentication (JWT is stored in this browser only).
    CUSTOMER_AUTH_STORAGE_KEY: 'kgs_customer_auth_v1',

    // Optional: set this if you want the cart forced onto a specific Medusa sales channel.
    MEDUSA_SALES_CHANNEL_ID: '',

    SOCIALS: {
      instagram: 'https://www.instagram.com/kitchengadgetshops/',
      facebook: 'https://facebook.com/kitchengadgetshops',
      pinterest: 'https://pin.it/yVgs4Dt9f',
      tiktok: 'https://www.tiktok.com/@kitchengadgetshops?_r=1&_t=ZP-99GXxF3pbhe'
    }
  });
})();

