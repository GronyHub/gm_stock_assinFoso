import sql from '@/lib/db'
import Link from 'next/link'

export default async function StockPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const rows = await sql`
    SELECT item_id, item_name, cf_group, unit_name,
           last_count_date, last_count_qty,
           total_purchased, total_sold,
           calculated_soh, calculated_loss
    FROM item_stock_summary
    WHERE (${q || null} IS NULL
           OR item_name ILIKE ${'%' + (q || '') + '%'}
           OR cf_group ILIKE ${'%' + (q || '') + '%'})
    ORDER BY item_name
    LIMIT 200
  `

  return (
    <div className="py-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Stock Summary</h1>
        <Link href="/stock/count"
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
          + Stock Count
        </Link>
      </div>

      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search items or group…"
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="submit" className="bg-gray-800 hover:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg transition">
          Search
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-gray-400 text-xs uppercase">
              <th className="px-3 py-3 text-left">Item</th>
              <th className="px-3 py-3 text-left">Group</th>
              <th className="px-3 py-3 text-right">Purchased</th>
              <th className="px-3 py-3 text-right">Sold</th>
              <th className="px-3 py-3 text-right">Last Count</th>
              <th className="px-3 py-3 text-right font-semibold text-white">SOH</th>
              <th className="px-3 py-3 text-right text-red-400">Loss</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => {
              const soh = Number(r.calculated_soh)
              const low = soh < 5
              return (
                <tr key={r.item_id} className="border-t border-gray-800 hover:bg-gray-900/50">
                  <td className="px-3 py-2">
                    <Link href={`/stock/${r.item_id}`} className="text-blue-400 hover:text-blue-300">
                      {r.item_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{r.cf_group || '—'}</td>
                  <td className="px-3 py-2 text-right text-gray-300">{Number(r.total_purchased).toFixed(0)}</td>
                  <td className="px-3 py-2 text-right text-gray-300">{Number(r.total_sold).toFixed(0)}</td>
                  <td className="px-3 py-2 text-right text-gray-400 text-xs">
                    {r.last_count_date ? `${String(r.last_count_date).slice(0,10)} (${Number(r.last_count_qty).toFixed(0)})` : '—'}
                  </td>
                  <td className={`px-3 py-2 text-right font-bold ${low ? 'text-red-400' : 'text-white'}`}>
                    {soh.toFixed(0)} {low && '⚠'}
                  </td>
                  <td className="px-3 py-2 text-right text-red-400 text-xs">
                    {r.calculated_loss != null && Number(r.calculated_loss) !== 0 ? Number(r.calculated_loss).toFixed(0) : ''}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
