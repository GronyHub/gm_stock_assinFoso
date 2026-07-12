'use client'
import { useState } from 'react'

const inputCls = 'w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 outline-none focus:ring-2 focus:ring-blue-400'

export default function UnlinkMismatchPage() {
  const [wrongItemName, setWrongItemName] = useState('4x6 packs')
  const [nameContains, setNameContains] = useState('passport')
  const [from, setFrom] = useState('2025-10-18')
  const [to, setTo] = useState('2026-03-17')
  const [rows, setRows] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function preview() {
    setLoading(true); setResult(null); setError('')
    try {
      const params = new URLSearchParams({ wrongItemName, nameContains, from, to })
      const res = await fetch(`/api/debug/unlink-mismatch?${params}`)
      const d = await res.json().catch(() => ({}))
      if (res.ok) setRows(Array.isArray(d.rows) ? d.rows : [])
      else setError(d.error || 'Could not load preview.')
    } catch {
      setError('Network error — could not reach the server.')
    }
    setLoading(false)
  }

  async function apply() {
    if (!rows || rows.length === 0) return
    setApplying(true); setError('')
    try {
      const res = await fetch('/api/debug/unlink-mismatch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wrongItemName, nameContains, from, to }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        setResult(`Unlinked ${d.unlinked} line${d.unlinked !== 1 ? 's' : ''}. They'll show up in Item hub → Errors → Unlinked, now under their real name, ready to link.`)
        setRows(null)
      } else {
        setError(d.error || 'Could not apply.')
      }
    } catch {
      setError('Network error — could not reach the server.')
    }
    setApplying(false)
  }

  return (
    <div className="py-4 max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-bold">Unlink Mismatched Sales</h1>
      <p className="text-sm text-gray-600">
        Finds sales lines currently linked to the wrong item (by name) whose original
        typed text suggests they actually belong to something else. Preview first,
        then unlink — they'll reappear in the Unlinked flag under their real name so
        you can relink them deliberately.
      </p>

      <div className="space-y-3">
        <div>
          <label className="text-sm text-gray-600 block mb-1.5">Currently (wrongly) linked to item named</label>
          <input value={wrongItemName} onChange={e => setWrongItemName(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="text-sm text-gray-600 block mb-1.5">Original text contains</label>
          <input value={nameContains} onChange={e => setNameContains(e.target.value)} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-600 block mb-1.5">From date</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1.5">To date</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className={inputCls} />
          </div>
        </div>
      </div>

      <button onClick={preview} disabled={loading || !wrongItemName || !nameContains}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold rounded-xl py-3 transition">
        {loading ? 'Loading…' : 'Preview'}
      </button>

      {error && <p className="text-sm text-red-500 font-medium text-center">{error}</p>}

      {rows && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-700">
            {rows.length} matching line{rows.length !== 1 ? 's' : ''}
          </p>
          {rows.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Nothing matches — nothing to unlink.</p>
          ) : (
            <>
              <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {rows.map((r: any) => (
                  <div key={r.line_id} className="px-3 py-2 text-xs">
                    <p className="font-semibold text-gray-900">{r.raw_item_name}</p>
                    <p className="text-gray-500">
                      {r.receipt_date} · {r.receipt_number} · {r.customer_name ?? 'Walk-in'} · qty {r.quantity} @ ₵{r.item_price}
                    </p>
                  </div>
                ))}
              </div>
              <button onClick={apply} disabled={applying}
                className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-semibold rounded-xl py-3 transition">
                {applying ? 'Unlinking…' : `Unlink These ${rows.length} Lines`}
              </button>
            </>
          )}
        </div>
      )}

      {result && <p className="text-sm text-green-700 font-medium text-center">{result}</p>}
    </div>
  )
}
