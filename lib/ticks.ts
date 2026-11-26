import sql from '@/lib/db'
import { dayKey, weekStart } from '@/lib/dailyChecksShared'

// "TICKED" WEEKLY TARGETS. A target law whose measure is "ticks" lists things (one per line) that each staff member ticks once a week (Monday to Sunday),
// each its own tick, for example "TikTok live video" and "Facebook live video". A supervisor then confirms each tick (Joe confirms staff, the owner confirms Joe).
export type TickLaw = { id: number; text: string; target_items: string | null; target_from: string | null; violations: string | null; points: number | null; target_scale: boolean | null }
export type Tick = { id: number; law_id: number; staff: string; week_start: string; item: string; status: 'pending' | 'confirmed' | 'rejected'; recorded_at: string; note: string | null }
export const itemsOf = (l: { target_items: string | null }) => String(l.target_items ?? '').split('\n').map(x => x.trim()).filter(Boolean)

let ready = false
export async function ensureTicks() {
  if (ready) return
  await sql`CREATE TABLE IF NOT EXISTS target_ticks (id SERIAL PRIMARY KEY, law_id INTEGER NOT NULL, staff TEXT NOT NULL, week_start TEXT NOT NULL, recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(), status TEXT NOT NULL DEFAULT 'pending', decided_by TEXT, decided_at TIMESTAMPTZ, note TEXT)`
  await sql`ALTER TABLE target_ticks ADD COLUMN IF NOT EXISTS item TEXT NOT NULL DEFAULT ''`
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS target_ticks_uq ON target_ticks (law_id, staff, week_start, item)`
  ready = true
}
export async function tickLaws(): Promise<TickLaw[]> {
  return await sql`SELECT id, text, target_items, target_from, violations, points, target_scale FROM page_laws WHERE law_type = 'target' AND target_measure = 'ticks' AND status = 'live' AND target_items IS NOT NULL ORDER BY id` as unknown as TickLaw[]
}
export async function ticksOfWeek(ws: string): Promise<Tick[]> {
  await ensureTicks()
  return await sql`SELECT id, law_id, staff, week_start, item, status, recorded_at::text AS recorded_at, note FROM target_ticks WHERE week_start = ${ws}` as unknown as Tick[]
}
// Joe confirms what staff ticked, the owner confirms Joe's. Nobody confirms their own.
export const canConfirmTick = (me: string, by: string) => by !== me && (me === 'joe' ? by !== 'grony' : me === 'grony' ? by === 'joe' : false)
export const thisWeek = () => weekStart(dayKey())
