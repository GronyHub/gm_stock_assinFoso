'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useViolations, SHORT_LABEL } from '@/app/(protected)/item/_components/useViolations'

// Bino takes charge of Grony Manage the same way Joe takes charge overall --
// so each time he logs in, a quick reminder of what's outstanding plus a
// link straight to the Flags panel on Home. Hardcoded to Bino for now.
// The violations fetch only ever happens for Bino's own session -- split
// into an inner component so every other user's session skips it entirely.
export default function BinoTaskBanner() {
  const { data: session, status } = useSession()
  const username = ((session?.user as any)?.username ?? session?.user?.name ?? '').toLowerCase()
  const isBino = status === 'authenticated' && username === 'bino'

  if (!isBino) return null
  return <BinoTaskBannerInner />
}

function BinoTaskBannerInner() {
  const { manageViolations, manageCount } = useViolations()
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    const key = 'bino_task_banner_shown'
    if (sessionStorage.getItem(key) !== today) {
      sessionStorage.setItem(key, today)
      setDismissed(false)
    }
  }, [])

  if (dismissed) return null

  const active = manageViolations.filter(v => v.count > 0).slice(0, 3)

  return (
    <div className="bg-blue-50 border-b border-blue-200 text-blue-900 text-sm px-4 py-2.5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold">🎯 Bino, here&apos;s what&apos;s on your plate for Grony Manage:</p>
        {active.length === 0 ? (
          <p className="text-xs text-blue-700 mt-0.5">Nothing outstanding right now ✓</p>
        ) : (
          <ul className="text-xs text-blue-700 mt-0.5 space-y-0.5">
            {active.map(v => (
              <li key={v.type}>{v.count} {SHORT_LABEL[v.type] ?? v.label}</li>
            ))}
          </ul>
        )}
        {manageCount > active.reduce((s, v) => s + v.count, 0) && (
          <p className="text-[11px] text-blue-500 mt-0.5">and more on the Flags panel</p>
        )}
        <Link href="/item" onClick={() => setDismissed(true)}
          className="inline-block mt-1 text-xs font-bold text-blue-700 underline">
          View Flags →
        </Link>
      </div>
      <button onClick={() => setDismissed(true)} className="shrink-0 text-blue-300 hover:text-blue-600 font-bold leading-none">×</button>
    </div>
  )
}
