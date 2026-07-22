// Shared primitives for the analytics sections distributed across each
// Grony Cash submenu (see ItemsAnalyticsSection, SalesAnalyticsSection,
// BillsAnalyticsSection, CountsAnalyticsSection, ExpensesAnalyticsSection,
// CashAnalyticsSection, LossAnalyticsSection, and ViolationsMiniChart) --
// split out of the old standalone Data tab (AnalyticsPanel) so each chart
// lives on the menu it's actually about instead of a separate tab.
const SHORT_MON = ['Ja','Fe','Mr','Ap','My','Ju','Jl','Au','Se','Oc','No','De']

export function monthLabel(k: string | null | undefined) {
  if (!k) return '—'
  const [y, m] = k.split('-').map(Number)
  return `${SHORT_MON[m - 1]} ${String(y).slice(-2)}`
}

export function dayLabel(s: string | null | undefined) {
  if (!s) return '—'
  const d = new Date(s + 'T00:00:00')
  return `${d.getDate()} ${SHORT_MON[d.getMonth()]}`
}

export function n(v: any) { const x = parseFloat(v); return isNaN(x) ? 0 : x }
export function fc(v: number) { return `₵${v.toLocaleString('en-GH', { maximumFractionDigits: 0 })}` }

export const PIE_COLORS = ['#3b82f6','#a855f7','#22c55e','#f97316','#ef4444','#06b6d4','#eab308','#ec4899','#64748b','#84cc16']

// One color per violation category -- shared between each menu's own
// ViolationsMiniChart so the color for e.g. "Sales" is consistent wherever
// it shows up.
export const CATEGORY_COLORS: Record<string, string> = {
  Items: '#3b82f6', Sales: '#f97316', Counts: '#6366f1', Cash: '#06b6d4', Staff: '#a855f7',
}

export function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 mb-3">
      <p className="text-sm font-semibold text-gray-700 mb-1">{title}</p>
      {subtitle && <p className="text-[10px] text-gray-400 mb-1">{subtitle}</p>}
      {children}
    </div>
  )
}

export function Pill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2 flex-1 min-w-[100px]">
      <p className="text-[10px] text-gray-400">{label}</p>
      <p className="text-sm font-bold" style={{ color: color ?? '#111827' }}>{value}</p>
    </div>
  )
}

export function Recommendation({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3 flex gap-2">
      <span className="text-sm shrink-0">💡</span>
      <p className="text-[11px] text-amber-800 leading-snug">{children}</p>
    </div>
  )
}

// Plain SVG rather than recharts -- a trend list can render one of these per
// item (potentially hundreds), and a recharts instance per row is too heavy.
export function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 64, h = 24, pad = 3
  const max = Math.max(...data, 0.0001)
  const points = data.map((v, i) => {
    const x = pad + (data.length > 1 ? (i / (data.length - 1)) * (w - pad * 2) : 0)
    const y = h - pad - (v / max) * (h - pad * 2)
    return [x, y]
  })
  const path = points.map(p => p.join(',')).join(' ')
  const [lastX, lastY] = points[points.length - 1] ?? [pad, h - pad]
  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden>
      <polyline points={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={2.5} fill={color} />
    </svg>
  )
}

export function TrendBadge({ direction, pct }: { direction: 'up' | 'down' | 'flat'; pct: number }) {
  const cls = direction === 'up' ? 'text-green-700 bg-green-50' : direction === 'down' ? 'text-red-700 bg-red-50' : 'text-gray-500 bg-gray-100'
  const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '—'
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${cls}`}>
      {arrow} {Math.abs(pct).toFixed(0)}%
    </span>
  )
}

export function StalenessBadge({ days }: { days: number | null }) {
  const cls = days === null || days >= 90 ? 'bg-red-50 text-red-700' : days >= 30 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${cls}`}>
      {days === null ? 'Never sold' : `${days}d`}
    </span>
  )
}

// Recent-half vs prior-half average, e.g. for a monthly/daily series.
export function splitTrend(series: number[]): { pct: number; direction: 'up' | 'down' | 'flat' } {
  const half = Math.floor(series.length / 2)
  const recent = series.slice(-half)
  const prior = series.slice(0, series.length - half)
  const recentAvg = recent.reduce((a, b) => a + b, 0) / (recent.length || 1)
  const priorAvg = prior.reduce((a, b) => a + b, 0) / (prior.length || 1)
  if (priorAvg === 0 && recentAvg === 0) return { pct: 0, direction: 'flat' }
  if (priorAvg === 0) return { pct: 100, direction: 'up' }
  const pct = ((recentAvg - priorAvg) / priorAvg) * 100
  return { pct: Math.round(pct * 10) / 10, direction: pct > 10 ? 'up' : pct < -10 ? 'down' : 'flat' }
}
