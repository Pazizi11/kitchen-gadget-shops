# Backend contract for Kitchen Gadget Shops

## Pricing
- Currency: USD.
- Store markup: 30% on CJ item price.
- Formula: `selling_price = round(cj_cost_price * 1.30, 2)`.
- Keep `cj_shipping_cost` separate and use it for profitability reporting.

## CJ import flow
1. Backend authenticates to CJ API (credentials in `.env`, never frontend).
2. Search only kitchen wares/gadgets.
3. Backend retrieves product detail, images, variants, inventory and video where available.
4. Backend maps product to one store category.
5. Backend calculates USD selling price with 30% markup.
6. Save as Draft for admin review.
7. Publish after review.
8. Use CJ webhooks plus scheduled reconciliation for stock/price changes.

## Suggested product JSON
```json
{
  "name": "Example Kitchen Gadget",
  "category": "Gadgets & Tools",
  "currency": "USD",
  "cj_cost_price": 10.00,
  "cj_shipping_cost": 3.00,
  "markup_percent": 30,
  "price": 13.00,
  "image_url": "https://...",
  "image_url_2": "https://...",
  "image_url_3": "https://...",
  "image_url_4": "https://...",
  "video_url": "https://...mp4",
  "cj_product_id": "...",
  "cj_product_url": "https://cjdropshipping.com/product/...",
  "stock_status": "In Stock",
  "status": "draft"
}
```
