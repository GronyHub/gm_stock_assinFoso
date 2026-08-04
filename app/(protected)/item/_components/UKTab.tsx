'use client'
import { useSession } from 'next-auth/react'
import SubmenuTable from './SubmenuTable'
import type { useUKData } from './ukViewData'

// Just the right-pane content for whichever submenu is selected -- the
// people picker and that person's submenu list now live in item/page.tsx's
// merged pane instead (see ukViewData.ts's useUKData hook, called once
// there and passed down as `uk`). The actual columns+rows table is shared
// with CHTab.tsx (see SubmenuTable.tsx) -- Fiifi/Kuukua/Ebo/Odoye's own
// submenus moved there, but read from the exact same uk_* tables this one
// does.
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

  return (
    <SubmenuTable submenu={selectedSubmenu} columns={uk.columns} rows={uk.rows}
      editCell={uk.editCell} saveCell={uk.saveCell} deleteRow={uk.deleteRow} addRow={uk.addRow} />
  )
}
