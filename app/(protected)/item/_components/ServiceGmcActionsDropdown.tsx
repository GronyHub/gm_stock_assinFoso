'use client'
import { useState } from 'react'

interface ActionResult {
  success: boolean
  message: string
  results?: any[]
  services?: any[]
}

type ActionType = 'migrate' | 'fix-losses' | 'add-constraints' | 'clear-costs' | null

export default function ServiceGmcActionsDropdown() {
  const [open, setOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<ActionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentAction, setCurrentAction] = useState<ActionType>(null)

  async function runAction(action: ActionType) {
    if (!action) return

    let endpoint = ''
    let confirmMsg = ''

    switch (action) {
      case 'migrate':
        endpoint = '/api/items/migrate-service-gmc-data'
        confirmMsg = 'Migrate all services using GMC?\n\nThis will transfer counts, bills, and sales from services to their target GMC items, then clear cost prices from the services.'
        break
      case 'fix-losses':
        endpoint = '/api/fix-service-gmc-loss-records'
        confirmMsg = 'Transfer loss revision records from services using GMC to their target items?\n\nThis will move the audit trail of deletions from services to the actual inventory items.'
        break
      case 'add-constraints':
        endpoint = '/api/add-service-gmc-constraints'
        confirmMsg = 'Add database constraints to enforce service GMC data integrity?\n\nThis will prevent:\n- Cost prices on services\n- Stock counts on services\n- Bills on services\n- Sales on services'
        break
      case 'clear-costs':
        endpoint = '/api/clear-service-gmc-costs'
        confirmMsg = 'Clear cost prices from services using GMC?\n\nCost pricing information should only exist on the target GMC items, not on the services themselves.'
        break
    }

    if (!confirm(confirmMsg)) return

    setRunning(true)
    setError(null)
    setResults(null)
    setCurrentAction(action)

    try {
      const res = await fetch(endpoint, { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Operation failed')
        return
      }

      setResults(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setRunning(false)
    }
  }

  const getActionLabel = () => {
    switch (currentAction) {
      case 'migrate':
        return 'Migrate Service GMC Data'
      case 'fix-losses':
        return 'Fix Service Loss Records'
      case 'add-constraints':
        return 'Add Service GMC Constraints'
      case 'clear-costs':
        return 'Clear Service Cost Prices'
      default:
        return 'Service GMC'
    }
  }

  if (results || error) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-3 max-w-sm">
        <p className="text-[9px] font-bold text-gray-900">{getActionLabel()}</p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-2">
            <p className="text-[9px] text-red-700 font-semibold">Error: {error}</p>
            <button
              onClick={() => { setError(null); setCurrentAction(null); setOpen(false) }}
              className="text-[8px] text-red-600 hover:text-red-700 mt-1 underline"
            >
              Close
            </button>
          </div>
        )}

        {results && (
          <div className={`border rounded p-2 space-y-2 ${currentAction === 'add-constraints' || currentAction === 'clear-costs' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
            <p className={`text-[9px] font-bold ${currentAction === 'add-constraints' || currentAction === 'clear-costs' ? 'text-green-700' : 'text-blue-700'}`}>
              ✓ {results.message}
            </p>
            {(results.results || results.services) && (results.results?.length ?? results.services?.length ?? 0) > 0 && (
              <div className="space-y-1 max-h-[300px] overflow-y-auto text-[8px]">
                {(results.results || results.services || []).map((r: any, idx: number) => (
                  <div key={idx} className="bg-white border rounded p-1.5 text-gray-700">
                    {r.service_name && (
                      <>
                        <p className="font-semibold">"{r.service_name}" → "{r.target_name}"</p>
                        <p>
                          {r.counts_transferred !== undefined && `Counts: ${r.counts_transferred}, `}
                          {r.bills_transferred !== undefined && `Bills: ${r.bills_transferred}, `}
                          {r.sales_transferred !== undefined && `Sales: ${r.sales_transferred}`}
                          {r.loss_records_transferred !== undefined && `Loss records: ${r.loss_records_transferred}`}
                        </p>
                      </>
                    )}
                    {r.constraint && (
                      <>
                        <p className="font-semibold">{r.constraint}</p>
                        <p>Status: {r.status}</p>
                      </>
                    )}
                    {r.name && r.cost_price_cleared !== undefined && (
                      <>
                        <p className="font-semibold">"{r.name}"</p>
                        <p>Cost price cleared: ₵{r.cost_price_cleared || 0}</p>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => { setResults(null); setError(null); setCurrentAction(null); setOpen(false) }}
              className={`text-[8px] font-semibold underline ${currentAction === 'add-constraints' || currentAction === 'clear-costs' ? 'text-green-600 hover:text-green-700' : 'text-blue-600 hover:text-blue-700'}`}
            >
              Done
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={running}
        className="text-[9px] font-semibold px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition border border-gray-300"
      >
        ⚙️ Service GMC
      </button>

      {open && !running && (
        <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-50 min-w-[200px]">
          <button
            onClick={() => runAction('migrate')}
            className="w-full text-left text-[9px] px-3 py-2 hover:bg-blue-50 border-b border-gray-100 transition"
          >
            <p className="font-semibold text-blue-700">↻ Migrate Data</p>
            <p className="text-[8px] text-gray-600">Transfer counts, bills, sales to target items</p>
          </button>
          <button
            onClick={() => runAction('fix-losses')}
            className="w-full text-left text-[9px] px-3 py-2 hover:bg-blue-50 border-b border-gray-100 transition"
          >
            <p className="font-semibold text-blue-700">→ Fix Loss Records</p>
            <p className="text-[8px] text-gray-600">Transfer audit trail to target items</p>
          </button>
          <button
            onClick={() => runAction('add-constraints')}
            className="w-full text-left text-[9px] px-3 py-2 hover:bg-red-50 border-b border-gray-100 transition"
          >
            <p className="font-semibold text-red-700">🔒 Add Constraints</p>
            <p className="text-[8px] text-gray-600">Enforce data integrity at database level</p>
          </button>
          <button
            onClick={() => runAction('clear-costs')}
            className="w-full text-left text-[9px] px-3 py-2 hover:bg-green-50 transition"
          >
            <p className="font-semibold text-green-700">💰 Clear Cost Prices</p>
            <p className="text-[8px] text-gray-600">Remove cost prices from services using GMC</p>
          </button>
        </div>
      )}
    </div>
  )
}
