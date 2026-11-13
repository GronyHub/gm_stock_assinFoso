'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

// The manager block: while the previous working day is not closed (Cash Counted, manager closing questions), the manager's every page is "Before you continue". It is a screen
// guard (like the caretaker's); the owner can excuse a day from that page.
const FREE = ['/start-of-day', '/profile', '/login']
export default function ManagerLockGuard() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const u = session?.user as { role?: string; username?: string; name?: string } | undefined
  const isJoe = u?.role !== 'owner' && (u?.username ?? u?.name ?? '').toLowerCase() === 'joe'
  const [short, setShort] = useState<{ day: string; short: number } | null>(null)
  useEffect(() => {
    if (!isJoe || FREE.some(p => pathname === p || pathname.startsWith(p + '/'))) { setShort(null); return }
    let off = false
    fetch('/api/manager-lock?fresh=1', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => {
      if (off) return
      if (!d?.locked) { setShort(null); return }
      // Only the cash shortage left: the Items hub (Sales Log) stays open; everything else is the Before-you-continue page.
      if (d.hubOpen && (pathname === '/item' || pathname.startsWith('/item/'))) { setShort({ day: d.day, short: d.shortage.short }); return }
      router.replace('/start-of-day')
    }).catch(() => {})
    return () => { off = true }
  }, [isJoe, pathname, router])
  if (!short) return null
  return (
    <a href="/start-of-day" className="fixed inset-x-0 bottom-0 z-[80] block bg-red-600 px-3 py-2 text-center text-xs font-bold text-white print:hidden">
      Cash counted for {short.day} is {short.short.toLocaleString('en-GH', { maximumFractionDigits: 2 })} less than the sales written down. Put the Sales Log right (or recount) to unlock the app. Tap for details.
    </a>
  )
}
