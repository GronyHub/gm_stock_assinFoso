'use client'
import { useEffect } from 'react'
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
  useEffect(() => {
    if (!isJoe || FREE.some(p => pathname === p || pathname.startsWith(p + '/'))) return
    let off = false
    fetch('/api/manager-lock', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (!off && d?.locked) router.replace('/start-of-day') }).catch(() => {})
    return () => { off = true }
  }, [isJoe, pathname, router])
  return null
}
