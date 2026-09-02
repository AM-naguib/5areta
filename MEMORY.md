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

Daily shop finance is completely separate from products:
- Product purchases do not change daily shop profit or the main vault.
- Product sales stay separate from service revenue and the main vault.
- Internal product consumption deducts inventory and remains visible only in inventory/product history.
- Internal product consumption does NOT reduce daily shop profit, monthly shop profit, daily records, or main-vault calculations.
- There is one shop-profit figure in the daily/dashboard flow: service revenue - ordinary operating - worker.

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
- Internal use is recorded as an inventory `consumption` movement and does not feed the daily finance module.
- Product sales track quantity, revenue, inventory cost, and gross product profit.
- Full inventory movement history is retained.
- Product sales cash and product profit are shown separately.

### Product movements page
The inventory area has a dedicated `حركات المنتجات` page, opened from the inventory header without adding another bottom-nav item.

It shows purchase/restock, sale, and internal-use movements with product name, date, quantity, and the relevant cost/sale/profit details.

Date filters:
- Last 7 days (default).
- Last 30 days.
- All movements.
- Custom from-date / to-date range.

The page also shows filtered summary counts for movement count, purchased pieces, sold pieces, and internally used pieces. Internal use is explicitly labeled as inventory-only and does not affect the daily shop record.

## Current deployment architecture
GitHub Pages remains the frontend/PWA.

Supabase is connected and stores shared business data:
- Supabase Database: days, vault withdrawals, products, inventory movements, settings.
- Supabase Storage: private product images.
- RLS protects business tables and Storage.

### Simplified single-user data flow
The previous one-time localStorage-to-Supabase migration flow has been removed because it added unnecessary startup complexity.

Current behavior:
- The app opens from a simple local cache after access is unlocked; there is no migration screen.
- Normal saves are written to localStorage immediately for speed and resilience.
- When the current browser has an approved Supabase session, the same state syncs automatically to Supabase in the background.
- If the internet/cloud is temporarily unavailable after a browser has previously been unlocked, the app can keep working locally and retry when connectivity returns.
- When there are no pending local changes, the app refreshes from Supabase in the background.
- There is no manual "sync now" workflow and no persistent sync-status UI.
- Supabase remains the shared cloud copy; localStorage is a practical device cache/offline working copy, not a one-time migration source.

The simplified sync assumes a single active owner workflow. A saved snapshot can replace the shared table state, which is intentionally simpler than multi-user conflict handling.

## Current access model
The site now has a remembered password gate.

Confirmed behavior:
- A new browser/session gets an anonymous Supabase Auth session, then sees a site password screen.
- Correct password verification happens server-side through the `unlock-site` Edge Function; the plaintext password is never committed to GitHub.
- Successful verification adds that anonymous Auth user to `authorized_devices`, so RLS grants access to business data.
- The browser also stores only a non-secret local unlocked marker so previously unlocked normal browsers can continue working locally if internet is temporarily unavailable.
- On the same normal browser, the persisted Supabase session means the password is not requested again during normal use.
- A new browser, cleared browser storage, or a fresh private/incognito session must enter the password once because those contexts do not share/persist the previous session.
- Five failed password attempts for the same anonymous session are rate-limited for 15 minutes.
- Never expose a Supabase service-role/secret key in GitHub Pages.

The actual site password value is secret and must not be written to repository files or project-memory documents.

## Product images
Product images are stored in the private Supabase Storage bucket `product-images` and loaded through signed URLs on approved sessions.

New local product images may be compressed in the browser before upload.

## Current Supabase state
Production project ref: `rsabmbljhjsfvadhrsti`

Core tables:
- `authorized_devices`
- `site_access_config`
- `site_password_attempts`
- `app_settings`
- `days`
- `withdrawals`
- `products`
- `inventory_movements`

Access function:
- `verify_site_password(text)` is callable only by trusted service-role code.

Edge Function:
- `unlock-site` verifies the site password server-side and authorizes the current anonymous session.

The older shop-PIN-specific tables/functions remain removed; the current password gate is a site access mechanism rather than the old migration/device-PIN workflow.

## Implementation notes
Main frontend files:
- `index.html`
- `styles.css`
- `app.js`
- `inventory.js`
- `inventory-movements.js`
- `cloud.js`
- `service-worker.js`

`app.js` saves immediately to the local cache and calls the cloud layer when cloud access is active.

The dashboard, day records, and CSV export intentionally contain no product-consumption accounting. Product consumption remains only in inventory movements/history.

`inventory-movements.js` creates the dedicated filtered product-movement view and its inventory-header entry point.

`cloud.js` contains the remembered site-password gate plus the simplified background Supabase read/write flow. It contains no one-time migration gate.

## Rule for future changes
Whenever a business/accounting/product/architecture decision is agreed, update both `MEMORY.md` and `docs/DECISIONS.md` with the implementation.