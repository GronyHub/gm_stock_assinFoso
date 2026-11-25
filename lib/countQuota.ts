import sql from '@/lib/db'
import { addPoint, ensurePenalties } from '@/lib/penalties'
import { addDays } from '@/lib/dailyChecksShared'

// THE WEEKLY COUNTS LAW. Every staff member counts at least COUNTS_PER_WEEK different items a week (Monday to Sunday; a stock count saved in Counts, by that person).
// A part-time week is scaled to the days worked (5 working days = the full number). The first working day of the next week, each person who fell short gets 1 point.
// It replaces the old rule (the manager makes sure 10 are counted every day), which stops with the week of START.
export const COUNTS_PER_WEEK = 30
export const FULL_WEEK_DAYS = 5
export const COUNTS_WEEKLY_START = '2026-11-23'   // a Monday: the first week the law applies to

export const weekStart = (day: string) => { const dow = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7; return addDays(day, -dow) }

async function lawId(): Promise<number | null> {
  const [law] = await sql`SELECT id FROM page_laws WHERE category = 'Stock & records' AND subcategory = 'Counts' AND law_type = 'standing' AND text ILIKE '%items a week%' ORDER BY id LIMIT 1`.catch(() => [])
  return law?.id ? Number(law.id) : null
}

export async function countedInWeek(staff: string, ws: string): Promise<number> {
  const [r] = await sql`SELECT COUNT(DISTINCT item_id)::int AS n FROM stock_counts WHERE LOWER(counted_by) = ${staff} AND count_date >= ${ws}::date AND count_date <= ${addDays(ws, 6)}::date`.catch(() => [{ n: 0 }])
  return Number(r?.n ?? 0)
}
export async function daysWorkedInWeek(staff: string, ws: string): Promise<number> {
  const [r] = await sql`SELECT COUNT(DISTINCT work_date)::int AS n FROM staff_times WHERE LOWER(staff_name) = ${staff} AND work_date >= ${ws} AND work_date <= ${addDays(ws, 6)} AND actual_in IS NOT NULL`.catch(() => [{ n: 0 }])
  return Number(r?.n ?? 0)
}
export const targetFor = (days: number) => days <= 0 ? 0 : Math.max(1, Math.round(COUNTS_PER_WEEK * Math.min(days, FULL_WEEK_DAYS) / FULL_WEEK_DAYS))

// How one person is doing this week (shown on the Counts page and in the login reminder). The target shown is the full number; it is scaled to days worked only when the week is checked.
export async function weekProgress(staff: string, day: string) {
  const ws = weekStart(day)
  return { weekStart: ws, weekEnd: addDays(ws, 6), mine: await countedInWeek(staff, ws), target: COUNTS_PER_WEEK, started: day >= COUNTS_WEEKLY_START }
}

// The weekly check now runs through the weekly target laws (lib/targets.ts): the counts law is one of them.
export async function assessCounts(day: string) {
  await (await import('./targets')).assessTargets(day)
}
