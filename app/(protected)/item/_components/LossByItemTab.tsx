'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type Row = { item_id: number; item_name: string; lgAmt: number; lossCount: number }
type SortCol = 'item_name' | 'lossCount' | 'lgAmt'
type SortDir = 'asc' | 'desc'

function fmtAmt(v: number) {
  if (v === 0) return '—'
  const s = Math.abs(v) >= 100 ? Math.abs(v).toFixed(0) : Math.abs(v).toFixed(1)
  return (v > 0 ? '+' : '-') + s
}

function Th({ label, col, cls = '', sort, onSort }: {
  label: string; col: SortCol; cls?: string
  sort: { col: SortCol; dir: SortDir }; onSort: (col: SortCol) => void
}) {
  const active = sort.col === col
  const arrow = active ? (sort.dir === 'desc' ? '↓' : '↑') : ''
  return (
    <th onClick={() => onSort(col)}
      className={`px-2 py-2 font-bold cursor-pointer select-none whitespace-nowrap text-[10px] uppercase tracking-wide border-b border-gray-200
        ${cls} ${active ? 'text-blue-600' : 'text-gray-400 hover:text-gray-700'}`}>
      {label}{arrow && <span className="ml-0.5 text-[9px]">{arrow}</span>}
    </th>
  )
}

// Every item ranked by its own running loss total -- same underlying data
// as the Items table (/api/losses/summary), just narrowed to the two
// numbers that actually answer "which items are losing money" instead of
// all eleven metric columns.
export default function LossByItemTab({ search }: { search: string }) {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<{ col: SortCol; dir: SortDir }>({ col: 'lgAmt', dir: 'desc' })

  useEffect(() => {
    fetch('/api/losses/summary').then(r => r.json())
      .then(d => { setRows(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q ? rows.filter(r => r.item_name.toLowerCase().includes(q)) : rows
    const dir = sort.dir === 'desc' ? -1 : 1
    return [...list].sort((a, b) => {
      const av = a[sort.col], bv = b[sort.col]
      return typeof av === 'string' ? dir * av.localeCompare(bv as string) : dir * ((av as number) - (bv as number))
    })
  }, [rows, search, sort])

  function handleSort(col: SortCol) {
    setSort(s => s.col === col ? { col, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { col, dir: col === 'item_name' ? 'asc' : 'desc' })
  }

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  return (
    <div className="flex flex-col h-full min-h-0 p-2">
      <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full table-fixed border-collapse text-[11px]">
          <colgroup>
            <col />
            <col style={{ width: 80 }} />
            <col style={{ width: 90 }} />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50">
              <Th label="Item" col="item_name" cls="text-left pl-2" sort={sort} onSort={handleSort} />
              <Th label="Loss No." col="lossCount" cls="text-center" sort={sort} onSort={handleSort} />
              <Th label="Loss Amt." col="lgAmt" cls="text-center" sort={sort} onSort={handleSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr><td colSpan={3} className="py-10 text-center text-gray-400 text-xs">No items</td></tr>
            )}
            {filtered.map((row, i) => (
              <tr key={row.item_id} onClick={() => router.push(`/stock/${row.item_id}`)}
                className={`cursor-pointer hover:bg-blue-50/60 transition ${i % 2 === 1 ? 'bg-gray-50' : 'bg-white'}`}>
                <td className="pl-2 pr-2 py-1.5 font-bold truncate text-blue-600">{row.item_name}</td>
                <td className={`text-center py-1.5 font-semibold tabular-nums ${row.lossCount > 0 ? 'text-red-500' : 'text-gray-300'}`}>
                  {row.lossCount}
                </td>
                <td className={`text-center py-1.5 font-semibold tabular-nums ${row.lgAmt > 0 ? 'text-red-500' : row.lgAmt < 0 ? 'text-green-600' : 'text-gray-300'}`}>
                  {fmtAmt(row.lgAmt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
