'use client'
import { useState, useEffect, useMemo } from 'react'
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
  aliases: string | null
}
type ComputedRow = DayRow & { expected_soh: number | null; loss: number | null }

type SortCol = 'item_name' | 'cf_group' | 'product_type' | 'lgAmt' | 'lgQty' | 'cnt' | 'wic' | 'gmc' | 'bl' | 'soh' | 'sp' | 'cp'
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
  return isNaN(n) || n === 0 ? '—' : n % 1 === 0 ? String(n) : n.toFixed(2)
}
function fmtQ(v: number) {
  if (v === 0) return '—'
  return v % 1 === 0 ? String(v) : v.toFixed(2)
}
function fmtCcy(v: string | null) {
  if (!v) return '—'
  const x = parseFloat(v)
  return isNaN(x) || x === 0 ? '—' : x.toFixed(0)
}
function fmtAmt(v: number) {
  if (v === 0) return '—'
  const s = Math.abs(v) >= 100 ? Math.abs(v).toFixed(0) : Math.abs(v).toFixed(1)
  return (v > 0 ? '+' : '-') + s
}
function fmtLg(v: number) {
  if (v === 0) return '—'
  const s = Math.abs(v) % 1 === 0 ? String(Math.abs(v)) : Math.abs(v).toFixed(2)
  return (v > 0 ? '+' : '-') + s
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
    case 'cf_group': return (row.cf_group ?? '').toLowerCase()
    case 'product_type': return (row.product_type ?? '').toLowerCase()
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

/* ── compact th with sort indicator ── */
const thBase = 'py-1 font-bold cursor-pointer select-none whitespace-nowrap border border-black'
function SortTh({ label, col, sort, onSort, cls = '' }: {
  label: string; col: SortCol
  sort: { col: SortCol; dir: SortDir }
  onSort: (col: SortCol) => void
  cls?: string
}) {
  const active = sort.col === col
  const arrow = active ? (sort.dir === 'desc' ? '↓' : '↑') : ''
  return (
    <th onClick={() => onSort(col)}
      className={`${thBase} ${cls} ${active ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}>
      {label}{arrow && <span className="ml-0.5 text-[7px]">{arrow}</span>}
    </th>
  )
}

/* ── edit form ── */
const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 text-[9px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400'

function ItemEditForm({ form, onChange, groups }: { form: typeof EMPTY_FORM; onChange: (f: typeof EMPTY_FORM) => void; groups: string[] }) {
  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...form, [k]: e.target.value })
  return (
    <div className="space-y-1 p-2 bg-gray-50 border-b border-gray-200">
      <input placeholder="Item name *" value={form.item_name} onChange={set('item_name')} className={inputCls} />
      <select value={form.cf_group} onChange={set('cf_group')} className={inputCls}>
        <option value="">— No group —</option>
        {groups.map(g => <option key={g} value={g}>{g}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-1">
        <input placeholder="SP" type="number" value={form.selling_rate} onChange={set('selling_rate')} className={inputCls} />
        <input placeholder="CP" type="number" value={form.purchase_rate} onChange={set('purchase_rate')} className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-1">
        <input placeholder="Units/pack" type="number" value={form.units_per_pack} onChange={set('units_per_pack')} className={inputCls} />
        <input placeholder="Unit" value={form.unit_name} onChange={set('unit_name')} className={inputCls} />
      </div>
    </div>
  )
}

/* ── expanded item detail ── */
function ItemDetail({ item, groups, currentAliases, currentMatches, onSaved, onRelationsSaved }: {
  item: SummaryRow; groups: string[]
  currentAliases: string; currentMatches: string
  onSaved: (u: Partial<SummaryRow>) => void
  onRelationsSaved: (aliasesStr: string, matchesStr: string) => void
}) {
  const [dayRows, setDayRows] = useState<DayRow[] | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [aliasesText, setAliasesText] = useState('')
  const [matchesText, setMatchesText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/losses/${item.item_id}`).then(r => r.json())
      .then(d => setDayRows(Array.isArray(d) ? d : []))
      .catch(() => setDayRows([]))
  }, [item.item_id])

  function startEdit() {
    setForm({ item_name: item.item_name, cf_group: item.cf_group ?? '', selling_rate: item.sp ?? '', purchase_rate: item.cp ?? '', units_per_pack: '', unit_name: '' })
    setAliasesText(currentAliases)
    setMatchesText(currentMatches)
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

    const aliasList = aliasesText.split(',').map(s => s.trim()).filter(Boolean)
    const matchList = matchesText.split(',').map(s => s.trim()).filter(Boolean)
    await fetch(`/api/items/${item.item_id}/relations`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aliases: aliasList, matches: matchList }),
    })

    setSaving(false); setEditing(false)
    onSaved({ item_name: form.item_name || item.item_name, cf_group: form.cf_group || null, sp: form.selling_rate || item.sp, cp: form.purchase_rate || item.cp })
    onRelationsSaved(aliasList.join(', '), matchList.join(', '))
  }

  const computed = dayRows ? computeRows(dayRows) : null
  const sp = parseFloat(item.sp ?? '0') || 0
  const totalLoss = computed ? parseFloat(computed.reduce((s, r) => s + (r.loss ?? 0), 0).toFixed(4)) : 0
  const totalCost = parseFloat((totalLoss * sp).toFixed(2))
  const lgCls = `text-center font-bold border-l border-gray-300 py-0.5 ${totalLoss > 0 ? 'text-red-600' : totalLoss < 0 ? 'text-green-600' : 'text-gray-400'}`

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mt-0.5">
      {/* blue header */}
      <div className="flex items-center justify-between px-2 py-1 bg-blue-600">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold text-white truncate">{item.item_name}</p>
          <p className="text-[8px] text-blue-200 truncate">{item.cf_group ?? 'No group'} · SOH {parseFloat(item.soh ?? '0') || 0} · SP {item.sp ? parseFloat(item.sp).toFixed(0) : '—'}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-1">
          <a href={`/stock/${item.item_id}`} className="text-[8px] font-bold text-blue-600 bg-white px-1.5 py-0.5 rounded">360°</a>
          {editing ? (
            <>
              <button onClick={saveEdit} disabled={saving} className="text-[8px] font-bold text-green-700 bg-white px-1.5 py-0.5 rounded disabled:opacity-50">{saving ? '…' : 'Save'}</button>
              <button onClick={() => setEditing(false)} className="text-[8px] font-bold text-gray-600 bg-white px-1.5 py-0.5 rounded">✕</button>
            </>
          ) : (
            <button onClick={startEdit} className="text-[8px] font-bold text-blue-600 bg-white px-1.5 py-0.5 rounded">Edit</button>
          )}
        </div>
      </div>

      {editing && (
        <div className="px-2 pb-2 space-y-1.5">
          <ItemEditForm form={form} onChange={setForm} groups={groups} />
          <div>
            <label className="text-[8px] font-bold text-gray-500 block mb-0.5">Aliases (comma-separated)</label>
            <input value={aliasesText} onChange={e => setAliasesText(e.target.value)}
              placeholder="e.g. old name 1, old name 2"
              className="w-full bg-gray-100 border border-gray-300 rounded px-1.5 py-1 text-[9px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
          <div>
            <label className="text-[8px] font-bold text-gray-500 block mb-0.5">
              {item.product_type === 'service' ? 'Goods used for this service' : 'Services this good is used for'} (comma-separated)
            </label>
            <input value={matchesText} onChange={e => setMatchesText(e.target.value)}
              placeholder="e.g. Service - Passport Printing (4x6)"
              className="w-full bg-gray-100 border border-gray-300 rounded px-1.5 py-1 text-[9px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
        </div>
      )}

      {/* detail table */}
      {!dayRows ? (
        <p className="text-[9px] text-gray-400 text-center py-3">Loading…</p>
      ) : computed!.length === 0 ? (
        <p className="text-[9px] text-gray-400 text-center py-3">No activity.</p>
      ) : (
        <table className="w-full table-fixed border-collapse text-[8px]">
          <colgroup>
            <col style={{width:'17%'}} />
            <col style={{width:'22%'}} />
            <col style={{width:'10%'}} />
            <col style={{width:'8%'}} />
            <col style={{width:'8%'}} />
            <col style={{width:'7%'}} />
            <col style={{width:'7%'}} />
            <col style={{width:'7%'}} />
            <col style={{width:'7%'}} />
            <col style={{width:'7%'}} />
          </colgroup>
          <thead>
            <tr className="bg-amber-400 text-gray-800 font-bold">
              {['DATE','ALIAS','₵','L/G','CNT','WIC','GMC','SP','BL','EXP'].map((h,i) => (
                <th key={h} className={`py-0.5 border-b-2 border-gray-400 ${i > 0 ? 'text-center border-l border-gray-400' : 'text-left pl-1'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {computed!.map((row, i) => {
              const lossVal = row.loss !== null ? row.loss * sp : null
              return (
                <tr key={i} className={`border-b border-gray-200 ${row.loss !== null && row.loss > 0.001 ? 'bg-red-50' : ''}`}>
                  <td className="pl-1 py-0.5 font-bold text-gray-500 whitespace-nowrap overflow-hidden">{fmtDate(row.date)}</td>
                  <td className="pl-1 py-0.5 border-l border-gray-300 text-purple-700 font-semibold overflow-hidden">
                    <span className="block truncate" title={row.aliases ?? ''}>{row.aliases ?? <span className="text-gray-300">—</span>}</span>
                  </td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300">
                    {lossVal === null ? <span className="text-gray-300">—</span>
                      : lossVal > 0.01 ? <span className="text-red-600">-{fmtN(lossVal)}</span>
                      : lossVal < -0.01 ? <span className="text-green-600">+{fmtN(Math.abs(lossVal))}</span>
                      : <span className="text-gray-400">0</span>}
                  </td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300">
                    {row.loss === null ? <span className="text-gray-300">—</span>
                      : row.loss > 0.001 ? <span className="text-red-600">-{fmtN(row.loss)}</span>
                      : row.loss < -0.001 ? <span className="text-green-600">+{fmtN(Math.abs(row.loss))}</span>
                      : <span className="text-gray-400">0</span>}
                  </td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-900">{fmtQs(row.qty_counted)}</td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-600">{fmtQs(row.wic_qty)}</td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-600">{fmtQs(row.gmc_qty)}</td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300 text-blue-500">{fmtQs(row.sell_price)}</td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300 text-blue-600">{fmtQs(row.bills_qty)}</td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-400">{fmtN(row.expected_soh)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold text-[8px]">
              <td className="pl-1 py-0.5 text-gray-500">Total</td>
              <td className={lgCls}>{totalCost > 0.01 ? `-₵${fmtN(totalCost)}` : totalCost < -0.01 ? `+₵${fmtN(Math.abs(totalCost))}` : '0'}</td>
              <td className={lgCls}>{totalLoss > 0.001 ? `-${fmtN(totalLoss)}` : totalLoss < -0.001 ? `+${fmtN(Math.abs(totalLoss))}` : '0'}</td>
              <td colSpan={7} />
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  )
}

/* ── main LossTab ── */
export default function LossTab({ onOpenItem: _onOpenItem, search = '', group = 'All', productType = 'all' }: {
  onOpenItem: (itemId: number) => void
  search?: string
  group?: string | null
  productType?: 'all' | 'goods' | 'services'
}) {
  const [rows, setRows] = useState<SummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<{ col: SortCol; dir: SortDir }>({ col: 'lgAmt', dir: 'desc' })
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [aliasMap, setAliasMap] = useState<Record<number, string>>({})
  const [matchMap, setMatchMap] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/losses/summary').then(r => r.json())
      .then(d => { setRows(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetch('/api/good-service-matches').then(r => r.json())
      .then((d: { good_name: string; service_name: string }[]) => {
        if (!Array.isArray(d)) return
        // Bidirectional: a Good's key collects its Services, a Service's key collects its Goods
        const acc: Record<string, Set<string>> = {}
        for (const { good_name, service_name } of d) {
          const gk = good_name.trim().toLowerCase()
          const sk = service_name.trim().toLowerCase()
          if (!acc[gk]) acc[gk] = new Set()
          acc[gk].add(service_name.trim())
          if (!acc[sk]) acc[sk] = new Set()
          acc[sk].add(good_name.trim())
        }
        const map: Record<string, string> = {}
        for (const k in acc) map[k] = Array.from(acc[k]).join(', ')
        setMatchMap(map)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/aliases/wide').then(r => r.json())
      .then((d: any[]) => {
        if (!Array.isArray(d)) return
        const map: Record<number, string> = {}
        for (const row of d) {
          const names = (row.aliases ?? []).map((a: any) => a.name).filter(Boolean)
          if (names.length) map[row.item_id] = names.join(', ')
        }
        setAliasMap(map)
      })
      .catch(() => {})
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

  const groupNames = useMemo(() =>
    Array.from(new Set(rows.map(r => r.cf_group ?? 'Ungrouped'))).sort()
  , [rows])

  const filtered = useMemo(() => {
    const q = (search ?? '').toLowerCase()
    const grp = group ?? 'All'
    const list = rows.filter(r => {
      if (q && !r.item_name.toLowerCase().includes(q) && !(r.cf_group ?? '').toLowerCase().includes(q)) return false
      if (grp !== 'All' && (r.cf_group ?? 'Ungrouped') !== grp) return false
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

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  const thProps = { sort, onSort: handleSort }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Table — all columns fit on screen; Item column compact */}
      <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-black bg-white">
        <table className="table-fixed border-collapse text-[8px]">
          <colgroup>
            <col style={{width:'104px'}} />
            <col style={{width:'30px'}} />
            <col style={{width:'26px'}} />
            <col style={{width:'26px'}} />
            <col style={{width:'26px'}} />
            <col style={{width:'26px'}} />
            <col style={{width:'22px'}} />
            <col style={{width:'26px'}} />
            <col style={{width:'30px'}} />
            <col style={{width:'26px'}} />
            <col style={{width:'22px'}} />
            <col style={{width:'22px'}} />
            <col style={{width:'18px'}} />
            <col style={{width:'220px'}} />
            <col style={{width:'220px'}} />
          </colgroup>
          <thead className="sticky top-0 z-20">
            <tr className="bg-gray-50">
              <SortTh label="Item" col="item_name" sort={sort} onSort={handleSort} cls="text-left pl-1 pr-0 sticky left-0 z-30 bg-gray-50 border-black" />
              <SortTh label="₵L/G" col="lgAmt" {...thProps} cls="text-center" />
              <SortTh label="L/G" col="lgQty" {...thProps} cls="text-center" />
              <SortTh label="CNT" col="cnt" {...thProps} cls="text-center" />
              <SortTh label="WIC" col="wic" {...thProps} cls="text-center" />
              <SortTh label="GMC" col="gmc" {...thProps} cls="text-center" />
              <SortTh label="BL" col="bl" {...thProps} cls="text-center" />
              <SortTh label="SOH" col="soh" {...thProps} cls="text-center" />
              <SortTh label="SP" col="sp" {...thProps} cls="text-center" />
              <SortTh label="CP" col="cp" {...thProps} cls="text-center" />
              <SortTh label="Grp" col="cf_group" {...thProps} cls="text-center" />
              <SortTh label="Typ" col="product_type" {...thProps} cls="text-center" />
              <th className={`${thBase} text-center text-gray-400`}>▸</th>
              <th className={`${thBase} text-left pl-1.5`}>Aliases</th>
              <th className={`${thBase} text-left pl-1.5`}>Matches</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={15} className="py-10 text-center text-gray-400 text-[9px]">No items</td></tr>
            )}
            {filtered.map(row => {
              const lossAmt = row.lgAmt > 0, gainAmt = row.lgAmt < 0
              const lossQty = row.lgQty > 0, gainQty = row.lgQty < 0
              const soh = parseFloat(row.soh ?? '0') || 0
              const isOpen = expandedId === row.item_id
              return <>
                <tr key={row.item_id}
                  onClick={() => setExpandedId(isOpen ? null : row.item_id)}
                  className={`cursor-pointer transition
                    ${isOpen ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <td className={`pl-1 pr-0 py-0.5 font-bold text-gray-900 whitespace-nowrap overflow-hidden sticky left-0 z-10 border border-black ${isOpen ? 'bg-blue-50' : 'bg-white'}`}
                    title={row.item_name}>{row.item_name.slice(0, 20)}</td>
                  <td className={`text-center py-0.5 font-bold tabular-nums border border-black ${lossAmt ? 'text-red-600' : gainAmt ? 'text-green-600' : 'text-gray-300'}`}>
                    {fmtAmt(row.lgAmt)}
                  </td>
                  <td className={`text-center py-0.5 font-bold tabular-nums border border-black ${lossQty ? 'text-red-500' : gainQty ? 'text-green-600' : 'text-gray-300'}`}>
                    {fmtLg(row.lgQty)}
                  </td>
                  <td className="text-center py-0.5 font-bold text-gray-700 tabular-nums border border-black">{fmtQ(row.cnt)}</td>
                  <td className="text-center py-0.5 font-bold text-gray-700 tabular-nums border border-black">{fmtQ(row.wic)}</td>
                  <td className="text-center py-0.5 font-bold text-gray-700 tabular-nums border border-black">{fmtQ(row.gmc)}</td>
                  <td className="text-center py-0.5 font-bold text-blue-600 tabular-nums border border-black">{fmtQ(row.bl)}</td>
                  <td className={`text-center py-0.5 font-bold tabular-nums border border-black ${soh <= 0 ? 'text-red-500' : 'text-gray-700'}`}>
                    {soh % 1 === 0 ? soh : soh.toFixed(1)}
                  </td>
                  <td className="text-center py-0.5 font-bold text-blue-600 tabular-nums border border-black">{fmtCcy(row.sp)}</td>
                  <td className="text-center py-0.5 font-bold text-green-600 tabular-nums border border-black">{fmtCcy(row.cp)}</td>
                  <td className="text-center py-0.5 font-bold text-gray-500 border border-black" title={row.cf_group ?? undefined}>{(row.cf_group ?? '—').slice(0, 3)}</td>
                  <td className={`text-center py-0.5 font-bold border border-black ${row.product_type === 'service' ? 'text-purple-500' : 'text-teal-600'}`}
                    title={row.product_type === 'service' ? 'Service' : 'Good'}>
                    {row.product_type === 'service' ? 'Svc' : 'Goo'}
                  </td>
                  <td className="text-center py-0.5 font-bold text-gray-400 border border-black">{isOpen ? '▾' : '▸'}</td>
                  <td className="pl-1.5 py-0.5 font-bold text-gray-500 truncate overflow-hidden border border-black" title={aliasMap[row.item_id]}>
                    {aliasMap[row.item_id] || '—'}
                  </td>
                  <td className="pl-1.5 py-0.5 font-bold text-gray-500 truncate overflow-hidden border border-black"
                    title={matchMap[row.item_name.trim().toLowerCase()]}>
                    {matchMap[row.item_name.trim().toLowerCase()] || '—'}
                  </td>
                </tr>
                {isOpen && (
                  <tr key={`${row.item_id}-d`}>
                    <td colSpan={15} className="px-1 pb-2 pt-0.5 bg-blue-50">
                      <ItemDetail item={row} groups={groupNames}
                        currentAliases={aliasMap[row.item_id] ?? ''}
                        currentMatches={matchMap[row.item_name.trim().toLowerCase()] ?? ''}
                        onSaved={u => patchRow(row.item_id, u)}
                        onRelationsSaved={(aliasesStr, matchesStr) => {
                          setAliasMap(prev => ({ ...prev, [row.item_id]: aliasesStr }))
                          setMatchMap(prev => ({ ...prev, [row.item_name.trim().toLowerCase()]: matchesStr }))
                        }} />
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
