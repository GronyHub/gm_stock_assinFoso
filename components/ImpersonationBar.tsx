'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { isOwnerLevel } from '@/lib/roles'

type SimpleUser = { id: number; username: string; display_name: string; role: string }

export default function ImpersonationBar() {
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
    if (!amOwnerLevel || impersonating) return
    fetch('/api/users').then(r => r.json()).then(d => setUsers(Array.isArray(d) ? d : [])).catch(() => {})
  }, [amOwnerLevel, impersonating])

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
    }
  }

  async function exitViewAs() {
    setBusy(true)
    await fetch('/api/impersonate', { method: 'DELETE' })
    setBusy(false)
    await update()
    router.refresh()
  }

  if (status !== 'authenticated') return null

  if (impersonating) {
    return (
      <div className="bg-amber-400 text-amber-950 text-sm font-semibold px-4 py-2 flex items-center justify-between gap-3 sticky top-0 z-[60]">
        <span>👁 Viewing the portal as <strong>{user.name}</strong> (you are {user.realName})</span>
        <button onClick={exitViewAs} disabled={busy}
          className="shrink-0 bg-amber-950 text-amber-50 text-xs font-bold px-3 py-1 rounded-lg hover:bg-amber-900 transition disabled:opacity-50">
          {busy ? 'Exiting…' : 'Exit view'}
        </button>
      </div>
    )
  }

  if (!amOwnerLevel) return null

  return (
    <div className="bg-gray-100 border-b border-gray-200 px-4 py-1.5 flex items-center gap-2 text-xs">
      {picking ? (
        <>
          <span className="text-gray-500 font-medium">View portal as:</span>
          <select
            autoFocus
            defaultValue=""
            onChange={e => startViewAs(e.target.value)}
            disabled={busy}
            className="border border-gray-300 rounded-lg px-2 py-1 text-xs bg-white text-gray-700 outline-none focus:ring-1 focus:ring-blue-400">
            <option value="" disabled>Select staff…</option>
            {users
              .filter(u => u.username.toLowerCase() !== (user?.username ?? '').toLowerCase())
              .map(u => <option key={u.id} value={u.username}>{u.display_name} (@{u.username})</option>)}
          </select>
          <button onClick={() => setPicking(false)} className="text-gray-400 hover:text-gray-600 font-semibold">Cancel</button>
        </>
      ) : (
        <button onClick={() => setPicking(true)} className="text-gray-500 hover:text-gray-700 font-semibold flex items-center gap-1">
          👁 View portal as…
        </button>
      )}
    </div>
  )
}
