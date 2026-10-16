import sql from './db'
import { ensureCaretakerTables } from './caretaker'
import { once } from './once'
import type { RoutineItem } from './caretakerShared'

let cache: { loadedAt: number; items: RoutineItem[] } | null = null
export function invalidateRoutineCache() { cache = null }

// My first example routine was only a placeholder (the owner's real list comes
// later), so it is retired here, once, instead of being shown as if it were real.
const retireDrafts = once(async () => {
  await sql`UPDATE care_routine SET active = FALSE WHERE created_by = 'draft' AND active`.catch(() => {})
})

export async function loadRoutine(force = false): Promise<RoutineItem[]> {
  await ensureCaretakerTables()
  // Cached in memory so the minute-by-minute alert tick never queries the
  // database just to read the list; cleared whenever the list is edited.
  if (!force && cache && Date.now() - cache.loadedAt < 6 * 3600 * 1000) return cache.items
  await retireDrafts()
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
