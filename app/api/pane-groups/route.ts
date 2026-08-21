import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { once } from '@/lib/once'
import { NextRequest, NextResponse } from 'next/server'

const ensurePaneGroupsTable = once(async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS pane_groups (
      item_key TEXT PRIMARY KEY,
      group_name TEXT,
      standalone BOOLEAN NOT NULL DEFAULT false
    )
  `.catch(() => {})
})

// Per-row section overrides for the Cash pane -- a row's `group` in
// CASH_ITEMS (item/page.tsx) is its default section, IS its own display
// text (no separate id->label map), and an owner-level account can move
// any row into any section (existing or freshly typed) or back out to
// none, from Settings -> Reorder & Rename Lists (see ReorderListsPanel.tsx
// and effectiveCashItems() in item/page.tsx, which merges these overrides
// over CASH_ITEMS' own defaults at render time).
//
// `standalone` is independent of `group_name` -- checking it makes a row
// display as its own one-row section (named after its own label, chip
// styled with a border instead of a fill so it reads as a manually-marked
// indicator rather than a "real" multi-row group) regardless of whether
// group_name is set. A row can have either, both, or neither.
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({}, { status: 401 })
  await ensurePaneGroupsTable()
  const rows = await sql`SELECT item_key, group_name, standalone FROM pane_groups`
  const map: Record<string, { group_name: string | null; standalone: boolean }> = {}
  for (const r of rows) map[r.item_key] = { group_name: r.group_name, standalone: !!r.standalone }
  return NextResponse.json(map)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!isOwnerLevel(session?.user as { role?: string; username?: string } | undefined)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { key, groupName, standalone } = await req.json()
  if (typeof key !== 'string' || !key.trim()) return NextResponse.json({ error: 'key is required' }, { status: 400 })
  await ensurePaneGroupsTable()

  const trimmedGroup = typeof groupName === 'string' && groupName.trim() ? groupName.trim() : null
  const standaloneBool = !!standalone

  if (!trimmedGroup && !standaloneBool) {
    // Nothing overridden -- back to CASH_ITEMS' own default entirely.
    await sql`DELETE FROM pane_groups WHERE item_key = ${key}`
  } else {
    await sql`
      INSERT INTO pane_groups (item_key, group_name, standalone) VALUES (${key}, ${trimmedGroup}, ${standaloneBool})
      ON CONFLICT (item_key) DO UPDATE SET group_name = ${trimmedGroup}, standalone = ${standaloneBool}
    `
  }
  return NextResponse.json({ ok: true })
}
