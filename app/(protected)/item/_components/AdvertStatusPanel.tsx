'use client'
import { useState, useEffect, useMemo } from 'react'
import { usePolling } from '@/lib/usePolling'
import { fmtDate } from '@/lib/fmtDate'

type StatusRow = {
  item_id: number
  item_name: string
  cf_group: string | null
  product_type: string
  has_advert: boolean
  notes: string | null
  updated_by: string | null
  updated_at: string | null
}

// Grony Manage > Advert > Audio Status -- "any service or item at the shop
// should have its advert recorded." Every active item/service starts as
// missing; mark it recorded once its audio advert exists.
export default function AdvertStatusPanel() {
  const [rows, setRows] = useState<StatusRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showRecorded, setShowRecorded] = useState(false)
  const [savingId, setSavingId] = useState<number | null>(null)

  function load() {
    fetch('/api/advert-status')
      .then(r => r.ok ? r.json() : [])
      .then(d => { setRows(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])
  usePolling(load, 20000, savingId === null)

  async function setStatus(item_id: number, has_advert: boolean) {
    setSavingId(item_id)
    const res = await fetch('/api/advert-status', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id, has_advert }),
    })
    setSavingId(null)
    if (res.ok) {
      setRows(prev => prev.map(r => r.item_id === item_id ? { ...r, has_advert } : r))
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = rows
    if (q) list = list.filter(r => r.item_name.toLowerCase().includes(q) || (r.cf_group ?? '').toLowerCase().includes(q))
    return list
  }, [rows, search])

  const missing = filtered.filter(r => !r.has_advert)
  const recorded = filtered.filter(r => r.has_advert)

  if (loading) return <p className="text-[11px] text-gray-400 text-center py-6">Loading…</p>

  return (
    <div className="py-2 px-2 space-y-2">
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search item or service…"
        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-400" />

      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">
          🚩 Missing Advert {missing.length > 0 && <span className="text-red-500">({missing.length})</span>}
        </p>
        {missing.length === 0 ? (
          <p className="text-[11px] text-gray-400 py-2">Every item and service has an audio advert recorded ✓</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-50">
            {missing.map(r => (
              <div key={r.item_id} className="px-2.5 py-1.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-gray-900 truncate">{r.item_name}</p>
                  <p className="text-[9px] text-gray-400">{r.cf_group ?? 'Ungrouped'} · <span className="capitalize">{r.product_type}</span></p>
                </div>
                <button onClick={() => setStatus(r.item_id, true)} disabled={savingId === r.item_id}
                  className="shrink-0 text-[10px] font-semibold px-2 py-1 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white transition">
                  {savingId === r.item_id ? '…' : 'Mark Recorded'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={() => setShowRecorded(v => !v)}
        className="text-[10px] font-semibold text-blue-600">
        {showRecorded ? '▴ Hide' : '▾ Show'} recorded ({recorded.length})
      </button>

      {showRecorded && (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-50">
          {recorded.map(r => (
            <div key={r.item_id} className="px-2.5 py-1.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-gray-900 truncate">{r.item_name}</p>
                <p className="text-[9px] text-gray-400">
                  {r.cf_group ?? 'Ungrouped'} · <span className="capitalize">{r.product_type}</span>
                  {r.updated_by && r.updated_at && <> · <span className="capitalize">{r.updated_by}</span>, {fmtDate(r.updated_at)}</>}
                </p>
              </div>
              <button onClick={() => setStatus(r.item_id, false)} disabled={savingId === r.item_id}
                className="shrink-0 text-[10px] font-semibold px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-600 transition">
                {savingId === r.item_id ? '…' : 'Mark Missing'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
