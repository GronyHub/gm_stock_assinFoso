// A cedi amount with a larger whole number and smaller decimals (Temu-style), so a column of prices is quick to scan.
// Always two decimals, thousands separated, tabular figures so the digits line up down a column.
export default function MoneyText({ v, className = '' }: { v: number; className?: string }) {
  const n = Number.isFinite(v) ? v : 0
  const [whole, dec] = Math.abs(n).toFixed(2).split('.')
  const grouped = Number(whole).toLocaleString('en-GB')
  return (
    <span className={`whitespace-nowrap tabular-nums ${className}`}>
      {n < 0 ? '-' : ''}<span className="text-[0.8em]">₵</span><span className="font-bold">{grouped}</span><span className="text-[0.75em]">.{dec}</span>
    </span>
  )
}
