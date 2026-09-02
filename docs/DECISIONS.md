# Decision Log

This file records agreed business and product decisions for 5areta.

## Confirmed

### D-001 — Daily finance separation
Status: Confirmed

Shop profit, personal withdrawals, and main-vault withdrawals are separate concepts.

### D-002 — Inventory has two main outbound purposes
Status: Confirmed

Stock leaves inventory as either:
- Internal shop operation / consumption.
- Customer sale.

### D-003 — Product sales must track profit
Status: Confirmed

For every product sale, record quantity, sale value, inventory cost, and resulting gross product profit.

### D-004 — Full inventory movement history
Status: Confirmed

Every stock addition or deduction must be logged rather than only overwriting the current quantity.

### D-005 — Default selling price per product
Status: Confirmed

Each product has a saved default selling price. When recording a sale, that price is prefilled automatically, but the user can edit it for that specific sale before saving.

### D-006 — Inventory unit model
Status: Confirmed

Inventory quantities are tracked as whole pieces only in the current version. No cartons, ml, grams, or unit conversions are required.

### D-007 — Inventory purchase payment source
Status: Confirmed

Inventory purchases are paid from the owner's personal money by default. Purchasing stock must not automatically reduce the main-vault balance.

## Proposed / awaiting confirmation

### D-008 — Costing method
Proposal: Weighted average cost.
Reason: simple, understandable, and appropriate for repeated purchases at changing prices.

### D-009 — Accounting for purchases
Proposal: Stock purchase increases inventory and records owner-funded cash outlay, but it should not immediately reduce operating profit. Cost affects profit when stock is consumed internally or sold.

### D-010 — Internal shop consumption
Proposal: Internal-use stock creates an operating cost automatically based on inventory cost. Avoid entering the same amount manually as an operating expense.

### D-011 — Product sales revenue
Proposal: Show service revenue and product revenue separately, plus combined total business revenue.

### D-012 — Storage architecture
Proposal: move inventory and images away from localStorage. Use IndexedDB for local-first v1, or Supabase now if multi-device synchronization is required immediately.

## Open decisions
- Whether owner-funded stock purchases should be tracked as owner capital/amount due back to owner.
- Supplier/invoice fields.
- Low stock threshold and alerts.
- Returns, damage/loss, manual stock adjustment.
- Whether cloud sync is required now.
