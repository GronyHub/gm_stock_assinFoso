import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// Read-only listing of end-of-day closing reports (submitted by the Closer —
// the last staff member to clock out — via POST /api/staff-times/today).
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  try {
    const reports = await sql`
      SELECT id, work_date::text, closer_name, no_tshirt_staff,
             advert_played, property_issue, speaker_brought_in,
             new_customer, new_customer_details,
             unfortunate_event, unfortunate_event_details, created_at
      FROM closing_reports
      ORDER BY work_date DESC
      LIMIT 90
    `
    return NextResponse.json(reports)
  } catch {
    return NextResponse.json([]) // table not created yet — no reports
  }
}
