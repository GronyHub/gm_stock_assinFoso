import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { NextRequest } from 'next/server'
import { once } from '@/lib/once'

const SETTING_KEY = 'live_sale_item_sort_order'

export const SORT_KEYS = ['count_status', 'violations', 'badge'] as const
export type ItemSortKey = typeof SORT_KEYS[number]
export const DEFAULT_ITEM_SORT_ORDER: ItemSortKey[] = ['count_status', 'violations', 'badge']

const ensureAppSettingsTable = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS app_settings (setting_key TEXT PRIMARY KEY, value_json TEXT NOT NULL)`.catch(() => {})
})

// The priority order Live Sale's Sale-mode grid arranges items in (count
// status due/overdue, attention-flag count, today's sales/badge count).
// Deliberately shared and writable by ANY authenticated staff member, not
// just owner-level -- unlike most of /api/app-settings' consumers, whoever
// rearranges this changes what the whole shop sees on their next load, so
// this gets its own dedicated route rather than going through that one
// (which hardcodes an owner-only write check). Stored in the same
// app_settings table under its own key, since it's the same
// one-JSON-blob-per-key shape.
export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  try {
    await ensureAppSettingsTable()
    const [row] = await sql`SELECT value_json FROM app_settings WHERE setting_key = ${SETTING_KEY}`
    if (!row) return success({ order: DEFAULT_ITEM_SORT_ORDER })
    try {
      const parsed = JSON.parse(row.value_json)
      const valid = Array.isArray(parsed) ? parsed.filter((k): k is ItemSortKey => (SORT_KEYS as readonly string[]).includes(k)) : []
      // Any key missing from a saved (older or corrupted) value falls back
      // to the end in its default position, rather than silently vanishing
      // from the picker.
      const complete = [...valid, ...SORT_KEYS.filter(k => !valid.includes(k))]
      return success({ order: complete })
    } catch {
      return success({ order: DEFAULT_ITEM_SORT_ORDER })
    }
  } catch (e) {
    return handleError('item-sort-order GET', e)
  }
}

export async function PUT(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  const { order } = await req.json()
  if (!Array.isArray(order) || order.length !== SORT_KEYS.length || !SORT_KEYS.every(k => order.includes(k))) {
    return badRequest(`order must be a permutation of: ${SORT_KEYS.join(', ')}`)
  }

  try {
    await ensureAppSettingsTable()
    const valueJson = JSON.stringify(order)
    await sql`
      INSERT INTO app_settings (setting_key, value_json) VALUES (${SETTING_KEY}, ${valueJson})
      ON CONFLICT (setting_key) DO UPDATE SET value_json = ${valueJson}
    `
    return success({ ok: true, order })
  } catch (e) {
    return handleError('item-sort-order PUT', e)
  }
}
