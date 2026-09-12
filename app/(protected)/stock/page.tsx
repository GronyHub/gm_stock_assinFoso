import sql from '@/lib/db'
import Link from 'next/link'
import StockList from './StockList'
import { getGmcTargetSohMap } from '@/lib/gmcStock'

export default async function StockPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const rawRows = await sql`
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
  // calculated_soh has no concept of a pack-open resetting the count, so it
  // drifts for a GMC conversion target -- override it with the pack-reset-
  // aware figure from lib/gmcStock.ts for the handful of items that's true for.
  const gmcMap = await getGmcTargetSohMap()
  const rows = gmcMap.size === 0 ? rawRows : rawRows.map(r => gmcMap.has(r.item_id) ? { ...r, calculated_soh: gmcMap.get(r.item_id) } : r)

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

      <StockList rows={rows} />
    </div>
  )
}

