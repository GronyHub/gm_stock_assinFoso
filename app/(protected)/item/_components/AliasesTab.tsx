'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'

type Tab = 'prezoho-sales' | 'prezoho-bills' | 'zoho-sales' | 'zoho-bills' | 'flagged' | 'ambiguous'
type UnresolvedRow = { name: string; cnt: number; confirmed: boolean }
type ZohoRawName = { name: string; cnt: number }
type ZohoGroup = { item_id: number; canonical_name: string; cf_group: string | null; raw_names: ZohoRawName[] }
type Item = { id: number; canonical_name: string; cf_group: string | null }
type AuditRow = { raw_name: string; item_id: number; canonical_name: string; source: string; cnt: number; warning: string }
type AmbiguousCandidate = { alias_id: number; alias_name: string; item_id: number; canonical_name: string; alias_type: string; source: string; line_count: number }
type AmbiguousGroup = { norm_name: string; candidates: AmbiguousCandidate[] }

const ALL_TAB_IDS: Tab[] = ['prezoho-sales', 'prezoho-bills', 'zoho-sales', 'zoho-bills', 'flagged', 'ambiguous']

const TABS: { id: Tab; label: string }[] = [
  { id: 'prezoho-sales', label: 'Pre-Zoho Sales' },
  { id: 'prezoho-bills', label: 'Pre-Zoho Bills' },
  { id: 'zoho-sales',    label: 'Zoho Sales' },
  { id: 'zoho-bills',    label: 'Zoho Bills' },
  { id: 'flagged',       label: '⚠ Flagged' },
  { id: 'ambiguous',     label: '⚠ Ambiguous' },
]

const CATEGORY_HINTS: Record<string, string> = {
  '12A dRUMS':'Drum unit','26A HP DRUMS':'Drum unit','55A HP DRUMS':'Drum unit',
  '80A/ 05A HP DRUMS':'Drum unit','1730 CANON BLADE':'Canon item','1730 CANON DRUMS':'Canon item',
  '1750i CANON TONER CART.':'Canon item','5045 drum':'Drum unit','C-EXV33':'Canon item',
  '131A Colour Cartridge Black':'Colour cartridge','131A Colour Cartridge Cyan':'Colour cartridge',
  '131A Colour Cartridge Magenta':'Colour cartridge','131A Colour Cartridge Yellow':'Colour cartridge',
  'EPSON TANK 6 COLOURS':'Epson item','HP 78A':'HP item',
  'Colour Printing =':'Service','Cardboard Printing':'Service','PV-Photo Framing':'Service',
  'LAMINATION ID':'Service','LAMINATION A3 SINGLES':'Service',
  "I.C-Online Registration (don't record anything here)":'Service','Tenancy Agreement':'Service',
  'ACER  LAPTOP CHARGER':'Not in system','Lenovo Big Pin':'Not in system',
  'MEMORY 4GB':'Not in system','MEMORY 8GB':'Not in system','PINK CARDBOARD':'Not in system',
  'PVC Rubber Cover (green)':'Not in system','DV4 LAPTOP BATTERIES':'Not in system',
  'Toshiba battery':'Not in system','HDTV CABLE':'Not in system','SX TONER REFILL':'Not in system',
  'V3 CABLES':'Not in system','Push Pins':'Not in system','A4 SHEETS PACKS':'Ambiguous',
}

const DELIVERY_RE = /^(delivery|momo charge|bank charge|goods (from|ordered|charge)|bengid|gentle order|lucky order|christina order|data appcom ghana|sent to dispatch)/i

const CAT_COLOR: Record<string, string> = {
  'Drum unit':'bg-purple-100 text-purple-700','Canon item':'bg-orange-100 text-orange-700',
  'Colour cartridge':'bg-pink-100 text-pink-700','Epson item':'bg-yellow-100 text-yellow-700',
  'HP item':'bg-blue-100 text-blue-700','Service':'bg-teal-100 text-teal-700',
  'Not in system':'bg-red-100 text-red-600','Ambiguous':'bg-gray-100 text-gray-600',
  'Delivery/Charge':'bg-gray-200 text-gray-500',
}

function getHint(name: string, tab: Tab) {
  if ((tab === 'prezoho-bills' || tab === 'zoho-bills') && DELIVERY_RE.test(name.trim())) return 'Delivery/Charge'
  return CATEGORY_HINTS[name] ?? ''
}

function PreZohoPanel({ tab, items }: { tab: Tab; items: Item[] }) {
  const endpoint = tab === 'prezoho-bills' ? '/api/aliases/unresolved-bills' : '/api/aliases/unresolved'
  const source   = tab === 'prezoho-bills' ? 'bills' : 'sales'

  const [rows, setRows]         = useState<UnresolvedRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<UnresolvedRow | null>(null)
  const [itemSearch, setItemSearch] = useState('')
  const [chosenItem, setChosenItem] = useState<Item | null>(null)
  const [saving, setSaving]     = useState(false)
  const [statusMap, setStatusMap] = useState<Record<string, 'done' | 'skipped'>>({})
  const [showAll, setShowAll]   = useState(false)
  const [nameSearch, setNameSearch] = useState('')
  const [catFilter, setCatFilter] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(endpoint).then(r => r.json()).then(d => {
      const data = Array.isArray(d) ? d : []
      setRows(data)
      const map: Record<string, 'done' | 'skipped'> = {}
      for (const r of data) if (r.confirmed) map[r.name] = 'done'
      setStatusMap(map)
      setLoading(false)
    })
  }, [tab])

  const display = useMemo(() => {
    let list = rows
    if (!showAll) list = list.filter(r => !statusMap[r.name])
    if (nameSearch) list = list.filter(r => r.name.toLowerCase().includes(nameSearch.toLowerCase()))
    if (catFilter) list = list.filter(r => getHint(r.name, tab) === catFilter)
    return list
  }, [rows, statusMap, showAll, nameSearch, catFilter])

  const filteredItems = useMemo(() => {
    const q = itemSearch.toLowerCase()
    if (!q) return items.slice(0, 40)
    return items.filter(i => i.canonical_name.toLowerCase().includes(q) || (i.cf_group ?? '').toLowerCase().includes(q)).slice(0, 40)
  }, [items, itemSearch])

  function selectRow(r: UnresolvedRow) { setSelected(r); setItemSearch(''); setChosenItem(null) }

  async function confirmMatch(force = false) {
    if (!selected || !chosenItem) return
    setSaving(true)
    const res = await fetch('/api/aliases/confirm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias_name: selected.name, item_id: chosenItem.id, source, force }),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => null)
      if (res.status === 409 && d?.requires_confirmation) {
        if (window.confirm(`${d.warning}\n\nMatch anyway?`)) confirmMatch(true)
      }
      return
    }
    setStatusMap(m => ({ ...m, [selected.name]: 'done' }))
    const next = display.find(r => r.name !== selected.name && !statusMap[r.name])
    setSelected(next ?? null); setChosenItem(null); setItemSearch('')
  }

  function skip() {
    if (!selected) return
    setStatusMap(m => ({ ...m, [selected.name]: 'skipped' }))
    const next = display.find(r => r.name !== selected.name && !statusMap[r.name])
    setSelected(next ?? null); setChosenItem(null); setItemSearch('')
  }

  const pending = rows.filter(r => !statusMap[r.name]).length
  const done    = rows.filter(r => statusMap[r.name] === 'done').length
  const skipped = rows.filter(r => statusMap[r.name] === 'skipped').length

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0 px-2 py-1 border-b border-gray-200 bg-white space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-orange-500 font-bold">{pending} pending</span>
          <span className="text-[9px] text-green-600 font-bold">{done} done</span>
          <span className="text-[9px] text-gray-400">{skipped} skipped</span>
          <div className="flex-1" />
          <button onClick={() => setShowAll(v => !v)}
            className={`text-[9px] font-semibold px-2 py-0.5 rounded transition ${showAll ? 'bg-gray-200 text-gray-700' : 'bg-orange-100 text-orange-600'}`}>
            {showAll ? 'All' : 'Pending'}
          </button>
        </div>
        <input value={nameSearch} onChange={e => setNameSearch(e.target.value)} placeholder="Search…"
          className="w-full text-[10px] bg-gray-50 border border-gray-200 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-blue-400" />
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {['All', ...Object.keys(CAT_COLOR)].map(cat => {
            const isAll = cat === 'All'; const active = isAll ? !catFilter : catFilter === cat
            return (
              <button key={cat} onClick={() => setCatFilter(isAll ? null : (catFilter === cat ? null : cat))}
                className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full transition
                  ${active ? (isAll ? 'bg-blue-600 text-white' : (CAT_COLOR[cat] ?? 'bg-gray-200')) : 'bg-gray-100 text-gray-500'}`}>
                {cat}
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="w-1/2 border-r border-gray-200 overflow-y-auto min-h-0">
          <table className="w-full border-collapse text-[10px]">
            <thead className="sticky top-0 bg-gray-100 z-10">
              <tr>
                <th className="text-left px-1 py-1 font-semibold text-gray-500 border-b border-gray-200">RAW NAME</th>
                <th className="text-right px-1 py-1 font-semibold text-gray-500 border-b border-gray-200">CNT</th>
                <th className="text-right px-1 py-1 font-semibold text-gray-500 border-b border-gray-200">ST</th>
              </tr>
            </thead>
            <tbody>
              {display.map(r => {
                const st = statusMap[r.name]; const hint = getHint(r.name, tab)
                return (
                  <tr key={r.name} onClick={() => selectRow(r)}
                    className={`cursor-pointer border-b border-gray-100 transition ${selected?.name === r.name ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <td className="px-1 py-0.5">
                      <p className="text-gray-900 truncate max-w-[120px]">{r.name}</p>
                      {hint && <span className={`text-[8px] font-semibold px-1 rounded ${CAT_COLOR[hint] ?? 'bg-gray-100 text-gray-500'}`}>{hint}</span>}
                    </td>
                    <td className="px-1 py-0.5 text-right text-gray-500">{r.cnt}</td>
                    <td className="px-1 py-0.5 text-right">
                      {st === 'done' && <span className="text-green-600 font-bold">✓</span>}
                      {st === 'skipped' && <span className="text-gray-400">—</span>}
                      {!st && <span className="text-orange-400">·</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="w-1/2 overflow-y-auto min-h-0 flex flex-col">
          {!selected ? <p className="text-[10px] text-gray-400 text-center py-10">Select a name to map</p> : (
            <div className="flex flex-col h-full">
              <div className="px-2 py-1.5 bg-gray-50 border-b border-gray-200 shrink-0">
                <p className="text-[9px] text-gray-400 uppercase font-semibold">Raw name · {selected.cnt} lines</p>
                <p className="text-[11px] font-bold text-gray-900 break-words">{selected.name}</p>
              </div>
              {chosenItem && (
                <div className="px-2 py-1.5 bg-blue-50 border-b border-blue-100 shrink-0">
                  <p className="text-[9px] text-blue-400 uppercase font-semibold">Maps to</p>
                  <p className="text-[10px] font-bold text-blue-900">{chosenItem.canonical_name}</p>
                </div>
              )}
              <div className="px-2 py-1.5 border-b border-gray-100 flex gap-1 shrink-0">
                <button onClick={() => confirmMatch()} disabled={!chosenItem || saving}
                  className="flex-1 bg-green-600 text-white text-[10px] font-bold rounded py-1.5 disabled:opacity-40 hover:bg-green-500 transition">
                  {saving ? 'Saving…' : '✓ Confirm'}
                </button>
                <button onClick={skip}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded hover:bg-gray-200 transition">
                  Skip
                </button>
              </div>
              <div className="px-2 py-1.5 border-b border-gray-100 shrink-0">
                <input value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder="Search canonical items…"
                  className="w-full text-[10px] bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                {filteredItems.map(item => (
                  <div key={item.id} onClick={() => setChosenItem(item)}
                    className={`px-2 py-1 border-b border-gray-50 cursor-pointer transition ${chosenItem?.id === item.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <p className="text-[10px] font-semibold text-gray-900">{item.canonical_name}</p>
                    {item.cf_group && <p className="text-[9px] text-gray-400">{item.cf_group}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ZohoPanel({ tab, items }: { tab: Tab; items: Item[] }) {
  const endpoint = tab === 'zoho-bills' ? '/api/aliases/zoho-bills' : '/api/aliases/zoho-sales'
  const srcKey   = tab === 'zoho-bills' ? 'zoho_bills' : 'zoho_sales'

  const [groups, setGroups]     = useState<ZohoGroup[]>([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<ZohoGroup | null>(null)
  const [search, setSearch]     = useState('')
  const [statusMap, setStatusMap]   = useState<Record<string, 'ok' | 'wrong' | 'skipped'>>({})
  const [reassigning, setReassigning] = useState<ZohoRawName | null>(null)
  const [reassignSearch, setReassignSearch] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(endpoint).then(r => r.json()).then(d => {
      setGroups(Array.isArray(d) ? d : [])
      setLoading(false)
    })
  }, [tab])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return groups
    return groups.filter(g =>
      g.canonical_name.toLowerCase().includes(q) ||
      g.raw_names.some(r => r.name.toLowerCase().includes(q))
    )
  }, [groups, search])

  const reassignTargets = useMemo(() => {
    const q = reassignSearch.toLowerCase()
    if (!q) return items.filter(i => i.id !== selected?.item_id).slice(0, 40)
    return items.filter(i => i.id !== selected?.item_id &&
      (i.canonical_name.toLowerCase().includes(q) || (i.cf_group ?? '').toLowerCase().includes(q))
    ).slice(0, 40)
  }, [items, reassignSearch, selected])

  function selectGroup(g: ZohoGroup) { setSelected(g); setStatusMap({}); setReassigning(null); setReassignSearch('') }
  function markOk(rawName: string) { setStatusMap(m => ({ ...m, [rawName]: 'ok' })) }
  function markSkip(rawName: string) { setStatusMap(m => ({ ...m, [rawName]: 'skipped' })) }

  async function doReassign(targetItem: Item, force = false) {
    if (!reassigning) return
    setSaving(true)
    const res = await fetch('/api/aliases/correct', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_name: reassigning.name, item_id: targetItem.id, source: srcKey, force }),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => null)
      if (res.status === 409 && d?.requires_confirmation) {
        if (window.confirm(`${d.warning}\n\nMatch anyway?`)) doReassign(targetItem, true)
      }
      return
    }
    setGroups(prev => prev.map(g => {
      if (g.item_id !== selected?.item_id) return g
      return { ...g, raw_names: g.raw_names.filter(r => r.name !== reassigning.name) }
    }))
    setStatusMap(m => ({ ...m, [reassigning.name]: 'ok' }))
    setReassigning(null); setReassignSearch('')
    setSelected(prev => prev ? { ...prev, raw_names: prev.raw_names.filter(r => r.name !== reassigning.name) } : null)
  }

  const totalRaw  = groups.reduce((s, g) => s + g.raw_names.length, 0)
  const doneCount = Object.values(statusMap).filter(s => s === 'ok').length

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0 px-2 py-1 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[9px] text-blue-600 font-bold">{groups.length} canonical items</span>
          <span className="text-[9px] text-gray-400">{totalRaw} raw name variants</span>
          {selected && <span className="text-[9px] text-green-600 font-bold ml-auto">{doneCount}/{selected.raw_names.length} reviewed</span>}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search canonical items or raw names…"
          className="w-full text-[10px] bg-gray-50 border border-gray-200 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-blue-400" />
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="w-1/2 border-r border-gray-200 overflow-y-auto min-h-0">
          <table className="w-full border-collapse text-[10px]">
            <thead className="sticky top-0 bg-gray-100 z-10">
              <tr>
                <th className="text-left px-1 py-1 font-semibold text-gray-500 border-b border-gray-200">CANONICAL ITEM</th>
                <th className="text-right px-1 py-1 font-semibold text-gray-500 border-b border-gray-200">#</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(g => (
                <tr key={g.item_id} onClick={() => selectGroup(g)}
                  className={`cursor-pointer border-b border-gray-100 transition ${selected?.item_id === g.item_id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <td className="px-1 py-0.5">
                    <p className="text-gray-900 font-semibold truncate max-w-[150px]">{g.canonical_name}</p>
                    {g.cf_group && <p className="text-[9px] text-gray-400">{g.cf_group}</p>}
                  </td>
                  <td className="px-1 py-0.5 text-right text-gray-400">{g.raw_names.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="w-1/2 overflow-y-auto min-h-0 flex flex-col">
          {!selected ? (
            <p className="text-[10px] text-gray-400 text-center py-10">Select a canonical item to review</p>
          ) : reassigning ? (
            <div className="flex flex-col h-full">
              <div className="px-2 py-1.5 bg-orange-50 border-b border-orange-200 shrink-0">
                <p className="text-[9px] text-orange-500 font-semibold uppercase">Reassigning</p>
                <p className="text-[10px] font-bold text-gray-900 break-words">{reassigning.name}</p>
              </div>
              <div className="px-2 py-1.5 border-b border-gray-100 shrink-0">
                <input value={reassignSearch} onChange={e => setReassignSearch(e.target.value)}
                  placeholder="Search canonical items…" autoFocus
                  className="w-full text-[10px] bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-orange-400" />
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                {reassignTargets.map(item => (
                  <div key={item.id} onClick={() => !saving && doReassign(item)}
                    className="px-2 py-1.5 border-b border-gray-100 cursor-pointer hover:bg-orange-50 transition">
                    <p className="text-[10px] font-semibold text-gray-900">{item.canonical_name}</p>
                    {item.cf_group && <p className="text-[9px] text-gray-400">{item.cf_group}</p>}
                  </div>
                ))}
              </div>
              <div className="px-2 py-1.5 border-t border-gray-200 shrink-0">
                <button onClick={() => { setReassigning(null); setReassignSearch('') }}
                  className="w-full text-[10px] font-semibold text-gray-600 bg-gray-100 rounded py-1 hover:bg-gray-200 transition">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="px-2 py-1.5 bg-gray-50 border-b border-gray-200 shrink-0">
                <p className="text-[11px] font-bold text-gray-900">{selected.canonical_name}</p>
                <p className="text-[9px] text-gray-400">{selected.raw_names.length} raw name variant{selected.raw_names.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                {selected.raw_names.filter(r => !statusMap[r.name]).map(r => (
                  <div key={r.name} className="px-2 py-1.5 border-b border-gray-100">
                    <div className="flex items-start gap-1 justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-gray-900 break-words leading-tight">{r.name}</p>
                        <p className="text-[9px] text-gray-400">{r.cnt} lines</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => markOk(r.name)}
                          className="text-[9px] font-bold text-white bg-green-500 hover:bg-green-600 px-1.5 py-0.5 rounded transition">✓</button>
                        <button onClick={() => { setReassigning(r); setReassignSearch('') }}
                          className="text-[9px] font-semibold text-orange-500 bg-orange-50 hover:bg-orange-100 px-1.5 py-0.5 rounded transition">Move</button>
                        <button onClick={() => markSkip(r.name)}
                          className="text-[9px] text-gray-400 hover:text-gray-600 px-1 py-0.5 rounded transition">—</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Every already-matched raw name that contradicts the item it's matched to
// (raw text says "singles", matched item is a "pack", or vice versa) --
// see /api/aliases/audit. Existing bad matches made before the sanity check
// existed don't get caught by it going forward, so this is the way to find
// and fix them retroactively.
function FlaggedPanel({ items }: { items: Item[] }) {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [reassigning, setReassigning] = useState<AuditRow | null>(null)
  const [reassignSearch, setReassignSearch] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch('/api/aliases/audit').then(r => r.json()).then(d => { setRows(Array.isArray(d) ? d : []); setLoading(false) })
  }, [])

  const key = (r: AuditRow) => `${r.source}::${r.raw_name}::${r.item_id}`
  const display = rows.filter(r => !dismissed.has(key(r)))

  const reassignTargets = useMemo(() => {
    const q = reassignSearch.toLowerCase()
    if (!q) return items.filter(i => i.id !== reassigning?.item_id).slice(0, 40)
    return items.filter(i => i.id !== reassigning?.item_id &&
      (i.canonical_name.toLowerCase().includes(q) || (i.cf_group ?? '').toLowerCase().includes(q))
    ).slice(0, 40)
  }, [items, reassignSearch, reassigning])

  async function doFix(target: Item, force = false) {
    if (!reassigning) return
    setSaving(true)
    const srcKey = reassigning.source === 'bills' ? 'zoho_bills' : 'zoho_sales'
    const res = await fetch('/api/aliases/correct', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_name: reassigning.raw_name, item_id: target.id, source: srcKey, force }),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => null)
      if (res.status === 409 && d?.requires_confirmation) {
        if (window.confirm(`${d.warning}\n\nMatch anyway?`)) doFix(target, true)
      }
      return
    }
    setDismissed(s => new Set(s).add(key(reassigning)))
    setReassigning(null); setReassignSearch('')
  }

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0 px-2 py-1 border-b border-gray-200 bg-white">
        <span className="text-[9px] text-red-600 font-bold">{display.length} flagged mismatch{display.length === 1 ? '' : 'es'}</span>
        <span className="text-[9px] text-gray-400 ml-2">raw name contradicts the item it&apos;s matched to (singles vs. pack)</span>
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="w-1/2 border-r border-gray-200 overflow-y-auto min-h-0">
          {display.length === 0 ? (
            <p className="text-[10px] text-gray-400 text-center py-10">No flagged mismatches found. 🎉</p>
          ) : (
            <table className="w-full border-collapse text-[10px]">
              <thead className="sticky top-0 bg-gray-100 z-10">
                <tr>
                  <th className="text-left px-1 py-1 font-semibold text-gray-500 border-b border-gray-200">RAW NAME</th>
                  <th className="text-left px-1 py-1 font-semibold text-gray-500 border-b border-gray-200">MATCHED TO</th>
                  <th className="text-right px-1 py-1 font-semibold text-gray-500 border-b border-gray-200">CNT</th>
                </tr>
              </thead>
              <tbody>
                {display.map(r => (
                  <tr key={key(r)} onClick={() => { setReassigning(r); setReassignSearch('') }}
                    className={`cursor-pointer border-b border-gray-100 transition ${reassigning && key(reassigning) === key(r) ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                    <td className="px-1 py-0.5"><p className="text-gray-900 truncate max-w-[100px]">{r.raw_name}</p></td>
                    <td className="px-1 py-0.5"><p className="text-red-600 truncate max-w-[100px]">{r.canonical_name}</p></td>
                    <td className="px-1 py-0.5 text-right text-gray-500">{r.cnt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="w-1/2 overflow-y-auto min-h-0 flex flex-col">
          {!reassigning ? (
            <p className="text-[10px] text-gray-400 text-center py-10">Select a flagged row to fix or dismiss</p>
          ) : (
            <div className="flex flex-col h-full">
              <div className="px-2 py-1.5 bg-red-50 border-b border-red-200 shrink-0">
                <p className="text-[9px] text-red-500 font-semibold uppercase">Flagged</p>
                <p className="text-[10px] font-bold text-gray-900 break-words">{reassigning.raw_name}</p>
                <p className="text-[9px] text-red-700 mt-0.5">{reassigning.warning}</p>
                <p className="text-[9px] text-gray-400 mt-0.5">Currently matched to: {reassigning.canonical_name} ({reassigning.cnt} lines)</p>
              </div>
              <div className="px-2 py-1.5 border-b border-gray-100 shrink-0">
                <button onClick={() => setDismissed(s => new Set(s).add(key(reassigning)))}
                  className="w-full text-[10px] font-semibold text-gray-600 bg-gray-100 rounded py-1.5 hover:bg-gray-200 transition">
                  Keep as-is (dismiss)
                </button>
              </div>
              <div className="px-2 py-1.5 border-b border-gray-100 shrink-0">
                <input value={reassignSearch} onChange={e => setReassignSearch(e.target.value)}
                  placeholder="Search the correct item…" autoFocus
                  className="w-full text-[10px] bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-red-400 text-gray-900" />
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                {reassignTargets.map(item => (
                  <div key={item.id} onClick={() => !saving && doFix(item)}
                    className="px-2 py-1.5 border-b border-gray-100 cursor-pointer hover:bg-red-50 transition">
                    <p className="text-[10px] font-semibold text-gray-900">{item.canonical_name}</p>
                    {item.cf_group && <p className="text-[9px] text-gray-400">{item.cf_group}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Alias names that map to more than one item -- exactly what
// /api/aliases/resweep skips rather than guess at. Resolving one here both
// moves any lines already mis-resolved to a losing candidate over to the
// one kept, and deletes the losing item_aliases rows, so the name maps to
// a single (correctly-resolved) item again for future confirms/sweeps.
function AmbiguousPanel() {
  const [groups, setGroups] = useState<AmbiguousGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AmbiguousGroup | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [resolving, setResolving] = useState<number | null>(null)
  const [lastResult, setLastResult] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch('/api/aliases/ambiguous').then(r => r.json()).then(d => {
      setGroups(Array.isArray(d) ? d : [])
      setLoading(false)
    })
  }, [])

  const display = groups.filter(g => !dismissed.has(g.norm_name))

  async function keep(group: AmbiguousGroup, keepItemId: number | null) {
    setResolving(keepItemId ?? -1)
    setLastResult(null)
    const res = await fetch('/api/aliases/ambiguous/resolve', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ norm_name: group.norm_name, keep_item_id: keepItemId }),
    })
    setResolving(null)
    if (!res.ok) return
    const d = await res.json()
    setLastResult(
      keepItemId
        ? `Moved ${d.salesLinesMoved} sales line${d.salesLinesMoved === 1 ? '' : 's'} and ${d.billLinesMoved} bill line${d.billLinesMoved === 1 ? '' : 's'} to the kept item; removed ${d.deletedCount} alias row${d.deletedCount === 1 ? '' : 's'}`
        : `Deleted ${d.deletedCount} unused alias row${d.deletedCount === 1 ? '' : 's'}`
    )
    setGroups(prev => prev.filter(g => g.norm_name !== group.norm_name))
    setSelected(null)
  }

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0 px-2 py-1 border-b border-gray-200 bg-white">
        <span className="text-[9px] text-red-600 font-bold">{display.length} ambiguous name{display.length === 1 ? '' : 's'}</span>
        <span className="text-[9px] text-gray-400 ml-2">same raw text maps to more than one item -- resweep skips these</span>
      </div>
      {lastResult && (
        <p className="shrink-0 text-[9px] text-gray-500 bg-gray-50 border-b border-gray-200 px-2 py-1">{lastResult}</p>
      )}
      <div className="flex flex-1 min-h-0">
        <div className="w-1/2 border-r border-gray-200 overflow-y-auto min-h-0">
          {display.length === 0 ? (
            <p className="text-[10px] text-gray-400 text-center py-10">No ambiguous aliases found. 🎉</p>
          ) : (
            <table className="w-full border-collapse text-[10px]">
              <thead className="sticky top-0 bg-gray-100 z-10">
                <tr>
                  <th className="text-left px-1 py-1 font-semibold text-gray-500 border-b border-gray-200">ALIAS NAME</th>
                  <th className="text-right px-1 py-1 font-semibold text-gray-500 border-b border-gray-200">ITEMS</th>
                </tr>
              </thead>
              <tbody>
                {display.map(g => (
                  <tr key={g.norm_name} onClick={() => setSelected(g)}
                    className={`cursor-pointer border-b border-gray-100 transition ${selected?.norm_name === g.norm_name ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                    <td className="px-1 py-0.5"><p className="text-gray-900 truncate max-w-[150px]">{g.candidates[0]?.alias_name}</p></td>
                    <td className="px-1 py-0.5 text-right text-gray-400">{g.candidates.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="w-1/2 overflow-y-auto min-h-0 flex flex-col">
          {!selected ? (
            <p className="text-[10px] text-gray-400 text-center py-10">Select a name to resolve</p>
          ) : (
            <div className="flex flex-col h-full">
              <div className="px-2 py-1.5 bg-red-50 border-b border-red-200 shrink-0">
                <p className="text-[9px] text-red-500 font-semibold uppercase">Ambiguous</p>
                <p className="text-[10px] font-bold text-gray-900 break-words">{selected.candidates[0]?.alias_name}</p>
                <p className="text-[9px] text-gray-400 mt-0.5">Pick which item this name really means -- lines currently resolved to the other candidate(s) move here too, and the losing aliases are removed</p>
              </div>
              {selected.candidates.every(c => c.line_count === 0) && (
                <div className="px-2 py-1.5 bg-orange-50 border-b border-orange-200 shrink-0">
                  <p className="text-[9px] text-orange-600 mb-1">No candidate has any lines resolved to it — likely just orphaned old data.</p>
                  <button onClick={() => keep(selected, null)} disabled={resolving !== null}
                    className="w-full text-[10px] font-bold text-white bg-orange-500 hover:bg-orange-600 rounded py-1.5 transition disabled:opacity-40">
                    {resolving === -1 ? 'Deleting…' : 'Delete entirely — not used anywhere'}
                  </button>
                </div>
              )}
              <div className="px-2 py-1.5 border-b border-gray-100 shrink-0">
                <button onClick={() => { setDismissed(s => new Set(s).add(selected.norm_name)); setSelected(null) }}
                  className="w-full text-[10px] font-semibold text-gray-600 bg-gray-100 rounded py-1.5 hover:bg-gray-200 transition">
                  Skip for now
                </button>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                {selected.candidates.map(c => (
                  <div key={c.alias_id} className="px-2 py-1.5 border-b border-gray-100">
                    <p className="text-[10px] font-semibold text-gray-900">{c.canonical_name}</p>
                    <p className="text-[9px] text-gray-400">{c.line_count} line{c.line_count === 1 ? '' : 's'} currently resolved here · {c.alias_type} · {c.source}</p>
                    <button onClick={() => keep(selected, c.item_id)} disabled={resolving !== null}
                      className="mt-1 text-[9px] font-bold text-white bg-green-600 hover:bg-green-500 px-2 py-0.5 rounded transition disabled:opacity-40">
                      {resolving === c.item_id ? 'Keeping…' : `Keep this one →`}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

type Props = { defaultTab?: string | null }

export default function AliasesTab({ defaultTab }: Props) {
  const validTab = (defaultTab as Tab | undefined)
  const [tab, setTab] = useState<Tab>(
    validTab && ALL_TAB_IDS.includes(validTab)
      ? validTab
      : 'prezoho-sales'
  )
  const [items, setItems] = useState<Item[]>([])
  const [resweeping, setResweeping] = useState(false)
  const [resweepResult, setResweepResult] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    fetch('/api/items/all').then(r => r.json()).then(d => {
      setItems(Array.isArray(d) ? d.map((i: any) => ({ id: i.id, canonical_name: i.name, cf_group: i.group })) : [])
    })
  }, [])

  async function resweep() {
    setResweeping(true); setResweepResult(null)
    const res = await fetch('/api/aliases/resweep', { method: 'POST' })
    setResweeping(false)
    if (!res.ok) { setResweepResult('Failed — try again'); return }
    const d = await res.json()
    const parts = [`${d.salesLinesUpdated} sales line${d.salesLinesUpdated === 1 ? '' : 's'}`, `${d.billLinesUpdated} bill line${d.billLinesUpdated === 1 ? '' : 's'}`]
    let msg = `Re-swept: ${parts.join(', ')} updated`
    if (d.ambiguousNamesSkipped?.length) msg += ` · ${d.ambiguousNamesSkipped.length} ambiguous name${d.ambiguousNamesSkipped.length === 1 ? '' : 's'} skipped`
    setResweepResult(msg)
    setRefreshKey(k => k + 1)
  }

  useEffect(() => {
    if (defaultTab && ALL_TAB_IDS.includes(defaultTab as Tab)) {
      setTab(defaultTab as Tab)
    }
  }, [defaultTab])

  const isZoho = tab === 'zoho-sales' || tab === 'zoho-bills'

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 border-b border-gray-200 bg-white px-2 py-1.5 space-y-1">
        <div className="flex items-center justify-between gap-1">
          <p className="text-[10px] font-bold text-gray-700">Alias Review</p>
          <div className="flex items-center gap-1">
            <button onClick={resweep} disabled={resweeping}
              title="Re-apply every existing alias against current sales/bill lines"
              className="text-[9px] text-green-700 font-semibold bg-green-50 px-1.5 py-0.5 rounded hover:bg-green-100 disabled:opacity-50">
              {resweeping ? 'Re-sweeping…' : '⟳ Re-sweep aliases'}
            </button>
            <Link href="/aliases/wide" className="text-[9px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded hover:bg-blue-100">
              Wide Table →
            </Link>
          </div>
        </div>
        {resweepResult && (
          <p className="text-[9px] text-gray-500 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5">{resweepResult}</p>
        )}
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full transition
                ${tab === t.id
                  ? ((t.id === 'flagged' || t.id === 'ambiguous') ? 'bg-red-600 text-white' : t.id.startsWith('zoho') ? 'bg-indigo-600 text-white' : 'bg-blue-600 text-white')
                  : 'bg-gray-100 text-gray-500'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'flagged'
        ? <FlaggedPanel key={refreshKey} items={items} />
        : tab === 'ambiguous'
        ? <AmbiguousPanel key={refreshKey} />
        : isZoho
        ? <ZohoPanel key={`${tab}-${refreshKey}`} tab={tab} items={items} />
        : <PreZohoPanel key={`${tab}-${refreshKey}`} tab={tab} items={items} />
      }
    </div>
  )
}
