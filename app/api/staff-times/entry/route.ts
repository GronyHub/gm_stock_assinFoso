import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { staff_name, work_date, actual_in, actual_out } = await req.json()
  if (!staff_name || !work_date || !actual_in) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const enteredBy = session.user?.name || (session.user as any)?.username || null

  try {
    const [existingRow] = await sql`
      SELECT id FROM staff_times WHERE staff_name = ${staff_name} AND work_date = ${work_date}
    `
    if (existingRow) {
      await sql`
        UPDATE staff_times
        SET actual_in = ${actual_in}, actual_out = ${actual_out ?? null}, entered_by = ${enteredBy}
        WHERE id = ${existingRow.id}
      `
    } else {
      await sql`
        INSERT INTO staff_times (staff_name, work_date, actual_in, actual_out, entered_by)
        VALUES (${staff_name}, ${work_date}, ${actual_in}, ${actual_out ?? null}, ${enteredBy})
      `
    }

    await logActivity(enteredBy ?? 'Unknown', 'entered time', `${staff_name} · in ${actual_in}${actual_out ? ` out ${actual_out}` : ''} on ${work_date}`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('staff-times entry POST error:', e)
    return NextResponse.json({ error: 'Could not save time entry. Please try again.' }, { status: 500 })
  }
}
