'use client'
import { useState, useEffect, useMemo } from 'react'

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

const MONTHS = ['Ja','Fe','Mr','Ap','My','Ju','Jl','Au','Se','Oc','No','De']
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa']

function fmtShort(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(-2)}-${DAYS[d.getUTCDay()]}`
}

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded px-2 py-1 text-[10px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400'

export default function CountsHistoryPage() {
  const [records, setRecords] = useState<CountRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<CountRecord | null>(null)
  const [editQty, setEditQty] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)

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

  function selectRecord(r: CountRecord) {
    setSelected(r)
    setEditing(false)
  }

  function startEdit(r: CountRecord) {
    setEditQty(String(r.quantity_counted))
    setEditNotes(r.notes ?? '')
    setEditing(true)
  }

  async function saveEdit() {
    if (!selected) return
    setSaving(true)
    const res = await fetch(`/api/stock/counts/${selected.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity_counted: Number(editQty), notes: editNotes }),
    })
    setSaving(false)
    if (res.ok) {
      const updated: CountRecord = await res.json()
      setRecords(prev => prev.map(r => r.id === selected.id ? { ...r, ...updated } : r))
      setSelected(s => s ? { ...s, ...updated } : s)
      setEditing(false)
    }
  }

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  return (
    <div className="-mx-4 -mt-4 flex flex-col" style={{ height: 'calc(100dvh - 56px - 60px)' }}>

      {/* Top bar */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-200 bg-white shrink-0">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${records.length} count records…`}
          className="flex-1 text-[10px] text-gray-900 placeholder-gray-300 bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400" />
      </div>

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
                <tr key={r.id} onClick={() => selectRecord(r)}
                  className={`cursor-pointer border-b border-gray-100 transition ${selected?.id === r.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <td className="px-0.5 py-0.5 text-gray-700 whitespace-nowrap">{fmtShort(r.count_date)}</td>
                  <td className="px-0.5 py-0.5 text-gray-900 truncate max-w-[80px]">{r.item_name}</td>
                  <td className="px-0.5 py-0.5 text-right font-semibold text-gray-900">{Number(r.quantity_counted)}</td>
                  <td className="px-0.5 py-0.5 text-right text-blue-500">{r.counted_by ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* RIGHT: detail / edit */}
        <div className="w-1/2 overflow-y-auto min-h-0 bg-white">
          {!selected ? (
            <p className="text-[10px] text-gray-400 text-center py-10">Select a record</p>
          ) : editing ? (
            <div className="p-2 space-y-2">
              <p className="text-[10px] font-bold text-gray-900 truncate">{selected.item_name}</p>
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
                <button onClick={() => setEditing(false)}
                  className="px-3 py-1 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold text-gray-900 leading-snug">{selected.item_name}</p>
                  <p className="text-[9px] text-gray-400">{fmtShort(selected.count_date)}</p>
                </div>
                <button onClick={() => startEdit(selected)}
                  className="shrink-0 text-[9px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100">
                  Edit
                </button>
              </div>
              <table className="w-full border-collapse text-[10px]">
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-0.5 text-gray-400">Group</td>
                    <td className="py-0.5 text-right text-gray-700">{selected.cf_group ?? '—'}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-0.5 text-gray-400">Qty Counted</td>
                    <td className="py-0.5 text-right font-bold text-gray-900">{Number(selected.quantity_counted)}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-0.5 text-gray-400">Counted By</td>
                    <td className="py-0.5 text-right text-blue-500">{selected.counted_by ?? '—'}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-0.5 text-gray-400">Source</td>
                    <td className="py-0.5 text-right text-gray-700">{selected.source ?? '—'}</td>
                  </tr>
                  {selected.notes && (
                    <tr>
                      <td className="py-0.5 text-gray-400">Notes</td>
                      <td className="py-0.5 text-right text-gray-700 italic">{selected.notes}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
