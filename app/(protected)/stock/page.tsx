import sql from '@/lib/db'
import Link from 'next/link'
import { fmtDate } from '@/lib/fmtDate'

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
    <div className="py-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Stock Summary</h1>
        <Link href="/stock/counts?tab=Daily"
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition">
          + Count
        </Link>
      </div>

      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search items…"
          className="flex-1 bg-white border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400" />
        <button type="submit"
          className="bg-gray-100 hover:bg-gray-200 text-gray-900 text-sm px-4 py-3 rounded-xl transition">
          Search
        </button>
      </form>

      {/* Mobile: card list */}
      <div className="md:hidden space-y-2">
        {rows.map((r: any) => {
          const soh = Number(r.calculated_soh)
          const low = soh < 5
          return (
            <Link key={r.item_id} href={`/stock/${r.item_id}`}
              className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 active:bg-gray-100">
              <div className="min-w-0 flex-1 pr-3">
                <p className={`font-medium truncate ${low ? 'text-red-400' : 'text-gray-900'}`}>{r.item_name}</p>
                <p className="text-gray-400 text-xs mt-0.5">{r.cf_group || '—'}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-xl font-bold ${low ? 'text-red-400' : 'text-gray-900'}`}>
                  {soh.toFixed(0)}{low ? ' ?' : ''}
                </p>
                <p className="text-gray-400 text-xs">SOH</p>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Desktop: full table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white text-gray-600 text-xs uppercase">
              <th className="px-3 py-3 text-left">Item</th>
              <th className="px-3 py-3 text-left">Group</th>
              <th className="px-3 py-3 text-right">Purchased</th>
              <th className="px-3 py-3 text-right">Sold</th>
              <th className="px-3 py-3 text-right">Last Count</th>
              <th className="px-3 py-3 text-right font-semibold text-gray-900">SOH</th>
              <th className="px-3 py-3 text-right text-red-400">Loss</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => {
              const soh = Number(r.calculated_soh)
              const low = soh < 5
              return (
                <tr key={r.item_id} className="border-t border-gray-200 hover:bg-white/50">
                  <td className="px-3 py-2">
                    <Link href={`/stock/${r.item_id}`} className="text-blue-600 hover:text-blue-600">
                      {r.item_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-gray-400 text-xs">{r.cf_group || '—'}</td>
                  <td className="px-3 py-2 text-right text-gray-300">{Number(r.total_purchased).toFixed(0)}</td>
                  <td className="px-3 py-2 text-right text-gray-300">{Number(r.total_sold).toFixed(0)}</td>
                  <td className="px-3 py-2 text-right text-gray-600 text-xs">
                    {r.last_count_date ? `${fmtDate(String(r.last_count_date).slice(0,10))} (${Number(r.last_count_qty).toFixed(0)})` : '—'}
                  </td>
                  <td className={`px-3 py-2 text-right font-bold ${low ? 'text-red-400' : 'text-gray-900'}`}>
                    {soh.toFixed(0)} {low && '?'}
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

