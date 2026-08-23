'use client'
import { useState } from 'react'

interface ConstraintResult {
  constraint?: string
  trigger?: string
  function?: string
  status: string
  error?: string
}

export default function AddServiceGmcConstraintsButton() {
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<ConstraintResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function addConstraints() {
    if (!confirm('Add database constraints to enforce service GMC data integrity?\n\nThis will prevent:\n- Cost prices on services\n- Stock counts on services\n- Bills on services\n- Sales on services\n\nViolations will be rejected at the database level.')) {
      return
    }

    setRunning(true)
    setError(null)
    setResults(null)

    try {
      const res = await fetch('/api/add-service-gmc-constraints', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to add constraints')
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
        onClick={addConstraints}
        disabled={running}
        className="text-[9px] font-semibold px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 transition"
      >
        {running ? 'Adding…' : '🔒 Add Service GMC Constraints'}
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

      {results && (
        <div className="bg-green-50 border border-green-200 rounded p-2 space-y-2">
          <p className="text-[9px] text-green-700 font-bold">✓ Constraints Applied</p>
          <div className="space-y-1 max-h-[400px] overflow-y-auto text-[8px]">
            {results.map((r, idx) => (
              <div key={idx} className="bg-white border border-green-100 rounded p-1.5">
                <p className="font-semibold text-gray-900">
                  {r.constraint || r.trigger || r.function}
                </p>
                <p className="text-gray-600">Status: {r.status}</p>
                {r.error && <p className="text-red-600 text-[7px]">Error: {r.error}</p>}
              </div>
            ))}
          </div>
          <div className="text-[8px] text-green-700 bg-green-100 rounded p-1.5">
            <p className="font-semibold">Database is now protected:</p>
            <ul className="list-disc list-inside space-y-0.5 mt-1">
              <li>Services cannot have cost prices</li>
              <li>Services cannot receive stock counts</li>
              <li>Services cannot receive bills</li>
              <li>Services cannot receive sales</li>
            </ul>
          </div>
          <button
            onClick={() => { setResults(null); setError(null) }}
            className="text-[8px] text-green-600 hover:text-green-700 font-semibold underline"
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}
