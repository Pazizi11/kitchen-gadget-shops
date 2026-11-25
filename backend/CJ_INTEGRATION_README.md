# Kitchen Gadget Shops — CJdropshipping integration

This backend now contains the CJ integration under `src/integrations/cj`.

## What is included

- CJ API authentication with access-token refresh and API-key fallback.
- CJ product search/import into Medusa as draft products.
- 30% markup: `store price = CJ cost × 1.30`.
- CJ variant IDs stored in Medusa variant metadata as `cj_vid`.
- CJ inventory lookup and Medusa inventory synchronization.
- `order.placed` subscriber that can automatically submit orders to CJ.
- CJ webhook endpoint for stock, order, and logistics updates.
- Tracking number/provider/URL stored on the Medusa order metadata.
- Admin-only endpoints for health, product sync, and inventory sync.

## Important environment switches

`CJ_AUTO_CREATE_ORDER=false` is intentional for safety. Set it to `true` only after a controlled test order succeeds.

`CJ_WEBHOOK_VERIFY_SIGNATURE=true` verifies the CJ `sign` header using the CJ `openId`, as required by CJ's webhook documentation.

## Endpoints

- `GET /admin/cj/health`
- `POST /admin/cj/products`
- `POST /admin/cj/inventory`
- `POST /cj/webhook`

Admin endpoints require Medusa admin authentication. The CJ webhook is public because CJ must call it; it is protected with CJ's HMAC signature when verification is enabled.

## Product import example

POST `/admin/cj/products`

```json
{
  "keyword": "kitchen",
  "pageSize": 20,
  "maxProducts": 10
}
```

Products are created as **drafts** so you can review them before publishing.

## Order forwarding

After Stripe/Medusa creates an order, Medusa emits `order.placed`. The subscriber calls CJ Create Order V3 only when `CJ_AUTO_CREATE_ORDER=true`.

CJ still controls the supplier-side payment/order processing. This integration creates the CJ order; it does not pretend that CJ has been paid unless CJ's API confirms the relevant step.

## Webhook

Configure CJ to call:

`https://api.bykitchengadgetshops.com/cj/webhook`

Do not use localhost in CJ's production webhook configuration.
