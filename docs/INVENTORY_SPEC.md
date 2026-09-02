# Inventory Module — Initial Specification

## UX goal
Inventory should feel like a simple shop tool, not an accounting system. Main mobile actions should be obvious and fast.

## Proposed screens

### Inventory home
- Current stock value.
- Number of products.
- Low-stock products.
- Product sales revenue and gross profit for selected month.
- Internal-use inventory cost for selected month.
- Product cards with image, name, available quantity, and current average cost.

### Add / receive stock
Fields:
- Product or new product.
- Product name (for new product).
- Image (for new product).
- Quantity received.
- Unit purchase cost.
- Date.
- Optional notes/supplier/invoice depending on final decision.

Result:
- Adds quantity.
- Recalculates weighted average cost if chosen.
- Creates an immutable STOCK_IN movement.

### Take from stock
User chooses one of two large actions:

1. تشغيل المحل
- Product.
- Quantity.
- Date.
- Notes optional.
- System calculates consumed inventory cost.
- Creates INTERNAL_USE stock movement.

2. بيع
- Product.
- Quantity.
- Selling price / total sale value.
- Date.
- Notes optional.
- System calculates cost of goods sold and gross profit.
- Creates SALE stock movement.

## Proposed entities

### Product
- id
- name
- image
- category
- unit
- currentQuantity (derived or cached)
- averageCost
- defaultSellPrice (optional / pending)
- minimumStock (optional / pending)
- createdAt
- archivedAt

### InventoryMovement
- id
- productId
- date
- type: PURCHASE | INTERNAL_USE | SALE | ADJUSTMENT | RETURN
- quantity
- unitCostAtMovement
- totalCost
- saleUnitPrice (sale only)
- saleRevenue (sale only)
- grossProfit (sale only)
- notes
- createdAt

### Purchase metadata (optional)
- supplier
- invoiceNumber
- paymentMethod

## Core calculations

### Stock quantity
Stock = purchases + positive adjustments + customer returns - sales - internal use - losses/negative adjustments.

### Weighted average cost
newAverageCost = ((oldQty * oldAvgCost) + (receivedQty * receivedUnitCost)) / (oldQty + receivedQty)

### Product sale
COGS = saleQty * current average cost at sale time.
Gross product profit = sale revenue - COGS.

### Internal use
Internal-use cost = usedQty * current average cost at use time.

## Finance integration proposal
- Service revenue remains visible separately.
- Product revenue is visible separately.
- Total business revenue = service revenue + product revenue.
- Product-sale gross profit is revenue minus product COGS.
- Internal-use inventory cost counts as shop operating cost automatically.
- Stock purchasing reduces cash/vault if paid from business cash, but does not immediately reduce accounting profit.

## Important safeguards
- Never allow sale/use quantity greater than available stock unless an explicit override is added later.
- Never recompute historical sale profit using today's cost; save cost-at-movement.
- Editing/deleting stock movements must recalculate stock and warn if later movements become invalid.
- Product deletion should normally archive the product, not erase history.
- Image storage should be optimized/compressed.

## Future-friendly additions
- Barcode scanning.
- Suppliers.
- Purchase invoices.
- Low-stock alerts.
- Product categories.
- Customer returns.
- Damaged/expired stock.
- Cloud sync and employee roles.
