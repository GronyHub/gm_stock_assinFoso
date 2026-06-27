'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'

type LogRow = { id: number; staff_name: string; action: string; details: string | null; created_at: string }

export default function ActivityToaster() {
  const { data: session, status } = useSession()
  const username = ((session?.user as any)?.username ?? session?.user?.name ?? '').toLowerCase()
  const lastIdRef = useRef<number | null>(null)
  const seededRef = useRef(false)
  const [toasts, setToasts] = useState<LogRow[]>([])

  useEffect(() => {
    if (status !== 'authenticated') return
    let cancelled = false

    async function poll() {
      try {
        const url = lastIdRef.current != null ? `/api/logs/recent?after=${lastIdRef.current}` : '/api/logs/recent'
        const res = await fetch(url)
        if (!res.ok) return
        const rows: LogRow[] = await res.json()
        if (cancelled || !rows.length) return

        if (!seededRef.current) {
          // First call just establishes the baseline -- don't toast existing history.
          lastIdRef.current = rows[0].id
          seededRef.current = true
          return
        }

        lastIdRef.current = rows[rows.length - 1].id
        const fromOthers = rows.filter(r => (r.staff_name ?? '').toLowerCase() !== username)
        if (fromOthers.length) {
          setToasts(prev => [...prev, ...fromOthers].slice(-4))
          fromOthers.forEach(r => {
            setTimeout(() => setToasts(prev => prev.filter(t => t.id !== r.id)), 6000)
          })
        }
      } catch {
        // silent -- a missed poll just means a delayed notification, not worth surfacing
      }
    }

    poll()
    const id = setInterval(poll, 8000)
    return () => { cancelled = true; clearInterval(id) }
  }, [status, username])

  if (!toasts.length) return null

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[300] flex flex-col gap-2 w-[92%] max-w-sm px-2">
      {toasts.map(t => (
        <div key={t.id}
          onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
          className="bg-gray-900/95 text-white text-xs rounded-xl px-3 py-2.5 shadow-lg flex items-start gap-2 cursor-pointer">
          <span className="text-base leading-none">🔔</span>
          <span className="min-w-0">
            <span className="font-semibold capitalize">{t.staff_name}</span>
            <span className="text-gray-300"> {t.action}</span>
            {t.details && <span className="text-gray-400"> — {t.details}</span>}
          </span>
        </div>
      ))}
    </div>
  )
}
