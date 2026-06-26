import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  const sessionUser = session?.user as any
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const today = new Date().toISOString().slice(0, 10)

    const todayRows = await sql`
      SELECT staff_name, actual_in, actual_out
      FROM staff_times
      WHERE work_date = ${today}
      ORDER BY staff_name
    `

    const username = sessionUser.username ?? sessionUser.name
    const [mine] = await sql`
      SELECT actual_in, actual_out FROM staff_times
      WHERE staff_name = ${username} AND work_date = ${today}
    `

    let recent: any[] = []
    try {
      recent = await sql`
        SELECT staff_name, work_date::text, actual_in, actual_out, entered_by
        FROM staff_times
        ORDER BY work_date DESC, staff_name
      `
    } catch {
      recent = await sql`
        SELECT staff_name, work_date::text, actual_in, actual_out, NULL AS entered_by
        FROM staff_times
        ORDER BY work_date DESC, staff_name
      `
    }

    return NextResponse.json({ today: todayRows, mine: mine ?? null, recent })
  } catch (e) {
    console.error('staff-times GET error:', e)
    return NextResponse.json({ today: [], mine: null, recent: [] })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const sessionUser = session?.user as any
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, time } = await req.json()
  if (!action || !time) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  if (!['in', 'out'].includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  const username = sessionUser.username ?? sessionUser.name
  const today = new Date().toISOString().slice(0, 10)
  const enteredBy = session?.user?.name || (session?.user as any)?.username || null

  try {
    if (action === 'out') {
      const [existing] = await sql`
        SELECT actual_in FROM staff_times WHERE staff_name = ${username} AND work_date = ${today}
      `
      if (!existing?.actual_in) {
        return NextResponse.json({ error: 'You must record Time In first' }, { status: 400 })
      }
    }

    // Avoid relying on a specific ON CONFLICT target constraint existing —
    // check for an existing row first, then UPDATE or INSERT accordingly.
    const [existingRow] = await sql`
      SELECT id FROM staff_times WHERE staff_name = ${username} AND work_date = ${today}
    `

    if (existingRow) {
      if (action === 'in') {
        await sql`UPDATE staff_times SET actual_in = ${time}, entered_by = ${enteredBy} WHERE id = ${existingRow.id}`
      } else {
        await sql`UPDATE staff_times SET actual_out = ${time}, entered_by = ${enteredBy} WHERE id = ${existingRow.id}`
      }
    } else {
      if (action === 'in') {
        await sql`
          INSERT INTO staff_times (staff_name, work_date, actual_in, entered_by)
          VALUES (${username}, ${today}, ${time}, ${enteredBy})
        `
      } else {
        await sql`
          INSERT INTO staff_times (staff_name, work_date, actual_out, entered_by)
          VALUES (${username}, ${today}, ${time}, ${enteredBy})
        `
      }
    }

    const [updated] = await sql`
      SELECT actual_in, actual_out FROM staff_times
      WHERE staff_name = ${username} AND work_date = ${today}
    `
    return NextResponse.json(updated)
  } catch (e) {
    console.error('staff-times POST error:', e)
    return NextResponse.json({ error: 'Could not save your time. Please try again.' }, { status: 500 })
  }
}
