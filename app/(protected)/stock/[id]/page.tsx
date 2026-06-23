import sql from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fmtDate } from '@/lib/fmtDate'

export default async function ItemHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [summary, txns] = await Promise.all([
    sql`SELECT * FROM item_stock_summary WHERE item_id = ${id}`,
    sql`SELECT txn_date, txn_type, reference, qty_change, unit_price, line_total, source, raw_item_name
        FROM item_transaction_history WHERE item_id = ${id}
        ORDER BY txn_date DESC, txn_type`,
  ])
  if (!summary.length) notFound()
  const s = summary[0]

  const typeStyle = (t: string) =>
    t === 'sale' ? 'bg-orange-900/50 text-orange-300'
    : t === 'stock_count' ? 'bg-blue-900/50 text-blue-300'
    : 'bg-green-900/50 text-green-300'

  return (
    <div className="py-4 space-y-5">
      <div>
        <Link href="/stock" className="text-sm text-gray-400 hover:text-white">← Stock</Link>
        <h1 className="text-xl font-bold mt-2">{s.item_name}</h1>
        <p className="text-sm text-gray-500">{s.cf_group}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'SOH', value: Number(s.calculated_soh).toFixed(0), color: Number(s.calculated_soh) < 5 ? 'text-red-400' : 'text-white' },
          { label: 'Purchased', value: Number(s.total_purchased).toFixed(0), color: 'text-green-400' },
          { label: 'Sold', value: Number(s.total_sold).toFixed(0), color: 'text-orange-400' },
          { label: 'Loss', value: s.calculated_loss != null ? Number(s.calculated_loss).toFixed(0) : '—', color: 'text-red-400' },
        ].map(c => (
          <div key={c.label} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-wider">{c.label}</p>
            <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {s.last_count_date && (
        <div className="bg-blue-950 border border-blue-800 rounded-xl p-4 text-sm">
          <span className="text-blue-400 font-medium">Last physical count:</span>
          <span className="text-white ml-2">{fmtDate(String(s.last_count_date).slice(0,10))}</span>
          <span className="text-gray-400 ml-2">— {Number(s.last_count_qty).toFixed(0)} units</span>
        </div>
      )}

      <h2 className="text-base font-semibold text-gray-300">Transaction History</h2>

      {/* Mobile: card list */}
      <div className="md:hidden space-y-2">
        {txns.map((t: any, i: number) => (
          <div key={i} className={`rounded-xl p-4 border border-gray-800 ${t.txn_type === 'stock_count' ? 'bg-blue-950/30' : 'bg-gray-900'}`}>
            <div className="flex items-start justify-between mb-1.5">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeStyle(t.txn_type)}`}>
                {t.txn_type}
              </span>
              <span className={`text-lg font-bold ${
                t.qty_change == null ? 'text-gray-500'
                : Number(t.qty_change) < 0 ? 'text-red-400' : 'text-green-400'}`}>
                {t.qty_change != null ? (Number(t.qty_change) > 0 ? '+' : '') + Number(t.qty_change).toFixed(0) : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-gray-400 text-sm">{fmtDate(String(t.txn_date).slice(0,10))}</p>
              {t.line_total != null && (
                <p className="text-gray-300 text-sm">₵{Number(t.line_total).toFixed(2)}</p>
              )}
            </div>
            {t.reference && <p className="text-gray-500 text-xs mt-1">{t.reference}</p>}
          </div>
        ))}
      </div>

      {/* Desktop: full table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-gray-400 text-xs uppercase">
              <th className="px-3 py-3 text-left">Date</th>
              <th className="px-3 py-3 text-left">Type</th>
              <th className="px-3 py-3 text-left">Reference</th>
              <th className="px-3 py-3 text-right">Qty</th>
              <th className="px-3 py-3 text-right">Unit Price</th>
              <th className="px-3 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {txns.map((t: any, i: number) => (
              <tr key={i} className={`border-t border-gray-800 ${t.txn_type === 'stock_count' ? 'bg-blue-950/30' : 'hover:bg-gray-900/50'}`}>
                <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{fmtDate(String(t.txn_date).slice(0,10))}</td>
                <td className="px-3 py-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeStyle(t.txn_type)}`}>
                    {t.txn_type}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-400 text-xs">{t.reference || '—'}</td>
                <td className={`px-3 py-2 text-right font-medium ${
                  t.qty_change == null ? 'text-gray-500'
                  : Number(t.qty_change) < 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {t.qty_change != null ? (Number(t.qty_change) > 0 ? '+' : '') + Number(t.qty_change).toFixed(0) : '—'}
                </td>
                <td className="px-3 py-2 text-right text-gray-400">
                  {t.unit_price != null ? `₵${Number(t.unit_price).toFixed(2)}` : '—'}
                </td>
                <td className="px-3 py-2 text-right text-gray-300">
                  {t.line_total != null ? `₵${Number(t.line_total).toFixed(2)}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
