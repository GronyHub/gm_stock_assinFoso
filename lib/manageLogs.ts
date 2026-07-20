import sql from '@/lib/db'

// Shared by /api/manage-logs (the category log itself) and /api/flags (which
// reads manage_logs to compute the audio jingle / equipment-check flags) --
// both need the table to exist before querying it.
export async function ensureManageLogs() {
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
}
