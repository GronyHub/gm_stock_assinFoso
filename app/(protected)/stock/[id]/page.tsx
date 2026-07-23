import sql from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fmtDate } from '@/lib/fmtDate'
import ItemDetailPanel from '../../item/_components/ItemDetailPanel'

export default async function ItemHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [summary, itemRow] = await Promise.all([
    sql`SELECT * FROM item_stock_summary WHERE item_id = ${id}`,
    sql`SELECT canonical_name, cf_group, selling_rate, purchase_rate FROM items WHERE id = ${id}`,
  ])
  if (!summary.length) notFound()
  const s = summary[0]
  const item = itemRow[0] ?? {}
  const soh = Number(s.calculated_soh)
  const sp = item.selling_rate != null ? Number(item.selling_rate) : null
  const cp = item.purchase_rate != null ? Number(item.purchase_rate) : null
  const stockValue = cp != null ? soh * cp : null

  const stats = [
    { label: 'SOH', value: soh.toFixed(0), color: soh < 5 ? 'text-red-500' : 'text-gray-900' },
    { label: 'SP', value: sp != null ? `₵${sp.toFixed(0)}` : '—', color: 'text-blue-600' },
    { label: 'CP', value: cp != null ? `₵${cp.toFixed(0)}` : '—', color: 'text-green-600' },
    { label: 'Stock Value', value: stockValue != null ? `₵${stockValue.toFixed(0)}` : '—', color: 'text-gray-900' },
    { label: 'Purchased', value: Number(s.total_purchased).toFixed(0), color: 'text-green-600' },
    { label: 'Sold', value: Number(s.total_sold).toFixed(0), color: 'text-orange-500' },
    { label: 'Loss', value: s.calculated_loss != null ? Number(s.calculated_loss).toFixed(0) : '—', color: 'text-red-500' },
  ]

  return (
    <div className="py-4 space-y-4">
      <div>
        <Link href="/item" className="text-xs text-gray-400 hover:text-gray-700">← Items</Link>
        <h1 className="text-xl font-bold text-gray-900 mt-1">{item.canonical_name ?? s.item_name}</h1>
        <p className="text-sm text-gray-400">{item.cf_group ?? s.cf_group}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {stats.map(c => (
          <div key={c.label} className="bg-white rounded-xl p-3 border border-gray-200">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">{c.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {s.last_count_date && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm">
          <span className="text-blue-600 font-medium">Last physical count:</span>
          <span className="text-gray-900 ml-2">{fmtDate(String(s.last_count_date).slice(0,10))}</span>
          <span className="text-gray-400 ml-2">— {Number(s.last_count_qty).toFixed(0)} units</span>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-gray-600 mb-1.5">Detail</h2>
        <ItemDetailPanel itemId={Number(id)} />
      </div>
    </div>
  )
}
