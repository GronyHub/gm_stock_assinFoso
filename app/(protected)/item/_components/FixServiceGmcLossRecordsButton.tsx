'use client'
import { useState } from 'react'

interface TransferResult {
  service_id: number
  service_name: string
  target_id: number
  target_name: string
  loss_records_transferred: number
}

export default function FixServiceGmcLossRecordsButton() {
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<TransferResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function runTransfer() {
    if (!confirm('Transfer loss revision records from services using GMC to their target items?\n\nThis will move the audit trail of deletions from services to the actual inventory items.')) {
      return
    }

    setRunning(true)
    setError(null)
    setResults(null)

    try {
      const res = await fetch('/api/fix-service-gmc-loss-records', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Transfer failed')
        return
      }

      setResults(data.results || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setRunning(false)
    }
  }

  if (!results && !error) {
    return (
      <button
        onClick={runTransfer}
        disabled={running}
        className="text-[9px] font-semibold px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50 transition"
      >
        {running ? 'Transferring…' : '→ Fix Service Loss Records'}
      </button>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-2">
          <p className="text-[9px] text-red-700 font-semibold">Error: {error}</p>
          <button
            onClick={() => setError(null)}
            className="text-[8px] text-red-600 hover:text-red-700 mt-1 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {results && results.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded p-2 space-y-2">
          <p className="text-[9px] text-blue-700 font-bold">✓ Transfer Complete: {results.length} service{results.length !== 1 ? 's' : ''}</p>
          <div className="space-y-1 max-h-[300px] overflow-y-auto text-[8px]">
            {results.map((r, idx) => (
              <div key={idx} className="bg-white border border-blue-100 rounded p-1.5 space-y-0.5">
                <p className="font-semibold text-gray-900">"{r.service_name}" → "{r.target_name}"</p>
                <div className="text-gray-600">
                  <div>Loss records transferred: {r.loss_records_transferred}</div>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => { setResults(null); setError(null) }}
            className="text-[8px] text-blue-600 hover:text-blue-700 font-semibold underline"
          >
            Run again
          </button>
        </div>
      )}

      {results && results.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded p-2">
          <p className="text-[9px] text-green-700 font-semibold">No services with loss records found</p>
          <button
            onClick={() => { setResults(null); setError(null) }}
            className="text-[8px] text-green-600 hover:text-green-700 mt-1 underline"
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}
