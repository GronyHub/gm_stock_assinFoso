'use client'
import { useState, useEffect } from 'react'

type Log = { id: number; staff_name: string; action: string; details: string | null; created_at: string }

const MONTHS = ['Ja','Fe','Mr','Ap','My','Ju','Jl','Au','Se','Oc','No','De']

function fmtTime(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(-2)} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

type Props = { keywords: string[]; onEntryClick?: (log: Log) => void }

export default function HistoryPanel({ keywords, onEntryClick }: Props) {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/logs')
      .then(r => r.json())
      .then((all: Log[]) => {
        const filtered = all.filter(l => keywords.some(k => l.action.toLowerCase().includes(k.toLowerCase())))
        setLogs(filtered)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>
  if (logs.length === 0) return <div className="py-20 text-center text-gray-400 text-xs">No history yet.</div>

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <table className="w-full border-collapse text-[10px] border border-black">
        <thead className="sticky top-0 bg-gray-100 z-10">
          <tr>
            <th className="text-left px-1 py-1 font-semibold text-gray-700 border border-black whitespace-nowrap">TIME</th>
            <th className="text-left px-1 py-1 font-semibold text-gray-700 border border-black">STAFF</th>
            <th className="text-left px-1 py-1 font-semibold text-gray-700 border border-black">ACTION</th>
            <th className="text-left px-1 py-1 font-semibold text-gray-700 border border-black">DETAILS</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id}
              onClick={() => onEntryClick?.(log)}
              className={`hover:bg-yellow-50 ${onEntryClick ? 'cursor-pointer' : ''}`}>
              <td className="px-1 py-1 text-gray-500 whitespace-nowrap border border-black">{fmtTime(log.created_at)}</td>
              <td className="px-1 py-1 font-semibold text-blue-600 border border-black">{log.staff_name}</td>
              <td className="px-1 py-1 text-gray-800 border border-black">{log.action}</td>
              <td className="px-1 py-1 text-gray-600 border border-black">{log.details ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
