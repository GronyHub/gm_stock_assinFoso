'use client'
import { useState, useEffect, useCallback } from 'react'
import { fmtOrdinalDate } from '@/lib/fmtDate'

function parseTimeMins(t: string | null) {
  if (!t) return null
  const m = t.match(/^(\d+):(\d+)(am|pm)$/i)
  if (!m) return null
  let h = parseInt(m[1])
  const min = parseInt(m[2])
  const ap = m[3].toLowerCase()
  if (ap === 'pm' && h !== 12) h += 12
  if (ap === 'am' && h === 12) h = 0
  return h * 60 + min
}
function minsToHrs(mins: number) {
  return `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`
}
function fc(v: number) {
  return `₵${v.toLocaleString('en-GH', { maximumFractionDigits: 2 })}`
}
// jsPDF's built-in fonts (Helvetica) have no ₵ glyph -- it silently renders
// as "μ" instead. Use a plain "GHS " prefix in PDF output only; the on-screen
// tab uses fc() above since normal browser text handles ₵ fine.
function fcPdf(v: number) {
  return `GHS ${v.toLocaleString('en-GH', { maximumFractionDigits: 2 })}`
}
function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function shiftDate(date: string, days: number) {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

type StaffRow = { staff_name: string; actual_in: string | null; actual_out: string | null }
type CountRow = { item_id: number; item_name: string; quantity_counted: string | number; counted_by: string | null }
type VerifyStatus = 'verified' | 'unlinked' | 'inactive_item' | 'invalid'
type ItemLine = {
  item_id: number | null; item_name: string; qty: string | number; total: string | number
  previousStock: number | null
  currentStock: number | null
  costPrice: number | null
  margin: number | null
  verifyStatus: VerifyStatus
}
type Receipt = { id: number; customer_name: string | null; total: string | number; cash_counted: string | number | null; wnw: string | number | null }
type Data = {
  date: string
  staff: StaffRow[]
  dailyCount: CountRow[]
  receipts: Receipt[]
  hasReceipt: boolean
  itemsWIC: ItemLine[]
  itemsGMC: ItemLine[]
  allVerified: boolean
  cashCounted: number
  wnwTotal: number
  bills: { count: number; total: number }
  expenses: { count: number; total: number }
  profitLoss: number
  grossMarginWIC: number
  grossMarginIncomplete: boolean
  canSeeAmounts: boolean
}

const TONE_CLS = {
  blue:   'bg-blue-50 text-blue-700',
  orange: 'bg-orange-50 text-orange-600',
  red:    'bg-red-50 text-red-600',
  green:  'bg-green-50 text-green-600',
  amber:  'bg-amber-50 text-amber-700',
} as const

function StatCard({ label, value, tone }: { label: string; value: string; tone: keyof typeof TONE_CLS }) {
  return (
    <div className={`rounded-xl p-3 ${TONE_CLS[tone]}`}>
      <p className="text-[10px] font-semibold opacity-70">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <p className="text-sm font-semibold text-gray-700 mb-2">{title}</p>
      {children}
    </div>
  )
}

const VERIFY_BADGE: Record<VerifyStatus, { icon: string; label: string; cls: string; title: string }> = {
  verified: {
    icon: '✅', label: 'Verified', cls: 'text-green-700',
    title: 'This sale is linked to an active item with a valid quantity and amount.',
  },
  unlinked: {
    icon: '❗', label: 'Not linked', cls: 'text-red-600 font-semibold',
    title: "This sale line isn't linked to an inventory item, so it wasn't recorded against any item's stock -- fix it in the Aliases screen.",
  },
  inactive_item: {
    icon: '⚠️', label: 'Inactive item', cls: 'text-red-600 font-semibold',
    title: 'This sale is linked to an item marked Inactive -- check whether it was merged/deactivated after this sale, or the wrong item was picked.',
  },
  invalid: {
    icon: '⚠️', label: 'Invalid entry', cls: 'text-red-600 font-semibold',
    title: 'This sale line is missing a valid quantity or amount -- check how it was entered.',
  },
}

function fmtQty(v: number | null) {
  return v == null ? '—' : v.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function ItemLineTable({ rows, emptyText }: { rows: ItemLine[]; emptyText: string }) {
  if (!rows.length) return <p className="text-[11px] text-gray-400">{emptyText}</p>
  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="text-gray-400 border-b border-gray-100">
          <th className="text-left font-semibold py-1">Item</th>
          <th className="text-right font-semibold py-1">Qty</th>
          <th className="text-right font-semibold py-1">CP</th>
          <th className="text-right font-semibold py-1">Total</th>
          <th className="text-right font-semibold py-1">Before</th>
          <th className="text-right font-semibold py-1">After</th>
          <th className="text-center font-semibold py-1">Verify</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const badge = VERIFY_BADGE[r.verifyStatus]
          return (
            <tr key={i} className="border-b border-gray-50 last:border-0">
              <td className="py-1 text-gray-700">{r.item_name}</td>
              <td className="py-1 text-right text-gray-600">{r.qty}</td>
              <td className="py-1 text-right text-gray-500" title={r.costPrice == null ? 'No cost price on record for this item' : undefined}>
                {r.costPrice == null ? '—' : fc(r.costPrice)}
              </td>
              <td className="py-1 text-right text-gray-600">{fc(Number(r.total) || 0)}</td>
              <td className="py-1 text-right text-gray-500">{fmtQty(r.previousStock)}</td>
              <td className="py-1 text-right text-gray-700 font-medium">{fmtQty(r.currentStock)}</td>
              <td className="py-1 text-center" title={badge.title}>
                <span className={badge.cls}>{badge.icon}</span>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export default function DailySummaryTab() {
  const [date, setDate] = useState(todayStr())
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/daily-summary?date=${date}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setData(null); setLoading(false) })
  }, [date])

  useEffect(() => { load() }, [load])

  const isProfit = (data?.profitLoss ?? 0) >= 0
  const isToday = date === todayStr()

  const [downloading, setDownloading] = useState(false)
  async function downloadPdf() {
    if (!data) return
    setDownloading(true)
    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])
      const autoTable = autoTableModule.default
      const doc = new jsPDF()
      const pageHeight = doc.internal.pageSize.getHeight()
      let y = 15

      function ensureSpace(needed: number) {
        if (y + needed > pageHeight - 15) { doc.addPage(); y = 15 }
      }
      function heading(text: string) {
        ensureSpace(16)
        doc.setFontSize(11)
        doc.text(text, 14, y)
        y += 5
      }
      function afterTable() {
        y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8
      }

      doc.setFontSize(14)
      doc.text(`Daily Summary — ${fmtOrdinalDate(data.date)}`, 14, y)
      y += 8
      if (!data.hasReceipt) {
        doc.setFontSize(9)
        doc.setTextColor(180, 100, 0)
        doc.text('No sales receipt entered for this day -- figures below are incomplete.', 14, y)
        doc.setTextColor(0, 0, 0)
        y += 6
      }

      autoTable(doc, {
        startY: y,
        head: [['Summary', 'Amount']],
        body: [
          ['Cash Counted', fcPdf(data.cashCounted)],
          ['Work Not Written', fcPdf(data.wnwTotal)],
          [data.canSeeAmounts ? 'Expenses' : 'Expenses (excl. Salaries)', fcPdf(data.expenses.total)],
          ['Bills', fcPdf(data.bills.total)],
          [isProfit ? 'Net Profit (cash-basis)' : 'Net Loss (cash-basis)', fcPdf(Math.abs(data.profitLoss))],
          [`Gross Margin — WIC Sales (SP - CP)${data.grossMarginIncomplete ? ', partial' : ''}`, fcPdf(data.grossMarginWIC)],
        ],
        styles: { fontSize: 9 },
      })
      afterTable()

      heading('Staff Present & Times')
      autoTable(doc, {
        startY: y,
        head: [['Staff', 'In', 'Out', 'Hours']],
        body: data.staff.length ? data.staff.map(s => {
          const inM = parseTimeMins(s.actual_in), outM = parseTimeMins(s.actual_out)
          const hours = inM != null && outM != null
            ? minsToHrs(outM >= inM ? outM - inM : (outM + 1440) - inM)
            : '—'
          return [s.staff_name, s.actual_in ?? '—', s.actual_out ?? '—', hours]
        }) : [['No staff times recorded for this day.', '', '', '']],
        styles: { fontSize: 8 },
      })
      afterTable()

      heading('Daily Count')
      autoTable(doc, {
        startY: y,
        head: [['Item', 'Qty', 'Counted By']],
        body: data.dailyCount.length
          ? data.dailyCount.map(r => [r.item_name, String(r.quantity_counted), r.counted_by ?? '—'])
          : [['No stock counts recorded for this day.', '', '']],
        styles: { fontSize: 8 },
      })
      afterTable()

      const itemBody = (rows: ItemLine[]) => rows.map(r => [
        r.item_name, String(r.qty), r.costPrice == null ? '—' : fc(r.costPrice), fc(Number(r.total) || 0),
        fmtQty(r.previousStock), fmtQty(r.currentStock), VERIFY_BADGE[r.verifyStatus].label,
      ])
      const itemHead = [['Item', 'Qty', 'CP', 'Total', 'Before', 'After', 'Verify']]

      heading('Items Bought — WIC')
      autoTable(doc, {
        startY: y,
        head: itemHead,
        body: data.itemsWIC.length ? itemBody(data.itemsWIC) : [['No walk-in customer purchases.', '', '', '', '', '', '']],
        styles: { fontSize: 8 },
      })
      afterTable()

      heading('Items Bought — GMC')
      autoTable(doc, {
        startY: y,
        head: itemHead,
        body: data.itemsGMC.length ? itemBody(data.itemsGMC) : [['No internal-use purchases.', '', '', '', '', '', '']],
        styles: { fontSize: 8 },
      })

      doc.save(`daily-summary-${data.date}.pdf`)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="px-4 py-3 space-y-3">
      {/* Date navigation */}
      <div className="flex items-center gap-2">
        <button onClick={() => setDate(d => shiftDate(d, -1))}
          className="shrink-0 w-8 h-8 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition font-bold">‹</button>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="flex-1 min-w-0 text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400" />
        <button onClick={() => setDate(d => shiftDate(d, 1))} disabled={isToday}
          className="shrink-0 w-8 h-8 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition font-bold disabled:opacity-30">›</button>
        {!isToday && (
          <button onClick={() => setDate(todayStr())}
            className="shrink-0 text-[10px] font-semibold text-blue-600">Today</button>
        )}
      </div>
      <div className="flex items-center justify-between -mt-1">
        <p className="text-xs text-gray-400">{fmtOrdinalDate(date)}</p>
        <div className="flex items-center gap-2">
          {data && data.allVerified && (
            <span className="text-[10px] font-semibold text-green-700">✅ All Verified</span>
          )}
          <button onClick={downloadPdf} disabled={!data || downloading}
            className="shrink-0 text-[10px] font-semibold px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 transition">
            {downloading ? 'Preparing…' : '⬇ Download PDF'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>
      ) : !data ? (
        <div className="py-20 text-center text-gray-400 text-xs">Failed to load the daily summary.</div>
      ) : (
        <>
          {!data.hasReceipt && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex gap-2">
              <span className="text-sm shrink-0">⚠️</span>
              <p className="text-[11px] text-amber-800 leading-snug">
                No sales receipt has been entered for this day yet -- items bought, cash counted, Work Not Written, and Profit/Loss below will be incomplete until it is.
              </p>
            </div>
          )}

          {/* Profit & Loss + WNW */}
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Cash Counted" value={fc(data.cashCounted)} tone="blue" />
            <StatCard label="Work Not Written" value={fc(data.wnwTotal)} tone="amber" />
            <StatCard label={data.canSeeAmounts ? 'Expenses' : 'Expenses (excl. Salaries)'} value={fc(data.expenses.total)} tone="orange" />
            <StatCard label="Bills" value={fc(data.bills.total)} tone="red" />
          </div>
          <StatCard label={isProfit ? 'Net Profit (today)' : 'Net Loss (today)'} value={fc(Math.abs(data.profitLoss))} tone={isProfit ? 'green' : 'red'} />
          {!data.canSeeAmounts && (
            <p className="text-[10px] text-gray-400 -mt-1">Salaries are excluded from Expenses and Profit/Loss for your account.</p>
          )}
          <StatCard
            label={`Gross Margin — WIC Sales (SP − CP)${data.grossMarginIncomplete ? ', partial' : ''}`}
            value={fc(data.grossMarginWIC)}
            tone={data.grossMarginWIC >= 0 ? 'green' : 'red'}
          />
          <p className="text-[10px] text-gray-400 -mt-1 leading-snug">
            This is a different number from Net Profit above, and they&apos;re not supposed to match: Net Profit is cash-basis (cash counted minus expenses and bills, including stock bought but not yet sold today), while Gross Margin is what today&apos;s actual WIC sales earned over their cost price, regardless of when they were paid for or restocked.
            {data.grossMarginIncomplete && ' Some items sold today have no cost price on record, so this figure is understated.'}
          </p>

          {/* Staff */}
          <Section title="Staff Present & Times">
            {data.staff.length === 0 ? (
              <p className="text-[11px] text-gray-400">No staff times recorded for this day.</p>
            ) : (
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-100">
                    <th className="text-left font-semibold py-1">Staff</th>
                    <th className="text-right font-semibold py-1">In</th>
                    <th className="text-right font-semibold py-1">Out</th>
                    <th className="text-right font-semibold py-1">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {data.staff.map((s, i) => {
                    const inM = parseTimeMins(s.actual_in), outM = parseTimeMins(s.actual_out)
                    const hours = inM != null && outM != null
                      ? minsToHrs(outM >= inM ? outM - inM : (outM + 1440) - inM)
                      : '—'
                    return (
                      <tr key={i} className="border-b border-gray-50 last:border-0">
                        <td className="py-1 text-gray-700 capitalize">{s.staff_name}</td>
                        <td className="py-1 text-right text-green-700">{s.actual_in ?? '—'}</td>
                        <td className="py-1 text-right text-orange-600">{s.actual_out ?? '—'}</td>
                        <td className="py-1 text-right text-gray-600">{hours}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </Section>

          {/* Daily count */}
          <Section title="Daily Count">
            {data.dailyCount.length === 0 ? (
              <p className="text-[11px] text-gray-400">No stock counts recorded for this day.</p>
            ) : (
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-100">
                    <th className="text-left font-semibold py-1">Item</th>
                    <th className="text-right font-semibold py-1">Qty</th>
                    <th className="text-right font-semibold py-1">Counted By</th>
                  </tr>
                </thead>
                <tbody>
                  {data.dailyCount.map(r => (
                    <tr key={r.item_id} className="border-b border-gray-50 last:border-0">
                      <td className="py-1 text-gray-700">{r.item_name}</td>
                      <td className="py-1 text-right text-gray-600">{r.quantity_counted}</td>
                      <td className="py-1 text-right text-gray-600 capitalize">{r.counted_by ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* Items bought WIC */}
          <Section title="Items Bought — WIC">
            <p className="text-[10px] text-gray-400 mb-1.5">
              Before/After = stock on record just before and after this sale (informational -- not required for Verify). Verify confirms the sale itself was recorded correctly: ✅ linked to an active item with a valid quantity and amount, ⚠️ inactive item or invalid entry, ❗ not linked to an item at all.
            </p>
            <ItemLineTable rows={data.itemsWIC} emptyText="No walk-in customer purchases recorded for this day." />
            {data.itemsWIC.length > 0 && (
              <p className="text-[10px] text-amber-700 mt-2">
                🔁 Count these tomorrow to confirm they&apos;re intact.
              </p>
            )}
          </Section>

          {/* Items bought GMC */}
          <Section title="Items Bought — GMC">
            <ItemLineTable rows={data.itemsGMC} emptyText="No Grony Multimedia (internal use) purchases recorded for this day." />
          </Section>
        </>
      )}
    </div>
  )
}
