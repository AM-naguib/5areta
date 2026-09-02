# Decision Log

This file records agreed business, product, and architecture decisions for 5areta.

## Confirmed

### D-001 — Daily finance separation
Shop profit, personal withdrawals, and main-vault withdrawals are separate concepts.

### D-002 — Two inventory outbound purposes
Stock leaves inventory through internal shop use or customer sale.

### D-003 — Product sales track profit
Every product sale stores quantity, sale value, inventory cost, and gross product profit.

### D-004 — Full inventory movement history
Purchases, sales, and internal consumption are logged as movements rather than only overwriting quantity.

### D-005 — Saved default selling price
Each product has a saved selling price that prefills a sale but can be changed for that individual sale.

### D-006 — Whole-piece inventory
Inventory quantities are whole pieces only. No carton/ml/gram conversion is required.

### D-007 — Owner-funded inventory purchases
Inventory purchases are normally paid from the owner's personal money and do not automatically reduce the main vault.

### D-008 — No owner receivable/capital tracking for stock
Do not track owner-funded stock purchases as money owed back to the owner or as owner capital.

### D-009 — Latest purchase price costing
The newest purchase price becomes the product's current unit cost for later sales and internal consumption. No weighted average or cost layers.

### D-010 — Purchase accounting
Status: Refined by D-040

Buying stock increases inventory. Product purchase/usage cost is retained in the inventory module and does not automatically enter the daily shop-finance calculation.

### D-011 — Internal product consumption category
Status: Refined by D-040

Internal use deducts stock and records its inventory cost in inventory movement history. It is not an ordinary operating expense and does not affect the daily shop-finance record.

### D-014 — Two shop-profit figures
Status: Superseded by D-040

The earlier design showed profit before and after product consumption. The daily shop-finance module now has one shop-profit figure only.

### D-015 — Product sales revenue separate from service revenue
Do not merge product-sales revenue into normal daily service revenue.

### D-016 — Product-sales money separate from main vault
Product-sale cash does not automatically increase the main shop vault.

### D-017 — Track product cash and product profit separately
Show full product-sales cash and product gross profit as different figures.

### D-018 — Minimal stock-purchase fields
Purchase entry requires only product, quantity, unit purchase price, and date.

### D-019 — Low-stock threshold
Use one shared threshold of 3 pieces or fewer.

### D-020 — No damaged/lost/manual quantity adjustment in current version
Inventory changes come from purchases, internal consumption, and customer sales only.

### D-021 — Restock existing product
Restocking an existing product allows added quantity, new/editable purchase unit price, and purchase date. The entered price becomes current cost.

### D-022 — Restock does not change saved selling price
Changing purchase cost does not automatically change the product's saved selling price.

### D-023 — Selling price editable from quick and full edit
Both edit paths change the same saved default selling price.

### D-024 — Product cards have quick actions and details
Cards provide Sell, Internal use, Add stock, and Edit price. Tapping the card opens full product details and movement history.

### D-025 — Local-only architecture
Status: Superseded by D-026.

### D-026 — GitHub Pages frontend + Supabase shared cloud
GitHub Pages hosts the frontend. Supabase Database stores structured business data and Supabase Storage stores product images.

### D-027 — No normal owner/staff account UI
Do not add a recurring named account-login experience in the current phase.

### D-028 — No visible access prompt during normal use
Status: Refined by D-039.

After a browser has successfully unlocked once, normal daily use should reopen without repeatedly asking for access credentials.

### D-029 — Six-digit shop PIN for device authorization
Status: Superseded by D-038 and D-039.

This was the earlier migration/device-PIN design and is no longer the current access flow.

### D-030A — Owner-selected shared shop PIN
Status: Superseded by D-038 and D-039.

The previous fixed six-digit device-authorization flow is no longer part of the current architecture.

### D-030B — Automatic one-time localStorage migration to Supabase
Status: Superseded by D-037.

The previous automatic migration/verification gate has been removed because it added startup complexity and could block normal work.

### D-031 — Delete legacy localStorage after migration
Status: Superseded by D-037.

LocalStorage is now intentionally retained as a simple device cache/offline working copy.

### D-032 — Continue working offline
If internet is unavailable, normal shop work should continue on a previously unlocked device and synchronize automatically when connectivity returns.

### D-033 — Last-write-wins
For editable record conflicts, use a simple last-write-wins approach rather than manual conflict resolution.

### D-034 — Background-only synchronization UX
Sync happens automatically. Do not add a persistent sync-status indicator or manual Sync Now button. Real failures may still show a short error message.

### D-035 — Product images in Supabase Storage
Product images are stored in private Supabase Storage and referenced by product records.

### D-036 — Initial Supabase cloud implementation
Status: Partially superseded by D-037, D-038, and D-039.

Supabase Database, private Storage, RLS, and browser cloud integration remain. The old one-time migration mechanism does not.

### D-037 — Simplified single-user local cache + background Supabase sync
Status: Implemented

The app is optimized for one owner and simplicity:
- No one-time data-migration/loading workflow.
- Save locally first so normal work is resilient to temporary Supabase availability.
- When the current browser session is authorized, sync the same state to Supabase automatically in the background.
- Keep one pending local snapshot when cloud writes cannot complete; retry when internet returns.
- When there is no pending local change, refresh from Supabase in the background.
- Do not run a one-time local-to-cloud migration or delete the local cache after sync.
- The simple sync may replace the shared table snapshot, which is acceptable for the intended single-owner workflow.

This supersedes D-030B and D-031 and simplifies the migration/offline portions of D-036.

### D-038 — Remove the shop PIN; keep backend device approval
Status: Superseded by D-039.

This temporary design removed all visible access prompts and required manual approval for new browser sessions. D-039 replaces manual approval with a remembered site-password gate.

### D-039 — Remembered site password with automatic browser authorization
Status: Implemented

The GitHub Pages site has a password gate for browser sessions that are not already authorized.

Behavior:
- A new browser/session receives an anonymous Supabase Auth session and is shown the site password screen.
- The password is verified server-side by the `unlock-site` Edge Function against a protected password hash; the plaintext password is never committed to GitHub.
- A correct password automatically adds the current anonymous Auth user to `authorized_devices`, which enables the existing RLS-protected database and Storage access.
- Supabase Auth persists the approved session on a normal browser, so the site does not ask for the password again on normal subsequent opens.
- A non-secret local unlocked marker allows a previously unlocked browser to keep using its local cache during a temporary internet outage.
- A new device/browser, cleared browser storage, or a fresh private/incognito session must enter the password once because it does not retain the previous browser session.
- Five failed attempts on the same anonymous session are blocked for 15 minutes.
- The frontend contains only the public Supabase publishable key; service-role credentials remain server-side.

This replaces the manual-new-device approval model in D-038 while preserving RLS protection and the simple single-owner UX.

### D-040 — Daily shop finance is fully independent from products
Status: Implemented

The daily registration/s سجل المحل must have no accounting dependency on products, including internal product consumption.

Rules:
- Daily shop profit = service revenue - ordinary operating expenses - worker payments.
- Internal product consumption does not reduce daily profit or monthly shop profit.
- Internal product consumption does not appear in daily record cards, the shop dashboard monthly breakdown, or daily CSV export.
- Internal product consumption still deducts stock and remains in the inventory movement history for product tracking only.
- Product sales remain separate from service revenue and the main vault.
- The shop dashboard shows one shop-profit figure, not before/after-products figures.

This supersedes D-014 and refines D-010 and D-011.

## Current architecture summary
- Frontend/PWA: GitHub Pages.
- Shared cloud data: Supabase Database.
- Product images: private Supabase Storage.
- Access control: remembered site password for new browser sessions + anonymous Supabase Auth + `authorized_devices` + RLS.
- Device working copy: localStorage for immediate saves/offline use after the site has been unlocked.
- Sync: automatic background synchronization; no migration gate and no manual sync button.
- Daily finance: fully independent from inventory/products.

## Open decisions
- Whether to provide an in-app password-change screen later.
- Whether a formal named account login should ever replace the simple shared site password if more users are added later.