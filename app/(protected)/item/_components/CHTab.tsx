'use client'
import { useSession } from 'next-auth/react'
import ManageLogPanel from './ManageLogPanel'
import { CH_ITEMS, type CHView } from './chViewData'

// Owner-level only (Grony/Joe), same pattern as UKTab: the tab button is
// already gated in item/page.tsx, but this re-checks the session itself too
// as a second guard. `view` picks which of C&H's own left-pane rows (see
// chViewData.ts) is active -- each is just a simple dated log/notes panel,
// same treatment Grony Manage's Arrangement/Cleanliness/etc. get, since
// none of these have any other existing data behind them either. Falls back
// to the first item for any view that isn't one of C&H's own (e.g. landing
// here directly via ?tab=ch with no matching ?view=) instead of rendering
// nothing.
export default function CHTab({ view }: { view: CHView }) {
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

  const item = CH_ITEMS.find(i => i.key === view) ?? CH_ITEMS[0]

  return (
    <div className="space-y-1">
      <div className="px-2 pt-2">
        <h1 className="text-lg font-bold text-gray-900">C&amp;H</h1>
        <p className="text-[10px] text-gray-400">Private · Grony &amp; Joe only</p>
      </div>
      <ManageLogPanel category={item.key} label={item.label} icon={item.icon} />
    </div>
  )
}
