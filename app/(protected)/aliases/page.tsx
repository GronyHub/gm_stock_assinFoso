'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'

type Tab = 'prezoho-sales' | 'prezoho-bills' | 'zoho-sales' | 'zoho-bills'

// Pre-Zoho unresolved row
type UnresolvedRow = { name: string; cnt: number; confirmed: boolean }
// Zoho matched row (already has a match, user confirms/corrects)
type ZohoRow = { name: string; cnt: number; resolved_name: string | null; item_id: number | null }

type Item = { id: number; canonical_name: string; cf_group: string | null }
type Status = 'ok' | 'corrected' | 'skipped'

const TABS: { id: Tab; label: string; desc: string }[] = [
  { id: 'prezoho-sales', label: 'Pre-Zoho Sales', desc: 'Unresolved sales lines from BizIMS' },
  { id: 'prezoho-bills', label: 'Pre-Zoho Bills', desc: 'Unresolved bill lines from BizIMS' },
  { id: 'zoho-sales',    label: 'Zoho Sales',    desc: 'Matched sales lines — confirm or correct' },
  { id: 'zoho-bills',    label: 'Zoho Bills',    desc: 'Matched bill lines — confirm or correct' },
]

const CATEGORY_HINTS: Record<string, string> = {
  '12A dRUMS': 'Drum unit','26A HP DRUMS': 'Drum unit','55A HP DRUMS': 'Drum unit',
  '80A/ 05A HP DRUMS': 'Drum unit','1730 CANON BLADE': 'Canon item','1730 CANON DRUMS': 'Canon item',
  '1750i CANON TONER CART.': 'Canon item','5045 drum': 'Drum unit','C-EXV33': 'Canon item',
  '131A Colour Cartridge Black': 'Colour cartridge','131A Colour Cartridge Cyan': 'Colour cartridge',
  '131A Colour Cartridge Magenta': 'Colour cartridge','131A Colour Cartridge Yellow': 'Colour cartridge',
  'EPSON TANK 6 COLOURS': 'Epson item','HP 78A': 'HP item',
  'Colour Printing =': 'Service','Cardboard Printing': 'Service','PV-Photo Framing': 'Service',
  'LAMINATION ID': 'Service','LAMINATION A3 SINGLES': 'Service',
  "I.C-Online Registration (don't record anything here)": 'Service','Tenancy Agreement': 'Service',
  'ACER  LAPTOP CHARGER': 'Not in system','Lenovo Big Pin': 'Not in system',
  'MEMORY 4GB': 'Not in system','MEMORY 8GB': 'Not in system','PINK CARDBOARD': 'Not in system',
  'PVC Rubber Cover (green)': 'Not in system','DV4 LAPTOP BATTERIES': 'Not in system',
  'Toshiba battery': 'Not in system','HDTV CABLE': 'Not in system','SX TONER REFILL': 'Not in system',
  'V3 CABLES': 'Not in system','Push Pins': 'Not in system','A4 SHEETS PACKS': 'Ambiguous',
  'C-EXV 28 – Black': 'Canon item','C-EXV 28 – Cyan': 'Canon item','C-EXV 28 – Yellow': 'Canon item',
  'C-EXV 33 – Black': 'Canon item','CEXV 28 - Black': 'Canon item','CEXV 28 - Cyan': 'Canon item',
  'CEXV 28 - Magenta': 'Canon item','CEXV 28 - Yellow': 'Canon item',
  'Cardboard (Pink) – 5 = 225': 'Not in system','fine glue big size      1       = 25': 'Not in system',
  'A3 paper cutter        1       = 250': 'Not in system',
  '5FT Banner (LF) = 890': 'Service','5FT Sticker - paper type (Light) (LF) = 830': 'Service',
}

const DELIVERY_RE = /^(delivery|momo charge|bank charge|goods (from|ordered|charge)|bengid|gentle order|lucky order|christina order|data appcom ghana|sent to dispatch)/i

const CATEGORY_COLORS: Record<string, string> = {
  'Drum unit':         'bg-purple-100 text-purple-700',
  'Canon item':        'bg-orange-100 text-orange-700',
  'Colour cartridge':  'bg-pink-100 text-pink-700',
  'Epson item':        'bg-yellow-100 text-yellow-700',
  'HP item':           'bg-blue-100 text-blue-700',
  'Service':           'bg-teal-100 text-teal-700',
  'Not in system':     'bg-red-100 text-red-600',
  'Ambiguous':         'bg-gray-100 text-gray-600',
  'Delivery/Charge':   'bg-gray-200 text-gray-500',
}

function getHint(name: string, tab: Tab) {
  if ((tab === 'prezoho-bills' || tab === 'zoho-bills') && DELIVERY_RE.test(name.trim())) return 'Delivery/Charge'
  return CATEGORY_HINTS[name] ?? ''
}

export default function AliasReviewPage() {
  const [tab, setTab] = useState<Tab>('prezoho-sales')
  const [rows, setRows] = useState<(UnresolvedRow | ZohoRow)[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<UnresolvedRow | ZohoRow | null>(null)
  const [itemSearch, setItemSearch] = useState('')
  const [chosenItem, setChosenItem] = useState<Item | null>(null)
  const [saving, setSaving] = useState(false)
  const [statusMap, setStatusMap] = useState<Record<string, Status>>({})
  const [nameSearch, setNameSearch] = useState('')
  const [catFilter, setCatFilter] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const isZoho = tab === 'zoho-sales' || tab === 'zoho-bills'

  const ENDPOINT: Record<Tab, string> = {
    'prezoho-sales': '/api/aliases/unresolved',
    'prezoho-bills': '/api/aliases/unresolved-bills',
    'zoho-sales':    '/api/aliases/zoho-sales',
    'zoho-bills':    '/api/aliases/zoho-bills',
  }

  async function loadData(t: Tab) {
    setLoading(true); setSelected(null); setChosenItem(null)
    setNameSearch(''); setCatFilter(null); setStatusMap({}); setShowAll(false)
    const [rawRows, allItems] = await Promise.all([
      fetch(ENDPOINT[t]).then(r => r.json()),
      fetch('/api/items/all').then(r => r.json()),
    ])
    setRows(Array.isArray(rawRows) ? rawRows : [])
    if (!isZoho) {
      const map: Record<string, Status> = {}
      for (const r of (rawRows as UnresolvedRow[])) if (r.confirmed) map[r.name] = 'ok'
      setStatusMap(map)
    }
    setItems(Array.isArray(allItems) ? allItems.map((i: any) => ({
      id: i.id, canonical_name: i.name, cf_group: i.group,
    })) : [])
    setLoading(false)
  }

  useEffect(() => { loadData(tab) }, [tab])

  const displayRows = useMemo(() => {
    let list = [...rows]
    if (!showAll && !isZoho) list = list.filter(r => !statusMap[r.name] || statusMap[r.name] === undefined)
    if (nameSearch.trim()) {
      const q = nameSearch.toLowerCase()
      list = list.filter(r => r.name.toLowerCase().includes(q))
    }
    if (catFilter) list = list.filter(r => getHint(r.name, tab) === catFilter)
    return list
  }, [rows, statusMap, showAll, nameSearch, catFilter, tab])

  const filteredItems = useMemo(() => {
    const q = itemSearch.toLowerCase()
    if (!q) return items.slice(0, 40)
    return items.filter(i =>
      i.canonical_name.toLowerCase().includes(q) || (i.cf_group ?? '').toLowerCase().includes(q)
    ).slice(0, 40)
  }, [items, itemSearch])

  function selectRow(r: UnresolvedRow | ZohoRow) {
    setSelected(r); setItemSearch(''); setChosenItem(null)
    // Pre-select current match for Zoho rows
    if (isZoho && (r as ZohoRow).item_id) {
      const current = items.find(i => i.id === (r as ZohoRow).item_id)
      if (current) setChosenItem(current)
    }
  }

  function advanceToNext(currentName: string) {
    const next = displayRows.find(r => r.name !== currentName)
    setSelected(next ?? null); setChosenItem(null); setItemSearch('')
  }

  async function confirm() {
    if (!selected || !chosenItem) return
    setSaving(true)
    let res: Response
    if (isZoho) {
      res = await fetch('/api/aliases/correct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_name: selected.name, item_id: chosenItem.id, source: tab === 'zoho-bills' ? 'zoho_bills' : 'zoho_sales' }),
      })
    } else {
      res = await fetch('/api/aliases/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias_name: selected.name, item_id: chosenItem.id, source: tab === 'prezoho-bills' ? 'bills' : 'sales' }),
      })
    }
    setSaving(false)
    if (res.ok) {
      setStatusMap(m => ({ ...m, [selected.name]: 'corrected' }))
      // Update zoho row inline
      if (isZoho) {
        setRows(prev => prev.map(r =>
          r.name === selected.name ? { ...r, item_id: chosenItem.id, resolved_name: chosenItem.canonical_name } : r
        ))
      }
      advanceToNext(selected.name)
    }
  }

  function skip() {
    if (!selected) return
    setStatusMap(m => ({ ...m, [selected.name]: 'skipped' }))
    advanceToNext(selected.name)
  }

  // Counts
  const total     = rows.length
  const corrected = Object.values(statusMap).filter(s => s === 'corrected').length
  const skipped   = Object.values(statusMap).filter(s => s === 'skipped').length
  const pending   = isZoho ? total - corrected - skipped : rows.filter(r => !statusMap[r.name]).length

  const zohoRow = selected && isZoho ? selected as ZohoRow : null

  return (
    <div className="-mx-4 -mt-4 flex flex-col" style={{ height: 'calc(100dvh - 56px - 60px)' }}>

      {/* Top bar */}
      <div className="shrink-0 border-b border-gray-200 bg-white">
        <div className="px-2 pt-1.5 space-y-1">

          {/* Title + Wide link */}
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-gray-700">Alias Review</p>
            <Link href="/aliases/wide" className="text-[9px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded hover:bg-blue-100">
              Wide Table →
            </Link>
          </div>

          {/* 4 tabs */}
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full transition
                  ${tab === t.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Counts + search */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-orange-500 font-bold shrink-0">{pending} pending</span>
            <span className="text-[9px] text-green-600 font-bold shrink-0">{corrected} {isZoho ? 'corrected' : 'done'}</span>
            <span className="text-[9px] text-gray-400 shrink-0">{skipped} skipped</span>
            <span className="text-[9px] text-gray-300 shrink-0">/ {total}</span>
          </div>
          <div className="flex gap-1 pb-0.5">
            <input value={nameSearch} onChange={e => setNameSearch(e.target.value)}
              placeholder="Search names…"
              className="flex-1 text-[10px] bg-gray-50 border border-gray-200 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-blue-400" />
            {!isZoho && (
              <button onClick={() => setShowAll(v => !v)}
                className={`text-[9px] font-semibold px-2 py-0.5 rounded transition
                  ${showAll ? 'bg-gray-200 text-gray-700' : 'bg-orange-100 text-orange-600'}`}>
                {showAll ? 'All' : 'Pending'}
              </button>
            )}
          </div>
        </div>

        {/* Category chips */}
        <div className="flex gap-1 px-2 pb-1.5 overflow-x-auto">
          {['All', ...Object.keys(CATEGORY_COLORS)].map(cat => {
            const isAll = cat === 'All'
            const active = isAll ? !catFilter : catFilter === cat
            return (
              <button key={cat} onClick={() => setCatFilter(isAll ? null : (catFilter === cat ? null : cat))}
                className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full transition
                  ${active ? (isAll ? 'bg-blue-600 text-white' : (CATEGORY_COLORS[cat] ?? 'bg-gray-200 text-gray-600')) : 'bg-gray-100 text-gray-500'}`}>
                {cat}
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>
      ) : (
        <div className="flex flex-1 min-h-0">

          {/* LEFT */}
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
                {displayRows.map(r => {
                  const st = statusMap[r.name]
                  const hint = getHint(r.name, tab)
                  const hintColor = hint ? (CATEGORY_COLORS[hint] ?? 'bg-gray-100 text-gray-500') : null
                  const zoho = r as ZohoRow
                  return (
                    <tr key={r.name} onClick={() => selectRow(r)}
                      className={`cursor-pointer border-b border-gray-100 transition
                        ${selected?.name === r.name ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                      <td className="px-1 py-0.5">
                        <p className="text-gray-900 truncate max-w-[120px]">{r.name}</p>
                        {isZoho && zoho.resolved_name && (
                          <p className={`text-[8px] truncate max-w-[120px] ${st === 'corrected' ? 'text-green-600 font-semibold' : 'text-gray-400'}`}>
                            → {st === 'corrected' ? (items.find(i => i.id === zoho.item_id)?.canonical_name ?? zoho.resolved_name) : zoho.resolved_name}
                          </p>
                        )}
                        {hint && <span className={`text-[8px] font-semibold px-1 rounded ${hintColor}`}>{hint}</span>}
                      </td>
                      <td className="px-1 py-0.5 text-right text-gray-500">{r.cnt}</td>
                      <td className="px-1 py-0.5 text-right">
                        {st === 'corrected' && <span className="text-green-600 font-bold">✓</span>}
                        {st === 'skipped'   && <span className="text-gray-400">—</span>}
                        {!st && isZoho      && <span className="text-blue-400">·</span>}
                        {!st && !isZoho     && <span className="text-orange-400">·</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* RIGHT */}
          <div className="w-1/2 overflow-y-auto min-h-0 bg-white flex flex-col">
            {!selected ? (
              <p className="text-[10px] text-gray-400 text-center py-10">Select a name to {isZoho ? 'review' : 'map'}</p>
            ) : (
              <div className="flex flex-col h-full">

                {/* Header */}
                <div className="px-2 py-1.5 bg-gray-50 border-b border-gray-200 shrink-0">
                  <p className="text-[9px] text-gray-400 uppercase font-semibold mb-0.5">
                    {isZoho ? 'Zoho line' : 'Raw name'} ({selected.cnt} line{selected.cnt !== 1 ? 's' : ''})
                  </p>
                  <p className="text-[11px] font-bold text-gray-900 break-words">{selected.name}</p>
                  {isZoho && zohoRow?.resolved_name && (
                    <p className="text-[9px] text-gray-500 mt-0.5">
                      Currently matched to: <span className="font-semibold text-gray-700">{zohoRow.resolved_name}</span>
                    </p>
                  )}
                  {getHint(selected.name, tab) && (
                    <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded mt-0.5 inline-block
                      ${CATEGORY_COLORS[getHint(selected.name, tab)] ?? 'bg-gray-100 text-gray-500'}`}>
                      {getHint(selected.name, tab)}
                    </span>
                  )}
                </div>

                {/* Chosen item */}
                {chosenItem && (
                  <div className="px-2 py-1.5 bg-blue-50 border-b border-blue-100 shrink-0">
                    <p className="text-[9px] text-blue-400 uppercase font-semibold">
                      {isZoho ? 'Change to' : 'Maps to'}
                    </p>
                    <p className="text-[10px] font-bold text-blue-900">{chosenItem.canonical_name}</p>
                    {chosenItem.cf_group && <p className="text-[9px] text-blue-400">{chosenItem.cf_group}</p>}
                  </div>
                )}

                {/* Actions */}
                <div className="px-2 py-1.5 border-b border-gray-100 flex gap-1 shrink-0">
                  <button onClick={confirm} disabled={!chosenItem || saving}
                    className="flex-1 bg-green-600 text-white text-[10px] font-bold rounded py-1.5 disabled:opacity-40 transition hover:bg-green-500">
                    {saving ? 'Saving…' : isZoho ? '✓ Confirm match' : '✓ Confirm'}
                  </button>
                  <button onClick={skip}
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded hover:bg-gray-200 transition">
                    Skip
                  </button>
                </div>

                {/* Item search */}
                <div className="px-2 py-1.5 border-b border-gray-100 shrink-0">
                  <input value={itemSearch} onChange={e => setItemSearch(e.target.value)}
                    placeholder={isZoho ? 'Change to a different canonical item…' : 'Search canonical items…'}
                    className="w-full text-[10px] bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400" />
                </div>

                {/* Items list */}
                <div className="flex-1 overflow-y-auto min-h-0">
                  {filteredItems.map(item => (
                    <div key={item.id} onClick={() => setChosenItem(item)}
                      className={`px-2 py-1 border-b border-gray-50 cursor-pointer transition
                        ${chosenItem?.id === item.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                      <p className="text-[10px] font-semibold text-gray-900 leading-tight">{item.canonical_name}</p>
                      {item.cf_group && <p className="text-[9px] text-gray-400">{item.cf_group}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
