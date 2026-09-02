# 5areta — Project Memory

Last updated: 2026-09-03

## Purpose
5areta is a simple Arabic RTL, mobile-first management app for a barbershop. Daily use must stay fast and uncomplicated on a phone.

Live app: https://am-naguib.github.io/5areta/
Repo: https://github.com/AM-naguib/5areta

## Financial model
Keep these concepts separate:

- Shop profit = service revenue - ordinary operating expenses - worker payments.
- Personal owner withdrawals do NOT reduce shop profit.
- Net cash into main vault = shop profit - personal withdrawal from daily income.
- Main-vault withdrawals reduce the vault only; they do not rewrite historical shop profit.
- Main-vault balance = opening balance + accumulated net cash from days - main-vault withdrawals.

Product consumption is separate from ordinary operating expense:
- Profit before product consumption = service revenue - ordinary operating - worker.
- Profit after product consumption = profit before products - internal product-consumption inventory cost.

Product-sale money stays separate from normal service revenue and from the main vault.

## Inventory model
Inventory is tracked in whole pieces only.

Each product has:
- Name.
- Image.
- Current quantity.
- Latest/current purchase cost.
- Saved default selling price.

Confirmed behavior:
- Latest purchase price becomes the product's current cost for subsequent sales/consumption.
- No weighted-average costing and no purchase-batch cost layers.
- Restocking changes current purchase cost but does not automatically change saved selling price.
- Selling price can be edited quickly from the product card or from full product edit.
- Purchases are normally owner-funded personally and do not reduce the main vault.
- Do not track owner-funded stock as money owed back to the owner or owner capital.
- Minimal purchase fields: product, quantity, unit purchase price, purchase date.
- Low-stock warning threshold is 3 pieces or fewer.
- No damaged/lost/manual-adjustment workflow in the current version.
- Stock leaves inventory through customer sale or internal shop use.
- Internal use is recorded as "استهلاك منتجات".
- Product sales track quantity, revenue, inventory cost, and gross product profit.
- Full inventory movement history is retained.
- Product sales cash and product profit are shown separately.

## Current deployment architecture
GitHub Pages remains the frontend/PWA.

Supabase is connected and stores shared business data:
- Supabase Database: days, vault withdrawals, products, inventory movements, settings.
- Supabase Storage: private product images.
- RLS protects business tables and Storage.

### Simplified single-user data flow
The previous one-time localStorage-to-Supabase migration flow has been removed because it added unnecessary startup complexity.

Current behavior:
- The app opens immediately from a simple local cache; no migration screen blocks normal work.
- Normal saves are written to localStorage immediately for speed and resilience.
- When the current device has an approved Supabase session, the same state syncs automatically to Supabase in the background.
- If the internet/cloud is temporarily unavailable, the app keeps working locally and retries the pending snapshot when connectivity returns.
- When there are no pending local changes, the app refreshes from Supabase in the background.
- There is no manual "sync now" workflow and no persistent sync-status UI.
- Supabase remains the shared cloud copy; localStorage is a practical device cache/offline working copy, not a one-time migration source.

The simplified sync assumes a single active owner workflow. A saved snapshot can replace the shared table state, which is intentionally simpler than multi-user conflict handling.

## Current access model
The six-digit shop-code/PIN flow has been removed.

There is no visible login or PIN prompt in normal use.

Security is not made public/open:
- Existing approved anonymous Supabase device sessions remain protected by RLS.
- A random new browser/session is NOT automatically given access to business data.
- If browser storage is cleared or a genuinely new device is used later, that device can be approved manually in Supabase instead of adding a shop-code flow back into the app.
- Never expose a Supabase service-role/secret key in GitHub Pages.

The old PIN verification backend has been disabled and its PIN database tables/functions removed.

## Product images
Product images are stored in the private Supabase Storage bucket `product-images` and loaded through signed URLs on approved sessions.

New local product images may be compressed in the browser before upload.

## Current Supabase state
Production project ref: `rsabmbljhjsfvadhrsti`

Core tables:
- `authorized_devices`
- `app_settings`
- `days`
- `withdrawals`
- `products`
- `inventory_movements`

The obsolete shop-PIN tables `device_pin_attempts` and `shop_access_config` and the `verify_shop_pin` database function have been removed.

## Implementation notes
Main frontend files:
- `index.html`
- `styles.css`
- `app.js`
- `inventory.js`
- `cloud.js`
- `service-worker.js`

`app.js` saves immediately to the local cache and calls the cloud layer when cloud access is active.

`cloud.js` now contains the simplified background Supabase read/write flow. It contains no migration gate and no shop-PIN UI.

## Rule for future changes
Whenever a business/accounting/product/architecture decision is agreed, update both `MEMORY.md` and `docs/DECISIONS.md` with the implementation.