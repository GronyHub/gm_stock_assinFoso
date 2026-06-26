import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// Returns staff presence grouped by date: { date: { staff_name, actual_in, actual_out }[] }
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({}, { status: 401 })

  try {
    const rows = await sql`
      SELECT staff_name, work_date::text AS date, actual_in, actual_out
      FROM staff_times
      WHERE staff_name <> '__shop_open__'
      ORDER BY work_date DESC, staff_name
    `
    // Group by date
    const byDate: Record<string, { staff_name: string; actual_in: string | null; actual_out: string | null }[]> = {}
    for (const r of rows) {
      if (!byDate[r.date]) byDate[r.date] = []
      byDate[r.date].push({ staff_name: r.staff_name, actual_in: r.actual_in, actual_out: r.actual_out })
    }
    return NextResponse.json(byDate)
  } catch {
    return NextResponse.json({})
  }
}
