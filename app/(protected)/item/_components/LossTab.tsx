'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { fmtDate } from '@/lib/fmtDate'

/* ── types ── */
type SummaryRow = {
  item_id: number
  item_name: string
  cf_group: string | null
  product_type: string | null
  soh: string | null
  sp: string | null
  cp: string | null
  lgAmt: number
  lgQty: number
  cnt: number
  wic: number
  gmc: number
  bl: number
}

type DayRow = {
  date: string
  qty_counted: string | null
  wic_qty: string | null
  gmc_qty: string | null
  bills_qty: string | null
  sell_price: string | null
}
type ComputedRow = DayRow & { expected_soh: number | null; loss: number | null }

type SortCol = 'item_name' | 'lgAmt' | 'lgQty' | 'cnt' | 'wic' | 'gmc' | 'bl' | 'soh' | 'sp' | 'cp'
type SortDir = 'asc' | 'desc'

const EMPTY_FORM = { item_name: '', cf_group: '', selling_rate: '', purchase_rate: '', units_per_pack: '', unit_name: '' }

/* ── helpers ── */
function numVal(v: string | null) { return v ? parseFloat(v) || 0 : 0 }
function fmtN(n: number | null) {
  if (n === null) return '—'
  return n % 1 === 0 ? String(n) : n.toFixed(2)
}
function fmtQs(v: string | null) {
  if (!v) return '—'
  const n = parseFloat(v)
  return n % 1 === 0 ? String(n) : n.toFixed(2)
}
function fmtQ(v: number) {
  if (v === 0) return '—'
  return v % 1 === 0 ? String(v) : v.toFixed(4).replace(/\.?0+$/, '')
}
function fmtCcy(v: string | null) {
  if (!v) return '—'
  const x = parseFloat(v)
  return isNaN(x) ? '—' : `₵${x.toFixed(2)}`
}
function fmtAmt(v: number) {
  if (v === 0) return '—'
  return (v > 0 ? '+' : '') + '₵' + Math.abs(v).toFixed(2)
}
function fmtLg(v: number) {
  if (v === 0) return '—'
  return (v > 0 ? '+' : '-') + fmtQ(Math.abs(v))
}

function computeRows(rows: DayRow[]): ComputedRow[] {
  const result: ComputedRow[] = []
  let prev: number | null = null
  for (const row of rows) {
    const bills = numVal(row.bills_qty), wic = numVal(row.wic_qty), gmc = numVal(row.gmc_qty)
    const counted = row.qty_counted !== null ? parseFloat(row.qty_counted) : null
    let expected: number | null = null, loss: number | null = null
    if (prev === null) {
      if (counted !== null) { prev = counted; expected = counted }
    } else {
      expected = parseFloat((prev + bills - wic - gmc).toFixed(4))
      if (counted !== null) { loss = parseFloat((expected - counted).toFixed(4)); prev = counted }
      else prev = expected
    }
    result.push({ ...row, expected_soh: expected, loss })
  }
  return result.reverse()
}

function rowSortVal(row: SummaryRow, col: SortCol): number | string {
  switch (col) {
    case 'item_name': return row.item_name.toLowerCase()
    case 'lgAmt': return row.lgAmt
    case 'lgQty': return row.lgQty
    case 'cnt': return row.cnt
    case 'wic': return row.wic
    case 'gmc': return row.gmc
    case 'bl': return row.bl
    case 'soh': return parseFloat(row.soh ?? '0') || 0
    case 'sp': return parseFloat(row.sp ?? '0') || 0
    case 'cp': return parseFloat(row.cp ?? '0') || 0
  }
}

/* ── SortTh ── */
function SortTh({ label, col, sort, onSort, right = true }: {
  label: string; col: SortCol
  sort: { col: SortCol; dir: SortDir }
  onSort: (col: SortCol) => void
  right?: boolean
}) {
  const active = sort.col === col
  return (
    <th onClick={() => onSort(col)}
      className={`px-3 py-2 whitespace-nowrap cursor-pointer select-none transition
        ${right ? 'text-right' : 'text-left'}
        ${active ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}>
      {label}{active ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ''}
    </th>
  )
}

/* ── inline edit form ── */
const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded px-2 py-1 text-[10px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400'

function ItemEditForm({ form, onChange, groups }: { form: typeof EMPTY_FORM; onChange: (f: typeof EMPTY_FORM) => void; groups: string[] }) {
  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...form, [k]: e.target.value })
  return (
    <div className="space-y-1 p-2">
      <input placeholder="Item name *" value={form.item_name} onChange={set('item_name')} className={inputCls} />
      <select value={form.cf_group} onChange={set('cf_group')} className={inputCls}>
        <option value="">— No group —</option>
        {groups.map(g => <option key={g} value={g}>{g}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-1">
        <input placeholder="Selling rate" type="number" value={form.selling_rate} onChange={set('selling_rate')} className={inputCls} />
        <input placeholder="Cost rate" type="number" value={form.purchase_rate} onChange={set('purchase_rate')} className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-1">
        <input placeholder="Units/pack" type="number" value={form.units_per_pack} onChange={set('units_per_pack')} className={inputCls} />
        <input placeholder="Unit name" value={form.unit_name} onChange={set('unit_name')} className={inputCls} />
      </div>
    </div>
  )
}

/* ── expanded item detail panel ── */
function ItemDetail({ item, groups, onSaved }: { item: SummaryRow; groups: string[]; onSaved: (updated: Partial<SummaryRow>) => void }) {
  const [dayRows, setDayRows] = useState<DayRow[] | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/losses/${item.item_id}`).then(r => r.json())
      .then(d => setDayRows(Array.isArray(d) ? d : []))
      .catch(() => setDayRows([]))
  }, [item.item_id])

  function startEdit() {
    setForm({
      item_name: item.item_name,
      cf_group: item.cf_group ?? '',
      selling_rate: item.sp ?? '',
      purchase_rate: item.cp ?? '',
      units_per_pack: '',
      unit_name: '',
    })
    setEditing(true)
  }

  async function saveEdit() {
    setSaving(true)
    await fetch(`/api/items/${item.item_id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_name: form.item_name || undefined,
        cf_group: form.cf_group || null,
        selling_rate: form.selling_rate ? parseFloat(form.selling_rate) : null,
        purchase_rate: form.purchase_rate ? parseFloat(form.purchase_rate) : null,
        units_per_pack: form.units_per_pack ? parseFloat(form.units_per_pack) : null,
        unit_name: form.unit_name || null,
      }),
    })
    setSaving(false)
    setEditing(false)
    onSaved({
      item_name: form.item_name || item.item_name,
      cf_group: form.cf_group || null,
      sp: form.selling_rate || item.sp,
      cp: form.purchase_rate || item.cp,
    })
  }

  const computed = dayRows ? computeRows(dayRows) : null
  const sp = parseFloat(item.sp ?? '0') || 0
  const totalLoss = computed ? parseFloat(computed.reduce((s, r) => s + (r.loss ?? 0), 0).toFixed(4)) : 0
  const totalCost = computed ? parseFloat(computed.reduce((s, r) => s + (r.loss !== null ? r.loss * sp : 0), 0).toFixed(2)) : 0
  const lgCls = `px-0 py-1 text-center font-bold border-l-2 border-l-gray-400 ${totalLoss > 0 ? 'text-red-600' : totalLoss < 0 ? 'text-green-600' : 'text-gray-400'}`

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* blue header */}
      <div className="flex items-center justify-between px-3 py-2 bg-blue-600">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-white truncate">{item.item_name}</p>
          <p className="text-[10px] text-blue-200">{item.cf_group ?? 'No group'} · SOH: {parseFloat(item.soh ?? '0') || 0}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <a href={`/stock/${item.item_id}`}
            className="text-[10px] text-blue-600 font-semibold bg-white px-2 py-0.5 rounded hover:bg-blue-50">
            360°
          </a>
          {editing ? (
            <>
              <button onClick={saveEdit} disabled={saving}
                className="text-[10px] text-green-700 font-semibold bg-white px-2 py-0.5 rounded hover:bg-green-50 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)}
                className="text-[10px] text-gray-600 font-semibold bg-white px-2 py-0.5 rounded hover:bg-gray-100">
                Cancel
              </button>
            </>
          ) : (
            <button onClick={startEdit}
              className="text-[10px] text-blue-600 font-semibold bg-white px-2 py-0.5 rounded hover:bg-blue-50">
              Edit
            </button>
          )}
        </div>
      </div>

      {/* edit form */}
      {editing && <ItemEditForm form={form} onChange={setForm} groups={groups} />}

      {/* loss table */}
      {!dayRows ? (
        <p className="text-[10px] text-gray-400 text-center py-4">Loading…</p>
      ) : computed!.length === 0 ? (
        <p className="text-[10px] text-gray-400 text-center py-4">No activity.</p>
      ) : (
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="bg-amber-400">
              <th className="text-left px-2 py-1 font-bold text-gray-800 border-b-2 border-gray-400">DATE</th>
              <th className="text-center px-2 py-1 font-bold text-gray-800 border-b-2 border-gray-400 border-l-2 border-l-gray-400">₵</th>
              <th className="text-center px-2 py-1 font-bold text-gray-800 border-b-2 border-gray-400 border-l-2 border-l-gray-400">L/G</th>
              <th className="text-center px-2 py-1 font-bold text-gray-800 border-b-2 border-gray-400 border-l-2 border-l-gray-400">CNT</th>
              <th className="text-center px-2 py-1 font-bold text-gray-800 border-b-2 border-gray-400 border-l-2 border-l-gray-400">WIC</th>
              <th className="text-center px-2 py-1 font-bold text-gray-800 border-b-2 border-gray-400 border-l-2 border-l-gray-400">GMC</th>
              <th className="text-center px-2 py-1 font-bold text-gray-800 border-b-2 border-gray-400 border-l-2 border-l-gray-400">SP</th>
              <th className="text-center px-2 py-1 font-bold text-gray-800 border-b-2 border-gray-400 border-l-2 border-l-gray-400">BL</th>
              <th className="text-center px-2 py-1 font-bold text-gray-800 border-b-2 border-gray-400 border-l-2 border-l-gray-400">EXP</th>
            </tr>
          </thead>
          <tbody>
            {computed!.map((row, i) => {
              const lossVal = row.loss !== null ? row.loss * sp : null
              return (
                <tr key={i} className={`border-b-2 border-gray-200 ${row.loss !== null && row.loss > 0.001 ? 'bg-red-50' : ''}`}>
                  <td className="px-2 py-0.5 font-bold text-gray-500 whitespace-nowrap">{fmtDate(row.date)}</td>
                  <td className="px-2 py-0.5 text-center font-bold border-l-2 border-l-gray-400">
                    {lossVal === null ? <span className="text-gray-300">—</span>
                      : lossVal > 0.01 ? <span className="text-red-600">-{fmtN(lossVal)}</span>
                      : lossVal < -0.01 ? <span className="text-green-600">+{fmtN(Math.abs(lossVal))}</span>
                      : <span className="text-gray-400">0</span>}
                  </td>
                  <td className="px-2 py-0.5 text-center font-bold border-l-2 border-l-gray-400">
                    {row.loss === null ? <span className="text-gray-300">—</span>
                      : row.loss > 0.001 ? <span className="text-red-600">-{fmtN(row.loss)}</span>
                      : row.loss < -0.001 ? <span className="text-green-600">+{fmtN(Math.abs(row.loss))}</span>
                      : <span className="text-gray-400">0</span>}
                  </td>
                  <td className="px-2 py-0.5 text-center font-bold border-l-2 border-l-gray-400 text-gray-900">{fmtQs(row.qty_counted)}</td>
                  <td className="px-2 py-0.5 text-center font-bold border-l-2 border-l-gray-400 text-gray-600">{fmtQs(row.wic_qty)}</td>
                  <td className="px-2 py-0.5 text-center font-bold border-l-2 border-l-gray-400 text-gray-600">{fmtQs(row.gmc_qty)}</td>
                  <td className="px-2 py-0.5 text-center font-bold border-l-2 border-l-gray-400 text-blue-500">{fmtQs(row.sell_price)}</td>
                  <td className="px-2 py-0.5 text-center font-bold border-l-2 border-l-gray-400 text-blue-600">{fmtQs(row.bills_qty)}</td>
                  <td className="px-2 py-0.5 text-center font-bold border-l-2 border-l-gray-400 text-gray-400">{fmtN(row.expected_soh)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50">
              <td className="px-2 py-1 font-bold text-gray-500">Total</td>
              <td className={lgCls}>{totalCost > 0.01 ? `-₵${fmtN(totalCost)}` : totalCost < -0.01 ? `+₵${fmtN(Math.abs(totalCost))}` : '₵0'}</td>
              <td className={lgCls}>{totalLoss > 0.001 ? `-${fmtN(totalLoss)}` : totalLoss < -0.001 ? `+${fmtN(Math.abs(totalLoss))}` : '0'}</td>
              <td colSpan={6} />
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  )
}

/* ── main LossTab ── */
export default function LossTab({ onOpenItem: _onOpenItem }: { onOpenItem: (itemId: number) => void }) {
  const [rows, setRows] = useState<SummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState<string>('All')
  const [productType, setProductType] = useState<'all' | 'goods' | 'services'>('all')
  const [groupOpen, setGroupOpen] = useState(false)
  const [sort, setSort] = useState<{ col: SortCol; dir: SortDir }>({ col: 'lgAmt', dir: 'desc' })
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const groupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/losses/summary').then(r => r.json())
      .then(d => { setRows(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (groupRef.current && !groupRef.current.contains(e.target as Node)) setGroupOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleSort(col: SortCol) {
    setSort(s => s.col === col
      ? { col, dir: s.dir === 'desc' ? 'asc' : 'desc' }
      : { col, dir: col === 'item_name' ? 'asc' : 'desc' }
    )
  }

  function patchRow(itemId: number, updates: Partial<SummaryRow>) {
    setRows(prev => prev.map(r => r.item_id === itemId ? { ...r, ...updates } : r))
  }

  const groups = useMemo(() =>
    ['All', ...Array.from(new Set(rows.map(r => r.cf_group ?? 'Ungrouped'))).sort()]
  , [rows])

  const groupNames = useMemo(() =>
    Array.from(new Set(rows.map(r => r.cf_group ?? 'Ungrouped'))).sort()
  , [rows])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const list = rows.filter(r => {
      if (q && !r.item_name.toLowerCase().includes(q) && !(r.cf_group ?? '').toLowerCase().includes(q)) return false
      if (group !== 'All' && (r.cf_group ?? 'Ungrouped') !== group) return false
      if (productType === 'services' && r.product_type !== 'service') return false
      if (productType === 'goods' && r.product_type === 'service') return false
      return true
    })
    const dir = sort.dir === 'desc' ? -1 : 1
    list.sort((a, b) => {
      const av = rowSortVal(a, sort.col), bv = rowSortVal(b, sort.col)
      return typeof av === 'string' ? dir * av.localeCompare(bv as string) : dir * ((av as number) - (bv as number))
    })
    return list
  }, [rows, search, group, productType, sort])

  if (loading) return <div className="py-20 text-center text-gray-400">Loading…</div>

  const hasFilter = group !== 'All' || productType !== 'all'
  const groupLabel = [group, productType !== 'all' ? (productType === 'goods' ? 'Goods' : 'Services') : null].filter(Boolean).join(' · ')
  const thProps = { sort, onSort: handleSort }

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* Controls */}
      <div className="shrink-0 flex gap-2 items-center flex-wrap">
        <div className="relative" ref={groupRef}>
          <button onClick={() => setGroupOpen(o => !o)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-xl flex items-center gap-1 transition
              ${hasFilter ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {groupLabel} <span className="text-[10px]">▾</span>
          </button>
          {groupOpen && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 min-w-[160px] py-1">
              {groups.map(g => (
                <button key={g} onClick={() => { setGroup(g); setGroupOpen(false) }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${g === group ? 'text-blue-600 font-semibold' : 'text-gray-700'}`}>
                  {g}
                </button>
              ))}
              <div className="border-t border-gray-100 mt-1 pt-1">
                {(['all', 'goods', 'services'] as const).map(t => (
                  <button key={t} onClick={() => { setProductType(t); setGroupOpen(false) }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${productType === t ? 'text-blue-600 font-semibold' : 'text-gray-700'}`}>
                    {t === 'all' ? 'All types' : t === 'goods' ? 'Goods' : 'Services'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search item or group…"
          className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs
            text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400 w-52" />
        <span className="text-[10px] text-gray-400 ml-auto">{filtered.length} items</span>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 font-semibold">
              <th className="px-3 py-2 text-left text-gray-500 whitespace-nowrap w-7">#</th>
              <SortTh label="Item" col="item_name" right={false} {...thProps} />
              <SortTh label="₵ L/G" col="lgAmt" {...thProps} />
              <SortTh label="L/G" col="lgQty" {...thProps} />
              <SortTh label="CNT" col="cnt" {...thProps} />
              <SortTh label="WIC" col="wic" {...thProps} />
              <SortTh label="GMC" col="gmc" {...thProps} />
              <SortTh label="BL" col="bl" {...thProps} />
              <SortTh label="SOH" col="soh" {...thProps} />
              <SortTh label="SP" col="sp" {...thProps} />
              <SortTh label="CP" col="cp" {...thProps} />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={11} className="py-12 text-center text-gray-400">No items found</td></tr>
            )}
            {filtered.map((row, idx) => {
              const lossAmt = row.lgAmt > 0, gainAmt = row.lgAmt < 0
              const lossQty = row.lgQty > 0, gainQty = row.lgQty < 0
              const soh = parseFloat(row.soh ?? '0') || 0
              const isOpen = expandedId === row.item_id
              return <>
                <tr key={row.item_id}
                  onClick={() => setExpandedId(isOpen ? null : row.item_id)}
                  className={`cursor-pointer transition border-b border-gray-100
                    ${isOpen ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <td className="px-3 py-2 text-gray-400 tabular-nums">{idx + 1}</td>
                  <td className="px-3 py-2 font-medium text-gray-900 max-w-[180px]">
                    <p className="truncate">{row.item_name}</p>
                    {row.cf_group && <p className="text-[10px] text-gray-400 truncate">{row.cf_group}</p>}
                  </td>
                  <td className={`px-3 py-2 text-right font-semibold tabular-nums ${lossAmt ? 'text-red-600' : gainAmt ? 'text-green-600' : 'text-gray-400'}`}>
                    {fmtAmt(row.lgAmt)}
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums ${lossQty ? 'text-red-500' : gainQty ? 'text-green-600' : 'text-gray-400'}`}>
                    {fmtLg(row.lgQty)}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700 tabular-nums">{fmtQ(row.cnt)}</td>
                  <td className="px-3 py-2 text-right text-gray-700 tabular-nums">{fmtQ(row.wic)}</td>
                  <td className="px-3 py-2 text-right text-gray-700 tabular-nums">{fmtQ(row.gmc)}</td>
                  <td className="px-3 py-2 text-right text-blue-600 tabular-nums">{fmtQ(row.bl)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${soh <= 0 ? 'text-red-500' : 'text-gray-700'}`}>
                    {soh % 1 === 0 ? soh : soh.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right text-blue-600 tabular-nums">{fmtCcy(row.sp)}</td>
                  <td className="px-3 py-2 text-right text-green-600 tabular-nums">{fmtCcy(row.cp)}</td>
                </tr>
                {isOpen && (
                  <tr key={`${row.item_id}-detail`}>
                    <td colSpan={11} className="px-3 pb-3 pt-1 bg-blue-50">
                      <ItemDetail
                        item={row}
                        groups={groupNames}
                        onSaved={updates => patchRow(row.item_id, updates)}
                      />
                    </td>
                  </tr>
                )}
              </>
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
