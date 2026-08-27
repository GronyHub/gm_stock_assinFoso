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
