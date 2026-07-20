export type VerifyStatus = 'verified' | 'unlinked' | 'inactive_item' | 'invalid'

// Confirms a sale line was recorded correctly -- linked to a real, active
// item, with a positive quantity and a recorded amount. Deliberately does
// NOT depend on any stock count: a sale can be entered correctly on the day
// it happens even if nobody has physically counted the item yet (that's
// what the next day's count is for). Shared by /api/daily-summary (per-item,
// on the aggregated day total) and /api/sales/verified-dates (per-line, via
// the equivalent SQL condition) -- keep both in sync if this changes.
export function verifySaleLine(input: {
  itemId: number | null
  itemStatus: string | null
  quantity: number | null
  total: number | null
}): VerifyStatus {
  if (input.itemId == null) return 'unlinked'
  if (input.itemStatus === 'Inactive') return 'inactive_item'
  if (input.quantity == null || !(input.quantity > 0)) return 'invalid'
  if (input.total == null) return 'invalid'
  return 'verified'
}
