'use client'
import { useState, useEffect } from 'react'
import { usePolling } from '@/lib/usePolling'
import { fmtDate } from '@/lib/fmtDate'

type ClosingReport = {
  id: number
  work_date: string
  closer_name: string
  no_tshirt_staff: string
  advert_played: boolean
  created_at: string
}

// Advert and Staff (dress code) don't need a separate log -- they're already
// answered every day in the Closer's end-of-day questionnaire
// (closing_reports). This just surfaces that same history filtered to one
// field, so Grony Manage doesn't end up with a second, conflicting record of
// the same thing.
export default function ClosingReportLogView({ field, label, icon }: {
  field: 'advert_played' | 'no_tshirt_staff'
  label: string
  icon: string
}) {
  const [reports, setReports] = useState<ClosingReport[] | null>(null)

  function load() {
    fetch('/api/staff-times/closing-report')
      .then(r => r.ok ? r.json() : [])
      .then(d => setReports(Array.isArray(d) ? d : []))
      .catch(() => setReports([]))
  }

  useEffect(() => { load() }, [])
  usePolling(load, 30000)

  return (
    <div className="py-2 px-2 space-y-2">
      <div className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{icon} {label}</p>
        <p className="text-[10px] text-gray-400 mt-0.5">
          Answered daily in the Closer&apos;s end-of-day questionnaire when clocking out -- shown here as history, not entered separately.
        </p>
      </div>

      {reports === null ? (
        <p className="text-[11px] text-gray-400 text-center py-6">Loading…</p>
      ) : reports.length === 0 ? (
        <p className="text-[11px] text-gray-400 text-center py-6">No closing reports yet.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-50">
          {reports.map(r => {
            const noTshirt = r.no_tshirt_staff?.split(',').map(s => s.trim()).filter(Boolean) ?? []
            return (
              <div key={r.id} className="px-2.5 py-1.5">
                <p className="text-[9px] text-gray-400">{fmtDate(r.work_date)} · Closer: <span className="capitalize">{r.closer_name}</span></p>
                {field === 'advert_played' ? (
                  <p className="text-[11px] text-gray-800">
                    Roadside advert played: <span className={r.advert_played ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
                      {r.advert_played ? 'Yes' : 'No'}
                    </span>
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-800">
                    No company T-shirt: {noTshirt.length
                      ? <span className="text-red-500 font-semibold">{noTshirt.join(', ')}</span>
                      : <span className="text-green-600 font-semibold">None</span>}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
