import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { isManagerName, SIGNERS } from '@/lib/signers'
import { ensureAttendance, openRecords, REVIEW_FROM } from '@/lib/attendance'
import { canDecideFor } from '@/lib/penalties'
import { getClockState } from '@/lib/clockState'
import { effectiveDue, appliesOn } from '@/lib/dailyChecksShared'

// "Waiting for me": everything the signed-in person owes or must decide, from every part of the app, in one list.
// urgency: 'now' (overdue or blocking), 'soon' (due today or within 24 hours), 'later'. `href` opens in the hub's right pane; `hub` asks the hub to open a view.
export type MyDayItem = { key: string; icon: string; title: string; detail: string; count: number; urgency: 'now' | 'soon' | 'later'; href?: string; hub?: string }
const today = () => new Date().toISOString().slice(0, 10)
const safe = async <T,>(f: () => Promise<T>, d: T): Promise<T> => { try { return await f() } catch { return d } }

export async function myDay(me: string, user: unknown): Promise<MyDayItem[]> {
  await ensureAttendance()
  const items: MyDayItem[] = []
  const day = today()
  const owner = isOwnerLevel(user as never), manager = isManagerName(me)
  const isStaff = SIGNERS.includes(me)
  const add = (i: MyDayItem | null) => { if (i && i.count > 0) items.push(i) }

  if (isStaff && me !== 'grony') {
    // clock-out and clock-in matters
    const prev = (await safe(() => openRecords(me), [])).filter(r => r.d < day && r.d >= REVIEW_FROM)
    add({ key: 'clock-prev', icon: '🕐', title: 'You did not clock out', detail: `${prev.length} earlier day${prev.length === 1 ? '' : 's'} without a time out. Enter your time out.`, count: prev.length, urgency: 'now' })
    const autos = await safe(() => sql`SELECT COUNT(*)::int AS n FROM clock_autos WHERE staff = ${me} AND status = 'notified'`, [{ n: 0 }])
    const ins = await safe(() => sql`SELECT COUNT(*)::int AS n FROM clock_in_autos WHERE staff = ${me} AND status = 'notified'`, [{ n: 0 }])
    add({ key: 'clock-auto', icon: '🕐', title: 'Check your clock times', detail: 'A clock-in or clock-out was set for you. Tap OK or send the correct time.', count: Number(autos[0].n) + Number(ins[0].n), urgency: 'soon' })
    // closing report
    const [cr] = await safe(() => sql`SELECT 1 FROM closing_reports WHERE work_date = ${day}`, [] as never[])
    const [here] = await safe(() => sql`SELECT 1 FROM staff_times WHERE LOWER(staff_name) = ${me} AND work_date = ${day} AND actual_in IS NOT NULL`, [] as never[])
    if (here && !cr) add({ key: 'closing', icon: '🌙', title: 'Closing report not answered today', detail: 'Due from 5pm; you can answer it early on the Daily Checklist.', count: 1, urgency: new Date().getUTCHours() >= 17 ? 'soon' : 'later', href: '/standards?closing=1' })
    // checklist tasks the shop owes now: tiles past their due time and not yet done today (the same list the day-end point is counted from)
    await safe(async () => {
      const now = new Date()
      if (now.getUTCDay() === 0) return
      const clock = await getClockState(day)
      if (clock.dayStart == null || !clock.present.includes(me)) return
      const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes()
      const tiles = await sql`SELECT id, title, time, minutes, frequency, kind, days, (law_id IS NOT NULL AND law_id IN (SELECT id FROM page_laws WHERE audience = 'managers')) AS mgr FROM daily_check_tiles
        WHERE active AND frequency = 'daily' AND kind <> 'properties' AND time ~ '^[0-2][0-9]:[0-5][0-9]$'` as unknown as { id: number; title: string; time: string; minutes: number | null; frequency: string; kind: string; days: string | null; mgr: boolean }[]
      const todays = tiles.filter(t => appliesOn(t, day) && (!t.mgr || manager))
      const handled = new Set((await sql`SELECT tile_id FROM daily_check_events WHERE day = ${day}` as unknown as { tile_id: number }[]).map(r => r.tile_id))
      const due = effectiveDue(todays, clock.dayStart)
      const late = todays.filter(t => !handled.has(t.id) && due.has(t.id) && due.get(t.id)! <= nowMin).sort((a, b) => due.get(a.id)! - due.get(b.id)!)
      if (!late.length) return
      const worst = nowMin - due.get(late[0].id)!
      const names = late.slice(0, 3).map(t => t.title.slice(0, 40)).join('; ') + (late.length > 3 ? ` and ${late.length - 3} more` : '')
      add({ key: 'tasks', icon: '✅', title: 'Checklist tasks to do now', detail: `${names}. Each one still undone at day end costs everyone clocked in a point.`, count: late.length, urgency: worst >= 30 ? 'now' : 'soon', href: `/standards?tile=${late[0].id}` })
    }, undefined)
  }

  if (isStaff) {
    // laws to sign, quizzes, login reminders
    const unsigned = await safe(() => sql`SELECT COUNT(*)::int AS n, MIN(l.id) AS first FROM page_laws l WHERE l.status = 'live' AND (l.audience = 'staff' OR (l.audience = 'managers' AND ${manager}))
      AND NOT EXISTS (SELECT 1 FROM law_signatures s WHERE s.law_id = l.id AND s.staff = ${me})`, [{ n: 0 }])
    add({ key: 'sign', icon: '✍', title: 'Company Laws to sign', detail: 'Read each law and sign it. New laws are due within 24 hours of going live.', count: Number(unsigned[0].n), urgency: me === 'grony' ? 'later' : 'soon', // the owner is not bound by the laws, so this never inflates the bar
      href: unsigned[0].first ? `/laws?law=${unsigned[0].first}&sign=1` : '/laws?sign=1' })
    const quiz = await safe(() => sql`SELECT l.id FROM page_laws l WHERE l.status = 'live' AND (l.audience = 'staff' OR (l.audience = 'managers' AND ${manager}))
      AND l.quiz IS NOT NULL AND l.quiz <> '' AND l.quiz <> '[]' AND NOT EXISTS (SELECT 1 FROM law_quiz_marks m WHERE m.law_id = l.id AND m.staff = ${me} AND m.score::float / NULLIF(m.total, 0) >= 0.75) ORDER BY l.id`, [] as { id: number }[])
    add({ key: 'quiz', icon: '📝', title: 'Law quizzes to pass', detail: 'Pass each quiz (75% or more) within 7 days of its laws going live.', count: quiz.length, urgency: 'later', href: quiz.length ? `/laws?law=${quiz[0].id}&quiz=1` : '/laws' })
    const q = await safe(() => sql`SELECT COUNT(*)::int AS n FROM staff_queries WHERE staff = ${me} AND status = 'open'`, [{ n: 0 }])
    add({ key: 'queries', icon: '❓', title: 'Questions waiting for your answer', detail: 'A supervisor asked about a day you were at work.', count: Number(q[0].n), urgency: 'now' })
    const ack = await safe(() => sql`SELECT COUNT(*)::int AS n FROM staff_penalties WHERE staff = ${me} AND status IN ('active', 'pending') AND source = 'manual' AND ack_at IS NULL AND created_at > now() - interval '30 days'`, [{ n: 0 }])
    add({ key: 'ack', icon: '⚖', title: 'Violations logged against you', detail: 'Acknowledge each one, or dispute it with a note.', count: Number(ack[0].n), urgency: 'soon', hub: 'violations' })
  }

  // decisions for supervisors
  if (owner) {
    const claims = await safe(() => sql`SELECT COUNT(*)::int AS n FROM clock_corrections WHERE status = 'pending' AND staff <> ${me} AND COALESCE(against, '') <> ${me}`, [{ n: 0 }])
    add({ key: 'claims', icon: '🕐', title: 'Clock times to approve', detail: 'Corrections staff sent after a forgotten or supervisor clock-in or clock-out.', count: Number(claims[0].n), urgency: 'soon', href: '/standards' })
    const sanc = await safe(() => sql`SELECT staff FROM penalty_sanctions WHERE status = 'proposed'`, [] as { staff: string }[])
    add({ key: 'sanctions', icon: '⚖', title: 'Sanctions to approve', detail: 'A staff member reached a points level.', count: sanc.filter(s => canDecideFor(me, String(s.staff))).length, urgency: 'soon', href: '/penalties' })
    const viol = await safe(() => sql`SELECT staff FROM staff_penalties WHERE status IN ('pending', 'disputed')`, [] as { staff: string }[])
    add({ key: 'violations', icon: '⚖', title: 'Violations to confirm or review', detail: 'Reports waiting to be confirmed and disputes waiting for a decision.', count: viol.filter(s => canDecideFor(me, String(s.staff))).length, urgency: 'soon', href: '/penalties' })
    const drafts = await safe(() => sql`SELECT COUNT(*)::int AS n, MIN(id) AS first FROM page_laws WHERE status = 'draft'`, [{ n: 0, first: null }])
    add({ key: 'drafts', icon: '📜', title: 'Draft laws to approve', detail: 'Approving creates the checklist tiles.', count: Number(drafts[0].n), urgency: 'later', href: drafts[0].first ? `/laws?law=${drafts[0].first}` : '/laws' })
  }
  if (me === 'joe') {
    const r = await safe(() => sql`SELECT COUNT(*)::int AS n FROM cctv_reviews WHERE status = 'pending' AND work_date < ${day}`, [{ n: 0 }])
    add({ key: 'cctv', icon: '🎥', title: 'CCTV reviews to do', detail: 'Days staff worked while you were not clocked in. Due within 48 hours.', count: Number(r[0].n), urgency: 'now', href: '/cctv-review' })
  }
  const order = { now: 0, soon: 1, later: 2 }
  return items.sort((a, b) => order[a.urgency] - order[b.urgency])
}
