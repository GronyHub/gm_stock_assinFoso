import sql from '@/lib/db'

// The Closer (last staff member to clock out) must answer end-of-day
// questions before their clock-out is accepted; answers land here, one row
// per day. Shared by /api/staff-times/today (writes it) and /api/flags
// (reads it to compute the "missing closing report" flag for the Closer
// role tab).
export async function ensureClosingReports() {
  await sql`
    CREATE TABLE IF NOT EXISTS closing_reports (
      id SERIAL PRIMARY KEY,
      work_date DATE NOT NULL UNIQUE,
      closer_name TEXT NOT NULL,
      no_tshirt_staff TEXT NOT NULL DEFAULT '',
      advert_played BOOLEAN NOT NULL,
      property_issue BOOLEAN NOT NULL,
      speaker_brought_in BOOLEAN NOT NULL,
      new_customer BOOLEAN NOT NULL,
      new_customer_details TEXT,
      unfortunate_event BOOLEAN NOT NULL,
      unfortunate_event_details TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.catch(() => {})
}
