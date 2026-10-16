import sql from '@/lib/db'
import { once } from '@/lib/once'

// Tap-as-you-work routine for the shop: Opening, Daytime, Closing and one
// section per station. Separate from the Standards checklist. Ghana is on GMT,
// so UTC days are the shop's days.
export * from './shopRoutineShared'

async function ensureImpl() {
  await sql`CREATE TABLE IF NOT EXISTS shop_routine (
    id SERIAL PRIMARY KEY, section TEXT NOT NULL, time TEXT, title TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0, active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`.catch(() => {})
  await sql`CREATE TABLE IF NOT EXISTS shop_routine_events (
    id SERIAL PRIMARY KEY, routine_id INTEGER NOT NULL, value TEXT NOT NULL, note TEXT,
    extra JSONB, recorded_by TEXT NOT NULL, recorded_at TIMESTAMPTZ NOT NULL DEFAULT now())`.catch(() => {})
  await sql`CREATE INDEX IF NOT EXISTS shop_routine_events_at ON shop_routine_events (recorded_at)`.catch(() => {})
  // First run: start Opening, Daytime and Closing from the Standards "Shop" daily lines.
  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM shop_routine`
  if (n === 0) {
    await sql`INSERT INTO shop_routine (section, title, position, created_by)
      SELECT CASE WHEN section LIKE 'A.%' THEN 'Opening' WHEN section LIKE 'B.%' AND section NOT LIKE 'B2.%' THEN 'Daytime' ELSE 'Closing' END,
             text, ROW_NUMBER() OVER (ORDER BY id), 'standards'
      FROM standards_items
      WHERE active AND station = 'Shop' AND frequency = 'daily' AND (section LIKE 'A.%' OR (section LIKE 'B.%' AND section NOT LIKE 'B2.%') OR section LIKE 'E.%')
      ORDER BY id`.catch(() => {})
  }
}
export const ensureShopRoutine = once(ensureImpl)
