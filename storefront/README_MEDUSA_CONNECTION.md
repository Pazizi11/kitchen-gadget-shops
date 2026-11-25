# Kitchen Gadget Shops — Medusa-connected frontend

This version connects the existing HTML/CSS/JS storefront to the Medusa v2 Store API.

## What changed
- Product listing now reads from Medusa (`/store/products`).
- Product detail now reads from Medusa (`/store/products/:id`).
- Uses the Medusa Publishable API Key through `x-publishable-api-key`.
- Local Medusa backend is expected at `http://localhost:9000`.
- Removed the old Node/Express product API dependency from the storefront.
- The old CJ starter catalog is no longer used.
- The existing design and page structure are preserved.
- Browser-side order creation is disabled until the checkout is connected to Medusa + Stripe.

## One required setup
Open:

`js/config.js`

Find:

`MEDUSA_PUBLISHABLE_KEY: 'PASTE_YOUR_MEDUSA_PUBLISHABLE_KEY_HERE'`

Replace the placeholder with the Publishable API Key you created in Medusa Admin.

Do not put Stripe secret keys, CJ API credentials, PostgreSQL passwords, or Medusa secret/admin credentials in this file.

## Run locally
1. Start PostgreSQL.
2. Start the Medusa backend from the Medusa project folder:
   `npm run dev`
3. Confirm Admin works at:
   `http://localhost:9000/app`
4. Open this frontend with VS Code Live Server (or another local static server).
5. Make sure at least one product exists in Medusa Admin.
6. Open the storefront and check Shop All / product pages.

## Important
This is Step 8 of the setup. Stripe checkout is not wired yet. The next backend/frontend step is to configure Stripe in Medusa and then replace the current browser-only checkout form with a Medusa payment-session/Stripe checkout flow.

## Store rules
- Store currency: USD.
- CJ product markup: 30% (`CJ cost × 1.30`).
- CJ credentials remain server-side; they must never be placed in frontend JavaScript.
