import { recordActivity } from '@/lib/logger'
import { othersStillIn, raiseChecks } from '@/lib/presenceCheck'
import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { distanceMeters, allowedRadiusMeters, SHOP_LAT, SHOP_LNG } from '@/lib/geo'
import { openerOf, parseTimeMins } from '@/lib/staffTimes'
import { ensureClosingReports, saveClosingReport, validClosing } from '@/lib/closingReports'
import { suspendedMessage } from '@/lib/penalties'
import { NextRequest, NextResponse } from 'next/server'
import { once } from '@/lib/once'
import { recordBackdate, BACKDATE_MINUTES } from '@/lib/clockViolations'
import { notifyManagement, notifyInput } from '@/lib/checklistAlerts'

// The Opener (earliest clock-in of the day) must confirm today's daily
// counts before their clock-in counts as fully complete -- see
// /api/staff-times/opening-count. This never delays or overrides actual_in
// itself, only this separate confirmation flag.
const ensureOpeningCountCol = once(async () => {
  await sql`ALTER TABLE staff_times ADD COLUMN IF NOT EXISTS opening_count_confirmed BOOLEAN NOT NULL DEFAULT FALSE`.catch(() => {})
})

// in_source/out_source record how each time got there -- 'clock' for the
// GPS-gated Clock In/Out buttons (set below), 'manual' for the "+ Add
// Entry"/edit forms (see /api/staff-times/entry and entry-id). Drives the
// green/red SourceDot next to each displayed time in StaffClient.tsx.
const ensureSourceCols = once(async () => {
  await sql`ALTER TABLE staff_times ADD COLUMN IF NOT EXISTS in_source TEXT`.catch(() => {})
  await sql`ALTER TABLE staff_times ADD COLUMN IF NOT EXISTS out_source TEXT`.catch(() => {})
})

// See /api/staff-times/break's own comment -- ensured here too (same
// duplicated-per-route pattern as the other columns above) so `mine`'s
// initial on_break value is correct on page load, not just after a toggle.
const ensureBreakCol = once(async () => {
  await sql`ALTER TABLE staff_times ADD COLUMN IF NOT EXISTS on_break BOOLEAN NOT NULL DEFAULT FALSE`.catch(() => {})
})

// clock_locations predates the accuracy-tolerance check (see lib/geo.ts's
// allowedRadiusMeters) -- ensured here rather than requiring another manual
// run of scripts/setup-clock-locations.mjs against production.
const ensureAccuracyCol = once(async () => {
  await sql`ALTER TABLE clock_locations ADD COLUMN IF NOT EXISTS accuracy_meters DOUBLE PRECISION`.catch(() => {})
})

export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return success({ today: [], mine: null, recent: [], opener: null, openerConfirmed: null, closer: null })

  const sessionUser = session?.user as any

  try {
    const today = new Date().toISOString().slice(0, 10)
    await ensureSourceCols()

    let todayRows: any[]
    try {
      todayRows = await sql`
        SELECT staff_name, actual_in, actual_out, in_source, out_source
        FROM staff_times
        WHERE work_date = ${today}
        ORDER BY staff_name
      `
    } catch {
      todayRows = await sql`
        SELECT staff_name, actual_in, actual_out
        FROM staff_times
        WHERE work_date = ${today}
        ORDER BY staff_name
      `
    }

    const username = sessionUser?.username ?? sessionUser?.name
    await ensureOpeningCountCol()
    await ensureBreakCol()
    let mine: any
    try {
      ;[mine] = await sql`
        SELECT actual_in, actual_out, opening_count_confirmed, in_source, out_source, on_break FROM staff_times
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
        SELECT staff_name, work_date::text, actual_in, actual_out, entered_by, in_source, out_source
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
    // anyone (e.g. Grony Manage's Opener view) can see whether today's
    // opener has confirmed their opening count, regardless of who's asking.
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

    return success({
      today: todayRows,
      mine: mine ?? null,
      recent,
      opener: openerName,
      openerConfirmed,
      closer: closerName,
    })
  } catch (e) {
    console.error('staff-times GET error:', e)
    return success({ today: [], mine: null, recent: [], opener: null, openerConfirmed: null, closer: null })
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const sessionUser = session?.user as any

  const { action, time: sentTime, picked, presence, absent, latitude, longitude, accuracy, closing_report, no_gps } = await req.json()
  if (!action) return badRequest('Missing fields')
  // The time is the SERVER's clock (Ghana = UTC), never the device's: a phone or computer with a wrong clock once recorded a 7:50pm clock-out at 6:32pm
  // (James, 2026-11-13). Only a time the person deliberately picked ("Pick a different time") is taken from them, and only when it is not later than now.
  const nowD = new Date(), nowM = nowD.getUTCHours() * 60 + nowD.getUTCMinutes()
  const serverTime = `${((nowD.getUTCHours() + 11) % 12) + 1}:${String(nowD.getUTCMinutes()).padStart(2, '0')}${nowD.getUTCHours() < 12 ? 'am' : 'pm'}`
  const sentM = sentTime ? parseTimeMins(String(sentTime)) : null
  if (picked && sentM != null && sentM > nowM + 5) return badRequest(`That time (${sentTime}) is later than now. Pick a time that has already passed.`)
  const time = picked && sentM != null ? String(sentTime) : serverTime
  if (!['in', 'out'].includes(action)) return badRequest('Invalid action')
  if (action === 'in' && sessionUser?.role !== 'owner') {
    const msg = await suspendedMessage(String(sessionUser?.username ?? sessionUser?.name ?? ''), new Date().toISOString().slice(0, 10))
    if (msg) return badRequest(msg)
  }

  const username = sessionUser?.username ?? sessionUser?.name
  const today = new Date().toISOString().slice(0, 10)
  const enteredBy = session?.user?.name || (session?.user as any)?.username || null

  const lat = parseFloat(latitude)
  const lng = parseFloat(longitude)
  const acc = parseFloat(accuracy)
  const hasLocation = !isNaN(lat) && !isNaN(lng)
  const distance = hasLocation ? distanceMeters(lat, lng, SHOP_LAT, SHOP_LNG) : null
  const radius = allowedRadiusMeters(hasLocation && !isNaN(acc) ? acc : null)
  const accepted = hasLocation && distance !== null && distance <= radius

  try {
    await ensureAccuracyCol()
    await sql`
      INSERT INTO clock_locations (staff_name, action, latitude, longitude, distance_meters, accuracy_meters, accepted)
      VALUES (${username}, ${action}, ${hasLocation ? lat : null}, ${hasLocation ? lng : null}, ${distance}, ${hasLocation && !isNaN(acc) ? acc : null}, ${accepted})
    `
  } catch (e) {
    console.error('clock_locations insert failed (non-fatal):', e)
  }

  await ensureOpeningCountCol()

  // A clock-IN without a usable GPS fix (denied, unavailable, or not at the shop) is allowed only when the person asks for it: it is then held for the manager, who checks the CCTV and
  // approves or rejects the time (see below). Clocking OUT still needs the GPS.
  const unverified = action === 'in' && (!hasLocation || !accepted) && !!no_gps
  if (!unverified) {
    if (!hasLocation) {
      const m = 'Location is required to clock in/out. Please enable location services and try again.'
      return action === 'in' ? NextResponse.json({ error: m, offer_cctv: true }, { status: 400 }) : badRequest(m)
    }
    if (!accepted) {
      const m = `You're too far from the shop to clock in/out (about ${Math.round(distance!)}m away).`
      return action === 'in' ? NextResponse.json({ error: m, offer_cctv: true }, { status: 400 }) : badRequest(m)
    }
  }

  try {
    let isCloser = false
    let closerReportJustSaved = false
    let stillIn: string[] = []

    // Opener = earliest actual_in of the day, and there can only be one --
    // without this, a later clock-in (real or backdated via the "pick a
    // time" option) could enter a time earlier than the already-established
    // opener's and silently take over the role after the fact, which is
    // confusing (both show up as "Opener for today" in the activity log,
    // see the 21st July case) and shouldn't be possible.
    if (action === 'in') {
      const others = await sql`
        SELECT staff_name, actual_in FROM staff_times
        WHERE work_date = ${today} AND actual_in IS NOT NULL AND staff_name <> ${username}
      ` as { staff_name: string; actual_in: string | null }[]
      const currentOpener = openerOf(others)
      if (currentOpener) {
        const openerTime = others.find(r => r.staff_name === currentOpener)?.actual_in ?? null
        const openerMins = parseTimeMins(openerTime)
        const thisMins = parseTimeMins(time)
        if (openerMins !== null && thisMins !== null && thisMins < openerMins) {
          return badRequest(`${currentOpener} is already today's Opener (clocked in at ${openerTime}) — you can't clock in with an earlier time than that.`)
        }
      }
    }

    if (action === 'out') {
      const [existing] = await sql`
        SELECT actual_in FROM staff_times WHERE staff_name = ${username} AND work_date = ${today}
      `
      if (!existing?.actual_in) {
        return badRequest('You must record Time In first')
      }
      // Compulsory before clocking out: "Is any of the following staff still at the shop?" for everyone else still clocked in. No answer, no clock-out.
      if (String(username).toLowerCase() !== 'grony' && await (await import('@/lib/featuresServer')).featureOn('presence_question')) {
        stillIn = await othersStillIn(String(username).toLowerCase(), today)
        const absentList = Array.isArray(absent) ? absent.map((x: unknown) => String(x).toLowerCase()).filter((x: string) => stillIn.includes(x)) : []
        if (stillIn.length && presence === 'no' && !absentList.length)
          return NextResponse.json({ error: 'Choose who is not at the shop.', requires_presence: true, others: stillIn }, { status: 409 })
        if (stillIn.length && presence !== 'yes' && presence !== 'no')
          return NextResponse.json({ error: 'Answer the question before you clock out.', requires_presence: true, others: stillIn }, { status: 409 })
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

      // The closing report is no longer a gate on clocking out (clock-out is automatic when forgotten). It is answered from the Daily Checklist;
      // if the closer sends it with the clock-out anyway, it is saved.
      if (isCloser && validClosing(closing_report)) {
        closerReportJustSaved = await saveClosingReport(today, username, closing_report)
      }
    }

    // Avoid relying on a specific ON CONFLICT target constraint existing —
    // check for an existing row first, then UPDATE or INSERT accordingly.
    const [existingRow] = await sql`
      SELECT id, actual_in, actual_out FROM staff_times WHERE staff_name = ${username} AND work_date = ${today}
    `
    // Once only: a time in or a time out already recorded for the day cannot be recorded again (that would be a way to change it).
    if (action === 'in' && existingRow?.actual_in) return badRequest(`You already clocked in today at ${existingRow.actual_in}. To correct it, ask Joe or Grony.`)
    if (action === 'out' && existingRow?.actual_out) return badRequest(`You already clocked out today at ${existingRow.actual_out}. To correct it, ask Joe or Grony.`)

    await ensureSourceCols()

    if (existingRow) {
      if (action === 'in') {
        try {
          await sql`UPDATE staff_times SET actual_in = ${time}, in_source = ${unverified ? 'unverified' : 'clock'}, entered_by = ${enteredBy} WHERE id = ${existingRow.id}`
        } catch {
          await sql`UPDATE staff_times SET actual_in = ${time} WHERE id = ${existingRow.id}`
        }
      } else {
        try {
          await sql`UPDATE staff_times SET actual_out = ${time}, out_source = 'clock', entered_by = ${enteredBy} WHERE id = ${existingRow.id}`
        } catch {
          await sql`UPDATE staff_times SET actual_out = ${time} WHERE id = ${existingRow.id}`
        }
      }
    } else {
      if (action === 'in') {
        try {
          await sql`
            INSERT INTO staff_times (staff_name, work_date, actual_in, in_source, entered_by)
            VALUES (${username}, ${today}, ${time}, ${unverified ? 'unverified' : 'clock'}, ${enteredBy})
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
            INSERT INTO staff_times (staff_name, work_date, actual_out, out_source, entered_by)
            VALUES (${username}, ${today}, ${time}, 'clock', ${enteredBy})
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
      SELECT actual_in, actual_out, opening_count_confirmed, in_source, out_source FROM staff_times
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

    // The presence answer: recorded in Done and told to the owner and Joe. "No" also asks each of them to confirm they are at the shop within a minute.
    if (action === 'out' && stillIn.length) {
      const me = String(username).toLowerCase(), who = me.charAt(0).toUpperCase() + me.slice(1), names = stillIn.map(n => n.charAt(0).toUpperCase() + n.slice(1))
      if (presence === 'yes') {
        void recordActivity(who, 'said others are still at the shop', names.join(', '))
        void notifyInput(me, `${who} clocked out`, `${who} says ${names.join(' and ')} ${names.length === 1 ? 'is' : 'are'} still at the shop.`)
      } else {
        const gone = (Array.isArray(absent) ? absent.map((x: unknown) => String(x).toLowerCase()) : []).filter((x: string) => stillIn.includes(x))
        const here = stillIn.filter(n => !gone.includes(n)).map(n => n.charAt(0).toUpperCase() + n.slice(1))
        if (here.length) void recordActivity(who, 'said others are still at the shop', here.join(', '))
        await raiseChecks(me, gone).catch(() => [])
      }
    }

    // After a clock-in: the time written is 30+ minutes before now -> a violation (5 = 1 point); no GPS -> held for the manager to approve from the CCTV.
    let backdated: { minutes: number; count: number; pointAwarded: boolean } | null = null
    let pendingApproval = false
    if (action === 'in' && String(username).toLowerCase() !== 'grony') {
      const who = String(username).toLowerCase(), wm = parseTimeMins(time), nowM = new Date().getUTCHours() * 60 + new Date().getUTCMinutes()
      if (wm != null && nowM - wm >= BACKDATE_MINUTES) {
        const r = await recordBackdate(who, today, time, nowM - wm).catch(() => null)
        if (r) {
          backdated = { minutes: nowM - wm, ...r }
          const nm = who.charAt(0).toUpperCase() + who.slice(1)
          void notifyManagement(who, `${nm} wrote an earlier clock-in time`, `Wrote ${time}, ${nowM - wm} minutes before it was recorded. Violation ${r.count % 5 === 0 ? 5 : r.count % 5} of 5${r.pointAwarded ? ': 1 penalty point added' : ''}.`)
        }
      }
      if (unverified) {
        await sql`UPDATE clock_corrections SET status = 'rejected', note = 'Replaced by a newer entry' WHERE staff = ${who} AND work_date = ${today} AND field = 'in' AND status = 'pending'`.catch(() => {})
        await sql`INSERT INTO clock_corrections (staff, work_date, kind, proposed_out, basis, field) VALUES (${who}, ${today}, 'entered', ${time}, ${'No GPS: the manager checks the CCTV and approves the time in'}, 'in')`.catch(() => {})
        pendingApproval = true
        void notifyManagement(who, `${who.charAt(0).toUpperCase() + who.slice(1)} clocked in without GPS`, `Time in ${time}. Check the CCTV, then approve or reject it (Waiting for team, or Shop > Times > the clock icon).`)
      }
    }

    return success({
      ...updated,
      backdated,
      pending_approval: pendingApproval,
      is_opener: isOpener,
      is_closer: action === 'out' && isCloser,
      closing_report_saved: closerReportJustSaved,
    })
  } catch (e) {
    return handleError('staff-times POST', e)
  }
}
