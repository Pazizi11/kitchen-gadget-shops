# Kitchen Gadget Shops — Medusa + Stripe Checkout

This frontend keeps the existing HTML/CSS/JS storefront and adds the checkout flow:

`Local UI cart → Medusa cart → address/shipping → Stripe payment session → Stripe Payment Element → Medusa complete cart → Medusa order`

## Frontend configuration

Edit `js/config.js`:

- `MEDUSA_PUBLISHABLE_KEY`: the publishable key created in Medusa Admin.
- `STRIPE_PUBLISHABLE_KEY`: your Stripe publishable key (`pk_live_...` for Live Mode).
- `MEDUSA_BACKEND_URL`: `http://localhost:9000` for local Medusa.
- `MEDUSA_SALES_CHANNEL_ID`: optional; leave blank to use the region's default sales channel behavior.

Never put the Stripe secret key (`sk_live_...`), PostgreSQL password, CJ API credentials, or Medusa admin credentials in frontend files.

## Backend prerequisites

1. Medusa backend is running on port 9000.
2. `STRIPE_API_KEY=sk_live_...` is present only in the Medusa backend `.env`.
3. Stripe is enabled as a payment provider for the USD region in Medusa Admin.
4. The USD region has at least one shipping option configured and available to the cart.
5. Products have purchasable variants and prices in USD.
6. For production, configure the Stripe webhook secret in Medusa and expose the required webhook endpoint securely.

## Cart and checkout behavior

- The browser keeps a UI cart for the existing storefront experience.
- Checkout creates/uses a Medusa cart and synchronizes the local cart's variant IDs and quantities into it.
- Customer email, name, phone, and shipping address are sent to the Medusa cart.
- The checkout selects a Medusa shipping option. The frontend prefers a free/standard option based on the existing $50 free-shipping rule, but Medusa remains the source of truth for the final total.
- Stripe Payment Element handles payment details.
- After successful Stripe confirmation, the frontend completes the Medusa cart.
- The returned Medusa order is stored temporarily in sessionStorage for the confirmation page, then the local/Medusa cart IDs are cleared.

## Pricing rule

Kitchen Gadget Shops keeps the business rule:

`store selling price = CJ product cost × 1.30`

The storefront does not recalculate CJ cost or markup during checkout. It uses the selling price returned by Medusa.

## CJdropshipping

CJ product import/synchronization belongs on the backend, not in this frontend. The frontend must never contain CJ API credentials. The backend should import kitchen gadgets from CJ, apply the 30% markup, and sync price, inventory, images/video and other supported product data into Medusa.

## Customer Accounts

This frontend now includes Medusa customer authentication pages:
- `register.html` — create account
- `login.html` — login
- `forgot-password.html` — request password reset
- `reset-password.html` — set a new password from a Medusa reset token
- `account.html` — profile, logout, and authenticated order history

Authentication uses Medusa's Email/Password auth routes and a browser-stored JWT. Protected `/store/customers/me` requests send the bearer token.

### Password reset email requirement
The storefront can request a reset token, but Medusa must have a notification subscriber/provider configured to actually email the reset link. The reset email should link back to:
`reset-password.html?token=<TOKEN>&email=<EMAIL>`

The current frontend does not add or expose email-provider credentials. Configure the notification/email provider in the Medusa backend before using Forgot Password in production.
