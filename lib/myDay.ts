import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { isManagerName, SIGNERS } from '@/lib/signers'
import { ensureAttendance, openRecords, REVIEW_FROM } from '@/lib/attendance'
import { canDecideFor } from '@/lib/penalties'
import { getClockState, onShift, type ClockState } from '@/lib/clockState'
import { effectiveDue, appliesOn } from '@/lib/dailyChecksShared'
import { owes } from '@/lib/assignment'
import { LAW_TYPES } from '@/lib/lawCategories'
import { unmetConditions } from '@/lib/tileConditions'
import { rotaShifts, allocatedTo } from '@/lib/allocation'
import { isShopDay, rotaRolesFor } from '@/lib/rota'
import { pendingJobCounts } from '@/lib/pendingJobs'
import { canLogAgainst } from '@/lib/violationLog'
import { ACTIVE_STAFF } from '@/lib/staffList'

// "Waiting for me": everything the signed-in person owes or must decide, from every part of the app, in one list.
// urgency: 'now' (overdue or blocking), 'soon' (due today or within 24 hours), 'later'. `href` opens in the hub's right pane; `hub` asks the hub to open a view.
export type MyDayItem = { key: string; icon: string; title: string; detail: string; count: number; urgency: 'now' | 'soon' | 'later'; href?: string; hub?: string; state?: 'done' | 'not' | 'miss'; time?: string | null; who?: string; category?: string; type?: string }
const lawTypeLabel = (t: string | null | undefined) => LAW_TYPES.find(x => x.key === t)?.label
const today = () => new Date().toISOString().slice(0, 10)
const safe = async <T,>(f: () => Promise<T>, d: T): Promise<T> => { try { return await f() } catch { return d } }

// Whose list a supervisor may look at: the same people they may log violations against (the owner anyone; Joe anyone but the owner; Bino James).
export function viewablePeople(user: { username?: string | null; name?: string | null; role?: string | null } | undefined): string[] {
  const self = String(user?.username ?? user?.name ?? '').toLowerCase()
  return ACTIVE_STAFF.filter(n => n !== self && canLogAgainst(user as never, n) && (n !== 'grony' || self === 'grony'))
}

// `viewing` = a supervisor is looking at someone else's list: only that person's own matters are shown, never the supervisor's decisions.
// lens: 'todo' = what is waiting except tasks already due; 'notdone' = only the tasks due or overdue today and not yet done (not yet a violation: the point is counted at day end); 'all' (default) = both, for the badge counts.
type DayOpts = { viewing?: boolean; lens?: 'all' | 'todo' | 'notdone' }
// The list is built from ~15 queries and asked for by several badges, the team view and every open tab, so identical asks within 30 seconds share one answer
// (and one in-flight build). Anything that ticks a task clears it so the person's own list never lags behind their tap.
const g = globalThis as unknown as { __myDayCache?: Map<string, { at: number; p: Promise<MyDayItem[]> }> }
export function clearMyDayCache() { g.__myDayCache?.clear() }
export function myDay(me: string, user: unknown, opts: DayOpts = {}): Promise<MyDayItem[]> {
  const cache = (g.__myDayCache ??= new Map())
  const key = [me, opts.viewing ? 'v' : '', opts.lens ?? 'all', !opts.viewing && isOwnerLevel(user as never) ? 'o' : ''].join('|')
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < 30000) return hit.p
  const p = myDayBuild(me, user, opts)
  cache.set(key, { at: Date.now(), p })
  p.catch(() => cache.delete(key))
  if (cache.size > 200) cache.clear()
  return p
}
async function myDayBuild(me: string, user: unknown, opts: DayOpts = {}): Promise<MyDayItem[]> {
  await ensureAttendance()
  const items: MyDayItem[] = []
  const day = today()
  const owner = !opts.viewing && isOwnerLevel(user as never), manager = isManagerName(me)
  const isStaff = SIGNERS.includes(me)
  // A standing duty (laws to sign, quizzes, decisions...) is always shown: a green tick when nothing is waiting.
  const tile = (i: MyDayItem) => add(i.count > 0 ? i : { ...i, state: 'done', detail: 'Nothing waiting.', urgency: 'later' }, true)
  const add = (i: MyDayItem | null, keep = false) => { if (i && (i.count > 0 || keep)) items.push(i) }

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
    if (here && !cr) add({ key: 'closing', icon: '🌙', title: 'Closing report not answered today', detail: 'Due from 5pm; you can answer it early in Waiting for team.', count: 1, urgency: new Date().getUTCHours() >= 17 ? 'soon' : 'later', href: '/todo?closing=1' })
    // checklist tasks that fall on this person: the ones still waiting (due or later) and the ones already finished today, each as its own tile
    await safe(async () => {
      const now = new Date()
      if (!(await isShopDay(day))) return
      const clock = await getClockState(day)
      if (clock.dayStart == null || !clock.present.includes(me)) return
      const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes()
      const allTiles = await sql`SELECT id, title, time, minutes, frequency, kind, days, assignment, category, condition,
          (SELECT l.law_type FROM page_laws l WHERE l.id = daily_check_tiles.law_id) AS law_type FROM daily_check_tiles
        WHERE active AND frequency = 'daily' AND kind <> 'properties' AND time ~ '^[0-2][0-9]:[0-5][0-9]$'` as unknown as { id: number; title: string; time: string; minutes: number | null; frequency: string; kind: string; days: string | null; assignment: string | null; category: string | null; condition: string | null; law_type: string | null }[]
      const unmet = await unmetConditions()
      const tiles = allTiles.filter(t => !t.condition || !unmet.has(t.condition))
      const dayTiles = tiles.filter(t => appliesOn(t, day))
      const shifts = await rotaShifts(day)
      const evRows = await sql`SELECT tile_id, value, note, recorded_by, recorded_at, extra FROM daily_check_events WHERE day = ${day} ORDER BY recorded_at, id` as unknown as { tile_id: number; value: string; note: string | null; recorded_by: string; recorded_at: string; extra: { overruled?: boolean } | null }[]
      const latestEv = new Map<number, (typeof evRows)[number]>(); for (const r of evRows) latestEv.set(r.tile_id, r)
      const handled = new Set([...latestEv.values()].filter(r => !(r.value === 'Not done' && r.extra?.overruled)).map(r => r.tile_id))
      const due = effectiveDue(dayTiles, clock.dayStart)
      // Shared ("everyone") tasks have one named person from the rota; the Opener, Closer and manager tasks keep their own owner.
      const todays = dayTiles.filter(t => t.assignment === 'all' || !t.assignment ? due.has(t.id) && allocatedTo(t.id, due.get(t.id)!, clock, shifts) === me : owes(t.assignment, me, clock))
      const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
      const cap1 = (n: string) => n.charAt(0).toUpperCase() + n.slice(1)
      const meta = (t: (typeof tiles)[number]) => ({ who: cap1(me), category: t.category ?? undefined, type: lawTypeLabel(t.law_type) })
      // A task that fell due before this person clocked in (or after they left) was never theirs.
      const late = todays.filter(t => !handled.has(t.id) && due.has(t.id) && due.get(t.id)! <= nowMin && onShift(me, due.get(t.id)!, clock)).sort((a, b) => due.get(a.id)! - due.get(b.id)!)
      // One tile per task, so each can be opened and done from here. (Only the Not done tab lists them all.)
      const cap = opts.lens === 'notdone' ? 500 : 8
      for (const t of late.slice(0, cap)) {
        const mins = nowMin - due.get(t.id)!
        add({ key: `task-${t.id}`, icon: '⏳', title: t.title, time: hhmm(due.get(t.id)!), ...meta(t), detail: `Due ${hhmm(due.get(t.id)!)}${mins > 0 ? `, ${mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`} late` : ''}. Left undone at day end it costs a point.`, count: 1, urgency: mins >= 30 ? 'now' : 'soon', href: `/todo?tile=${t.id}` })
      }
      if (late.length > cap) add({ key: 'tasks-more', icon: '⏳', title: `${late.length - cap} more tasks to do now`, detail: 'Open Waiting for team to see them all.', count: late.length - cap, urgency: 'now', hub: undefined, href: '/todo' })
      if (opts.lens === 'notdone') return
      // Ahead of their time today: still to come
      for (const t of todays.filter(t => !handled.has(t.id) && due.has(t.id) && due.get(t.id)! > nowMin).sort((a, b) => due.get(a.id)! - due.get(b.id)!)) {
        add({ key: `tasknext-${t.id}`, icon: '🕘', title: t.title, time: hhmm(due.get(t.id)!), ...meta(t), detail: `Due ${hhmm(due.get(t.id)!)}.`, count: 0, urgency: 'later', href: `/todo?tile=${t.id}` }, true)
      }
      // Finished today (done, or marked not done with a reason): shown so the day reads complete
      for (const t of todays) {
        const ev = latestEv.get(t.id); if (!ev || ev.extra?.overruled) continue
        const when = new Date(ev.recorded_at), at = `${String(when.getUTCHours()).padStart(2, '0')}:${String(when.getUTCMinutes()).padStart(2, '0')}`
        const done = ev.value !== 'Not done'
        add({ key: `taskdone-${t.id}`, icon: done ? '✅' : '➖', title: t.title, time: due.has(t.id) ? hhmm(due.get(t.id)!) : t.time, ...meta(t), state: done ? 'done' : 'not',
          detail: done ? `Done by ${cap1(ev.recorded_by)} at ${at}.` : `Marked not done by ${cap1(ev.recorded_by)} at ${at}${ev.note ? `: ${ev.note}` : ''}.`, count: 0, urgency: 'later' }, true)
      }
    }, undefined)
  }

  if (isStaff) {
    // laws to sign, quizzes, login reminders
    const unsigned = await safe(() => sql`SELECT COUNT(*)::int AS n, MIN(l.id) AS first FROM page_laws l WHERE l.status = 'live' AND (l.audience = 'staff' OR (l.audience = 'managers' AND ${manager}))
      AND NOT EXISTS (SELECT 1 FROM law_signatures s WHERE s.law_id = l.id AND s.staff = ${me})`, [{ n: 0 }])
    tile({ key: 'sign', icon: '✍', title: 'Company Laws to sign', detail: 'Read each law and sign it. New laws are due within 24 hours of going live.', count: Number(unsigned[0].n), urgency: me === 'grony' ? 'later' : 'soon', // the owner is not bound by the laws, so this never inflates the bar
      href: unsigned[0].first ? `/laws?law=${unsigned[0].first}&sign=1` : '/laws?sign=1' })
    const quiz = await safe(() => sql`SELECT l.id FROM page_laws l WHERE l.status = 'live' AND (l.audience = 'staff' OR (l.audience = 'managers' AND ${manager}))
      AND l.quiz IS NOT NULL AND l.quiz <> '' AND l.quiz <> '[]' AND NOT EXISTS (SELECT 1 FROM law_quiz_marks m WHERE m.law_id = l.id AND m.staff = ${me} AND m.score::float / NULLIF(m.total, 0) >= 0.75) ORDER BY l.id`, [] as { id: number }[])
    tile({ key: 'quiz', icon: '📝', title: 'Law quizzes to pass', detail: 'Pass each quiz (75% or more) within 7 days of its laws going live.', count: quiz.length, urgency: 'later', href: quiz.length ? `/laws?law=${quiz[0].id}&quiz=1` : '/laws' })
    const pj = await safe(() => pendingJobCounts(), { open: 0, ready: 0, overdue: 0 })
    tile({ key: 'pending-jobs', icon: '🧾', title: 'Pending jobs overdue', detail: `${pj.overdue} job${pj.overdue === 1 ? '' : 's'} customers left ${pj.overdue === 1 ? 'is' : 'are'} past the promised date. Finish it, or call the customer.`, count: pj.overdue, urgency: 'now', href: '/pending-jobs' })
    const mt = await safe(() => sql`SELECT COUNT(*)::int AS n, MIN(due_date) AS first_due FROM custom_tasks WHERE LOWER(assigned_to) = ${me} AND NOT done AND (due_date IS NULL OR substr(due_date::text, 1, 10) <= ${day})`, [{ n: 0, first_due: null }])
    const overdue = mt[0].first_due && String(mt[0].first_due).slice(0, 10) < day
    tile({ key: 'mytasks', icon: '📌', title: 'Tasks assigned to you', detail: overdue ? 'One or more are past their due date.' : 'Tasks a manager gave you. Open your page to see them.', count: Number(mt[0].n), urgency: overdue ? 'now' : 'soon', hub: 'tasks' })
    const q = await safe(() => sql`SELECT COUNT(*)::int AS n FROM staff_queries WHERE staff = ${me} AND status = 'open'`, [{ n: 0 }])
    add({ key: 'queries', icon: '❓', title: 'Questions waiting for your answer', detail: 'A supervisor asked about a day you were at work.', count: Number(q[0].n), urgency: 'now' })
    const ack = await safe(() => sql`SELECT COUNT(*)::int AS n FROM staff_penalties WHERE staff = ${me} AND status IN ('active', 'pending') AND source = 'manual' AND ack_at IS NULL AND created_at > now() - interval '30 days'`, [{ n: 0 }])
    add({ key: 'ack', icon: '⚖', title: 'Violations logged against you', detail: 'Acknowledge each one, or dispute it with a note.', count: Number(ack[0].n), urgency: 'soon', hub: 'violations' })
  }

  // decisions for supervisors
  // A supervisor viewing the owner's or Joe's list sees the decisions waiting for them too (read-only).
  const decider = owner || (!!opts.viewing && (me === 'joe' || me === 'grony'))
  if (decider) {
    const claims = await safe(() => sql`SELECT COUNT(*)::int AS n FROM clock_corrections WHERE status = 'pending' AND staff <> ${me} AND COALESCE(against, '') <> ${me}`, [{ n: 0 }])
    tile({ key: 'claims', icon: '🕐', title: 'Clock times to approve', detail: 'Corrections staff sent after a forgotten or supervisor clock-in or clock-out.', count: Number(claims[0].n), urgency: 'soon', hub: 'waiting' })
    const sanc = await safe(() => sql`SELECT staff FROM penalty_sanctions WHERE status = 'proposed'`, [] as { staff: string }[])
    tile({ key: 'sanctions', icon: '⚖', title: 'Sanctions to approve', detail: 'A staff member reached a points level.', count: sanc.filter(s => canDecideFor(me, String(s.staff))).length, urgency: 'soon', href: '/penalties' })
    const viol = await safe(() => sql`SELECT staff FROM staff_penalties WHERE status IN ('pending', 'disputed')`, [] as { staff: string }[])
    tile({ key: 'violations', icon: '⚖', title: 'Violations to confirm or review', detail: 'Reports waiting to be confirmed and disputes waiting for a decision.', count: viol.filter(s => canDecideFor(me, String(s.staff))).length, urgency: 'soon', href: '/penalties' })
    const drafts = await safe(() => sql`SELECT COUNT(*)::int AS n, MIN(id) AS first FROM page_laws WHERE status = 'draft'`, [{ n: 0, first: null }])
    tile({ key: 'drafts', icon: '📜', title: 'Draft laws to approve', detail: 'Approving creates the checklist tiles.', count: Number(drafts[0].n), urgency: 'later', href: drafts[0].first ? `/laws?law=${drafts[0].first}` : '/laws' })
  }
  if (me === 'joe') {
    const r = await safe(() => sql`SELECT COUNT(*)::int AS n FROM cctv_reviews WHERE status = 'pending' AND work_date < ${day}`, [{ n: 0 }])
    tile({ key: 'cctv', icon: '🎥', title: 'CCTV reviews to do', detail: 'Days staff worked while you were not clocked in. Due within 48 hours.', count: Number(r[0].n), urgency: 'now', href: '/cctv-review' })
  }
  const order = { now: 0, soon: 1, later: 2 }
  const isTask = (i: MyDayItem) => i.key.startsWith('task-') || i.key === 'tasks-more'
  const pick = opts.lens === 'notdone' ? items.filter(isTask) : opts.lens === 'todo' ? items.filter(i => !isTask(i)) : items
  return pick.sort((a, b) => order[a.urgency] - order[b.urgency])
}

// Shop-wide "Not done": every task due or overdue today that nobody has done yet, with who it falls on.
export async function teamNotDone(user: unknown): Promise<{ items: MyDayItem[]; who: Record<string, string[]> }> {
  const byKey = new Map<string, MyDayItem>(), who: Record<string, string[]> = {}
  for (const n of ACTIVE_STAFF) {
    if (n === 'grony') continue
    for (const i of await myDay(n, user, { viewing: true, lens: 'notdone' })) {
      if (!byKey.has(i.key)) byKey.set(i.key, i)
      ;(who[i.key] ??= []).push(n.charAt(0).toUpperCase() + n.slice(1))
    }
  }
  return { items: [...byKey.values()].sort((a, b) => ({ now: 0, soon: 1, later: 2 }[a.urgency] - { now: 0, soon: 1, later: 2 }[b.urgency])), who }
}

// One person's checklist duties on any other date: an earlier day (done, marked not done, or missed) or a day ahead (planned from the rota). Today is myDay().
export async function personDay(me: string, date: string): Promise<MyDayItem[]> {
  const todayKey = today()
  if (date === todayKey) return []
  const future = date > todayKey
  if (!(await isShopDay(date))) return []
  const shifts = await rotaShifts(date)
  let clock: ClockState
  if (future) {
    const rr = await rotaRolesFor(date)
    const ins: Record<string, number> = {}, outs: Record<string, number | null> = {}
    for (const sh of shifts) { ins[sh.n] = sh.from; outs[sh.n] = sh.to }
    clock = { dayStart: shifts.length ? Math.min(...shifts.map(x => x.from)) : null, present: [], everIn: shifts.map(x => x.n), opener: rr?.opener ?? null, lastOut: rr?.closer ?? null, ins, outs }
  } else clock = await getClockState(date)
  if (clock.dayStart == null) return []
  const allTiles = await sql`SELECT id, title, time, minutes, frequency, kind, days, assignment, category, condition,
      (SELECT l.law_type FROM page_laws l WHERE l.id = daily_check_tiles.law_id) AS law_type FROM daily_check_tiles
    WHERE active AND frequency = 'daily' AND kind <> 'properties' AND time ~ '^[0-2][0-9]:[0-5][0-9]$'` as unknown as { id: number; title: string; time: string; minutes: number | null; frequency: string; kind: string; days: string | null; assignment: string | null; category: string | null; condition: string | null; law_type: string | null }[]
  const dayTiles = allTiles.filter(t => appliesOn(t, date))
  const evRows = future ? [] : await sql`SELECT tile_id, value, note, recorded_by, recorded_at, extra FROM daily_check_events WHERE day = ${date} ORDER BY recorded_at, id` as unknown as { tile_id: number; value: string; note: string | null; recorded_by: string; recorded_at: string; extra: { overruled?: boolean } | null }[]
  const latestEv = new Map<number, (typeof evRows)[number]>(); for (const r of evRows) latestEv.set(r.tile_id, r)
  // A task that depends on a condition is only listed on a day when it was actually asked for (or ahead, when nobody can tell yet).
  const tiles = dayTiles.filter(t => !t.condition || future || latestEv.has(t.id))
  const due = effectiveDue(tiles, clock.dayStart)
  const mine = tiles.filter(t => t.assignment === 'all' || !t.assignment ? due.has(t.id) && allocatedTo(t.id, due.get(t.id)!, clock, shifts) === me : owes(t.assignment, me, clock))
    .sort((a, b) => (due.get(a.id) ?? 0) - (due.get(b.id) ?? 0) || a.id - b.id)
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  const cap1 = (n: string) => n.charAt(0).toUpperCase() + n.slice(1)
  return mine.map(t => {
    const base = { title: t.title, time: due.has(t.id) ? hhmm(due.get(t.id)!) : t.time, who: cap1(me), category: t.category ?? undefined, type: lawTypeLabel(t.law_type), count: 0, urgency: 'later' as const }
    const ev = latestEv.get(t.id)
    if (future) return { key: `plan-${t.id}`, icon: '🕘', detail: `Planned for ${hhmm(due.get(t.id)!)}.`, ...base }
    const at = ev ? new Date(ev.recorded_at) : null, atS = at ? `${String(at.getUTCHours()).padStart(2, '0')}:${String(at.getUTCMinutes()).padStart(2, '0')}` : ''
    if (ev && ev.value !== 'Not done') return { key: `day-${t.id}`, icon: '✅', state: 'done' as const, detail: `Done by ${cap1(ev.recorded_by)} at ${atS}.`, ...base }
    if (ev && ev.note && ev.note.trim().length >= 4 && !ev.extra?.overruled) return { key: `day-${t.id}`, icon: '➖', state: 'not' as const, detail: `Marked not done by ${cap1(ev.recorded_by)} at ${atS}: ${ev.note}`, ...base }
    return { key: `day-${t.id}`, icon: '❌', state: 'miss' as const, detail: 'Not done at all.', ...base }
  })
}
