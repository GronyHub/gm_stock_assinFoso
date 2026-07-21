import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { distanceMeters, SHOP_LAT, SHOP_LNG, ALLOWED_RADIUS_METERS } from '@/lib/geo'
import { openerOf } from '@/lib/staffTimes'
import { ensureClosingReports } from '@/lib/closingReports'
import { NextRequest, NextResponse } from 'next/server'

// The Opener (earliest clock-in of the day) must confirm today's daily
// counts before their clock-in counts as fully complete -- see
// /api/staff-times/opening-count. This never delays or overrides actual_in
// itself, only this separate confirmation flag.
async function ensureOpeningCountCol() {
  await sql`ALTER TABLE staff_times ADD COLUMN IF NOT EXISTS opening_count_confirmed BOOLEAN NOT NULL DEFAULT FALSE`.catch(() => {})
}

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
    await ensureOpeningCountCol()
    let mine: any
    try {
      ;[mine] = await sql`
        SELECT actual_in, actual_out, opening_count_confirmed FROM staff_times
        WHERE staff_name = ${username} AND work_date = ${today}
      `
    } catch {
      ;[mine] = await sql`
        SELECT actual_in, actual_out FROM staff_times
        WHERE staff_name = ${username} AND work_date = ${today}
      `
    }

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

    let closerName: string | null = null
    try {
      await ensureClosingReports()
      const [report] = await sql`SELECT closer_name FROM closing_reports WHERE work_date = ${today}`
      closerName = report?.closer_name ?? null
    } catch { /* table may not exist yet */ }

    // Today's opener's own confirmation status -- not just "mine" -- so
    // anyone (e.g. the RoleBar's Opener tab) can see whether today's opener
    // has confirmed their opening count, regardless of who's asking.
    const openerName = openerOf(todayRows)
    let openerConfirmed: boolean | null = null
    if (openerName) {
      try {
        const [openerRow] = await sql`
          SELECT opening_count_confirmed FROM staff_times WHERE staff_name = ${openerName} AND work_date = ${today}
        `
        openerConfirmed = !!openerRow?.opening_count_confirmed
      } catch { openerConfirmed = null }
    }

    return NextResponse.json({
      today: todayRows,
      mine: mine ?? null,
      recent,
      opener: openerName,
      openerConfirmed,
      closer: closerName,
    })
  } catch (e) {
    console.error('staff-times GET error:', e)
    return NextResponse.json({ today: [], mine: null, recent: [], opener: null, openerConfirmed: null, closer: null })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const sessionUser = session?.user as any
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, time, latitude, longitude, closing_report } = await req.json()
  if (!action || !time) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  if (!['in', 'out'].includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  const username = sessionUser.username ?? sessionUser.name
  const today = new Date().toISOString().slice(0, 10)
  const enteredBy = session?.user?.name || (session?.user as any)?.username || null

  const lat = parseFloat(latitude)
  const lng = parseFloat(longitude)
  const hasLocation = !isNaN(lat) && !isNaN(lng)
  const distance = hasLocation ? distanceMeters(lat, lng, SHOP_LAT, SHOP_LNG) : null
  const accepted = hasLocation && distance !== null && distance <= ALLOWED_RADIUS_METERS

  try {
    await sql`
      INSERT INTO clock_locations (staff_name, action, latitude, longitude, distance_meters, accepted)
      VALUES (${username}, ${action}, ${hasLocation ? lat : null}, ${hasLocation ? lng : null}, ${distance}, ${accepted})
    `
  } catch (e) {
    console.error('clock_locations insert failed (non-fatal):', e)
  }

  await ensureOpeningCountCol()

  if (!hasLocation) {
    return NextResponse.json({ error: 'Location is required to clock in/out. Please enable location services and try again.' }, { status: 400 })
  }
  if (!accepted) {
    return NextResponse.json({ error: `You're too far from the shop to clock in/out (about ${Math.round(distance!)}m away).` }, { status: 400 })
  }

  try {
    let isCloser = false
    let closerReportJustSaved = false

    if (action === 'out') {
      const [existing] = await sql`
        SELECT actual_in FROM staff_times WHERE staff_name = ${username} AND work_date = ${today}
      `
      if (!existing?.actual_in) {
        return NextResponse.json({ error: 'You must record Time In first' }, { status: 400 })
      }

      // Closer = the last staff member to clock out: everyone else who clocked
      // in today has already clocked out. The Closer must submit the closing
      // questionnaire before their clock-out is accepted.
      const presentToday = await sql`
        SELECT staff_name, actual_in, actual_out FROM staff_times
        WHERE work_date = ${today} AND actual_in IS NOT NULL
        ORDER BY staff_name
      `
      const others = presentToday.filter((r: any) => r.staff_name !== username)
      isCloser = others.every((r: any) => r.actual_out)

      if (isCloser) {
        await ensureClosingReports()
        const [existingReport] = await sql`SELECT id FROM closing_reports WHERE work_date = ${today}`
        if (!existingReport) {
          const cr = closing_report
          const yesNoKeys = ['advert_played', 'property_issue', 'speaker_brought_in', 'new_customer', 'unfortunate_event'] as const
          const valid = cr && typeof cr === 'object' && yesNoKeys.every(k => typeof cr[k] === 'boolean')
          if (!valid) {
            return NextResponse.json({
              requires_closing_report: true,
              present_staff: presentToday.map((r: any) => r.staff_name),
              error: 'You are the Closer for today — please answer the closing questions before clocking out.',
            }, { status: 409 })
          }

          const noTshirt = (Array.isArray(cr.no_tshirt_staff) ? cr.no_tshirt_staff : [])
            .map((s: any) => String(s).trim()).filter(Boolean)
          await sql`
            INSERT INTO closing_reports
              (work_date, closer_name, no_tshirt_staff, advert_played, property_issue,
               speaker_brought_in, new_customer, new_customer_details,
               unfortunate_event, unfortunate_event_details)
            VALUES
              (${today}, ${username}, ${noTshirt.join(', ')}, ${cr.advert_played}, ${cr.property_issue},
               ${cr.speaker_brought_in}, ${cr.new_customer}, ${cr.new_customer ? (cr.new_customer_details || null) : null},
               ${cr.unfortunate_event}, ${cr.unfortunate_event ? (cr.unfortunate_event_details || null) : null})
            ON CONFLICT (work_date) DO NOTHING
          `
          closerReportJustSaved = true

          const summary = [
            `No company T-shirt: ${noTshirt.length ? noTshirt.join(', ') : 'none'}`,
            `Roadside advert played: ${cr.advert_played ? 'Yes' : 'No'}`,
            `Spoilt/lost property: ${cr.property_issue ? 'Yes' : 'No'}`,
            `Speaker & wires brought in: ${cr.speaker_brought_in ? 'Yes' : 'No'}`,
            `New customer of interest: ${cr.new_customer ? `Yes — ${cr.new_customer_details || 'no details'}` : 'No'}`,
            `Unfortunate event: ${cr.unfortunate_event ? `Yes — ${cr.unfortunate_event_details || 'no details'}` : 'No'}`,
          ].join(' · ')
          await logActivity(username, 'submitted closing report', summary)
        }
      }
    }

    // Avoid relying on a specific ON CONFLICT target constraint existing —
    // check for an existing row first, then UPDATE or INSERT accordingly.
    const [existingRow] = await sql`
      SELECT id FROM staff_times WHERE staff_name = ${username} AND work_date = ${today}
    `

    if (existingRow) {
      if (action === 'in') {
        try {
          await sql`UPDATE staff_times SET actual_in = ${time}, entered_by = ${enteredBy} WHERE id = ${existingRow.id}`
        } catch {
          await sql`UPDATE staff_times SET actual_in = ${time} WHERE id = ${existingRow.id}`
        }
      } else {
        try {
          await sql`UPDATE staff_times SET actual_out = ${time}, entered_by = ${enteredBy} WHERE id = ${existingRow.id}`
        } catch {
          await sql`UPDATE staff_times SET actual_out = ${time} WHERE id = ${existingRow.id}`
        }
      }
    } else {
      if (action === 'in') {
        try {
          await sql`
            INSERT INTO staff_times (staff_name, work_date, actual_in, entered_by)
            VALUES (${username}, ${today}, ${time}, ${enteredBy})
          `
        } catch {
          await sql`
            INSERT INTO staff_times (staff_name, work_date, actual_in)
            VALUES (${username}, ${today}, ${time})
          `
        }
      } else {
        try {
          await sql`
            INSERT INTO staff_times (staff_name, work_date, actual_out, entered_by)
            VALUES (${username}, ${today}, ${time}, ${enteredBy})
          `
        } catch {
          await sql`
            INSERT INTO staff_times (staff_name, work_date, actual_out)
            VALUES (${username}, ${today}, ${time})
          `
        }
      }
    }

    const [updated] = await sql`
      SELECT actual_in, actual_out, opening_count_confirmed FROM staff_times
      WHERE staff_name = ${username} AND work_date = ${today}
    `

    // Opener = earliest clock-in of the day; recompute after saving so the
    // response can tell the user they earned the role.
    let isOpener = false
    if (action === 'in') {
      const todayRows = await sql`
        SELECT staff_name, actual_in FROM staff_times
        WHERE work_date = ${today} AND actual_in IS NOT NULL
      `
      isOpener = openerOf(todayRows) === username
    }

    await logActivity(
      enteredBy ?? username,
      action === 'in' ? 'clocked in' : 'clocked out',
      isOpener ? `${time} — Opener for today` : (action === 'out' && isCloser ? `${time} — Closer for today` : time)
    )

    return NextResponse.json({
      ...updated,
      is_opener: isOpener,
      is_closer: action === 'out' && isCloser,
      closing_report_saved: closerReportJustSaved,
    })
  } catch (e) {
    console.error('staff-times POST error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not save your time: ${detail}` }, { status: 500 })
  }
}
