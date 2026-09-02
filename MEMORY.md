# 5areta — Project Memory

Last updated: 2026-09-02

## Purpose
5areta is a simple Arabic RTL, mobile-first shop management app for a barbershop. It should stay easy enough to use daily from a phone, while being structured so it can later run on a shop device and support cloud sync.

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
- Current version is local-first and can be backed up/restored.

## New inventory requirements requested
The app will gain inventory for creams, oils, and similar products.

Each product should support:
- Product name.
- Product image.
- Quantity in stock.
- Purchase cost.
- A saved default selling price.

### Confirmed selling-price behavior
Each product has one saved default selling price. When recording a sale, that price appears automatically, but it can be edited for that individual sale before saving.

### Confirmed inventory unit behavior
Inventory is tracked by whole pieces only in the current version. Product quantities are simple counts such as 1, 2, 3. No cartons, ml, grams, or unit conversions are needed now.

### Confirmed inventory purchase funding
Inventory purchases are normally paid from the owner's personal money. Adding purchased stock must not automatically reduce the main-vault balance.

### Confirmed owner-funding tracking
Do not track these owner-funded stock purchases as money owed back to the owner or as owner capital. Only the stock purchase itself, its quantity, and inventory cost are recorded.

Inventory can leave stock for exactly two main reasons:
1. Shop operation / internal use.
2. Customer sale.

### Confirmed internal-use recording
When stock is used by the shop, deduct the quantity and record its inventory cost in a separate business category named "استهلاك منتجات". This category stays separate from ordinary operating expenses.

### Confirmed profit display with product consumption
The app should show two profit figures:
- Shop profit before product consumption = service revenue - ordinary operating expenses - worker payments.
- Shop profit after product consumption = shop profit before product consumption - product-consumption inventory cost.

This lets the owner see ordinary shop performance separately from the more complete profit after creams/oils/products used internally.

### Confirmed product-sales revenue reporting
Product-sales revenue stays separate from the normal daily service-revenue figure. Do not merge it into the daily service revenue. Product sales should have their own revenue total, and each sale should store its sale amount, inventory cost, and product gross profit.

For sale:
- Quantity is deducted from stock.
- Sale amount is recorded.
- Cost of goods sold is calculated.
- Product-sale profit is calculated and stored.
- The system must keep a full movement history.

## Important accounting principle
Buying stock is a cash outflow but is not automatically the same as an operating expense for profit reporting. Inventory cost becomes an expense when the item is sold or consumed by the shop. We must keep cash movement and profit accounting separate.

## Proposed stock cost method
Recommended: weighted average cost, unless changed by decision.
Example: buy 10 units at 100 and later 10 at 120 => average stock cost becomes 110. Selling/using 2 units records cost of 220.

## Data / technical concern
Product images and larger inventory history should not rely only on localStorage. Preferred next architecture is either:
- local-first with IndexedDB for products/images/movements, or
- cloud-backed storage/database (e.g. Supabase) for multi-device sync.
Decision pending.

## Open questions
- Should stock purchases record supplier and invoice/notes?
- Do we need low-stock alerts / minimum stock levels?
- Do we need returns, damaged/lost stock, and manual adjustment from version 1?
- Local-only vs multi-device cloud sync now?

## Rule for future changes
Whenever a business/accounting decision is agreed, update MEMORY.md and docs/DECISIONS.md before or with the implementation commit.
