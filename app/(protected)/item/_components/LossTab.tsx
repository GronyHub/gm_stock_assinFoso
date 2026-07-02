'use client'
import { Fragment, useState, useEffect, useMemo } from 'react'
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
  units_per_pack: string | null
  converts_to_item_id: number | null
  lgAmt: number
  lgQty: number
  cnt: number
  wic: number
  gmc: number
  bl: number
  cnv: number
}

type DayRow = {
  date: string
  qty_counted: string | null
  wic_qty: string | null
  gmc_qty: string | null
  bills_qty: string | null
  sell_price: string | null
  aliases: string | null
  converted_in_qty: string | null
  wic_breakdown: { name: string; qty: number }[] | null
}
type ComputedRow = DayRow & { expected_soh: number | null; loss: number | null }

type SortCol = 'item_name' | 'cf_group' | 'product_type' | 'lgAmt' | 'lgQty' | 'cnt' | 'wic' | 'gmc' | 'bl' | 'soh' | 'sp' | 'cp'
type SortDir = 'asc' | 'desc'

const EMPTY_FORM = { item_name: '', cf_group: '', selling_rate: '', purchase_rate: '', units_per_pack: '', unit_name: '', converts_to_item_id: '' }

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
function shortSourceName(name: string) {
  return name.replace(/^service\s*-\s*/i, '').slice(0, 10)
}

function computeRows(rows: DayRow[]): ComputedRow[] {
  const result: ComputedRow[] = []
  let prev: number | null = null
  for (const row of rows) {
    const bills = numVal(row.bills_qty), wic = numVal(row.wic_qty), gmc = numVal(row.gmc_qty)
    const convertedIn = numVal(row.converted_in_qty)
    const counted = row.qty_counted !== null ? parseFloat(row.qty_counted) : null
    let expected: number | null = null, loss: number | null = null
    if (prev === null) {
      if (counted !== null) { prev = counted; expected = counted }
    } else {
      expected = parseFloat((prev + bills + convertedIn - wic - gmc).toFixed(4))
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

function ItemEditForm({ form, onChange, groups, itemId, isService, allItems }: {
  form: typeof EMPTY_FORM; onChange: (f: typeof EMPTY_FORM) => void; groups: string[]
  itemId: number; isService: boolean; allItems: { item_id: number; item_name: string }[]
}) {
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
      <div>
        <label className="text-[8px] font-bold text-gray-500 block mb-0.5">
          {isService
            ? 'On sale (WIC), deduct "Units/pack" of this service from:'
            : 'On GMC, credit "Units/pack" of this item into:'}
        </label>
        <select value={form.converts_to_item_id} onChange={set('converts_to_item_id')} className={inputCls}>
          <option value="">— No conversion —</option>
          {allItems.filter(i => i.item_id !== itemId).map(i => (
            <option key={i.item_id} value={i.item_id}>{i.item_name}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

/* ── expanded item detail ── */
/* ── Alias picker: search unresolved raw names, attach/detach to this item ── */
type AliasRecord = { id: number; name: string }
type UnresolvedName = { name: string; cnt: number; confirmed: boolean }

function AliasPicker({ itemId, current, onChange }: {
  itemId: number
  current: AliasRecord[]
  onChange: (next: AliasRecord[]) => void
}) {
  const [salesNames, setSalesNames] = useState<UnresolvedName[] | null>(null)
  const [billNames, setBillNames] = useState<UnresolvedName[] | null>(null)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/aliases/unresolved').then(r => r.json()).then(d => setSalesNames(Array.isArray(d) ? d : []))
    fetch('/api/aliases/unresolved-bills').then(r => r.json()).then(d => setBillNames(Array.isArray(d) ? d : []))
  }, [])

  const candidates = useMemo(() => {
    const seen = new Set(current.map(a => a.name.toLowerCase().trim()))
    const all = [
      ...(salesNames ?? []).map(n => ({ ...n, source: 'sales' as const })),
      ...(billNames ?? []).map(n => ({ ...n, source: 'bills' as const })),
    ]
    const q = query.trim().toLowerCase()
    return all
      .filter(n => !n.confirmed && !seen.has(n.name.toLowerCase().trim()))
      .filter(n => !q || n.name.toLowerCase().includes(q))
      .slice(0, 25)
  }, [salesNames, billNames, current, query])

  async function add(name: string, source: 'sales' | 'bills') {
    setBusy(true)
    const res = await fetch('/api/aliases/confirm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias_name: name, item_id: itemId, source }),
    })
    setBusy(false)
    if (res.ok) onChange([...current, { id: -Date.now(), name }]) // optimistic id placeholder, refreshed on next load
  }

  async function remove(alias: AliasRecord) {
    setBusy(true)
    await fetch(`/api/aliases/${alias.id}`, { method: 'DELETE' })
    setBusy(false)
    onChange(current.filter(a => a.id !== alias.id))
  }

  return (
    <div className="space-y-1">
      {current.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {current.map(a => (
            <span key={a.id} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[8px] font-semibold px-1.5 py-0.5 rounded-full">
              {a.name}
              <button onClick={() => remove(a)} disabled={busy} className="text-blue-400 hover:text-red-500 font-bold">×</button>
            </span>
          ))}
        </div>
      )}
      <input value={query} onChange={e => setQuery(e.target.value)}
        placeholder="Search unresolved names to attach…"
        className="w-full bg-gray-100 border border-gray-300 rounded px-1.5 py-1 text-[9px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400" />
      {query.trim() && (
        <div className="border border-gray-200 rounded bg-white max-h-28 overflow-y-auto">
          {candidates.length === 0 ? (
            <p className="text-[8px] text-gray-400 px-1.5 py-1">No matching unresolved names</p>
          ) : candidates.map(c => (
            <button key={`${c.source}-${c.name}`} onClick={() => add(c.name, c.source)} disabled={busy}
              className="w-full text-left px-1.5 py-1 text-[8px] text-gray-800 hover:bg-blue-50 border-b border-gray-100 last:border-0 flex items-center justify-between">
              <span className="truncate">{c.name}</span>
              <span className="text-gray-400 shrink-0 ml-1">{c.source} · {c.cnt}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Match picker: search canonical items of the opposite product_type ── */
type MatchRecord = { id: number; name: string }
type CandidateItem = { item_id: number; item_name: string; product_type: string | null }

function MatchPicker({ itemId, itemName, isService, current, candidatePool, onChange }: {
  itemId: number; itemName: string; isService: boolean
  current: MatchRecord[]
  candidatePool: CandidateItem[]
  onChange: (next: MatchRecord[]) => void
}) {
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)

  const candidates = useMemo(() => {
    const seen = new Set(current.map(m => m.name.toLowerCase().trim()))
    const q = query.trim().toLowerCase()
    return candidatePool
      .filter(c => !seen.has(c.item_name.toLowerCase().trim()))
      .filter(c => !q || c.item_name.toLowerCase().includes(q))
      .slice(0, 25)
  }, [candidatePool, current, query])

  async function add(name: string) {
    setBusy(true)
    const body = isService ? { good_name: name, service_name: itemName } : { good_name: itemName, service_name: name }
    const res = await fetch('/api/good-service-matches', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const d = await res.json().catch(() => null)
    setBusy(false)
    if (res.ok) onChange([...current, { id: d?.id ?? -Date.now(), name }])
  }

  async function remove(match: MatchRecord) {
    setBusy(true)
    await fetch(`/api/good-service-matches/${match.id}`, { method: 'DELETE' })
    setBusy(false)
    onChange(current.filter(m => m.id !== match.id))
  }

  return (
    <div className="space-y-1">
      {current.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {current.map(m => (
            <span key={m.id} className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 text-[8px] font-semibold px-1.5 py-0.5 rounded-full">
              {m.name}
              <button onClick={() => remove(m)} disabled={busy} className="text-purple-400 hover:text-red-500 font-bold">×</button>
            </span>
          ))}
        </div>
      )}
      <input value={query} onChange={e => setQuery(e.target.value)}
        placeholder={`Search ${isService ? 'goods' : 'services'} to attach…`}
        className="w-full bg-gray-100 border border-gray-300 rounded px-1.5 py-1 text-[9px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400" />
      {query.trim() && (
        <div className="border border-gray-200 rounded bg-white max-h-28 overflow-y-auto">
          {candidates.length === 0 ? (
            <p className="text-[8px] text-gray-400 px-1.5 py-1">No matching {isService ? 'goods' : 'services'}</p>
          ) : candidates.map(c => (
            <button key={c.item_id} onClick={() => add(c.item_name)} disabled={busy}
              className="w-full text-left px-1.5 py-1 text-[8px] text-gray-800 hover:bg-purple-50 border-b border-gray-100 last:border-0 truncate">
              {c.item_name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}


function ItemDetail({ item, groups, allItems, currentAliases, currentMatches, candidatePool, autoEdit, onSaved, onRelationsSaved }: {
  item: SummaryRow; groups: string[]; allItems: { item_id: number; item_name: string }[]
  currentAliases: AliasRecord[]; currentMatches: MatchRecord[]
  candidatePool: CandidateItem[]
  autoEdit: boolean
  onSaved: (u: Partial<SummaryRow>) => void
  onRelationsSaved: (aliases: AliasRecord[], matches: MatchRecord[]) => void
}) {
  const [dayRows, setDayRows] = useState<DayRow[] | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [aliases, setAliases] = useState<AliasRecord[]>(currentAliases)
  const [matches, setMatches] = useState<MatchRecord[]>(currentMatches)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/losses/${item.item_id}`).then(r => r.json())
      .then(d => setDayRows(Array.isArray(d) ? d : []))
      .catch(() => setDayRows([]))
  }, [item.item_id])

  function startEdit() {
    setForm({
      item_name: item.item_name, cf_group: item.cf_group ?? '', selling_rate: item.sp ?? '', purchase_rate: item.cp ?? '',
      units_per_pack: item.units_per_pack ?? '', unit_name: '',
      converts_to_item_id: item.converts_to_item_id ? String(item.converts_to_item_id) : '',
    })
    setAliases(currentAliases)
    setMatches(currentMatches)
    setEditing(true)
  }

  useEffect(() => {
    if (autoEdit) startEdit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEdit])

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
        converts_to_item_id: form.converts_to_item_id ? Number(form.converts_to_item_id) : null,
      }),
    })
    setSaving(false); setEditing(false)
    onSaved({
      item_name: form.item_name || item.item_name, cf_group: form.cf_group || null, sp: form.selling_rate || item.sp, cp: form.purchase_rate || item.cp,
      units_per_pack: form.units_per_pack || null,
      converts_to_item_id: form.converts_to_item_id ? Number(form.converts_to_item_id) : null,
    })
    onRelationsSaved(aliases, matches)
  }

  const computed = dayRows ? computeRows(dayRows) : null
  const sp = parseFloat(item.sp ?? '0') || 0
  const totalLoss = computed ? parseFloat(computed.reduce((s, r) => s + (r.loss ?? 0), 0).toFixed(4)) : 0
  const totalCost = parseFloat((totalLoss * sp).toFixed(2))
  const lgCls = `text-center font-bold border-l border-gray-300 py-0.5 ${totalLoss > 0 ? 'text-red-600' : totalLoss < 0 ? 'text-green-600' : 'text-gray-400'}`

  // When 2+ services independently draw on this item's stock, show each one as its own
  // column (instead of one combined WIC number) so they can be told apart.
  const breakdownNames = computed
    ? Array.from(new Set(computed.flatMap(r => (r.wic_breakdown ?? []).map(b => b.name)))).sort()
    : []
  const showBreakdown = breakdownNames.length >= 2
  const breakdownColW = showBreakdown ? Math.max(4, Math.min(7, Math.floor(16 / breakdownNames.length))) : 0
  const aliasW = 100 - 76 - (showBreakdown ? 0 : 7) - breakdownColW * breakdownNames.length

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mt-0.5">
      {editing && (
        <div className="px-2 pt-1.5 pb-2 space-y-2">
          <div className="flex items-center justify-end gap-1">
            <button onClick={saveEdit} disabled={saving} className="text-[8px] font-bold text-white bg-green-600 px-1.5 py-0.5 rounded disabled:opacity-50">{saving ? '…' : 'Save'}</button>
            <button onClick={() => setEditing(false)} className="text-[8px] font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">✕</button>
          </div>
          <ItemEditForm form={form} onChange={setForm} groups={groups} itemId={item.item_id} isService={item.product_type === 'service'} allItems={allItems} />
          <div>
            <label className="text-[8px] font-bold text-gray-500 block mb-0.5">Aliases</label>
            <AliasPicker itemId={item.item_id} current={aliases} onChange={setAliases} />
          </div>
          <div>
            <label className="text-[8px] font-bold text-gray-500 block mb-0.5">
              {item.product_type === 'service' ? 'Goods used for this service' : 'Services this good is used for'}
            </label>
            <MatchPicker itemId={item.item_id} itemName={item.item_name} isService={item.product_type === 'service'}
              current={matches} candidatePool={candidatePool} onChange={setMatches} />
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
            <col style={{width:'15%'}} />
            <col style={{width:'10%'}} />
            <col style={{width:'8%'}} />
            <col style={{width:'8%'}} />
            {showBreakdown
              ? breakdownNames.map(n => <col key={n} style={{width:`${breakdownColW}%`}} />)
              : <col style={{width:'7%'}} />}
            <col style={{width:'7%'}} />
            <col style={{width:'7%'}} />
            <col style={{width:'7%'}} />
            <col style={{width:'7%'}} />
            <col style={{width:'7%'}} />
            <col style={{width:`${aliasW}%`}} />
          </colgroup>
          <thead>
            <tr className="bg-amber-400 text-gray-800 font-bold">
              <th className="py-0.5 border-b-2 border-gray-400 text-left pl-1">DATE</th>
              <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400">₵</th>
              <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400">L/G</th>
              <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400">CNT</th>
              {showBreakdown
                ? breakdownNames.map(n => (
                    <th key={n} title={n} className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400">
                      {shortSourceName(n)}
                    </th>
                  ))
                : <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400">WIC</th>}
              <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400">GMC</th>
              <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400">SP</th>
              <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400">BL</th>
              <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400" title="Converted in from another item's GMC take">CNV</th>
              <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400">EXP</th>
              <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400">ALIAS</th>
            </tr>
          </thead>
          <tbody>
            {computed!.map((row, i) => {
              const lossVal = row.loss !== null ? row.loss * sp : null
              return (
                <tr key={i} className={`border-b border-gray-200 ${row.loss !== null && row.loss > 0.001 ? 'bg-red-50' : ''}`}>
                  <td className="pl-1 py-0.5 font-bold text-gray-500 whitespace-nowrap overflow-hidden">{fmtDate(row.date)}</td>
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
                  {showBreakdown
                    ? breakdownNames.map(n => (
                        <td key={n} className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-600">
                          {fmtQ(row.wic_breakdown?.find(b => b.name === n)?.qty ?? 0)}
                        </td>
                      ))
                    : <td className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-600">{fmtQs(row.wic_qty)}</td>}
                  <td className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-600">{fmtQs(row.gmc_qty)}</td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300 text-blue-500">{fmtQs(row.sell_price)}</td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300 text-blue-600">{fmtQs(row.bills_qty)}</td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300 text-teal-600">{fmtQs(row.converted_in_qty)}</td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-400">{fmtN(row.expected_soh)}</td>
                  <td className="pl-1 py-0.5 border-l border-gray-300 text-purple-700 font-semibold overflow-hidden">
                    <span className="block truncate" title={row.aliases ?? ''}>{row.aliases ?? <span className="text-gray-300">—</span>}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold text-[8px]">
              <td className="pl-1 py-0.5 text-gray-500">Total</td>
              <td className={lgCls}>{totalCost > 0.01 ? `-₵${fmtN(totalCost)}` : totalCost < -0.01 ? `+₵${fmtN(Math.abs(totalCost))}` : '0'}</td>
              <td className={lgCls}>{totalLoss > 0.001 ? `-${fmtN(totalLoss)}` : totalLoss < -0.001 ? `+${fmtN(Math.abs(totalLoss))}` : '0'}</td>
              <td colSpan={showBreakdown ? 7 + breakdownNames.length : 8} />
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
  const [editTriggerId, setEditTriggerId] = useState<number | null>(null)
  const [aliasRecords, setAliasRecords] = useState<Record<number, AliasRecord[]>>({})
  const [matchRecords, setMatchRecords] = useState<Record<string, MatchRecord[]>>({})

  useEffect(() => {
    fetch('/api/losses/summary').then(r => r.json())
      .then(d => { setRows(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function loadMatches() {
    fetch('/api/good-service-matches').then(r => r.json())
      .then((d: { id: number; good_name: string; service_name: string }[]) => {
        if (!Array.isArray(d)) return
        // Bidirectional: a Good's key collects its Services, a Service's key collects its Goods
        const acc: Record<string, MatchRecord[]> = {}
        for (const { id, good_name, service_name } of d) {
          const gk = good_name.trim().toLowerCase()
          const sk = service_name.trim().toLowerCase()
          if (!acc[gk]) acc[gk] = []
          acc[gk].push({ id, name: service_name.trim() })
          if (!acc[sk]) acc[sk] = []
          acc[sk].push({ id, name: good_name.trim() })
        }
        setMatchRecords(acc)
      })
      .catch(() => {})
  }
  useEffect(() => { loadMatches() }, [])

  function loadAliases() {
    fetch('/api/aliases/wide').then(r => r.json())
      .then((d: any[]) => {
        if (!Array.isArray(d)) return
        const map: Record<number, AliasRecord[]> = {}
        for (const row of d) {
          const records = (row.aliases ?? []).map((a: any) => ({ id: a.id, name: a.name })).filter((a: AliasRecord) => a.name)
          if (records.length) map[row.item_id] = records
        }
        setAliasRecords(map)
      })
      .catch(() => {})
  }
  useEffect(() => { loadAliases() }, [])

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

  const goodsPool = useMemo<CandidateItem[]>(() =>
    rows.filter(r => r.product_type !== 'service').map(r => ({ item_id: r.item_id, item_name: r.item_name, product_type: r.product_type }))
  , [rows])
  const servicesPool = useMemo<CandidateItem[]>(() =>
    rows.filter(r => r.product_type === 'service').map(r => ({ item_id: r.item_id, item_name: r.item_name, product_type: r.product_type }))
  , [rows])
  const allItemsList = useMemo(() =>
    rows.map(r => ({ item_id: r.item_id, item_name: r.item_name })).sort((a, b) => a.item_name.localeCompare(b.item_name))
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

  const colgroup = (
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
      <col style={{width:'56px'}} />
      <col style={{width:'50px'}} />
      <col style={{width:'18px'}} />
      <col style={{width:'220px'}} />
      <col style={{width:'220px'}} />
      <col style={{width:'50px'}} />
    </colgroup>
  )

  function renderRow(row: SummaryRow) {
    const lossAmt = row.lgAmt > 0, gainAmt = row.lgAmt < 0
    const lossQty = row.lgQty > 0, gainQty = row.lgQty < 0
    const soh = parseFloat(row.soh ?? '0') || 0
    const isOpen = expandedId === row.item_id
    return (
      <Fragment key={row.item_id}>
      <tr
        onClick={() => { setExpandedId(isOpen ? null : row.item_id); setEditTriggerId(null) }}
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
        <td className="text-center py-0.5 font-bold text-gray-500 truncate border border-black" title={row.cf_group ?? undefined}>{row.cf_group ?? '—'}</td>
        <td className={`text-center py-0.5 font-bold border border-black ${row.product_type === 'service' ? 'text-purple-500' : 'text-teal-600'}`}
          title={row.product_type === 'service' ? 'Service' : 'Good'}>
          {row.product_type === 'service' ? 'Service' : 'Good'}
        </td>
        <td className="text-center py-0.5 font-bold text-gray-400 border border-black">{isOpen ? '▾' : '▸'}</td>
        <td className="pl-1.5 py-0.5 font-bold text-gray-500 truncate overflow-hidden border border-black"
          title={(aliasRecords[row.item_id] ?? []).map(a => a.name).join(', ')}>
          {(aliasRecords[row.item_id] ?? []).map(a => a.name).join(', ') || '—'}
        </td>
        <td className="pl-1.5 py-0.5 font-bold text-gray-500 truncate overflow-hidden border border-black"
          title={(matchRecords[row.item_name.trim().toLowerCase()] ?? []).map(m => m.name).join(', ')}>
          {(matchRecords[row.item_name.trim().toLowerCase()] ?? []).map(m => m.name).join(', ') || '—'}
        </td>
        <td className="text-center py-0.5 border border-black">
          <button
            onClick={e => { e.stopPropagation(); setExpandedId(row.item_id); setEditTriggerId(row.item_id) }}
            className="text-[8px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
            Edit
          </button>
        </td>
      </tr>
      {isOpen && (
        <tr>
          {/* colSpan makes this cell as wide as the scrollable table, but the inner
              wrapper is sticky-pinned to the left edge and capped to the visible
              viewport width (like the frozen Item column above), so the detail
              table renders at phone width directly under the row that opened it.
              The cell itself has no background of its own, so whatever part of it
              sits past the sticky content just blends into the page instead of
              showing as a visible bar. */}
          <td colSpan={16} className="p-0 border border-black">
            <div className="sticky left-0 w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] max-h-[50vh] overflow-y-auto bg-blue-50 px-0.5 pb-2 pt-0.5">
              <ItemDetail item={row} groups={groupNames} allItems={allItemsList}
                currentAliases={aliasRecords[row.item_id] ?? []}
                currentMatches={matchRecords[row.item_name.trim().toLowerCase()] ?? []}
                candidatePool={row.product_type === 'service' ? goodsPool : servicesPool}
                autoEdit={editTriggerId === row.item_id}
                onSaved={u => patchRow(row.item_id, u)}
                onRelationsSaved={(newAliases, newMatches) => {
                  setAliasRecords(prev => ({ ...prev, [row.item_id]: newAliases }))
                  setMatchRecords(prev => ({ ...prev, [row.item_name.trim().toLowerCase()]: newMatches }))
                  setEditTriggerId(null)
                }} />
            </div>
          </td>
        </tr>
      )}
      </Fragment>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Table — all columns fit on screen; Item column compact */}
      <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-black bg-white">
        <table className="table-fixed border-collapse text-[8px]">
          {colgroup}
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
              <SortTh label="Group" col="cf_group" {...thProps} cls="text-center" />
              <SortTh label="Type" col="product_type" {...thProps} cls="text-center" />
              <th className={`${thBase} text-center text-gray-400`}>▸</th>
              <th className={`${thBase} text-left pl-1.5`}>Aliases</th>
              <th className={`${thBase} text-left pl-1.5`}>Matches</th>
              <th className={`${thBase} text-center`}>Edit</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={16} className="py-10 text-center text-gray-400 text-[9px]">No items</td></tr>
            )}
            {filtered.map(renderRow)}
          </tbody>
        </table>
      </div>
    </div>
  )
}
