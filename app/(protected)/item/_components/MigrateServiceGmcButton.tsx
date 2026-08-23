'use client'
import { useState } from 'react'

interface MigrationResult {
  service_id: number
  service_name: string
  target_id: number
  target_name: string
  counts_transferred: number
  bills_transferred: number
  cost_price_transferred: number | null
  sales_transferred: number
}

export default function MigrateServiceGmcButton() {
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<MigrationResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function runMigration() {
    if (!confirm('Migrate all services using GMC?\n\nThis will transfer counts, bills, and sales from services to their target GMC items, then clear cost prices from the services.')) {
      return
    }
    
    setRunning(true)
    setError(null)
    setResults(null)
    
    try {
      const res = await fetch('/api/items/migrate-service-gmc-data', { method: 'POST' })
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.error || 'Migration failed')
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
        onClick={runMigration}
        disabled={running}
        className="text-[9px] font-semibold px-2 py-1 rounded bg-purple-100 text-purple-700 hover:bg-purple-200 disabled:opacity-50 transition"
      >
        {running ? 'Migrating…' : '↻ Migrate Service GMC Data'}
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
        <div className="bg-green-50 border border-green-200 rounded p-2 space-y-2">
          <p className="text-[9px] text-green-700 font-bold">✓ Migration Complete: {results.length} service{results.length !== 1 ? 's' : ''}</p>
          <div className="space-y-1 max-h-[300px] overflow-y-auto text-[8px]">
            {results.map((r, idx) => (
              <div key={idx} className="bg-white border border-green-100 rounded p-1.5 space-y-0.5">
                <p className="font-semibold text-gray-900">"{r.service_name}" → "{r.target_name}"</p>
                <div className="grid grid-cols-2 gap-1 text-gray-600">
                  <div>Counts: {r.counts_transferred}</div>
                  <div>Bills: {r.bills_transferred}</div>
                  <div>Sales: {r.sales_transferred}</div>
                  {r.cost_price_transferred != null && <div>Cost: ₵{r.cost_price_transferred}</div>}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => { setResults(null); setError(null) }}
            className="text-[8px] text-green-600 hover:text-green-700 font-semibold underline"
          >
            Run again
          </button>
        </div>
      )}

      {results && results.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded p-2">
          <p className="text-[9px] text-blue-700 font-semibold">No services using GMC found to migrate</p>
          <button
            onClick={() => { setResults(null); setError(null) }}
            className="text-[8px] text-blue-600 hover:text-blue-700 mt-1 underline"
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}
