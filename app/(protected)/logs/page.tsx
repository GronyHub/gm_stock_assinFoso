'use client'
import { useState, useEffect, useMemo } from 'react'
import { usePolling } from '@/lib/usePolling'

type LogEntry = {
  id: number
  staff_name: string
  action: string
  details: string | null
  created_at: string
}

function fmtTs(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('en-GH', {
    timeZone: 'Africa/Accra',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function actionColor(action: string) {
  if (action.startsWith('added')) return 'bg-green-100 text-green-700'
  if (action.startsWith('edited')) return 'bg-blue-100 text-blue-700'
  if (action.startsWith('deleted')) return 'bg-red-100 text-red-600'
  if (action.includes('time')) return 'bg-purple-100 text-purple-700'
  if (action.includes('stock') || action.includes('count')) return 'bg-orange-100 text-orange-700'
  return 'bg-gray-100 text-gray-600'
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)

  function load() {
    fetch('/api/logs')
      .then(r => r.json())
      .then(data => { setLogs(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  // Auto-refresh every 60s
  usePolling(load, 60_000, autoRefresh)

  const filtered = useMemo(() => {
    if (!search.trim()) return logs
    const q = search.toLowerCase()
    return logs.filter(l =>
      l.staff_name.toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q) ||
      (l.details ?? '').toLowerCase().includes(q)
    )
  }, [logs, search])

  // Group by date
  const grouped = useMemo(() => {
    const map: Record<string, LogEntry[]> = {}
    for (const l of filtered) {
      const day = new Date(l.created_at).toLocaleDateString('en-GH', {
        timeZone: 'Africa/Accra', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
      })
      if (!map[day]) map[day] = []
      map[day].push(l)
    }
    return Object.entries(map)
  }, [filtered])

  if (loading) return <div className="py-20 text-center text-gray-400">Loading…</div>

  return (
    <div className="py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Activity Logs</h1>
          <p className="text-sm text-gray-400 mt-0.5">{filtered.length} entries</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)}
              className="w-3.5 h-3.5 accent-blue-600" />
            Live
          </label>
          <button onClick={load}
            className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-200 font-medium">
            Refresh
          </button>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search staff, action, details…"
        className="w-full mb-4 bg-white border border-gray-200 rounded-xl px-4 py-3 text-base
          text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400"
      />

      {grouped.length === 0 && (
        <p className="text-center text-gray-400 py-16">No activity yet.</p>
      )}

      {/* Log entries grouped by day */}
      <div className="space-y-5">
        {grouped.map(([day, entries]) => (
          <div key={day}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{day}</p>
            <div className="space-y-1.5">
              {entries.map(entry => (
                <div key={entry.id}
                  className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 flex items-start gap-3">
                  {/* Timestamp */}
                  <div className="shrink-0 text-right min-w-[72px]">
                    <p className="text-[11px] text-gray-400 leading-tight">
                      {new Date(entry.created_at).toLocaleTimeString('en-GH', {
                        timeZone: 'Africa/Accra', hour: '2-digit', minute: '2-digit', hour12: true
                      })}
                    </p>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{entry.staff_name}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${actionColor(entry.action)}`}>
                        {entry.action}
                      </span>
                    </div>
                    {entry.details && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{entry.details}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
