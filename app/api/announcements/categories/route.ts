import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// Distinct auto-logged activity types that exist in the feed so far --
// backs the Home feed's "type" filter dropdown. Manually-typed posts have
// no category (see /api/announcements POST) and never appear here.
export async function GET() {
  try {
    await sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS category TEXT`.catch(() => {})
    const rows = await sql`
      SELECT DISTINCT category FROM announcements
      WHERE category IS NOT NULL
      ORDER BY category
    `
    return NextResponse.json(rows.map((r: any) => r.category))
  } catch (e) {
    console.error('announcements categories GET error:', e)
    return NextResponse.json([])
  }
}
