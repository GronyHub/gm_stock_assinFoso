'use client'
import { useEffect, useState } from 'react'
import { fmtDate } from '@/lib/fmtDate'

type Report = {
  id: number
  work_date: string
  closer_name: string
  no_tshirt_staff: string
  advert_played: boolean
  property_issue: boolean
  speaker_brought_in: boolean
  new_customer: boolean
  new_customer_details: string | null
  unfortunate_event: boolean
  unfortunate_event_details: string | null
}

function YesNoBadge({ v, goodWhen }: { v: boolean; goodWhen: boolean }) {
  const good = v === goodWhen
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${good ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
      {v ? 'Yes' : 'No'}
    </span>
  )
}

// End-of-day closing reports submitted by the Closer at clock-out.
export default function ClosingReportsList() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/staff-times/closing-report')
      .then(r => r.json())
      .then(d => { setReports(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <p className="py-6 text-center text-gray-400 text-sm">Loading…</p>
  if (reports.length === 0) return <p className="py-6 text-center text-gray-400 text-sm">No closing reports yet.</p>

  return (
    <div className="space-y-2">
      {reports.map(r => (
        <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900">{fmtDate(r.work_date)}</p>
            <p className="text-xs text-gray-500">🌙 Closer: <span className="font-semibold capitalize">{r.closer_name}</span></p>
          </div>
          <div className="space-y-1 text-xs text-gray-700">
            <div className="flex items-center justify-between gap-2">
              <span>No company T-shirt</span>
              <span className={`font-semibold capitalize ${r.no_tshirt_staff ? 'text-red-600' : 'text-green-700'}`}>
                {r.no_tshirt_staff || 'None'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Roadside advert played</span>
              <YesNoBadge v={r.advert_played} goodWhen={true} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Spoilt / lost property</span>
              <YesNoBadge v={r.property_issue} goodWhen={false} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Speaker &amp; wires brought in</span>
              <YesNoBadge v={r.speaker_brought_in} goodWhen={true} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>New customer of interest</span>
              <YesNoBadge v={r.new_customer} goodWhen={true} />
            </div>
            {r.new_customer && r.new_customer_details && (
              <p className="bg-blue-50 rounded-lg px-2.5 py-1.5 text-blue-900">{r.new_customer_details}</p>
            )}
            <div className="flex items-center justify-between gap-2">
              <span>Unfortunate event</span>
              <YesNoBadge v={r.unfortunate_event} goodWhen={false} />
            </div>
            {r.unfortunate_event && r.unfortunate_event_details && (
              <p className="bg-red-50 rounded-lg px-2.5 py-1.5 text-red-900">{r.unfortunate_event_details}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
