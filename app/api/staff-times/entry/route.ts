import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'

// Ensure status column exists (runs once, no-op after first time)
async function ensureStatusCol() {
  try {
    await sql`ALTER TABLE staff_times ADD COLUMN IF NOT EXISTS status TEXT`
  } catch {}
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { staff_name, work_date, actual_in, actual_out, status } = await req.json()
  if (!staff_name || !work_date) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  if (!actual_in && !status) {
    return NextResponse.json({ error: 'Provide either a time or a status' }, { status: 400 })
  }

  await ensureStatusCol()
  const enteredBy = (session.user as any)?.username || session.user?.name || null

  try {
    const [existing] = await sql`
      SELECT id FROM staff_times WHERE staff_name = ${staff_name} AND work_date = ${work_date}
    `
    if (existing) {
      await sql`
        UPDATE staff_times
        SET actual_in = ${actual_in ?? null},
            actual_out = ${actual_out ?? null},
            status = ${status ?? null},
            entered_by = ${enteredBy}
        WHERE id = ${existing.id}
      `
    } else {
      await sql`
        INSERT INTO staff_times (staff_name, work_date, actual_in, actual_out, status, entered_by)
        VALUES (${staff_name}, ${work_date}, ${actual_in ?? null}, ${actual_out ?? null}, ${status ?? null}, ${enteredBy})
      `
    }

    const desc = status
      ? `${staff_name} · ${status} on ${work_date}`
      : `${staff_name} · in ${actual_in}${actual_out ? ` out ${actual_out}` : ''} on ${work_date}`
    await logActivity(enteredBy ?? 'Unknown', 'entered time', desc)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('staff-times entry POST error:', e)
    return NextResponse.json({ error: 'Could not save time entry. Please try again.' }, { status: 500 })
  }
}
