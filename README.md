# Book store

Customer-facing Next.js storefront for the existing Sling bookstore API. It has no backend of its own; Next.js only forwards API calls to Sling.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. The Sling API must be running at `http://127.0.0.1:8000`.

### API base URL

The Sling API does not send CORS headers, so the browser calls this app's own `/sling/*` path and Next.js rewrites it server-side to the store's API (see `next.config.ts`).

| Variable | Default | Purpose |
| --- | --- | --- |
| `SLING_API_URL` | `http://127.0.0.1:8000/users/book` | Where `/sling/*` is forwarded. For production set e.g. `https://<domain>/users/book`. Read at build/start time. |
| `NEXT_PUBLIC_API_BASE_URL` | `/sling` | Only set this if the API allows cross-origin requests and you want the browser to call it directly. |

## Storefront routes

- `/` home, catalog search, category browsing, "show more" pagination
- `/products/[id]` product detail, size/colour selection, quantity
- `/cart` browser-persisted bag
- `/checkout` COD and (when configured) Razorpay payment
- `/confirmation` COD pending-approval notice, or Razorpay webhook confirmation polling
- `/orders` customer order history (paginated, search by bill number)
- `/orders/[id]` order detail with line items and GST
- `/login`, `/register`, `/account` phone + password access, profile and password change

## API and payment behaviour

- Responses use the Sling envelope; numeric fields arrive as strings and are normalised in `src/lib/api.ts`.
- The Sanctum token from login is stored in local storage. A 401 signs the customer out.
- Prices are GST-inclusive. `product.tax_amount` (per unit) is sent as each line's `tax_amount` for receipts, never added to totals.
- Plain products still come back with one "default" variation (no size/colour); its id is sent as `variation_id` so the shop's variation stock stays in step. Only variations with a size or colour are shown as choices.
- `billing_customer` is always sent (with nulls when unused) because `/orders/store` reads it unconditionally.
- Orders use `customer_id` from the login/profile response (not the user `id`).
- Razorpay is offered only when `/payment_gateway_detail` returns `payment_gateway: "razorpay"` and a `key_id`. `/orders/checkout` currently adds `tax_amount` on top of the price when sizing the payment, so online checkout sends `tax_amount: 0` and refuses to open Razorpay if the returned amount differs from the bag total.
- After Checkout.js reports success, `/confirmation` polls `/orders/list` every 2 s for up to 60 s for a new order (id above the newest one seen before paying) matching the paid amount. COD orders are shown as awaiting the shop's approval.

## Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```
