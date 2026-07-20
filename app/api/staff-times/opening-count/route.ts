import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { openerOf } from '@/lib/staffTimes'
import { outstandingDailyItems } from '@/lib/countRules'
import { NextResponse } from 'next/server'

async function ensureCol() {
  await sql`ALTER TABLE staff_times ADD COLUMN IF NOT EXISTS opening_count_confirmed BOOLEAN NOT NULL DEFAULT FALSE`.catch(() => {})
}

// The Opener (earliest clock-in of the day) confirms here, once today's
// daily counts are all done, that their clock-in is fully complete. The
// clock-in time itself was already recorded at /api/staff-times/today and
// is never touched by this -- only opening_count_confirmed changes.
export async function POST() {
  const session = await auth()
  const sessionUser = session?.user as any
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const username = sessionUser.username ?? sessionUser.name
  const today = new Date().toISOString().slice(0, 10)

  try {
    await ensureCol()

    const [mine] = await sql`
      SELECT id, actual_in FROM staff_times WHERE staff_name = ${username} AND work_date = ${today}
    `
    if (!mine?.actual_in) {
      return NextResponse.json({ error: 'Clock in first before confirming the opening counts.' }, { status: 400 })
    }

    const todayRows = await sql`
      SELECT staff_name, actual_in FROM staff_times WHERE work_date = ${today} AND actual_in IS NOT NULL
    `
    if (openerOf(todayRows) !== username) {
      return NextResponse.json({ error: "Only today's Opener needs to confirm the opening counts." }, { status: 400 })
    }

    const outstanding = await outstandingDailyItems()
    if (outstanding.length > 0) {
      const names = outstanding.map((i: any) => i.item_name)
      return NextResponse.json({
        error: `${outstanding.length} item${outstanding.length !== 1 ? 's' : ''} still need${outstanding.length === 1 ? 's' : ''} counting today: ${names.slice(0, 5).join(', ')}${names.length > 5 ? '…' : ''}`,
        remaining: names,
      }, { status: 409 })
    }

    await sql`UPDATE staff_times SET opening_count_confirmed = true WHERE id = ${mine.id}`
    await logActivity(username, 'confirmed opening counts', today)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('opening-count POST error:', e)
    return NextResponse.json({ error: 'Could not confirm opening counts. Please try again.' }, { status: 500 })
  }
}
