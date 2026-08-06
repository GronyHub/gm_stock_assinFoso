'use client'
import { useSession } from 'next-auth/react'
import ManageLogPanel from './ManageLogPanel'
import SubmenuTable from './SubmenuTable'
import { CH_ITEMS, CH_CHILD_PERSON, type CHView } from './chViewData'
import type { useUKData } from './ukViewData'

// Owner-level only (Grony/Joe), same pattern as UKTab: the tab button is
// already gated in item/page.tsx, but this re-checks the session itself too
// as a second guard. `view` picks which of C&H's own left-pane rows (see
// chViewData.ts) is active -- most are just a simple dated log/notes panel,
// same treatment Grony Manage's Arrangement/Cleanliness/etc. get, since none
// of those have any other existing data behind them either. Falls back to
// the first item for any view that isn't one of C&H's own (e.g. landing
// here directly via ?tab=ch with no matching ?view=) instead of rendering
// nothing.
//
// Fiifi/Kuukua/Ebo/Odoye (CH_CHILD_PERSON) are the exception -- moved here
// from UK, they keep UK's own submenu+table treatment (see SubmenuTable.tsx)
// instead of a plain ManageLogPanel, fed by `childData` (a second
// useUKData() instance item/page.tsx drives with these four names -- see
// its pickCHView). They also keep UK's tighter Grony-only gate on top of
// this component's own Grony-or-Joe one, exactly as restrictive as they
// were before the move.
export default function CHTab({ view, childData }: { view: CHView; childData: ReturnType<typeof useUKData> }) {
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

  const childPerson = CH_CHILD_PERSON[view]
  if (childPerson) {
    if (username !== 'grony') {
      return (
        <div className="py-20 text-center space-y-2">
          <p className="text-2xl">🔒</p>
          <p className="text-gray-500 text-sm">This page is private.</p>
        </div>
      )
    }
    const selectedSubmenu = childData.submenus.find(s => s.id === childData.selectedSubmenuId) ?? null
    if (!selectedSubmenu) {
      return <p className="py-20 text-center text-gray-400 text-xs px-4">Pick a submenu from the left to see its columns.</p>
    }
    // Same stale-data guard as UKTab.tsx -- childData.columns/rows can still
    // hold the previously-selected child's data for one render after
    // picking a new submenu, before their fetch resolves. See UKTab.tsx's
    // comment for why handing that straight to SubmenuTable silently
    // collapses its column widths.
    const columnsMatch = childData.columns.every(c => c.submenu_id === selectedSubmenu.id)
    const rowsMatch = childData.rows.every(r => r.submenu_id === selectedSubmenu.id)
    if (!columnsMatch || !rowsMatch) {
      return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>
    }
    return (
      <SubmenuTable key={selectedSubmenu.id} submenu={selectedSubmenu} columns={childData.columns} rows={childData.rows}
        editCell={childData.editCell} saveCell={childData.saveCell} deleteRow={childData.deleteRow} addRow={childData.addRow}
        toggleColumnWide={childData.toggleColumnWide} />
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
