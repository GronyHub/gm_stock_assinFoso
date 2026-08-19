'use client'
import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { AnalyticsToggle } from './analyticsShared'
import { useColumnPrefs, ColumnsPickerButton, ColResizeHandle, type ColumnDef } from './columnPrefs'
const LossAnalyticsSection = dynamic(() => import('./LossAnalyticsSection'), { ssr: false })

type Row = { item_id: number; item_name: string; lgAmt: number; lossCount: number }
type SortCol = 'item_name' | 'lossCount' | 'lgAmt'
type SortDir = 'asc' | 'desc'

// Item stays sticky/always-visible (first column); these two are the only
// ones the picker can hide/reorder/rename.
type ColKey = 'lossCount' | 'lgAmt'
const COLUMNS: ColumnDef<ColKey>[] = [
  { key: 'lossCount', label: 'Loss No.', width: 90 },
  { key: 'lgAmt',     label: 'Loss Amt.', width: 90 },
]
const LOSS_BY_ITEM_COL_DEFAULTS: Record<string, number> = { item: 200, lossCount: 90, lgAmt: 90 }

function fmtAmt(v: number) {
  if (v === 0) return '—'
  const s = Math.abs(v) >= 100 ? Math.abs(v).toFixed(0) : Math.abs(v).toFixed(1)
  return (v > 0 ? '+' : '-') + s
}

function Th({ label, col, cls = '', sort, onSort, onResize, onResetWidth, noDivider = false }: {
  label: string; col: SortCol; cls?: string
  sort: { col: SortCol; dir: SortDir }; onSort: (col: SortCol) => void
  onResize: (deltaPx: number) => void; onResetWidth: () => void; noDivider?: boolean
}) {
  const active = sort.col === col
  const arrow = active ? (sort.dir === 'desc' ? '↓' : '↑') : ''
  return (
    <th onClick={() => onSort(col)}
      className={`relative overflow-hidden px-2 py-2 font-bold cursor-pointer select-none whitespace-nowrap text-[10px] uppercase tracking-wide border-b border-gray-200
        ${noDivider ? '' : 'border-r'} ${cls} ${active ? 'text-blue-600' : 'text-gray-400 hover:text-gray-700'}`}>
      {label}{arrow && <span className="ml-0.5 text-[9px]">{arrow}</span>}
      <ColResizeHandle onResize={onResize} onReset={onResetWidth} />
    </th>
  )
}

// Every item ranked by its own running loss total -- same underlying data
// as the Items table (/api/losses/summary), just narrowed to the two
// numbers that actually answer "which items are losing money" instead of
// all eleven metric columns. Now Item 360's own landing page (see
// Item360Tab) rather than a separate destination -- a row click drills
// straight into that same item's full 360 detail via onSelectItem.
export default function LossByItemTab({ search, onSelectItem }: { search: string; onSelectItem: (id: number) => void }) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<{ col: SortCol; dir: SortDir }>({ col: 'lgAmt', dir: 'desc' })
  const colPrefs = useColumnPrefs<ColKey>('lossByItem', COLUMNS)
  // Trend charts + top/least-loss rankings that used to live under the
  // removed "Data" tab's "Loss" section -- shown here since both this list
  // and that section are ultimately about ranking items by loss.
  const [showAnalytics, setShowAnalytics] = useState(false)

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

  if (showAnalytics) {
    return (
      <div className="flex flex-col h-full min-h-0 p-2 overflow-y-auto">
        <div className="shrink-0 flex justify-end mb-2">
          <AnalyticsToggle showing={showAnalytics} onToggle={() => setShowAnalytics(false)} />
        </div>
        <LossAnalyticsSection />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0 p-2">
      <div className="shrink-0 flex items-center justify-end gap-1.5 mb-2">
        <ColumnsPickerButton prefs={colPrefs} />
        <AnalyticsToggle showing={showAnalytics} onToggle={() => setShowAnalytics(true)} />
      </div>
      <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-gray-200 bg-white">
        <table className="table-fixed border-collapse text-[11px]" style={{
          width: colPrefs.getWidth('item', LOSS_BY_ITEM_COL_DEFAULTS.item)
            + colPrefs.shownColumns.reduce((s, c) => s + colPrefs.getWidth(c.key, c.width ?? 90), 0),
        }}>
          <colgroup>
            <col style={{ width: colPrefs.getWidth('item', LOSS_BY_ITEM_COL_DEFAULTS.item) }} />
            {colPrefs.shownColumns.map(c => <col key={c.key} style={{ width: colPrefs.getWidth(c.key, c.width ?? 90) }} />)}
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50">
              <Th label="Item" col="item_name" cls="text-left pl-2" sort={sort} onSort={handleSort}
                onResize={d => colPrefs.resizeWidth('item', d, LOSS_BY_ITEM_COL_DEFAULTS.item)} onResetWidth={() => colPrefs.resetWidth('item')} />
              {colPrefs.shownColumns.map((c, i) => (
                <Th key={c.key} label={c.label} col={c.key} cls="text-center" sort={sort} onSort={handleSort}
                  noDivider={i === colPrefs.shownColumns.length - 1}
                  onResize={d => colPrefs.resizeWidth(c.key, d, c.width ?? 90)} onResetWidth={() => colPrefs.resetWidth(c.key)} />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr><td colSpan={1 + colPrefs.shownColumns.length} className="py-10 text-center text-gray-400 text-xs">No items</td></tr>
            )}
            {filtered.map((row, i) => (
              <tr key={row.item_id} onClick={() => onSelectItem(row.item_id)}
                className={`cursor-pointer hover:bg-blue-50/60 transition ${i % 2 === 1 ? 'bg-gray-50' : 'bg-white'}`}>
                <td className="pl-2 pr-2 py-1.5 font-bold truncate text-blue-600">{row.item_name}</td>
                {colPrefs.shownColumns.map(c => c.key === 'lossCount' ? (
                  <td key={c.key} className={`text-center py-1.5 font-semibold tabular-nums ${row.lossCount > 0 ? 'text-red-500' : 'text-gray-300'}`}>
                    {row.lossCount}
                  </td>
                ) : (
                  <td key={c.key} className={`text-center py-1.5 font-semibold tabular-nums ${row.lgAmt > 0 ? 'text-red-500' : row.lgAmt < 0 ? 'text-green-600' : 'text-gray-300'}`}>
                    {fmtAmt(row.lgAmt)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
