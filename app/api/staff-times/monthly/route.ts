import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { NextRequest, NextResponse } from 'next/server'

function parseTimeMins(t: string | null): number | null {
  if (!t) return null
  const m = t.match(/^(\d+):(\d+)(am|pm)$/i)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (m[3].toLowerCase() === 'pm' && h !== 12) h += 12
  if (m[3].toLowerCase() === 'am' && h === 12) h = 0
  return h * 60 + min
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !isOwnerLevel(session.user as any)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const month = req.nextUrl.searchParams.get('month')
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month=YYYY-MM is required' }, { status: 400 })
  }
  const [y, m] = month.split('-').map(Number)
  const startDate = `${month}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const endDate = `${month}-${String(lastDay).padStart(2, '0')}`

  const rows = await sql`
    SELECT staff_name, actual_in, actual_out
    FROM staff_times
    WHERE work_date >= ${startDate} AND work_date <= ${endDate}
      AND actual_in IS NOT NULL AND actual_out IS NOT NULL
  `

  const mins: Record<string, number> = {}
  for (const r of rows) {
    const name = r.staff_name.charAt(0).toUpperCase() + r.staff_name.slice(1).toLowerCase()
    const inM = parseTimeMins(r.actual_in), outM = parseTimeMins(r.actual_out)
    if (inM == null || outM == null) continue
    mins[name] = (mins[name] ?? 0) + (outM >= inM ? outM - inM : (outM + 1440) - inM)
  }

  const hours: Record<string, number> = {}
  for (const [name, total] of Object.entries(mins)) hours[name] = Math.round((total / 60) * 10000) / 10000

  return NextResponse.json({ hours, endDate })
}
