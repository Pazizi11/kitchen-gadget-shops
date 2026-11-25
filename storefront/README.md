# Kitchen Gadget Shops — Frontend (Backend-ready)

Website: **kitchengadgetshop.com**  
Store currency: **USD**  
CJ product markup rule: **30% on the CJ item/product price** (`store_price = cj_price × 1.30`). CJ shipping cost is stored separately so true profit can be calculated.

## What was updated
- Added newsletter/contact email: `kitchengadgetshopsco@gmail.com`.
- Added Instagram, Facebook, Pinterest and TikTok links to the footer.
- Replaced the old 15% rule with a fixed 30% default markup.
- Added USD-aware money formatting.
- Removed the insecure hard-coded browser admin passcode; Admin now expects backend authentication.
- Reworked frontend API calls to target a Node.js backend (`/api` in production; `http://localhost:5000/api` during local development).
- Added a CJ Product Importer UI in Admin. It expects backend endpoints for CJ search/import.
- Expanded product media support to 4 images plus `video_url`.
- Product detail pages now display CJ video when `video_url` exists.
- Added two safe starter CJ kitchen products with real CJ-hosted images so the frontend still shows products before the backend is connected.
- Standardized the serving category as `Kitchen Utensils & Serving`.

## Run in VS Code
1. Open this folder in VS Code.
2. Use the **Live Server** extension (or any local static server) and open `index.html`.
3. Until the Node.js backend is running, the storefront falls back to `data/cj-starter-products.json`.
4. The Admin CJ importer requires the future backend on `http://localhost:5000`.

## Backend endpoints expected
- `POST /api/auth/admin/login` → `{ token }`
- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/products`
- `PATCH /api/products/:id`
- `DELETE /api/products/:id`
- `POST /api/orders`
- `GET /api/orders`
- `PATCH /api/orders/:id`
- `POST /api/newsletter/subscribe`
- `GET /api/cj/products/search?q=...&category=...&limit=12`
- `POST /api/cj/products/import`

CJ import response/product records should support: `image_url`, `image_url_2`, `image_url_3`, `image_url_4`, `video_url`, `cj_product_id`, `cj_product_url`, `cj_cost_price`, `cj_shipping_cost`, `price`, `currency`, `markup_percent`, `category`, `stock_status`.

## Important CJ media note
The frontend is ready to show images and videos. Real CJ video URLs should be obtained server-side with authenticated CJ API access and stored/cached by the backend. Never place CJ API credentials in frontend JavaScript.
