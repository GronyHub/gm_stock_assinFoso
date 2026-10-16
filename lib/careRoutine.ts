import sql from './db'
import { ensureCaretakerTables } from './caretaker'
import type { RoutineItem } from './caretakerShared'

// (The school car leaving, children home, 8pm sweeping and 8:30 bedtime are the
// House buttons on Care Today, which have their own timed alerts, so they are
// not repeated here.)
// First draft of the routine, loaded once when the table is empty. It is only
// a starting point built from the owner's description -- the owners edit it in
// the app (C&H > Routine). All times GMT.
type Seed = [string, string, string, string, boolean]   // day_type, time, title, scope, important
const SEED: Seed[] = [
  ['school', '04:00', 'Wake Fiifi to urinate', 'Fiifi', true],
  ['school', '06:00', 'Supervise Fiifi to take his shower', 'Fiifi', true],
  ['school', '06:30', 'Supervise Fiifi to get dressed', 'Fiifi', false],
  ['school', '06:00', 'Wake the other children and supervise their shower', 'all', false],
  ['school', '06:45', 'Breakfast', 'all', true],
  ['school', '07:00', 'Check uniforms, school bags and homework books', 'all', false],
  ['school', '07:10', 'Hair and skin check before school', 'all', false],
  ['school', '10:00', 'Deep clean the house while the children are at school (cobwebs, bathrooms)', 'all', false],
  ['school', '17:00', 'Children back home: check bags, school needs and homework brought', 'all', true],
  ['school', '17:30', 'Shower and change out of uniform', 'all', false],
  ['school', '18:00', 'Supervise homework', 'all', true],
  ['school', '19:00', 'Supper', 'all', true],
  ['school', '21:00', 'Take Fiifi to urinate before sleep', 'Fiifi', true],
  ['weekend', '04:00', 'Wake Fiifi to urinate', 'Fiifi', true],
  ['weekend', '07:30', 'Wake the children, wash and dress (supervise Fiifi)', 'all', false],
  ['weekend', '08:30', 'Breakfast', 'all', true],
  ['weekend', '10:00', 'Chores with the children', 'all', false],
  ['weekend', '13:00', 'Lunch', 'all', true],
  ['weekend', '15:00', 'Activity time with the children (walk, games, reading)', 'all', false],
  ['weekend', '19:00', 'Supper', 'all', true],
  ['weekend', '21:00', 'Take Fiifi to urinate before sleep', 'Fiifi', true],
]

let cache: { loadedAt: number; items: RoutineItem[] } | null = null
export function invalidateRoutineCache() { cache = null }

async function seedIfEmpty() {
  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM care_routine`
  if (n > 0) return
  for (const [d, t, title, scope, imp] of SEED) {
    await sql`INSERT INTO care_routine (day_type, time, title, scope, important, created_by) VALUES (${d}, ${t}, ${title}, ${scope}, ${imp}, 'draft')`
  }
}

export async function loadRoutine(force = false): Promise<RoutineItem[]> {
  await ensureCaretakerTables()
  // Cached in memory so the minute-by-minute alert tick never queries the
  // database just to read the list; cleared whenever the list is edited.
  if (!force && cache && Date.now() - cache.loadedAt < 6 * 3600 * 1000) return cache.items
  await seedIfEmpty()
  const rows = await sql`SELECT id, day_type, time, title, scope, important, active FROM care_routine WHERE active ORDER BY time, id`
  cache = { loadedAt: Date.now(), items: rows as unknown as RoutineItem[] }
  return cache.items
}

// For the minute-by-minute alert tick: uses the cached list whatever its age
// (so quiet hours never hit the database), loading it only if it was cleared
// (a restart or an edit).
export async function getRoutineForTick(): Promise<RoutineItem[]> {
  if (cache) return cache.items
  return loadRoutine(true)
}
