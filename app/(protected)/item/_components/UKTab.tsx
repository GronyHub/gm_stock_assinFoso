'use client'
import { useSession } from 'next-auth/react'
import SubmenuTable from './SubmenuTable'
import type { useUKData } from './ukViewData'

// Just the right-pane content for whichever submenu is selected -- the
// side pane now lists every person's every submenu flat (no People-then-
// Submenus click-through, see item/page.tsx), but each click still opens
// just that one submenu's own page here, not every submenu at once. The
// actual columns+rows table is shared with CHTab.tsx (see SubmenuTable.tsx)
// -- Fiifi/Kuukua/Ebo/Odoye's own submenus moved there, but read from the
// exact same uk_* tables this one does.
export default function UKTab({ uk }: { uk: ReturnType<typeof useUKData> }) {
  const { data: session } = useSession()
  const username = ((session?.user as any)?.username ?? session?.user?.name ?? '').toLowerCase()

  if (username !== 'grony') {
    return (
      <div className="py-20 text-center space-y-2">
        <p className="text-2xl">🔒</p>
        <p className="text-gray-500 text-sm">This page is private.</p>
      </div>
    )
  }

  const selectedSubmenu = uk.submenus.find(s => s.id === uk.selectedSubmenuId) ?? null

  if (!selectedSubmenu) {
    return <p className="py-20 text-center text-gray-400 text-xs px-4">Pick a submenu from the left to see its columns.</p>
  }

  // uk.columns/uk.rows update asynchronously after picking a submenu --
  // useUKData's loadColumns/loadRows don't clear the previous submenu's
  // data before fetching the new one, so for one render they can still
  // hold the OLD submenu's rows while `selectedSubmenu` has already moved
  // on to the new one. SubmenuTable's column-width/order state
  // (useColumnPrefs) only seeds itself once, on mount, from whatever
  // columns it's handed right then -- if that first render gets the stale
  // previous submenu's columns, the real ones arriving a beat later don't
  // match any of the ids it already locked in, and the table silently
  // collapses to nothing but the delete-row column. Checking submenu_id
  // here (not just length) avoids ever handing it mismatched data in the
  // first place, rather than trying to make that state resync after the
  // fact.
  const columnsMatch = uk.columns.every(c => c.submenu_id === selectedSubmenu.id)
  const rowsMatch = uk.rows.every(r => r.submenu_id === selectedSubmenu.id)
  if (!columnsMatch || !rowsMatch) {
    return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>
  }

  return (
    <SubmenuTable key={selectedSubmenu.id} submenu={selectedSubmenu} columns={uk.columns} rows={uk.rows}
      editCell={uk.editCell} saveCell={uk.saveCell} deleteRow={uk.deleteRow} addRow={uk.addRow} />
  )
}
