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
import { dutiesForDate, standingRowsAll, allDutiesForDate, personalDuties, type Duty } from '@/lib/duties'
import { canLogAgainst } from '@/lib/violationLog'
import { ACTIVE_STAFF } from '@/lib/staffList'

// "Waiting for me": everything the signed-in person owes or must decide, from every part of the app, in one list.
// urgency: 'now' (overdue or blocking), 'soon' (due today or within 24 hours), 'later'. `href` opens in the hub's right pane; `hub` asks the hub to open a view.
export type MyDayItem = { key: string; icon: string; title: string; detail: string; count: number; urgency: 'now' | 'soon' | 'later'; href?: string; hub?: string; state?: 'done' | 'not' | 'miss'; clear?: boolean; time?: string | null; who?: string; category?: string; type?: string }
const lawTypeLabel = (t: string | null | undefined) => LAW_TYPES.find(x => x.key === t)?.label
const today = () => new Date().toISOString().slice(0, 10)
const safe = async <T,>(f: () => Promise<T>, d: T): Promise<T> => { try { return await f() } catch { return d } }

// Whose list a supervisor may look at: the same people they may log violations against (the owner anyone; Joe anyone but the owner; Bino James).
export function viewablePeople(user: { username?: string | null; name?: string | null; role?: string | null } | undefined): string[] {
  const self = String(user?.username ?? user?.name ?? '').toLowerCase()
  return ACTIVE_STAFF.filter(n => n !== self && canLogAgainst(user as never, n) && (n !== 'grony' || self === 'grony'))
}

// Who the viewer may see standing duties of: themselves and the people they supervise (the owner: everyone).
export function dutyViewer(user: { username?: string | null; name?: string | null; role?: string | null } | undefined) {
  const self = String(user?.username ?? user?.name ?? '').toLowerCase(), ok = new Set([self, ...viewablePeople(user)])
  return { includeManagerLaws: isOwnerLevel(user as never), canSee: (p: string) => isOwnerLevel(user as never) || ok.has(p) }
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
  const STANDING_TYPE: Record<string, string> = { sign: 'Law to sign', quiz: 'Law quiz', 'pending-jobs': 'Pending job', mytasks: 'Assigned task', claims: 'Decision', sanctions: 'Decision', violations: 'Decision', drafts: 'Decision', cctv: 'Review' }
  const me1 = me.charAt(0).toUpperCase() + me.slice(1)
  const tile = (i: MyDayItem) => { const full = { ...i, who: me1, category: i.category ?? 'Standing duty', type: i.type ?? STANDING_TYPE[i.key] }; add(i.count > 0 ? full : { ...full, state: 'done', clear: true, detail: 'Nothing waiting.', urgency: 'later' }, true) }
  const add = (i: MyDayItem | null, keep = false) => { if (i && (i.count > 0 || keep)) items.push(i) }

  // The standing duties (laws, quizzes, CCTV, decisions) come from the same rows Waiting for team shows for every person.
  const standAll = await standingRowsAll()
  const stand = standAll.filter(x => x.person === me)
  const leftOf = (k: 'sign' | 'quiz' | 'cctv' | 'approve') => stand.filter(x => x.kind === k).reduce((a, x) => a + x.n - x.done, 0)
  // The personal items without a date (assigned tasks, questions, decisions, clock matters...) come from the same function too.
  const pdAll = await personalDuties()
  const cnt = (k: string) => pdAll.filter(d => d.key === `s:${k}:${me}` || d.key === `s:${k}:team`).reduce((a, d) => a + (d.count ?? 0), 0)

  if (isStaff && me !== 'grony') {
    // clock-out and clock-in matters
    const prev = (await safe(() => openRecords(me), [])).filter(r => r.d < day && r.d >= REVIEW_FROM)
    add({ key: 'clock-prev', icon: '🕐', title: 'You did not clock out', detail: `${cnt('clock-prev')} earlier day${cnt('clock-prev') === 1 ? '' : 's'} without a time out. Enter your time out.`, count: cnt('clock-prev'), urgency: 'now' })
    const autos = await safe(() => sql`SELECT COUNT(*)::int AS n FROM clock_autos WHERE staff = ${me} AND status = 'notified'`, [{ n: 0 }])
    const ins = await safe(() => sql`SELECT COUNT(*)::int AS n FROM clock_in_autos WHERE staff = ${me} AND status = 'notified'`, [{ n: 0 }])
    add({ key: 'clock-auto', icon: '🕐', title: opts.viewing ? `Check ${me.charAt(0).toUpperCase() + me.slice(1)}'s clock times` : 'Check your clock times', detail: opts.viewing ? 'A clock-in or clock-out was set for them. They tap OK or send the correct time.' : 'A clock-in or clock-out was set for you. Tap OK or send the correct time.', count: cnt('clock-auto'), urgency: 'soon' })
    // closing report
    const [cr] = await safe(() => sql`SELECT 1 FROM closing_reports WHERE work_date = ${day}`, [] as never[])
    const [here] = await safe(() => sql`SELECT 1 FROM staff_times WHERE LOWER(staff_name) = ${me} AND work_date = ${day} AND actual_in IS NOT NULL`, [] as never[])
    if (here && !cr) add({ key: 'closing', icon: '🌙', title: 'Closing report not answered today', detail: 'Due from 5pm; you can answer it early in Waiting for team.', count: 1, urgency: new Date().getUTCHours() >= 17 ? 'soon' : 'later', href: '/todo?closing=1' })
    // checklist tasks that fall on this person (from the one duties calculation that Waiting for team reads too)
    await safe(async () => {
      const now = new Date()
      const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes()
      const mine = (await dutiesForDate(day)).filter(d => d.owner === me)
      const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
      const cap1 = (n: string) => n.charAt(0).toUpperCase() + n.slice(1)
      const meta = (d: Duty) => ({ who: cap1(me), category: d.category ?? undefined, type: lawTypeLabel(d.lawType) })
      const late = mine.filter(d => d.state === 'late' || d.state === 'now')
      // One tile per task, so each can be opened and done from here. (Only the Not done tab lists them all.)
      const cap = opts.lens === 'notdone' ? 500 : 8
      for (const d of late.slice(0, cap)) {
        const mins = nowMin - d.due
        add({ key: `task-${d.id}`, icon: '⏳', title: d.title, time: hhmm(d.due), ...meta(d), detail: `Due ${hhmm(d.due)}${mins > 0 ? `, ${mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`} late` : ''}. Left undone at day end it costs a point.`, count: 1, urgency: mins >= 30 ? 'now' : 'soon', href: `/todo?tile=${d.id}` })
      }
      if (late.length > cap) add({ key: 'tasks-more', icon: '⏳', title: `${late.length - cap} more tasks to do now`, detail: 'Open Waiting for team to see them all.', count: late.length - cap, urgency: 'now', href: '/todo' })
      if (opts.lens === 'notdone') return
      for (const d of mine.filter(x => x.state === 'later')) add({ key: `tasknext-${d.id}`, icon: '🕘', title: d.title, time: hhmm(d.due), ...meta(d), detail: `Due ${hhmm(d.due)}.`, count: 0, urgency: 'later', href: `/todo?tile=${d.id}` }, true)
      for (const d of mine.filter(x => x.state === 'done' || x.state === 'no')) {
        const done = d.state === 'done'
        add({ key: `taskdone-${d.id}`, icon: done ? '✅' : '➖', title: d.title, time: hhmm(d.due), ...meta(d), state: done ? 'done' : 'not',
          detail: done ? `Done by ${cap1(d.by ?? me)} at ${d.at}.` : `Marked not done by ${cap1(d.by ?? me)} at ${d.at}${d.note ? `: ${d.note}` : ''}.`, count: 0, urgency: 'later' }, true)
      }
    }, undefined)
  }

  if (isStaff) {
    // laws to sign, quizzes, login reminders (each has a due date: see standingRows)
    const dueText = (k: 'sign' | 'quiz') => { const r = stand.filter(x => x.kind === k); const over = r.filter(x => x.due < day).reduce((a, x) => a + x.n - x.done, 0), now = r.filter(x => x.due === day).reduce((a, x) => a + x.n - x.done, 0); return `${over} overdue · ${now} due today.` }
    const unsigned = await safe(() => sql`SELECT COUNT(*)::int AS n, MIN(l.id) AS first FROM page_laws l WHERE l.status = 'live' AND (l.audience = 'staff' OR (l.audience = 'managers' AND ${manager}))
      AND NOT EXISTS (SELECT 1 FROM law_signatures s WHERE s.law_id = l.id AND s.staff = ${me})`, [{ n: 0 }])
    tile({ key: 'sign', icon: '✍', title: 'Company Laws to sign', detail: `${dueText('sign')} Each is due 24 hours after it goes live.`, count: leftOf('sign'), urgency: me === 'grony' ? 'later' : 'soon', // the owner is not bound by the laws, so this never inflates the bar
      href: unsigned[0].first ? `/laws?law=${unsigned[0].first}&sign=1` : '/laws?sign=1' })
    const quiz = await safe(() => sql`SELECT l.id FROM page_laws l WHERE l.status = 'live' AND (l.audience = 'staff' OR (l.audience = 'managers' AND ${manager}))
      AND l.quiz IS NOT NULL AND l.quiz <> '' AND l.quiz <> '[]' AND NOT EXISTS (SELECT 1 FROM law_quiz_marks m WHERE m.law_id = l.id AND m.staff = ${me} AND m.score::float / NULLIF(m.total, 0) >= 0.75) ORDER BY l.id`, [] as { id: number }[])
    tile({ key: 'quiz', icon: '📝', title: 'Law quizzes to pass', detail: `${dueText('quiz')} Pass each quiz (75% or more) within 7 days of its law going live.`, count: leftOf('quiz'), urgency: 'later', href: quiz.length ? `/laws?law=${quiz[0].id}&quiz=1` : '/laws' })
    const pj = await safe(() => pendingJobCounts(), { open: 0, ready: 0, overdue: 0 })
    tile({ key: 'pending-jobs', icon: '🧾', title: 'Pending jobs overdue', detail: `${pj.overdue} job${pj.overdue === 1 ? '' : 's'} customers left ${pj.overdue === 1 ? 'is' : 'are'} past the promised date. Finish it, or call the customer.`, count: cnt('pending-jobs'), urgency: 'now', href: '/pending-jobs' })
    const mt = await safe(() => sql`SELECT COUNT(*)::int AS n, MIN(due_date) AS first_due FROM custom_tasks WHERE LOWER(assigned_to) = ${me} AND NOT done AND (due_date IS NULL OR substr(due_date::text, 1, 10) <= ${day})`, [{ n: 0, first_due: null }])
    const overdue = mt[0].first_due && String(mt[0].first_due).slice(0, 10) < day
    tile({ key: 'mytasks', icon: '📌', title: opts.viewing ? `Tasks assigned to ${me.charAt(0).toUpperCase() + me.slice(1)}` : 'Tasks assigned to you', detail: overdue ? 'One or more are past their due date.' : opts.viewing ? 'Tasks a manager gave them.' : 'Tasks a manager gave you. Open your page to see them.', count: cnt('mytasks'), urgency: overdue ? 'now' : 'soon', hub: 'tasks' })
    const q = await safe(() => sql`SELECT COUNT(*)::int AS n FROM staff_queries WHERE staff = ${me} AND status = 'open'`, [{ n: 0 }])
    add({ key: 'queries', icon: '❓', title: opts.viewing ? 'Questions waiting for their answer' : 'Questions waiting for your answer', detail: 'A supervisor asked about a day you were at work.', count: cnt('queries'), urgency: 'now' })
    const ack = await safe(() => sql`SELECT COUNT(*)::int AS n FROM staff_penalties WHERE staff = ${me} AND status IN ('active', 'pending') AND source = 'manual' AND ack_at IS NULL AND created_at > now() - interval '30 days'`, [{ n: 0 }])
    add({ key: 'ack', icon: '⚖', title: opts.viewing ? 'Violations logged against them' : 'Violations logged against you', detail: 'Acknowledge each one, or dispute it with a note.', count: cnt('ack'), urgency: 'soon', hub: 'violations' })
  }

  // decisions for supervisors
  // A supervisor viewing the owner's or Joe's list sees the decisions waiting for them too (read-only).
  const decider = owner || (!!opts.viewing && (me === 'joe' || me === 'grony'))
  if (decider) {
    const claims = await safe(() => sql`SELECT COUNT(*)::int AS n FROM clock_corrections WHERE status = 'pending' AND staff <> ${me} AND COALESCE(against, '') <> ${me}`, [{ n: 0 }])
    tile({ key: 'claims', icon: '🕐', title: 'Clock times to approve', detail: 'Corrections staff sent after a forgotten or supervisor clock-in or clock-out.', count: leftOf('approve'), urgency: 'soon', hub: 'waiting' })
    const sanc = await safe(() => sql`SELECT staff FROM penalty_sanctions WHERE status = 'proposed'`, [] as { staff: string }[])
    tile({ key: 'sanctions', icon: '⚖', title: 'Sanctions to approve', detail: 'A staff member reached a points level.', count: cnt('sanctions'), urgency: 'soon', href: '/penalties' })
    const viol = await safe(() => sql`SELECT staff FROM staff_penalties WHERE status IN ('pending', 'disputed')`, [] as { staff: string }[])
    tile({ key: 'violations', icon: '⚖', title: 'Violations to confirm or review', detail: 'Reports waiting to be confirmed and disputes waiting for a decision.', count: cnt('violations'), urgency: 'soon', href: '/penalties' })
    const drafts = await safe(() => sql`SELECT COUNT(*)::int AS n, MIN(id) AS first FROM page_laws WHERE status = 'draft'`, [{ n: 0, first: null }])
    tile({ key: 'drafts', icon: '📜', title: 'Draft laws to approve', detail: 'Approving creates the checklist tiles.', count: cnt('drafts'), urgency: 'later', href: drafts[0].first ? `/laws?law=${drafts[0].first}` : '/laws' })
  }
  if (me === 'joe') {
    const r = await safe(() => sql`SELECT COUNT(*)::int AS n FROM cctv_reviews WHERE status = 'pending' AND work_date < ${day}`, [{ n: 0 }])
    tile({ key: 'cctv', icon: '🎥', title: 'CCTV reviews to do', detail: opts.viewing ? 'Days staff worked while Joe was not clocked in. Due within 48 hours.' : 'Days staff worked while you were not clocked in. Due within 48 hours.', count: leftOf('cctv'), urgency: 'now', href: '/cctv-review' })
  }
  const order = { now: 0, soon: 1, later: 2 }
  const isTask = (i: MyDayItem) => i.key.startsWith('task-') || i.key === 'tasks-more'
  const pick = opts.lens === 'notdone' ? items.filter(isTask) : opts.lens === 'todo' ? items.filter(i => !isTask(i)) : items
  // Everything already clear goes last.
  return pick.sort((a, b) => Number(!!a.clear) - Number(!!b.clear) || order[a.urgency] - order[b.urgency])
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

// One person's duties on any other date, from the same calculation Waiting for team reads: an earlier day (done, marked not done, or missed) or a day ahead.
// Today is myDay(), which adds the personal items that have no date.
const KIND_ICON: Record<string, string> = { task: '✅', periodic: '🔁', oneoff: '📌', job: '🧾', standing: '📋' }
export async function personDay(me: string, date: string, _user?: unknown): Promise<MyDayItem[]> {
  if (date === today()) return []
  const cap1 = (n: string) => n.charAt(0).toUpperCase() + n.slice(1)
  const all = await allDutiesForDate(date, { includeManagerLaws: true, canSee: p => p === me })
  // Duties for everyone (a one-off for the whole team, a weekly law nobody is named for) are on each person's list too.
  const mine = all.filter(d => d.owner === me || (d.owner === null && (d.kind === 'oneoff' || d.kind === 'periodic' || d.kind === 'job')))
  return mine.map(d => {
    const hh = d.kind === 'task' ? `${String(Math.floor(d.due / 60)).padStart(2, '0')}:${String(d.due % 60).padStart(2, '0')}` : d.time || undefined
    const base = { key: `${d.state}-${d.key}`, title: d.title, time: hh, who: cap1(me), category: d.category ?? undefined, type: d.typeLabel ?? lawTypeLabel(d.lawType), count: 0, urgency: 'later' as const }
    const by = d.by ? cap1(d.by) : cap1(me)
    if (d.state === 'plan') return { ...base, icon: '🕘', detail: d.detail ?? (d.kind === 'task' ? `Planned for ${hh}.` : 'Planned.') }
    if (d.state === 'done') return { ...base, icon: KIND_ICON[d.kind] ?? '✅', state: 'done' as const, detail: d.detail ?? `Done by ${by}${d.at ? ` at ${d.at}` : ''}.` }
    if (d.state === 'no') return { ...base, icon: '➖', state: 'not' as const, detail: `Marked not done by ${by}${d.at ? ` at ${d.at}` : ''}: ${d.note}` }
    return { ...base, icon: '❌', state: 'miss' as const, detail: d.detail ?? 'Not done at all.' }
  })
}
