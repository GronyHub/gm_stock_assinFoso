'use client'
import { useState } from 'react'
import { fmtDate } from '@/lib/fmtDate'
import ItemDetailModal from '@/app/(protected)/item/_components/ItemDetailModal'

type Row = {
  item_id: number
  item_name: string
  cf_group: string | null
  last_count_date: string | null
  last_count_qty: string | number | null
  total_purchased: string | number
  total_sold: string | number
  calculated_soh: string | number
  calculated_loss: string | number | null
}

// The interactive part of the stock summary page split out into its own
// client component -- the page itself stays a server component (direct
// sql fetch), and this just needs viewingItemId's local state to open an
// item's detail popup instead of navigating to the Loss by Item page,
// which no longer exists as its own destination.
export default function StockList({ rows }: { rows: Record<string, any>[] }) {
  const typedRows = rows as unknown as Row[]
  const [viewingItemId, setViewingItemId] = useState<number | null>(null)

  return (
    <>
      {/* Mobile: card list */}
      <div className="md:hidden space-y-2">
        {typedRows.map(r => {
          const soh = Number(r.calculated_soh)
          const low = soh < 5
          return (
            <button key={r.item_id} type="button" onClick={() => setViewingItemId(r.item_id)}
              className="w-full flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 active:bg-gray-100 text-left">
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
            </button>
          )
        })}
      </div>

      {/* Desktop: full table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-white text-gray-600 text-[10px] uppercase">
              <th className="px-3 py-0.5 text-left">Item</th>
              <th className="px-3 py-0.5 text-left">Group</th>
              <th className="px-3 py-0.5 text-right">Purchased</th>
              <th className="px-3 py-0.5 text-right">Sold</th>
              <th className="px-3 py-0.5 text-right">Last Count</th>
              <th className="px-3 py-0.5 text-right font-semibold text-gray-900">SOH</th>
              <th className="px-3 py-0.5 text-right text-red-400">Loss</th>
            </tr>
          </thead>
          <tbody>
            {typedRows.map(r => {
              const soh = Number(r.calculated_soh)
              const low = soh < 5
              return (
                <tr key={r.item_id} className="border-t border-gray-200 hover:bg-white/50 text-[11px] font-bold leading-tight">
                  <td className="px-3 py-0">
                    <button type="button" onClick={() => setViewingItemId(r.item_id)} className="text-blue-600 hover:text-blue-600">
                      {r.item_name}
                    </button>
                  </td>
                  <td className="px-3 py-0 text-gray-400 text-[10px]">{r.cf_group || '—'}</td>
                  <td className="px-3 py-0 text-right text-gray-300">{Number(r.total_purchased).toFixed(0)}</td>
                  <td className="px-3 py-0 text-right text-gray-300">{Number(r.total_sold).toFixed(0)}</td>
                  <td className="px-3 py-0 text-right text-gray-600 text-[10px]">
                    {r.last_count_date ? `${fmtDate(String(r.last_count_date).slice(0,10))} (${Number(r.last_count_qty).toFixed(0)})` : '—'}
                  </td>
                  <td className={`px-3 py-0 text-right font-bold ${low ? 'text-red-400' : 'text-gray-900'}`}>
                    {soh.toFixed(0)} {low && '?'}
                  </td>
                  <td className="px-3 py-0 text-right text-red-400 text-[10px]">
                    {r.calculated_loss != null && Number(r.calculated_loss) !== 0 ? Number(r.calculated_loss).toFixed(0) : ''}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {viewingItemId != null && (
        <ItemDetailModal itemId={viewingItemId} onClose={() => setViewingItemId(null)} />
      )}
    </>
  )
}
