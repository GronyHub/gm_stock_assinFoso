import { requireAuth, badRequest, success } from '@/lib/api'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { NextRequest } from 'next/server'
import { once } from '@/lib/once'

const ensureAppSettingsTable = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS app_settings (setting_key TEXT PRIMARY KEY, value_json TEXT NOT NULL)`.catch(() => {})
})

// Generic shared-setting store -- one JSON blob per key, readable by
// everyone, writable by owner-level only. Every "this only applies on my
// own device" preference in the app (table column show/hide/reorder/
// rename/width, left-pane display mode, Live Sale's item arrange order,
// and any future one) should read/write through this instead of
// localStorage, so whatever the owner configures actually applies to
// every other staff member's own version of the app too, not just the
// browser that set it. Same owner-level-write/everyone-reads shape as
// /api/pane-order, /api/pane-labels, and /api/pane-groups -- this is just
// the generic version of that same pattern for anything that doesn't
// warrant its own dedicated table.
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error
  const key = req.nextUrl.searchParams.get('key')
  if (!key) return badRequest('key is required')

  await ensureAppSettingsTable()
  const [row] = await sql`SELECT value_json FROM app_settings WHERE setting_key = ${key}`
  if (!row) return success({ value: null })
  try {
    return success({ value: JSON.parse(row.value_json) })
  } catch {
    return success({ value: null })
  }
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session?.user as { role?: string; username?: string } | undefined)) return badRequest('Forbidden')

  const { key, value } = await req.json()
  if (typeof key !== 'string' || !key.trim()) return badRequest('key is required')
  await ensureAppSettingsTable()

  const valueJson = JSON.stringify(value ?? null)
  await sql`
    INSERT INTO app_settings (setting_key, value_json) VALUES (${key}, ${valueJson})
    ON CONFLICT (setting_key) DO UPDATE SET value_json = ${valueJson}
  `
  return success({ ok: true })
}
