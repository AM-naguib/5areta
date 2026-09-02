# 5areta — Project Memory

Last updated: 2026-09-03

## Purpose
5areta is a simple Arabic RTL, mobile-first shop management app for a barbershop. It should stay easy enough to use daily from a phone, while being structured so it can run on a shop device and share the same live business data.

## Existing financial model
- Shop profit = service revenue - operating expenses - worker payments.
- Personal withdrawals are NOT shop operating expenses.
- Net cash into main vault = shop profit - personal withdrawals from daily income.
- Main-vault withdrawals are tracked separately and do not change shop profit.
- Main-vault balance = opening vault balance + net cash from days - main-vault withdrawals.

## Existing product goals
- Arabic RTL.
- Mobile-first.
- Very fast daily entry.
- Clear separation between profit, personal withdrawals, and vault movement.
- PWA / installable web app.
- GitHub Pages remains the frontend deployment.

## Inventory requirements and confirmed behavior
The app includes inventory for creams, oils, and similar products.

Each product supports:
- Product name.
- Product image.
- Quantity in stock.
- Purchase cost.
- A saved default selling price.

### Confirmed selling-price behavior
Each product has one saved default selling price. When recording a sale, that price appears automatically, but it can be edited for that individual sale before saving.

Changing a product's purchase price during restocking must not automatically change its saved default selling price. The selling price stays as-is until the user edits it manually.

The saved default selling price can be edited from two places:
- A quick "Edit price" action directly on the product card.
- The full product edit screen, which also allows editing the product name and image.
Both update the same saved default selling price.

### Confirmed inventory unit behavior
Inventory is tracked by whole pieces only in the current version. Product quantities are simple counts such as 1, 2, 3. No cartons, ml, grams, or unit conversions are needed now.

### Confirmed inventory purchase funding
Inventory purchases are normally paid from the owner's personal money. Adding purchased stock must not automatically reduce the main-vault balance.

### Confirmed owner-funding tracking
Do not track these owner-funded stock purchases as money owed back to the owner or as owner capital. Only the stock purchase itself, its quantity, and inventory cost are recorded.

### Confirmed inventory costing method
Use the latest purchase price as the current unit cost for each product. Do not use weighted-average costing and do not keep separate purchase-batch cost layers.
Example: if a product previously cost 100 and the newest purchase costs 120, its current cost becomes 120 for later sale-profit and internal-consumption calculations.

### Confirmed purchase-entry fields
When adding purchased stock, keep the entry simple and record only:
- Product.
- Quantity.
- Purchase unit price.
- Purchase date.
Do not require supplier name, invoice number, or invoice notes in the current version.

### Confirmed restock behavior for existing products
An existing product must have a direct "Add stock" / restock action. The user can add more quantity to that same product and enter/edit the purchase unit price for the new stock addition, plus the purchase date. A changed purchase price must not require creating a new product. After saving the restock, the entered purchase price becomes that product's latest/current unit cost.

### Confirmed low-stock behavior
Use one shared low-stock threshold for all products. When any product reaches 3 pieces or fewer, show a low-stock warning.

### Confirmed product-card interaction
Product cards keep the main daily actions visible for speed:
- Sell.
- Internal use / shop operation.
- Add stock.
- Edit selling price.

Tapping the product card itself opens the product-details screen. That screen shows the image, current quantity, latest purchase price, saved selling price, product profit information, and the full movement history for that product.

### Confirmed stock-adjustment scope
Do not include damaged/lost stock actions or manual quantity adjustments in the current version. Inventory changes should come only from:
- Purchases into stock.
- Internal shop consumption.
- Customer sales.

Inventory can leave stock for exactly two main reasons:
1. Shop operation / internal use.
2. Customer sale.

### Confirmed internal-use recording
When stock is used by the shop, deduct the quantity and record its inventory cost in a separate business category named "استهلاك منتجات". This category stays separate from ordinary operating expenses.

### Confirmed profit display with product consumption
The app shows two profit figures:
- Shop profit before product consumption = service revenue - ordinary operating expenses - worker payments.
- Shop profit after product consumption = shop profit before product consumption - product-consumption inventory cost.

This lets the owner see ordinary shop performance separately from the more complete profit after creams/oils/products used internally.

### Confirmed product-sales revenue reporting
Product-sales revenue stays separate from the normal daily service-revenue figure. Do not merge it into the daily service revenue. Product sales have their own revenue total, and each sale stores its sale amount, inventory cost, and product gross profit.

### Confirmed separate product-sales balances
Product-sale money is tracked in a dedicated product area and must not automatically increase the main shop vault.
The product area keeps two different figures:
- Product sales cash = the full cash collected from product sales.
- Product profit = product sales revenue minus the inventory cost of sold products.
Both figures remain visible and separate.

For sale:
- Quantity is deducted from stock.
- Sale amount is recorded.
- Cost of goods sold is calculated using the product's latest purchase price at the time of sale.
- Product-sale profit is calculated and stored.
- The system keeps a full movement history.

## Important accounting principle
Buying stock is a cash outflow but is not automatically the same as an operating expense for profit reporting. Inventory cost becomes an expense when the item is sold or consumed by the shop. We must keep cash movement and profit accounting separate.

## Confirmed deployment and data architecture
GitHub Pages remains the frontend host, but device-local storage is no longer the target long-term data architecture.

Use Supabase for shared persistent data so the owner's phone and the shop device see the same business state.

Target architecture:
- GitHub Pages: frontend/PWA only.
- Supabase Database: days, vault withdrawals, products, inventory movements, purchase/sale values, and other structured business records.
- Supabase Storage: product images.
- Authorized devices read and write the same Supabase data.
- The current localStorage implementation is temporary until migration is completed and verified.

### Confirmed first-phase access experience
Do not add normal owner/staff user accounts or a recurring login screen in the first Supabase migration phase.

A new or unrecognized device asks once for a six-digit shop PIN. The owner chooses one fixed six-digit PIN for the shop, and that same PIN is used to authorize any new device. After the PIN is accepted, that device is remembered and normal future use opens directly without asking for the PIN every time.

Security constraints:
- PIN verification happens through a protected backend/server-side path, not by embedding or comparing the secret in GitHub Pages JavaScript.
- Do not expose a Supabase service-role key, raw PIN, PIN hash, or any server secret in frontend code.
- The authorized device stores only a revocable device credential, not a server secret.
- Supabase data must not be unrestricted/publicly writable.

## Inventory V1 implementation status
Inventory V1 is currently deployed on GitHub Pages and works with browser-local storage. This is now considered the temporary implementation before the Supabase migration.

Implemented in the current live version:
- A new "المخزن" tab in the main navigation.
- Add a product with name, image, starting quantity, purchase price, saved selling price, and purchase date.
- Product images are compressed in the browser before local storage.
- Restock an existing product with a new quantity, editable new purchase price, and date.
- The newest restock price becomes the product's current/latest purchase cost; the saved selling price stays unchanged.
- Record customer product sales with editable sale price, inventory cost, revenue, and gross product profit.
- Record internal shop consumption under "استهلاك منتجات" and reduce stock.
- Show shop profit before product consumption and after product consumption.
- Show separate cumulative product-sales cash and product profit; neither automatically changes the main shop vault.
- Low-stock warning at 3 pieces or fewer.
- Product cards with quick Sell / Internal use / Add stock / Edit price actions.
- Product detail view with complete purchase, sale, and consumption movement history.
- Quick selling-price edit plus full product edit for name, image, and selling price.
- Backup/restore carries product and inventory data.

Live app: https://am-naguib.github.io/5areta/

### Confirmed migration of existing local data
When Supabase goes live, automatically migrate the existing browser-local app data into Supabase on first successful setup. Do not require the owner to re-enter the existing records manually.

After migration is verified, Supabase becomes the primary source of truth for shared business data. Local data may remain only as a temporary fallback/cache during migration and should not continue as an independent competing data source.

### Confirmed post-migration cleanup
After the automatic local-to-Supabase migration has completed and the migrated data has been verified successfully, delete the legacy app data from localStorage automatically.

The app should then use Supabase as the only primary source of truth. Do not keep the old local dataset as a parallel live copy that can diverge.

### Confirmed offline-first behavior
If the internet is unavailable, the app must continue accepting normal business entries locally instead of blocking work. Queue unsynced changes on the device and automatically synchronize them to Supabase when connectivity returns.

The UI should clearly indicate pending/offline changes until synchronization succeeds. Supabase remains the shared source of truth once queued changes are synchronized.

### Confirmed same-record conflict rule
If two authorized devices edit the same editable record while working from different states, use a simple last-write-wins rule: the most recently accepted update becomes the current value.

Inventory movement history should still be retained for normal stock actions, but editable record conflicts do not require a manual conflict-resolution screen in this phase.

### Confirmed background-only synchronization UX
Supabase synchronization should happen automatically in the background. Do not add a persistent sync-status indicator or a manual "sync now" button in the normal interface in this phase.

If an actual synchronization error requires user action, the app may still surface a clear error message rather than silently losing data.

### Confirmed product-image cloud storage
Store product images in Supabase Storage so the same product image is available on every authorized device. Structured product records should reference the stored image rather than keeping device-only image data as the primary copy.

## Supabase migration implementation status

Backend scaffolding has been added to the repository:
- `supabase/schema.sql`: tables, RLS, authorized-device checks, and private product-image bucket policies.
- `supabase/functions/verify-device/index.ts`: one-time 6-digit device PIN verification with per-session attempt limiting.
- `docs/SUPABASE_SETUP.md`: exact one-time Supabase Dashboard setup steps.

The actual production database is not active yet. Before wiring the live GitHub Pages frontend to Supabase, the Supabase project owner must enable anonymous sign-ins, run the schema SQL, configure `SHOP_PIN` as a Supabase Function secret, and deploy the `verify-device` Edge Function.

The chosen PIN value itself must never be committed to this repository.

## Open questions
- Device revocation/reset flow if a phone or shop device is lost.
- How to migrate any existing local data into Supabase when the migration goes live.

## Rule for future changes
Whenever a business/accounting decision is agreed, update MEMORY.md and docs/DECISIONS.md before or with the implementation commit.
