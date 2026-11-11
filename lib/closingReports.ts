import sql from '@/lib/db'
import { recordActivity } from '@/lib/logger'
import { once } from '@/lib/once'
import { logActivity } from '@/lib/logger'

// The Closer (last staff member to clock out) must answer end-of-day
// questions before their clock-out is accepted; answers land here, one row
// per day. Shared by /api/staff-times/today (writes it) and /api/flags
// (reads it to compute the "missing closing report" flag for the Closer
// role tab).
async function ensureClosingReportsImpl() {
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

export const ensureClosingReports = once(ensureClosingReportsImpl)

export type ClosingInput = {
  no_tshirt_staff?: unknown; advert_played: boolean; property_issue: boolean; speaker_brought_in: boolean; new_customer: boolean
  new_customer_details?: string | null; unfortunate_event: boolean; unfortunate_event_details?: string | null
}
const YES_NO = ['advert_played', 'property_issue', 'speaker_brought_in', 'new_customer', 'unfortunate_event'] as const
export const validClosing = (cr: unknown): cr is ClosingInput => !!cr && typeof cr === 'object' && YES_NO.every(k => typeof (cr as Record<string, unknown>)[k] === 'boolean')

// Saves the day's closing report (one per day, first one wins). Used by the Daily Checklist card and by the clock-out route.
export async function saveClosingReport(day: string, who: string, cr: ClosingInput): Promise<boolean> {
  await ensureClosingReports()
  const noTshirt = (Array.isArray(cr.no_tshirt_staff) ? cr.no_tshirt_staff : []).map(x => String(x).trim()).filter(Boolean)
  const rows = await sql`
    INSERT INTO closing_reports (work_date, closer_name, no_tshirt_staff, advert_played, property_issue, speaker_brought_in, new_customer, new_customer_details, unfortunate_event, unfortunate_event_details)
    VALUES (${day}, ${who}, ${noTshirt.join(', ')}, ${cr.advert_played}, ${cr.property_issue}, ${cr.speaker_brought_in}, ${cr.new_customer}, ${cr.new_customer ? (cr.new_customer_details || null) : null},
            ${cr.unfortunate_event}, ${cr.unfortunate_event ? (cr.unfortunate_event_details || null) : null})
    ON CONFLICT (work_date) DO NOTHING RETURNING id`
  if (!rows.length) return false
  void recordActivity(who, 'answered the closing report', day)
  const summary = [
    `No company T-shirt: ${noTshirt.length ? noTshirt.join(', ') : 'none'}`,
    `Roadside advert played: ${cr.advert_played ? 'Yes' : 'No'}`,
    `Spoilt/lost property: ${cr.property_issue ? 'Yes' : 'No'}`,
    `Speaker & wires brought in: ${cr.speaker_brought_in ? 'Yes' : 'No'}`,
    `New customer of interest: ${cr.new_customer ? `Yes — ${cr.new_customer_details || 'no details'}` : 'No'}`,
    `Unfortunate event: ${cr.unfortunate_event ? `Yes — ${cr.unfortunate_event_details || 'no details'}` : 'No'}`,
  ].join(' · ')
  await logActivity(who, 'submitted closing report', summary)
  return true
}
