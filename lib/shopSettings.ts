import sql from '@/lib/db'
import { once } from '@/lib/once'

// Small shop-wide settings the owner and Joe control (what everyone sees). Stored as JSON by key.
const ensure = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS shop_settings (key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_by TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`.catch(() => {})
})

export type TimesDisplay = { hidden: string[]; hideEmpty: boolean }
export const DEFAULT_TIMES: TimesDisplay = { hidden: [], hideEmpty: false }

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try { await ensure(); const [r] = await sql`SELECT value FROM shop_settings WHERE key = ${key}`; return (r?.value as T) ?? fallback } catch { return fallback }
}
export async function setSetting(key: string, value: unknown, by: string) {
  await ensure()
  await sql`INSERT INTO shop_settings (key, value, updated_by) VALUES (${key}, ${JSON.stringify(value)}::jsonb, ${by}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`
}
export async function timesDisplay(): Promise<TimesDisplay> {
  const t = await getSetting<Partial<TimesDisplay>>('times_display', DEFAULT_TIMES)
  return { hidden: Array.isArray(t.hidden) ? t.hidden.map(x => String(x).toLowerCase()) : [], hideEmpty: !!t.hideEmpty }
}
