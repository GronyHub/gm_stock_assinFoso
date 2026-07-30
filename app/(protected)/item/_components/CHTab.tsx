'use client'
import { useSession } from 'next-auth/react'

// Placeholder top-level tab -- content TBD. Owner-level only (Grony/Joe),
// same pattern as UKTab: the tab button is already gated in item/page.tsx,
// but this re-checks the session itself too as a second guard.
export default function CHTab() {
  const { data: session } = useSession()
  const user = session?.user as any
  const role = user?.role ?? ''
  const username = (user?.username ?? user?.name ?? '').toLowerCase()
  const isOwnerLevel = role === 'owner' || username === 'joe'

  if (!isOwnerLevel) {
    return (
      <div className="py-20 text-center space-y-2">
        <p className="text-2xl">🔒</p>
        <p className="text-gray-500 text-sm">This page is private.</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <h1 className="text-lg font-bold text-gray-900">C&amp;H</h1>
      <p className="text-[10px] text-gray-400">Private · Grony &amp; Joe only</p>
      <p className="py-20 text-center text-gray-400 text-xs">Coming soon.</p>
    </div>
  )
}
