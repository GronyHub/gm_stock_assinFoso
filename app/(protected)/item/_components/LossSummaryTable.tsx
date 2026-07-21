'use client'

type Period = { n: number; amt: number }
export type LossSummary = { total: Period; yesterday: Period; week: Period; month: Period; year: Period }

const cedis = (v: number) => `₵${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`

// Loss Feed period totals as a table -- same fix as the flag-type table:
// the panel title already says whose numbers these are, so rows don't
// need to repeat it.
export function LossSummaryTable({ summary, onFixNow }: { summary: LossSummary; onFixNow: () => void }) {
  const rows: { label: string; period: Period }[] = [
    { label: 'All-Time', period: summary.total },
    { label: 'Yesterday', period: summary.yesterday },
    { label: 'This Week', period: summary.week },
    { label: 'This Month', period: summary.month },
    { label: 'This Year', period: summary.year },
  ]

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden mb-2">
      <table className="w-full text-[11px] border-collapse">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-2 py-1.5 font-semibold text-gray-500">Period</th>
            <th className="text-center px-1.5 py-1.5 font-semibold text-gray-500">Losses</th>
            <th className="text-right px-2 py-1.5 font-semibold text-gray-500">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(r => (
            <tr key={r.label} onClick={() => r.period.n > 0 && onFixNow()}
              className={`transition ${r.period.n > 0 ? 'cursor-pointer hover:bg-blue-50' : ''}`}>
              <td className={`px-2 py-1.5 ${r.period.n > 0 ? 'text-gray-800' : 'text-gray-400'}`}>{r.label}</td>
              <td className={`px-1.5 py-1.5 text-center font-bold ${r.period.n > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {r.period.n > 0 ? r.period.n : '✓'}
              </td>
              <td className={`px-2 py-1.5 text-right ${r.period.n > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                {r.period.n > 0 ? cedis(r.period.amt) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-2 py-1 text-[10px] text-gray-400 bg-gray-50 border-t border-gray-100">
        Fix losses now or they&apos;ll be deducted from salary.
      </p>
    </div>
  )
}
