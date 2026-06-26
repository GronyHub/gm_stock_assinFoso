'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'

type Unresolved = { name: string; cnt: number; confirmed: boolean }
type Item = { id: number; canonical_name: string; cf_group: string | null }
type Status = 'pending' | 'confirmed' | 'skipped'

export default function AliasReviewPage() {
  const [rows, setRows] = useState<Unresolved[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Unresolved | null>(null)
  const [itemSearch, setItemSearch] = useState('')
  const [chosenItem, setChosenItem] = useState<Item | null>(null)
  const [saving, setSaving] = useState(false)
  const [statusMap, setStatusMap] = useState<Record<string, Status>>({})
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [nameSearch, setNameSearch] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/aliases/unresolved').then(r => r.json()),
      fetch('/api/items/all').then(r => r.json()),
    ]).then(([unres, allItems]) => {
      setRows(Array.isArray(unres) ? unres : [])
      // pre-mark already confirmed ones
      const map: Record<string, Status> = {}
      if (Array.isArray(unres)) {
        for (const r of unres) if (r.confirmed) map[r.name] = 'confirmed'
      }
      setStatusMap(map)
      setItems(Array.isArray(allItems) ? allItems.map((i: any) => ({
        id: i.id, canonical_name: i.name, cf_group: i.group,
      })) : [])
      setLoading(false)
    })
  }, [])

  const displayRows = useMemo(() => {
    let list = rows
    if (filter === 'pending') list = list.filter(r => !statusMap[r.name] || statusMap[r.name] === 'pending')
    if (nameSearch.trim()) {
      const q = nameSearch.toLowerCase()
      list = list.filter(r => r.name.toLowerCase().includes(q))
    }
    return list
  }, [rows, statusMap, filter, nameSearch])

  const filteredItems = useMemo(() => {
    const q = itemSearch.toLowerCase()
    if (!q) return items.slice(0, 40)
    return items.filter(i =>
      i.canonical_name.toLowerCase().includes(q) ||
      (i.cf_group ?? '').toLowerCase().includes(q)
    ).slice(0, 40)
  }, [items, itemSearch])

  function selectRow(r: Unresolved) {
    setSelected(r)
    setItemSearch('')
    setChosenItem(null)
  }

  async function confirm() {
    if (!selected || !chosenItem) return
    setSaving(true)
    const res = await fetch('/api/aliases/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias_name: selected.name, item_id: chosenItem.id }),
    })
    setSaving(false)
    if (res.ok) {
      setStatusMap(m => ({ ...m, [selected.name]: 'confirmed' }))
      // auto-advance to next pending
      const next = displayRows.find(r => r.name !== selected.name && (!statusMap[r.name] || statusMap[r.name] === 'pending'))
      setSelected(next ?? null)
      setChosenItem(null)
      setItemSearch('')
    }
  }

  function skip() {
    if (!selected) return
    setStatusMap(m => ({ ...m, [selected.name]: 'skipped' }))
    const next = displayRows.find(r => r.name !== selected.name && (!statusMap[r.name] || statusMap[r.name] === 'pending'))
    setSelected(next ?? null)
    setChosenItem(null)
    setItemSearch('')
  }

  const pending = rows.filter(r => !statusMap[r.name] || statusMap[r.name] === 'pending').length
  const confirmed = rows.filter(r => statusMap[r.name] === 'confirmed').length
  const skipped = rows.filter(r => statusMap[r.name] === 'skipped').length

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  return (
    <div className="-mx-4 -mt-4 flex flex-col" style={{ height: 'calc(100dvh - 56px - 60px)' }}>

      {/* Top bar */}
      <div className="shrink-0 px-2 py-1.5 border-b border-gray-200 bg-white space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-bold text-gray-700">Alias Review</p>
            <Link href="/aliases/wide" className="text-[9px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded hover:bg-blue-100">
              Wide Table →
            </Link>
          </div>
          <div className="flex gap-2 text-[9px]">
            <span className="text-orange-500 font-bold">{pending} pending</span>
            <span className="text-green-600 font-bold">{confirmed} confirmed</span>
            <span className="text-gray-400">{skipped} skipped</span>
          </div>
        </div>
        <div className="flex gap-1">
          <input value={nameSearch} onChange={e => setNameSearch(e.target.value)}
            placeholder="Search raw names…"
            className="flex-1 text-[10px] bg-gray-50 border border-gray-200 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-blue-400" />
          <button onClick={() => setFilter(f => f === 'pending' ? 'all' : 'pending')}
            className={`text-[9px] font-semibold px-2 py-0.5 rounded transition ${filter === 'pending' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600'}`}>
            {filter === 'pending' ? 'Pending only' : 'Show all'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">

        {/* LEFT: unresolved names */}
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
                return (
                  <tr key={r.name} onClick={() => selectRow(r)}
                    className={`cursor-pointer border-b border-gray-100 transition
                      ${selected?.name === r.name ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <td className="px-1 py-0.5 text-gray-900 truncate max-w-[120px]">{r.name}</td>
                    <td className="px-1 py-0.5 text-right text-gray-500">{r.cnt}</td>
                    <td className="px-1 py-0.5 text-right">
                      {st === 'confirmed' && <span className="text-green-600 font-bold">✓</span>}
                      {st === 'skipped'   && <span className="text-gray-400">—</span>}
                      {(!st || st === 'pending') && <span className="text-orange-400">·</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* RIGHT: canonical picker */}
        <div className="w-1/2 overflow-y-auto min-h-0 bg-white flex flex-col">
          {!selected ? (
            <p className="text-[10px] text-gray-400 text-center py-10">Select a name to map</p>
          ) : (
            <div className="flex flex-col h-full">

              {/* Selected name header */}
              <div className="px-2 py-1.5 bg-gray-50 border-b border-gray-200 shrink-0">
                <p className="text-[9px] text-gray-400 uppercase font-semibold mb-0.5">Raw name ({selected.cnt} sales lines)</p>
                <p className="text-[11px] font-bold text-gray-900 break-words">{selected.name}</p>
                {statusMap[selected.name] === 'confirmed' && (
                  <p className="text-[9px] text-green-600 font-semibold mt-0.5">✓ Already confirmed</p>
                )}
              </div>

              {/* Chosen item display */}
              {chosenItem && (
                <div className="px-2 py-1.5 bg-blue-50 border-b border-blue-100 shrink-0">
                  <p className="text-[9px] text-blue-400 uppercase font-semibold">Maps to</p>
                  <p className="text-[10px] font-bold text-blue-900">{chosenItem.canonical_name}</p>
                  {chosenItem.cf_group && <p className="text-[9px] text-blue-400">{chosenItem.cf_group}</p>}
                </div>
              )}

              {/* Action buttons */}
              <div className="px-2 py-1.5 border-b border-gray-100 flex gap-1 shrink-0">
                <button onClick={confirm} disabled={!chosenItem || saving}
                  className="flex-1 bg-green-600 text-white text-[10px] font-bold rounded py-1.5 disabled:opacity-40 transition hover:bg-green-500">
                  {saving ? 'Saving…' : '✓ Confirm'}
                </button>
                <button onClick={skip}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded hover:bg-gray-200 transition">
                  Skip
                </button>
              </div>

              {/* Canonical item search */}
              <div className="px-2 py-1.5 border-b border-gray-100 shrink-0">
                <input value={itemSearch} onChange={e => setItemSearch(e.target.value)}
                  placeholder="Search canonical items…"
                  className="w-full text-[10px] bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400" />
              </div>

              {/* Items list */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {filteredItems.map(item => (
                  <div key={item.id}
                    onClick={() => setChosenItem(item)}
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
    </div>
  )
}
