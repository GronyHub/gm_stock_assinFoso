'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { isOwnerLevel } from '@/lib/roles'

type SimpleUser = { id: number; username: string; display_name: string; role: string }

// Hamburger-menu trigger for "View Portal As" -- lets owner-level users
// (Grony/Joe) see the app as a specific staff member. The active-impersonation
// state (amber "you are viewing as X, Exit view" banner) stays in
// ImpersonationBar, global and always visible, so it can't be missed once
// started from here.
export default function ViewPortalAsButton({ onDone }: { onDone?: () => void }) {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const user = session?.user as any

  const [users, setUsers] = useState<SimpleUser[]>([])
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)

  const impersonating = !!user?.impersonating
  const amOwnerLevel = status === 'authenticated' && isOwnerLevel(
    impersonating ? { role: user.realRole, username: user.realUsername } : user
  )

  useEffect(() => {
    if (!amOwnerLevel || impersonating || !picking) return
    fetch('/api/users').then(r => r.json()).then(d => setUsers(Array.isArray(d) ? d : [])).catch(() => {})
  }, [amOwnerLevel, impersonating, picking])

  async function startViewAs(username: string) {
    if (!username) return
    setBusy(true)
    const res = await fetch('/api/impersonate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username }),
    })
    setBusy(false)
    if (res.ok) {
      setPicking(false)
      await update()
      router.refresh()
      onDone?.()
    }
  }

  if (!amOwnerLevel || impersonating) return null

  return (
    <div className="px-4 py-2.5 border-t border-blue-700 first:border-t-0">
      {picking ? (
        <div className="space-y-1.5">
          <p className="text-[10px] text-blue-100 font-semibold">View portal as:</p>
          <select
            autoFocus
            defaultValue=""
            onChange={e => startViewAs(e.target.value)}
            disabled={busy}
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white text-gray-700 outline-none focus:ring-1 focus:ring-blue-400">
            <option value="" disabled>Select staff…</option>
            {users
              .filter(u => u.username.toLowerCase() !== (user?.username ?? '').toLowerCase())
              .map(u => <option key={u.id} value={u.username}>{u.display_name} (@{u.username})</option>)}
          </select>
          <button onClick={() => setPicking(false)} className="text-[10px] text-blue-200 hover:text-white font-semibold">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setPicking(true)}
          className="w-full text-left text-sm font-medium text-white hover:text-blue-100 flex items-center gap-1.5">
          👁 View Portal as…
        </button>
      )}
    </div>
  )
}
