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

## Proposed / awaiting confirmation

### D-005 — Costing method
Proposal: Weighted average cost.
Reason: simple, understandable, and appropriate for repeated purchases at changing prices.

### D-006 — Accounting for purchases
Proposal: Stock purchase is recorded as inventory/cash movement. It should not immediately reduce operating profit. Cost affects profit when stock is consumed internally or sold.

### D-007 — Internal shop consumption
Proposal: Internal-use stock creates an operating cost automatically based on inventory cost. Avoid entering the same amount manually as an operating expense.

### D-008 — Product sales revenue
Proposal: Show service revenue and product revenue separately, plus combined total business revenue.

### D-009 — Storage architecture
Proposal: move inventory and images away from localStorage. Use IndexedDB for local-first v1, or Supabase now if multi-device synchronization is required immediately.

## Open decisions
- Default selling price vs price entered on each sale.
- Product units and packaging model.
- Supplier/invoice fields.
- Low stock threshold and alerts.
- Returns, damage/loss, manual stock adjustment.
- Whether cloud sync is required now.
