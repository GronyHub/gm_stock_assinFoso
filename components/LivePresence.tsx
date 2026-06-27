'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

type PresenceRow = { staff_name: string; activity: string; updated_at: string }

export default function LivePresence() {
  const { data: session, status } = useSession()
  const username = ((session?.user as any)?.username ?? session?.user?.name ?? '').toLowerCase()
  const [rows, setRows] = useState<PresenceRow[]>([])

  useEffect(() => {
    if (status !== 'authenticated') return
    let cancelled = false

    function poll() {
      fetch('/api/presence')
        .then(r => r.ok ? r.json() : [])
        .then((d: PresenceRow[]) => {
          if (cancelled) return
          setRows(Array.isArray(d) ? d.filter(r => (r.staff_name ?? '').toLowerCase() !== username) : [])
        })
        .catch(() => {})
    }

    poll()
    const id = setInterval(poll, 8000)
    return () => { cancelled = true; clearInterval(id) }
  }, [status, username])

  if (!rows.length) return null

  return (
    <div className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-[290] flex flex-col gap-1.5 w-[92%] max-w-sm px-2">
      {rows.map(r => (
        <div key={r.staff_name}
          className="bg-blue-600/95 text-white text-xs rounded-full px-3 py-1.5 shadow-lg flex items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
          </span>
          <span className="capitalize font-semibold">{r.staff_name}</span>
          <span className="text-blue-100">is {r.activity}…</span>
        </div>
      ))}
    </div>
  )
}
