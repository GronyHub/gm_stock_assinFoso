// Shared numeric display trimming -- prices/units stored with fixed DB
// precision (e.g. "45.0000", "0.7000") should never show trailing zero
// decimals: a whole number shows with none at all, anything else shows
// only its actually-significant digits. Rounds to 4dp first to shake off
// binary floating-point noise before letting toString's own trimming do
// the rest ("45.0000" -> 45 -> "45", "0.7000" -> 0.7 -> "0.7").
export function trimZeros(num: number | string | null | undefined): string {
  if (num == null || num === '') return ''
  const n = Number(num)
  if (!Number.isFinite(n)) return String(num)
  return parseFloat(n.toFixed(4)).toString()
}

// ACP (Adjusted Cost Price = VCP + that bill's apportioned Shared Expenses)
// inherits whatever fraction falls out of splitting a shared expense across
// a bill's line items, which is real math but not a number anyone needs to
// see to 4 decimal places (e.g. 28.928, 50.8043). Displayed rounded to a
// whole number everywhere -- unlike other prices (see trimZeros above),
// which show their real value since those are set directly, not derived.
export function formatACP(num: number | string | null | undefined): string {
  if (num == null || num === '') return ''
  const n = Number(num)
  if (!Number.isFinite(n)) return String(num)
  return String(Math.round(n))
}
