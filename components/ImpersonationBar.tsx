'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

// The active-impersonation banner only -- global and always visible so
// exiting a "view as" session is never more than one tap away, regardless of
// which page it was started from. The trigger to START one lives in the
// hamburger menu instead (ViewPortalAsButton), not here.
export default function ImpersonationBar() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const user = session?.user as any
  const [busy, setBusy] = useState(false)

  const impersonating = !!user?.impersonating

  async function exitViewAs() {
    setBusy(true)
    await fetch('/api/impersonate', { method: 'DELETE' })
    setBusy(false)
    await update()
    router.refresh()
  }

  if (status !== 'authenticated' || !impersonating) return null

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
