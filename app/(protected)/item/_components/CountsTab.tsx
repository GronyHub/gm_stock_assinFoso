'use client'
import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { usePolling } from '@/lib/usePolling'
import { isOwnerLevel } from '@/lib/roles'
import HistoryPanel from './HistoryPanel'

type Item = { id: number; item_name: string; cf_group: string | null; product_type?: string | null }

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
    else alert((await res.json().catch(() => null))?.error ?? 'Could not save count.')
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

// Ad-hoc count of ANY item, any time -- not just the ones due today. Same-day
// counts replace rather than duplicate (see /api/stock/count).
function ManualCountForm({ items, onSaved, onClose }: { items: Item[]; onSaved: () => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<Item | null>(null)
  const [qty, setQty] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return []
    return items
      // Services are not physical stock and can never be counted.
      .filter(i => i.product_type !== 'service' && !/^service/i.test(i.cf_group ?? '') && !/^service/i.test(i.item_name))
      .filter(i => i.item_name.toLowerCase().includes(t) || (i.cf_group ?? '').toLowerCase().includes(t))
      .slice(0, 25)
  }, [q, items])

  async function save() {
    if (!sel || qty === '') return
    setSaving(true); setError('')
    const res = await fetch('/api/stock/count', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: sel.id, qty: Number(qty), notes: notes.trim() || 'Manual count' }),
    })
    setSaving(false)
    if (res.ok) { onSaved(); onClose() }
    else setError((await res.json().catch(() => null))?.error ?? 'Could not save count.')
  }

  return (
    <div className="bg-blue-50 border-b border-blue-200 px-2 py-2 space-y-1.5 shrink-0">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-blue-700">Manual Count — any item, today&apos;s date</p>
        <button onClick={onClose} className="text-blue-300 hover:text-blue-500 font-bold leading-none">×</button>
      </div>
      {!sel ? (
        <>
          <input value={q} onChange={e => setQ(e.target.value)} autoFocus
            placeholder="Search item to count…" className={inputCls} />
          {matches.length > 0 && (
            <div className="bg-white border border-gray-200 rounded max-h-40 overflow-y-auto divide-y divide-gray-100">
              {matches.map(i => (
                <button key={i.id} onClick={() => setSel(i)}
                  className="w-full text-left px-2 py-1.5 hover:bg-blue-50 transition">
                  <span className="text-[10px] font-semibold text-gray-900">{i.item_name}</span>
                  {i.cf_group && <span className="text-[9px] text-gray-400"> · {i.cf_group}</span>}
                </button>
              ))}
            </div>
          )}
          {q.trim() && matches.length === 0 && <p className="text-[9px] text-gray-400">No items match.</p>}
        </>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between bg-white border border-gray-200 rounded px-2 py-1.5">
            <span className="text-[10px] font-semibold text-gray-900">{sel.item_name}</span>
            <button onClick={() => { setSel(null); setQty('') }} className="text-[9px] text-blue-600 font-semibold">change</button>
          </div>
          <div className="flex gap-1.5">
            <input type="number" min="0" step="any" value={qty} onChange={e => setQty(e.target.value)}
              placeholder="Qty counted" inputMode="decimal" autoFocus className={inputCls + ' w-24'} />
            <input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Notes (optional)" className={inputCls + ' flex-1'} />
            <button onClick={save} disabled={qty === '' || saving}
              className="shrink-0 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white text-[10px] font-semibold rounded px-3 py-1 transition">
              {saving ? '…' : 'Save'}
            </button>
          </div>
          {error && <p className="text-[9px] text-red-500">{error}</p>}
        </div>
      )}
    </div>
  )
}

type Props = {
  items: Item[]
  groupFilter: string | null
  search: string
  violation: string | null
}

export default function CountsTab({ items, groupFilter, search, violation }: Props) {
  const { data: session } = useSession()
  const canDelete = isOwnerLevel(session?.user as any)
  const [records, setRecords] = useState<CountRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [highlightId, setHighlightId] = useState<number | null>(null)
  const [editQty, setEditQty] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [dailyItems, setDailyItems] = useState<DailyItem[]>([])
  const [gmcWeeklyItems, setGmcWeeklyItems] = useState<DailyItem[]>([])
  const [overdueItems, setOverdueItems] = useState<DailyItem[]>([])
  const [dailyLoading, setDailyLoading] = useState(true)
  const [showManual, setShowManual] = useState(false)

  function loadRecords() {
    fetch('/api/stock/counts').then(r => r.json()).then(d => { setRecords(d); setLoading(false) })
  }
  function loadDaily() {
    Promise.all([
      fetch('/api/stock/daily').then(r => r.json()),
      fetch('/api/stock/gmc-weekly').then(r => r.json()),
      fetch('/api/stock/overdue').then(r => r.json()),
    ]).then(([daily, gmcWeekly, overdue]) => {
      setDailyItems(daily); setGmcWeeklyItems(gmcWeekly); setOverdueItems(overdue); setDailyLoading(false)
    })
  }

  useEffect(() => { loadRecords() }, [])
  useEffect(() => { loadDaily() }, [])
  usePolling(loadRecords, 5000, editingId === null)
  usePolling(loadDaily, 5000, editingId === null)

  const groupItemNames = useMemo(() => {
    if (!groupFilter || groupFilter === 'All') return null
    return new Set(items.filter(i => (i.cf_group ?? 'Ungrouped') === groupFilter).map(i => i.item_name))
  }, [items, groupFilter])

  const filtered = useMemo(() => {
    let list = records
    if (groupItemNames) list = list.filter(r => groupItemNames.has(r.item_name))
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        r.item_name.toLowerCase().includes(q) ||
        (r.cf_group ?? '').toLowerCase().includes(q) ||
        (r.counted_by ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [records, groupItemNames, search])

  const filteredDaily = useMemo(() => {
    let list = dailyItems
    if (groupItemNames) list = list.filter(i => groupItemNames.has(i.item_name))
    if (search) list = list.filter(i => i.item_name.toLowerCase().includes(search.toLowerCase()))
    return list
  }, [dailyItems, groupItemNames, search])

  const filteredOverdue = useMemo(() => {
    let list = overdueItems
    if (groupItemNames) list = list.filter(i => groupItemNames.has(i.item_name))
    if (search) list = list.filter(i => i.item_name.toLowerCase().includes(search.toLowerCase()))
    return list
  }, [overdueItems, groupItemNames, search])

  const filteredGmcWeekly = useMemo(() => {
    let list = gmcWeeklyItems
    if (groupItemNames) list = list.filter(i => groupItemNames.has(i.item_name))
    if (search) list = list.filter(i => i.item_name.toLowerCase().includes(search.toLowerCase()))
    return list
  }, [gmcWeeklyItems, groupItemNames, search])

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
    } else {
      alert((await res.json().catch(() => null))?.error ?? 'Could not save count.')
    }
  }

  async function deleteCount(r: CountRecord) {
    if (!confirm(`Delete the count of ${Number(r.quantity_counted)} for "${r.item_name}" on ${fmtShort(r.count_date)}? This changes the loss/gain math from that day onward.`)) return
    const res = await fetch(`/api/stock/counts/${r.id}`, { method: 'DELETE' })
    if (res.ok) {
      setRecords(prev => prev.filter(x => x.id !== r.id))
      if (editingId === r.id) setEditingId(null)
    } else {
      alert((await res.json().catch(() => null))?.error ?? 'Could not delete count.')
    }
  }

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  // Daily/15-Day violation views
  if (violation === 'daily' || violation === '7day' || violation === '15day') {
    const countItems = violation === 'daily' ? filteredDaily : violation === '7day' ? filteredGmcWeekly : filteredOverdue
    const label = violation === 'daily' ? 'daily' : violation === '7day' ? '7-day GMC' : '15-day overdue'
    return (
      <div className="overflow-y-auto h-full py-2">
        <div className="flex justify-end px-2 pb-1">
          <button onClick={() => setShowManual(v => !v)}
            className="text-[9px] font-semibold px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-500 transition">
            {showManual ? '× Close' : '+ Manual Count'}
          </button>
        </div>
        {showManual && (
          <ManualCountForm items={items} onClose={() => setShowManual(false)}
            onSaved={() => { loadRecords(); loadDaily() }} />
        )}
        {dailyLoading ? (
          <p className="py-10 text-center text-gray-400 text-[10px]">Loading…</p>
        ) : countItems.length === 0 ? (
          <p className="py-4 text-center text-gray-400 text-[10px]">
            {violation === 'daily' ? 'All daily items counted!'
              : violation === '7day' ? 'All GMC items counted within 7 days!'
              : 'All items up to date!'}
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
                <CountRow key={item.item_id} item={item}
                  onSaved={id => {
                    if (violation === 'daily') setDailyItems(prev => prev.filter(i => i.item_id !== id))
                    else if (violation === '7day') setGmcWeeklyItems(prev => prev.filter(i => i.item_id !== id))
                    else setOverdueItems(prev => prev.filter(i => i.item_id !== id))
                  }} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    )
  }

  // List view
  if (showHistory) return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1.5 px-2 py-1 border-b border-gray-200 bg-gray-50 shrink-0">
        <button onClick={() => setShowHistory(false)}
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-purple-600 text-white transition">
          ← Back
        </button>
        <span className="text-[9px] font-semibold text-purple-700">Counts History</span>
      </div>
      <HistoryPanel keywords={['stock', 'count']} onEntryClick={log => {
        // "counted stock": "ItemName · qty 5"
        // "edited stock count": "ItemName · qty 5 on 2024-01-15"
        const itemMatch = log.details?.match(/^(.+?) ·/)
        const dateMatch = log.details?.match(/on (\d{4}-\d{2}-\d{2})/)
        const itemName = itemMatch?.[1]
        const date = dateMatch?.[1]
        const target = records.find(r =>
          r.item_name === itemName && (date ? r.count_date.startsWith(date) : true)
        )
        setShowHistory(false)
        if (target) {
          setHighlightId(target.id)
          setTimeout(() => {
            document.getElementById(`count-${target.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }, 50)
        }
      }} />
    </div>
  )

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-end gap-1.5 px-2 py-1 border-b border-gray-100 bg-gray-50 shrink-0">
        <button onClick={() => setShowManual(v => !v)}
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-500 transition">
          {showManual ? '× Close' : '+ Manual Count'}
        </button>
        <button onClick={() => setShowHistory(true)}
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-700 transition">
          History
        </button>
      </div>
      {showManual && (
        <ManualCountForm items={items} onClose={() => setShowManual(false)}
          onSaved={() => { loadRecords(); loadDaily() }} />
      )}
      <div className="flex-1 overflow-y-auto min-h-0">
        <table className="w-full border-collapse text-[10px] border border-black">
          <thead className="sticky top-0 bg-gray-100 z-10">
            <tr>
              <th className="text-left px-1 py-1 font-semibold text-gray-700 border border-black whitespace-nowrap">DATE</th>
              <th className="text-left px-1 py-1 font-semibold text-gray-700 border border-black">ITEM</th>
              <th className="text-left px-1 py-1 font-semibold text-gray-700 border border-black">GROUP</th>
              <th className="text-center px-1 py-1 font-semibold text-gray-700 border border-black">QTY</th>
              <th className="text-left px-1 py-1 font-semibold text-gray-700 border border-black">BY</th>
              <th className="text-left px-1 py-1 font-semibold text-gray-700 border border-black">SRC</th>
              <th className="text-left px-1 py-1 font-semibold text-gray-700 border border-black">NOTES</th>
              <th className="px-1 py-1 border border-black" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <>
                <tr key={r.id} id={`count-${r.id}`}
                  className={`hover:bg-gray-50 transition-colors ${highlightId === r.id ? 'bg-yellow-100' : ''}`}>
                  <td className="px-1 py-1 text-gray-600 whitespace-nowrap border border-black">{fmtShort(r.count_date)}</td>
                  <td className="px-1 py-1 text-gray-900 font-semibold border border-black">{r.item_name}</td>
                  <td className="px-1 py-1 text-gray-500 border border-black">{r.cf_group ?? '—'}</td>
                  <td className="px-1 py-1 text-center font-bold text-gray-900 border border-black">{Number(r.quantity_counted)}</td>
                  <td className="px-1 py-1 text-blue-500 border border-black">{r.counted_by ?? '—'}</td>
                  <td className="px-1 py-1 text-gray-500 border border-black">{r.source ?? '—'}</td>
                  <td className="px-1 py-1 text-gray-500 italic border border-black">{r.notes ?? '—'}</td>
                  <td className="px-1 py-1 border border-black">
                    <div className="flex gap-0.5 justify-end whitespace-nowrap">
                      <button onClick={() => editingId === r.id ? setEditingId(null) : startEdit(r)}
                        className="text-[9px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded hover:bg-blue-100">
                        {editingId === r.id ? 'Close' : 'Edit'}
                      </button>
                      {canDelete && (
                        <button onClick={() => deleteCount(r)}
                          className="text-[9px] text-red-500 font-semibold bg-red-50 px-1.5 py-0.5 rounded hover:bg-red-100">
                          Del
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {editingId === r.id && (
                  <tr key={`edit-${r.id}`} className="bg-blue-50/40 border-b border-blue-200">
                    <td colSpan={8} className="px-2 py-2">
                      <div className="flex items-end gap-2 flex-wrap">
                        <div>
                          <p className="text-[9px] text-gray-400 mb-0.5">Qty Counted</p>
                          <input type="number" min="0" step="any" value={editQty}
                            onChange={e => setEditQty(e.target.value)} className={inputCls + ' w-24'} />
                        </div>
                        <div>
                          <p className="text-[9px] text-gray-400 mb-0.5">Notes</p>
                          <input value={editNotes} onChange={e => setEditNotes(e.target.value)}
                            placeholder="Optional" className={inputCls + ' w-40'} />
                        </div>
                        <div className="flex gap-1">
                          <button onClick={saveEdit} disabled={saving}
                            className="bg-green-600 text-white text-[10px] font-bold rounded px-3 py-1 disabled:opacity-40">
                            {saving ? 'Saving…' : 'Save'}
                          </button>
                          <button onClick={() => setEditingId(null)}
                            className="px-3 py-1 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded">Cancel</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-[10px] text-gray-400 text-center py-10">No records</p>}
      </div>
    </div>
  )
}
