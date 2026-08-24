import { requireAuth, badRequest, success } from '@/lib/api'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { NextRequest } from 'next/server'
import { once } from '@/lib/once'

const ensurePaneHiddenTable = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS pane_hidden (item_key TEXT PRIMARY KEY)`.catch(() => {})
})

// Which pane rows (Grony Cash / Grony Manage / Team) are hidden from the
// left sidebar, keyed by the row's own stable `key` -- same
// shared-with-everyone pattern as pane_labels/pane_order/pane_groups (see
// ReorderListsPanel.tsx). Purely a visibility override: a hidden row's
// routing, PageToolIcons scopeKey, and task/notes/laws/flag data are all
// untouched, so hiding it can never orphan or move any of that data, and
// un-hiding it later brings it straight back with everything intact.
export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error
  await ensurePaneHiddenTable()
  const rows = await sql`SELECT item_key FROM pane_hidden`
  const map: Record<string, boolean> = {}
  for (const r of rows) map[r.item_key] = true
  return success(map)
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session?.user as { role?: string; username?: string } | undefined)) return badRequest('Forbidden')

  const { key, hidden } = await req.json()
  if (typeof key !== 'string' || !key.trim()) return badRequest('key is required')
  await ensurePaneHiddenTable()

  if (hidden) {
    await sql`INSERT INTO pane_hidden (item_key) VALUES (${key}) ON CONFLICT (item_key) DO NOTHING`
  } else {
    await sql`DELETE FROM pane_hidden WHERE item_key = ${key}`
  }
  return success({ ok: true })
}
