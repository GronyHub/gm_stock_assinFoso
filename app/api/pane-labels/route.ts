import { requireAuth, badRequest, success } from '@/lib/api'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { NextRequest } from 'next/server'
import { once } from '@/lib/once'

const ensurePaneLabelsTable = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS pane_labels (item_key TEXT PRIMARY KEY, label TEXT NOT NULL)`.catch(() => {})
})

// Purely a display-label override, keyed by the pane row's own stable
// `key` -- routing, PageToolIcons scopeKey, and task/notes/laws/flag data
// all still key off the item's real key, never this label, so renaming a
// row here is cosmetic only and can never orphan or move any of that data.
// See ReorderListsPanel.tsx, which handles both reorder and rename in one
// place, same as columnPrefs.tsx already does for table columns.
export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error
  await ensurePaneLabelsTable()
  const rows = await sql`SELECT item_key, label FROM pane_labels`
  const map: Record<string, string> = {}
  for (const r of rows) map[r.item_key] = r.label
  return success(map)
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session?.user as { role?: string; username?: string } | undefined)) return badRequest('Forbidden')

  const { key, label } = await req.json()
  if (typeof key !== 'string' || !key.trim()) return badRequest('key is required')
  await ensurePaneLabelsTable()

  const trimmed = typeof label === 'string' ? label.trim() : ''
  if (!trimmed) {
    // Empty label = reset to the item's default -- same convention as
    // columnPrefs.tsx's renameColumn.
    await sql`DELETE FROM pane_labels WHERE item_key = ${key}`
  } else {
    await sql`
      INSERT INTO pane_labels (item_key, label) VALUES (${key}, ${trimmed})
      ON CONFLICT (item_key) DO UPDATE SET label = ${trimmed}
    `
  }
  return success({ ok: true })
}
