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
Status: Proposed / not separately implemented

Buying stock increases inventory. Inventory cost affects profit when stock is sold or consumed rather than automatically becoming an ordinary operating expense at purchase time.

### D-011 — Internal product consumption category
Internal use deducts stock and records its inventory cost under `استهلاك منتجات`, separate from ordinary operating expenses.

### D-014 — Two shop-profit figures
Show profit before product consumption and profit after product consumption.

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
Do not add a recurring account-login experience in the current phase.

### D-028 — No visible access prompt during normal use
Status: Current again through D-038.

Normal daily use should open without a visible login/PIN prompt.

### D-029 — Six-digit shop PIN for device authorization
Status: Superseded by D-038.

This was previously used for first-time device authorization and has now been removed.

### D-030A — Owner-selected shared shop PIN
Status: Superseded by D-038.

The previous fixed six-digit shop code is no longer part of the current architecture.

### D-030B — Automatic one-time localStorage migration to Supabase
Status: Superseded by D-037.

The previous automatic migration/verification gate has been removed because it added startup complexity and could block normal work.

### D-031 — Delete legacy localStorage after migration
Status: Superseded by D-037.

LocalStorage is now intentionally retained as a simple device cache/offline working copy.

### D-032 — Continue working offline
If internet is unavailable, normal shop work should continue on the device and synchronize automatically when connectivity returns.

### D-033 — Last-write-wins
For editable record conflicts, use a simple last-write-wins approach rather than manual conflict resolution.

### D-034 — Background-only synchronization UX
Sync happens automatically. Do not add a persistent sync-status indicator or manual Sync Now button. Real failures may still show a short error message.

### D-035 — Product images in Supabase Storage
Product images are stored in private Supabase Storage and referenced by product records.

### D-036 — Initial Supabase cloud implementation
Status: Partially superseded by D-037 and D-038.

Supabase Database, private Storage, RLS, and browser cloud integration remain. The old PIN and one-time migration mechanisms do not.

### D-037 — Simplified single-user local cache + background Supabase sync
Status: Implemented

The app is optimized for one owner and simplicity:
- Open immediately from localStorage without a migration/loading gate.
- Save locally first so normal work is never blocked by Supabase availability.
- When the current device session is approved, sync the same state to Supabase automatically in the background.
- Keep one pending local snapshot when cloud writes cannot complete; retry when internet returns.
- When there is no pending local change, refresh from Supabase in the background.
- Do not run a one-time local-to-cloud migration or delete the local cache after sync.
- The simple sync may replace the shared table snapshot, which is acceptable for the intended single-owner workflow.

This supersedes D-030B and D-031 and simplifies the migration/offline portions of D-036.

### D-038 — Remove the shop PIN; keep backend device approval
Status: Implemented

There is no shop-code/PIN prompt in the app.

Security must still not become public:
- Existing approved anonymous Supabase sessions keep access through RLS.
- A random new anonymous session is not automatically authorized to read/write business data.
- If a genuinely new browser/device is needed later, approve that device manually in Supabase instead of asking the user for a shop PIN.
- The old PIN verification Edge Function is disabled.
- The old PIN database tables and PIN verification database function are removed.
- Never expose a service-role/secret key in the GitHub Pages frontend.

This supersedes D-029 and D-030A.

## Current architecture summary
- Frontend/PWA: GitHub Pages.
- Shared cloud data: Supabase Database.
- Product images: private Supabase Storage.
- Access control: approved Supabase device sessions + RLS, no visible PIN/login in normal use.
- Device working copy: localStorage for immediate saves/offline use.
- Sync: automatic background synchronization; no migration gate and no manual sync button.

## Open decisions
- Device revocation/reset procedure if the current phone/browser storage is lost.
- Whether a formal account login should ever replace manual device approval if more users/devices are added later.