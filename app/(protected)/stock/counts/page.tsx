'use client'
import { useState, useEffect, useMemo } from 'react'
import { fmtDate } from '@/lib/fmtDate'

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

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 text-base text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400'

export default function CountsHistoryPage() {
  const [records, setRecords] = useState<CountRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editQty, setEditQty] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/stock/counts').then(r => r.json()).then(d => { setRecords(d); setLoading(false) })
  }, [])

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

  function openEdit(r: CountRecord) {
    setEditId(r.id)
    setEditQty(String(r.quantity_counted))
    setEditNotes(r.notes ?? '')
  }

  async function saveEdit() {
    if (!editId) return
    setSaving(true)
    const res = await fetch(`/api/stock/counts/${editId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity_counted: Number(editQty), notes: editNotes }),
    })
    setSaving(false)
    if (res.ok) {
      const updated: CountRecord = await res.json()
      setRecords(prev => prev.map(r => r.id === editId ? { ...r, ...updated } : r))
      setEditId(null)
    }
  }

  // Group by date for display
  const grouped = useMemo(() => {
    const map: Record<string, CountRecord[]> = {}
    for (const r of filtered) {
      if (!map[r.count_date]) map[r.count_date] = []
      map[r.count_date].push(r)
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a))
  }, [filtered])

  if (loading) return <div className="py-20 text-center text-gray-400">Loading…</div>

  return (
    <div className="py-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Count History</h1>
        <p className="text-sm text-gray-400 mt-0.5">{records.length} count{records.length !== 1 ? 's' : ''} recorded</p>
      </div>

      <input type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search item, group, staff…"
        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400" />

      {grouped.length === 0 && (
        <p className="py-10 text-center text-gray-400 text-sm">No count records found.</p>
      )}

      {grouped.map(([date, items]) => (
        <div key={date} className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{fmtDate(date)}</p>
          {items.map(r => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
              {editId === r.id ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-900">{r.item_name}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Qty counted</label>
                      <input type="number" min="0" step="any" value={editQty}
                        onChange={e => setEditQty(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Notes</label>
                      <input value={editNotes} onChange={e => setEditNotes(e.target.value)}
                        placeholder="Optional" className={inputCls} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveEdit} disabled={saving}
                      className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2.5 transition">
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={() => setEditId(null)}
                      className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 leading-snug">{r.item_name}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      {r.cf_group && <p className="text-xs text-gray-400">{r.cf_group}</p>}
                      {r.counted_by && <p className="text-xs text-blue-500">{r.counted_by}</p>}
                      {r.notes && <p className="text-xs text-gray-400 italic">{r.notes}</p>}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-900">{Number(r.quantity_counted)}</span>
                    <button onClick={() => openEdit(r)}
                      className="text-xs text-blue-600 font-semibold px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 transition">
                      Edit
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
