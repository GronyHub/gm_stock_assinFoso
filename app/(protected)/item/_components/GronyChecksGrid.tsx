'use client'
import { useState, useEffect } from 'react'
import ManageLogPanel from './ManageLogPanel'

const GRONY_SECTIONS = Array.from({ length: 10 }, (_, i) => i + 1)
const CHECK_TYPES = [
  { key: 'properties', label: 'Properties', icon: '🏠' },
  { key: 'cleanliness', label: 'Cleanliness', icon: '🧹' },
  { key: 'arrangement', label: 'Arrangement', icon: '📦' },
  { key: 'repair_works', label: 'Repair Works', icon: '🔧' },
  { key: 'customer_display', label: 'Customer Display', icon: '📊' },
  { key: 'security', label: 'Security', icon: '🔒' },
]

type CheckStatus = {
  [gronySection: number]: {
    [checkKey: string]: { hasEntry: boolean; lastDate?: string }
  }
}

export default function GronyChecksGrid() {
  const [status, setStatus] = useState<CheckStatus>({})
  const [loading, setLoading] = useState(true)
  const [selectedCell, setSelectedCell] = useState<{ grony: number; check: string } | null>(null)

  useEffect(() => {
    loadStatus()
  }, [])

  async function loadStatus() {
    try {
      const res = await fetch('/api/manage-logs?view=grony_checks')
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
      }
    } catch (e) {
      console.error('Failed to load grony checks status:', e)
    } finally {
      setLoading(false)
    }
  }

  function getCategoryForCheck(checkKey: string, gronySection: number): string {
    return `grony_${checkKey}_${gronySection}`
  }

  function hasCheck(gronySection: number, checkKey: string): boolean {
    return status[gronySection]?.[checkKey]?.hasEntry ?? false
  }

  function getLastDate(gronySection: number, checkKey: string): string | undefined {
    return status[gronySection]?.[checkKey]?.lastDate
  }

  if (selectedCell) {
    const { grony, check } = selectedCell
    const category = getCategoryForCheck(check, grony)
    const checkLabel = CHECK_TYPES.find(c => c.key === check)?.label || check
    return (
      <div className="flex flex-col gap-2 p-2">
        <button onClick={() => setSelectedCell(null)} className="text-sm text-blue-600 hover:text-blue-700 font-semibold">
          ← Back to Grid
        </button>
        <h2 className="text-lg font-bold">Grony {grony} — {checkLabel}</h2>
        <ManageLogPanel category={category} label={`${checkLabel} - Grony ${grony}`} icon={CHECK_TYPES.find(c => c.key === check)?.icon || ''} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4 overflow-auto">
      <h1 className="text-2xl font-bold">Grony Sections Checks</h1>

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200">
                <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-200">Section</th>
                {CHECK_TYPES.map(check => (
                  <th key={check.key} className="px-3 py-2 text-center font-semibold text-gray-700 border-r border-gray-200 whitespace-nowrap">
                    <div className="text-lg mb-1">{check.icon}</div>
                    <div>{check.label}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GRONY_SECTIONS.map(grony => (
                <tr key={grony} className="border-b border-gray-200">
                  <td className="px-3 py-2 font-semibold text-gray-900 bg-gray-50 border-r border-gray-200">
                    Grony {grony}
                  </td>
                  {CHECK_TYPES.map(check => {
                    const has = hasCheck(grony, check.key)
                    const lastDate = getLastDate(grony, check.key)
                    return (
                      <td
                        key={`${grony}-${check.key}`}
                        onClick={() => setSelectedCell({ grony, check: check.key })}
                        className={`px-3 py-2 text-center cursor-pointer transition border-r border-gray-200 ${
                          has
                            ? 'bg-green-50 hover:bg-green-100'
                            : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <div className={`font-bold text-lg ${has ? 'text-green-600' : 'text-gray-400'}`}>
                          {has ? '✓' : '○'}
                        </div>
                        {lastDate && (
                          <div className="text-[9px] text-gray-500 mt-0.5">{lastDate}</div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
