import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { parseTimeMins } from '@/lib/staffTimes'
import { NextRequest, NextResponse } from 'next/server'

// Turns a day's staff_times rows into two clock boundaries -- the earliest
// clock-in (shop opening) and the latest clock-out (last staff to sign
// out) -- so the Live Sale Log tab can show a real "since opening"/"until
// sign-out" gap for the first and last tap of each day instead of nothing.
// actual_in/actual_out are plain "8:45am"-style strings with no date of
// their own (see parseTimeMins), so the minutes-since-midnight they parse
// to get stitched back onto the requested work_date here.
function toIso(date: string, mins: number) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const datesParam = req.nextUrl.searchParams.get('dates') || ''
  const dates = Array.from(new Set(datesParam.split(',').map(d => d.trim()).filter(Boolean))).slice(0, 120)
  if (!dates.length) return NextResponse.json([])

  const rows = await sql`
    SELECT work_date::text AS work_date, actual_in, actual_out
    FROM staff_times
    WHERE work_date = ANY(${dates}::date[])
  `

  const byDate = new Map<string, { actual_in: string | null; actual_out: string | null }[]>()
  for (const r of rows as { work_date: string; actual_in: string | null; actual_out: string | null }[]) {
    if (!byDate.has(r.work_date)) byDate.set(r.work_date, [])
    byDate.get(r.work_date)!.push(r)
  }

  const result = dates.map(date => {
    const dayRows = byDate.get(date) ?? []
    let openMins: number | null = null
    let closeMins: number | null = null
    for (const r of dayRows) {
      const inMins = parseTimeMins(r.actual_in)
      if (inMins !== null && (openMins === null || inMins < openMins)) openMins = inMins
      const outMins = parseTimeMins(r.actual_out)
      if (outMins !== null && (closeMins === null || outMins > closeMins)) closeMins = outMins
    }
    return {
      date,
      openTime: openMins !== null ? toIso(date, openMins) : null,
      closeTime: closeMins !== null ? toIso(date, closeMins) : null,
    }
  })

  return NextResponse.json(result)
}
