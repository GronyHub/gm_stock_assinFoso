import sql from '@/lib/db'

// Whether each item/service currently has an audio advert recorded --
// Grony Manage > Advert > Audio's own rule ("any service or item should
// have its advert recorded"). Shared by /api/advert-status (marking items)
// and /api/flags (the "items missing audio adverts" flag).
export async function ensureAdvertStatusTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS item_audio_advert_status (
      item_id INTEGER PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
      has_advert BOOLEAN NOT NULL DEFAULT FALSE,
      notes TEXT,
      updated_by TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.catch(() => {})
}
