'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { usePolling } from '@/lib/usePolling'

type PresenceRow = { staff_name: string; activity: string; updated_at: string }

export default function LivePresence() {
  const { data: session, status } = useSession()
  const username = ((session?.user as any)?.username ?? session?.user?.name ?? '').toLowerCase()
  const [rows, setRows] = useState<PresenceRow[]>([])

  function poll() {
    fetch('/api/presence')
      .then(r => r.ok ? r.json() : [])
      .then((d: PresenceRow[]) => {
        setRows(Array.isArray(d) ? d.filter(r => (r.staff_name ?? '').toLowerCase() !== username) : [])
      })
      .catch(() => {})
  }

  useEffect(() => { if (status === 'authenticated') poll() }, [status, username])
  // Mounted app-wide in the root layout -- unlike every other poll in the
  // app, this one has no page to scope it to, so it was running full-speed
  // on every open tab all day with no tab-visibility pause.
  usePolling(poll, 30000, status === 'authenticated')

  if (!rows.length) return null

  return (
    <div className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-[290] flex flex-col gap-1.5 w-[92%] max-w-sm px-2 pointer-events-none">
      {rows.map(r => (
        <div key={r.staff_name}
          className="text-white text-xs px-2 py-1 flex items-center gap-2 drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)]">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
          </span>
          <span className="capitalize font-semibold">{r.staff_name}</span>
          <span>is {r.activity}…</span>
        </div>
      ))}
    </div>
  )
}
