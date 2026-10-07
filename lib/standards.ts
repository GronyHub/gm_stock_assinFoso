import sql from '@/lib/db'
import { once } from '@/lib/once'

export const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly', 'once'] as const
export type Frequency = (typeof FREQUENCIES)[number]

async function ensureStandardsTablesImpl() {
  await sql`
    CREATE TABLE IF NOT EXISTS standards_items (
      id SERIAL PRIMARY KEY,
      station TEXT NOT NULL,
      section TEXT NOT NULL,
      section_note TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      text TEXT NOT NULL,
      how TEXT,
      tag TEXT,
      frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily','weekly','monthly','yearly','once')),
      kind TEXT NOT NULL DEFAULT 'check',
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.catch(() => {})
  await sql`
    CREATE TABLE IF NOT EXISTS standards_ticks (
      id SERIAL PRIMARY KEY,
      item_id INTEGER NOT NULL REFERENCES standards_items(id) ON DELETE CASCADE,
      period_key TEXT NOT NULL,
      ticked_by TEXT NOT NULL,
      ticked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (item_id, period_key)
    )
  `.catch(() => {})
}
export const ensureStandardsTables = once(ensureStandardsTablesImpl)

// Ghana is on GMT (UTC+0 all year), so UTC dates are the shop's local dates.
function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export function periodKeys(now = new Date()): Record<Frequency, string> {
  const iso = now.toISOString()
  return {
    daily: iso.slice(0, 10),
    weekly: isoWeek(now),
    monthly: iso.slice(0, 7),
    yearly: iso.slice(0, 4),
    once: 'once',
  }
}

export function periodKeyFor(frequency: string, now = new Date()): string {
  const keys = periodKeys(now)
  return keys[(FREQUENCIES as readonly string[]).includes(frequency) ? (frequency as Frequency) : 'daily']
}
