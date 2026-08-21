import sql from '@/lib/db'
import { once } from '@/lib/once'

// Shared by /api/manage-logs (the category log itself) and /api/flags (which
// reads manage_logs to compute the audio jingle / equipment-check flags) --
// both need the table to exist before querying it.
async function ensureManageLogsImpl() {
  await sql`
    CREATE TABLE IF NOT EXISTS manage_logs (
      id SERIAL PRIMARY KEY,
      category TEXT NOT NULL,
      log_date DATE NOT NULL DEFAULT CURRENT_DATE,
      notes TEXT,
      photo_url TEXT,
      logged_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.catch(() => {})
  // Staff Meeting-only columns (who attended, what time it ran) -- null for
  // every other category's entries, which never send them.
  await sql`
    ALTER TABLE manage_logs
      ADD COLUMN IF NOT EXISTS attendees TEXT[],
      ADD COLUMN IF NOT EXISTS start_time TIME,
      ADD COLUMN IF NOT EXISTS end_time TIME,
      ADD COLUMN IF NOT EXISTS grony_section INTEGER
  `.catch(() => {})
}

export const ensureManageLogs = once(ensureManageLogsImpl)
