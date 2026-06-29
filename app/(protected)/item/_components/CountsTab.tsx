'use client'
import { useState, useEffect, useMemo } from 'react'
import { usePolling } from '@/lib/usePolling'

type Item = { id: number; item_name: string; cf_group: string | null }

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

type Props = {
  items: Item[]
  groupFilter: string | null
  search: string
  violation: string | null
}

export default function CountsTab({ items, groupFilter, search, violation }: Props) {
  const [records, setRecords] = useState<CountRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [editQty, setEditQty] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [dailyItems, setDailyItems] = useState<DailyItem[]>([])
  const [overdueItems, setOverdueItems] = useState<DailyItem[]>([])
  const [dailyLoading, setDailyLoading] = useState(true)

  function loadRecords() {
    fetch('/api/stock/counts').then(r => r.json()).then(d => { setRecords(d); setLoading(false) })
  }
  function loadDaily() {
    Promise.all([
      fetch('/api/stock/daily').then(r => r.json()),
      fetch('/api/stock/overdue').then(r => r.json()),
    ]).then(([daily, overdue]) => {
      setDailyItems(daily); setOverdueItems(overdue); setDailyLoading(false)
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

  // Daily/15-Day violation views
  if (violation === 'daily' || violation === '15day') {
    const countItems = violation === 'daily' ? filteredDaily : filteredOverdue
    const label = violation === 'daily' ? 'daily' : '15-day overdue'
    return (
      <div className="overflow-y-auto h-full py-2">
        {dailyLoading ? (
          <p className="py-10 text-center text-gray-400 text-[10px]">Loading…</p>
        ) : countItems.length === 0 ? (
          <p className="py-4 text-center text-gray-400 text-[10px]">
            {violation === 'daily' ? 'All daily items counted!' : 'All items up to date!'}
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
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto min-h-0">
        <table className="w-full border-collapse text-[10px]">
          <thead className="sticky top-0 bg-gray-100 z-10">
            <tr>
              <th className="text-left px-1 py-1 font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">DATE</th>
              <th className="text-left px-1 py-1 font-semibold text-gray-500 border-b border-gray-200">ITEM</th>
              <th className="text-left px-1 py-1 font-semibold text-gray-500 border-b border-gray-200">GROUP</th>
              <th className="text-center px-1 py-1 font-semibold text-gray-500 border-b border-gray-200">QTY</th>
              <th className="text-left px-1 py-1 font-semibold text-gray-500 border-b border-gray-200">BY</th>
              <th className="text-left px-1 py-1 font-semibold text-gray-500 border-b border-gray-200">SRC</th>
              <th className="text-left px-1 py-1 font-semibold text-gray-500 border-b border-gray-200">NOTES</th>
              <th className="px-1 py-1 border-b border-gray-200" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <>
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-1 py-1 text-gray-600 whitespace-nowrap">{fmtShort(r.count_date)}</td>
                  <td className="px-1 py-1 text-gray-900 font-semibold">{r.item_name}</td>
                  <td className="px-1 py-1 text-gray-500">{r.cf_group ?? '—'}</td>
                  <td className="px-1 py-1 text-center font-bold text-gray-900">{Number(r.quantity_counted)}</td>
                  <td className="px-1 py-1 text-blue-500">{r.counted_by ?? '—'}</td>
                  <td className="px-1 py-1 text-gray-500">{r.source ?? '—'}</td>
                  <td className="px-1 py-1 text-gray-500 italic">{r.notes ?? '—'}</td>
                  <td className="px-1 py-1">
                    <button onClick={() => editingId === r.id ? setEditingId(null) : startEdit(r)}
                      className="text-[9px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded hover:bg-blue-100 whitespace-nowrap">
                      {editingId === r.id ? 'Close' : 'Edit'}
                    </button>
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
