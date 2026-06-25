'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

type CountRecord = {
  id: number
  item_name: string
  count_date: string
  quantity_counted: string
  notes: string | null
  counted_by: string | null
  source: string | null
  cf_group: string | null
}

type DailyItem = {
  item_id: number; item_name: string; cf_group: string | null
  calculated_soh: number; last_count_date: string | null; days_overdue: number | null
}

const MONTHS = ['Ja','Fe','Mr','Ap','My','Ju','Jl','Au','Se','Oc','No','De']
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa']

function fmtShort(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(-2)}-${DAYS[d.getUTCDay()]}`
}

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded px-2 py-1 text-[10px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400'

const TABS = ['List', 'Daily', '15-Day'] as const
type Tab = typeof TABS[number]

function Badge({ n }: { n: number }) {
  if (!n) return null
  return <span className="ml-1 bg-red-100 text-red-600 text-[9px] font-bold px-1 py-0.5 rounded-full">{n}</span>
}

// Daily/15-Day count submission row
function CountRow({ item, onSaved }: { item: DailyItem; onSaved: (id: number) => void }) {
  const [customQty, setCustomQty] = useState('')
  const [saving, setSaving] = useState(false)
  const soh = Number(item.calculated_soh)

  async function submit(qty: number) {
    setSaving(true)
    const res = await fetch('/api/stock/count', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.item_id, qty, notes: '' }),
    })
    setSaving(false)
    if (res.ok) onSaved(item.item_id)
  }

  const overdue = item.days_overdue
  const badgeClass = overdue === null || overdue === 0 ? 'bg-orange-100 text-orange-600'
    : overdue <= 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'
  const badgeLabel = overdue === null ? 'Never' : overdue === 0 ? 'Today' : `${overdue}d`

  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="px-1.5 py-1 min-w-0">
        <p className="text-[10px] text-gray-900 font-semibold leading-tight truncate max-w-[110px]">{item.item_name}</p>
        {item.cf_group && <p className="text-[9px] text-gray-400 leading-tight truncate">{item.cf_group}</p>}
      </td>
      <td className="px-1 py-1 text-center text-[10px] font-bold text-gray-900 whitespace-nowrap">{soh}</td>
      <td className="px-1 py-1">
        <span className={`text-[9px] font-semibold px-1 py-0.5 rounded-full whitespace-nowrap ${badgeClass}`}>{badgeLabel}</span>
      </td>
      <td className="px-1 py-1">
        <div className="flex items-center gap-1">
          <button onClick={() => submit(soh)} disabled={saving}
            className="bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white text-[9px] font-semibold rounded px-1.5 py-1 whitespace-nowrap transition">
            {saving ? '…' : `=${soh}`}
          </button>
          <input type="number" min="0" step="any" value={customQty} onChange={e => setCustomQty(e.target.value)}
            placeholder="qty" inputMode="decimal"
            className="w-11 bg-gray-100 border border-gray-200 rounded px-1 py-1 text-[10px] text-center outline-none focus:ring-1 focus:ring-blue-400" />
          <button onClick={() => { if (customQty !== '') submit(Number(customQty)) }}
            disabled={customQty === '' || saving}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white text-[9px] font-semibold rounded px-1.5 py-1 transition">
            Save
          </button>
        </div>
      </td>
    </tr>
  )
}

function CountsHistoryPageInner() {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab')

  const [records, setRecords] = useState<CountRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [editQty, setEditQty] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const [tab, setTab] = useState<Tab>(
    initialTab === 'Daily' || initialTab === '15-Day' ? initialTab : 'List'
  )
  const [dailyItems, setDailyItems] = useState<DailyItem[]>([])
  const [overdueItems, setOverdueItems] = useState<DailyItem[]>([])
  const [dailyLoading, setDailyLoading] = useState(true)

  useEffect(() => {
    fetch('/api/stock/counts').then(r => r.json()).then(d => { setRecords(d); setLoading(false) })
  }, [])

  useEffect(() => {
    Promise.all([
      fetch('/api/stock/daily').then(r => r.json()),
      fetch('/api/stock/overdue').then(r => r.json()),
    ]).then(([daily, overdue]) => {
      setDailyItems(daily); setOverdueItems(overdue); setDailyLoading(false)
    })
  }, [])

  function removeDaily(id: number) { setDailyItems(prev => prev.filter(i => i.item_id !== id)) }
  function removeOverdue(id: number) { setOverdueItems(prev => prev.filter(i => i.item_id !== id)) }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return records
    return records.filter(r =>
      r.item_name.toLowerCase().includes(q) ||
      (r.cf_group ?? '').toLowerCase().includes(q) ||
      (r.counted_by ?? '').toLowerCase().includes(q) ||
      r.count_date.includes(q)
    )
  }, [records, search])

  function jumpTo(r: CountRecord) {
    setSelectedId(r.id)
    document.getElementById(`count-${r.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function startEdit(r: CountRecord) {
    setEditQty(String(r.quantity_counted))
    setEditNotes(r.notes ?? '')
    setEditingId(r.id)
  }

  async function saveEdit() {
    if (editingId == null) return
    setSaving(true)
    const res = await fetch(`/api/stock/counts/${editingId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity_counted: Number(editQty), notes: editNotes }),
    })
    setSaving(false)
    if (res.ok) {
      const updated: CountRecord = await res.json()
      setRecords(prev => prev.map(r => r.id === editingId ? { ...r, ...updated } : r))
      setEditingId(null)
    }
  }

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  return (
    <div className="-mx-4 -mt-4 flex flex-col h-[calc(100dvh-60px)] md:h-[calc(100dvh-56px)]">

      {/* Top bar */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-200 bg-white shrink-0">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${records.length}…`}
          className="w-20 flex-1 min-w-0 text-[10px] text-gray-900 placeholder-gray-300 bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400" />
        <div className="flex gap-1 overflow-x-auto shrink-0 max-w-[65%]">
          {TABS.map(t => {
            const cnt = t === 'Daily' ? dailyItems.length : t === '15-Day' ? overdueItems.length : 0
            return (
              <button key={t} onClick={() => setTab(t)}
                className={`shrink-0 text-[9px] font-semibold px-1.5 py-1 rounded transition whitespace-nowrap
                  ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {t}<Badge n={cnt} />
              </button>
            )
          })}
        </div>
      </div>

      {tab === 'List' && (
      <div className="flex flex-1 min-h-0">

        {/* LEFT: counts table */}
        <div className="w-1/2 border-r border-gray-200 overflow-y-auto min-h-0">
          <table className="w-full border-collapse text-[10px]">
            <thead className="sticky top-0 bg-gray-100 z-10">
              <tr>
                <th className="text-left px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">DATE</th>
                <th className="text-left px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">ITEM</th>
                <th className="text-right px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">QTY</th>
                <th className="text-right px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">BY</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} onClick={() => jumpTo(r)}
                  className={`cursor-pointer border-b border-gray-100 transition ${selectedId === r.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <td className="px-0.5 py-0.5 text-gray-700 whitespace-nowrap">{fmtShort(r.count_date)}</td>
                  <td className="px-0.5 py-0.5 text-gray-900 truncate max-w-[80px]">{r.item_name}</td>
                  <td className="px-0.5 py-0.5 text-right font-semibold text-gray-900">{Number(r.quantity_counted)}</td>
                  <td className="px-0.5 py-0.5 text-right text-blue-500">{r.counted_by ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* RIGHT: every record, stacked continuously */}
        <div className="w-1/2 overflow-y-auto min-h-0 bg-white">
          {filtered.length === 0 ? (
            <p className="text-[10px] text-gray-400 text-center py-10">No records found</p>
          ) : (
            filtered.map(r => (
              <div key={r.id} id={`count-${r.id}`}
                className={`border-b border-gray-200 transition ${selectedId === r.id ? 'bg-blue-50/40' : ''}`}>
                {editingId === r.id ? (
                  <div className="p-2 space-y-2">
                    <p className="text-[10px] font-bold text-gray-900 truncate">{r.item_name}</p>
                    <div>
                      <p className="text-[9px] text-gray-400 mb-0.5">Qty Counted</p>
                      <input type="number" min="0" step="any" value={editQty}
                        onChange={e => setEditQty(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-400 mb-0.5">Notes</p>
                      <input value={editNotes} onChange={e => setEditNotes(e.target.value)}
                        placeholder="Optional" className={inputCls} />
                    </div>
                    <div className="flex gap-1">
                      <button onClick={saveEdit} disabled={saving}
                        className="flex-1 bg-green-600 text-white text-[10px] font-bold rounded py-1 disabled:opacity-40">
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="px-3 py-1 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-2 space-y-2">
                    <div className="flex items-start justify-between sticky top-0 bg-white z-10">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold text-gray-900 leading-snug">{r.item_name}</p>
                        <p className="text-[9px] text-gray-400">{fmtShort(r.count_date)}</p>
                      </div>
                      <button onClick={() => startEdit(r)}
                        className="shrink-0 text-[9px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100">
                        Edit
                      </button>
                    </div>
                    <table className="w-full border-collapse text-[10px]">
                      <tbody>
                        <tr className="border-b border-gray-100">
                          <td className="py-0.5 text-gray-400">Group</td>
                          <td className="py-0.5 text-right text-gray-700">{r.cf_group ?? '—'}</td>
                        </tr>
                        <tr className="border-b border-gray-100">
                          <td className="py-0.5 text-gray-400">Qty Counted</td>
                          <td className="py-0.5 text-right font-bold text-gray-900">{Number(r.quantity_counted)}</td>
                        </tr>
                        <tr className="border-b border-gray-100">
                          <td className="py-0.5 text-gray-400">Counted By</td>
                          <td className="py-0.5 text-right text-blue-500">{r.counted_by ?? '—'}</td>
                        </tr>
                        <tr className="border-b border-gray-100">
                          <td className="py-0.5 text-gray-400">Source</td>
                          <td className="py-0.5 text-right text-gray-700">{r.source ?? '—'}</td>
                        </tr>
                        {r.notes && (
                          <tr>
                            <td className="py-0.5 text-gray-400">Notes</td>
                            <td className="py-0.5 text-right text-gray-700 italic">{r.notes}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
      )}

      {(tab === 'Daily' || tab === '15-Day') && (
        <div className="flex-1 overflow-y-auto min-h-0 py-2">
          {dailyLoading ? (
            <p className="py-10 text-center text-gray-400 text-[10px]">Loading…</p>
          ) : (() => {
            const countItems = tab === 'Daily' ? dailyItems : overdueItems
            return countItems.length === 0 ? (
              <p className="py-4 text-center text-gray-400 text-[10px]">
                {tab === 'Daily' ? 'All daily items counted!' : 'All items up to date!'}
              </p>
            ) : (
              <table className="w-full border-collapse text-[10px]">
                <thead className="sticky top-0 bg-gray-100 z-10">
                  <tr>
                    <th className="text-left px-1.5 py-1 font-semibold text-gray-500 border-b border-gray-200">Item</th>
                    <th className="text-center px-1 py-1 font-semibold text-gray-500 border-b border-gray-200">SOH</th>
                    <th className="px-1 py-1 font-semibold text-gray-500 border-b border-gray-200">Status</th>
                    <th className="px-1 py-1 font-semibold text-gray-500 border-b border-gray-200">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {countItems.map(item => (
                    <CountRow key={item.item_id} item={item} onSaved={tab === 'Daily' ? removeDaily : removeOverdue} />
                  ))}
                </tbody>
              </table>
            )
          })()}
        </div>
      )}
    </div>
  )
}

export default function CountsHistoryPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-gray-400 text-xs">Loading…</div>}>
      <CountsHistoryPageInner />
    </Suspense>
  )
}
