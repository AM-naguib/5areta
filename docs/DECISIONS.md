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
Status: Refined by D-042

The app is optimized for one owner and simplicity:
- No one-time data-migration/loading workflow.
- Save locally first so normal work is resilient to temporary Supabase availability.
- When the current browser session is authorized, sync automatically to Supabase in the background.
- Keep one pending local snapshot when cloud writes cannot complete; retry when internet returns.
- When there is no pending local change, refresh from Supabase in the background.
- Do not run a one-time local-to-cloud migration or delete the local cache after sync.

The earlier full-table snapshot replacement behavior is superseded by D-042.

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

The daily registration / سجل المحل has no accounting dependency on products, including internal product consumption.

Rules:
- Daily shop profit = service revenue - ordinary operating expenses - worker payments.
- Internal product consumption does not reduce daily profit or monthly shop profit.
- Internal product consumption does not appear in daily record cards, the shop dashboard monthly breakdown, or daily CSV export.
- Internal product consumption still deducts stock and remains in the inventory movement history for product tracking only.
- Product sales remain separate from service revenue and the main vault.
- The shop dashboard shows one shop-profit figure, not before/after-products figures.

This supersedes D-014 and refines D-010 and D-011.

### D-041 — Dedicated filtered product movements page
Status: Implemented

The inventory module has a separate `حركات المنتجات` view opened from the inventory page rather than adding a sixth bottom-navigation item.

The movement view includes all inventory movement types: purchase/restock, customer sale, and internal shop use. Each row shows the product, movement type, date, quantity, and the relevant purchase-cost, sale-value, inventory-cost, or sale-profit details.

Date filters:
- Last 7 days as the default.
- Last 30 days.
- All movements.
- Custom from-date / to-date.

The selected period also shows summary counts for total movements, purchased units, sold units, and internally used units. Internal-use cards explicitly state that they belong to inventory only and do not affect the daily shop-finance record.

### D-042 — Record-level cloud synchronization safety
Status: Implemented

Background synchronization must not replace whole business tables from a possibly stale browser snapshot.

Rules:
- Keep a last-known cloud base snapshot locally.
- Compare the current local state with that base to determine which individual records were added, edited, or deleted.
- Upsert only changed records and delete only records that were explicitly removed relative to the known base.
- A stale local snapshot must not delete unrelated rows that appeared in Supabase from another newer cloud state.
- After offline work, fetch the latest Supabase state first, reapply only the local changes/deletions on top of it, then synchronize those differences.
- If the same record changed both remotely and locally, the existing last-write-wins rule remains for that record.
- The pending local snapshot remains an offline recovery mechanism, but it is used to calculate record-level differences rather than replace entire tables.

This refines D-037 without adding any manual sync UI.

### D-043 — One daily-finance record per calendar date
Status: Implemented

The shop should never contain two daily-finance records for the same date.

Rules:
- When saving a new day, if that date already exists, block the duplicate.
- Offer to open the existing day for editing instead.
- When editing an existing day, changing its date to another already-used date is also blocked.
- Supabase enforces the same rule with the unique index `days_unique_date_idx` on `days(date)` as a backend safety layer.

### D-044 — Numeric day/month/year date format
Status: Implemented

All user-facing full dates use `DD/MM/YYYY` with numeric day, month, and year.

Rules:
- Example: 3 September 2026 displays as `03/09/2026`.
- Date entry fields use the same day/month/year order instead of browser-dependent month/day/year display.
- Valid one- or two-digit day/month input is normalized to two digits.
- Arabic/Persian digit input may be entered and is normalized for parsing.
- Internal data continues to store dates as ISO `YYYY-MM-DD` so sorting, comparisons, Supabase, offline sync, and filters stay reliable.
- The custom product-movement date range follows the same display convention.
- User-facing daily CSV dates are exported as `DD/MM/YYYY`.

## Current architecture summary
- Frontend/PWA: GitHub Pages.
- Shared cloud data: Supabase Database.
- Product images: private Supabase Storage.
- Access control: remembered site password for new browser sessions + anonymous Supabase Auth + `authorized_devices` + RLS.
- Device working copy: localStorage for immediate saves/offline use after the site has been unlocked.
- Sync: automatic record-level background synchronization; no migration gate and no manual sync button.
- Daily finance: fully independent from inventory/products and unique by calendar date.
- Inventory movements: dedicated filtered history page inside the inventory module.
- Full user-facing dates: numeric `DD/MM/YYYY`; internal storage: ISO `YYYY-MM-DD`.

## Open decisions
- Whether to provide an in-app password-change screen later.
- Whether a formal named account login should ever replace the simple shared site password if more users are added later.