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
export type MyDayItem = { key: string; icon: string; title: string; detail: string; count: number; urgency: 'now' | 'soon' | 'later'; href?: string; hub?: string; state?: 'done' | 'not' | 'miss'; clear?: boolean; inline?: boolean; time?: string | null; who?: string; category?: string; type?: string }
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
  void user
  const items: MyDayItem[] = []
  const day = today()
  const isStaff = SIGNERS.includes(me)
  const me1 = me.charAt(0).toUpperCase() + me.slice(1), cap1 = (n: string) => n.charAt(0).toUpperCase() + n.slice(1)
  const now = new Date(), nowMin = now.getUTCHours() * 60 + now.getUTCMinutes()
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  const add = (i: MyDayItem) => { items.push(i) }

  // Waiting for me is the Waiting for team list cut down to one person: every duty that falls on them (and the ones meant for everyone), from the same calculation.
  const all = await allDutiesForDate(day, { includeManagerLaws: true, canSee: p => p === me })
  const mine = all.filter(d => d.owner === me || (d.owner === null && (d.kind === 'oneoff' || d.kind === 'periodic' || d.kind === 'job' || (d.kind === 'standing' && isStaff))))
  const urg = (d: Duty): MyDayItem['urgency'] => (d.state === 'late' ? 'now' : d.state === 'now' ? 'soon' : 'later')

  // The closing report is answered in Waiting for team by whoever closes; it is shown here to whoever is at work until it is answered.
  if (isStaff && me !== 'grony') {
    const [cr] = await safe(() => sql`SELECT 1 FROM closing_reports WHERE work_date = ${day}`, [] as never[])
    const [here] = await safe(() => sql`SELECT 1 FROM staff_times WHERE LOWER(staff_name) = ${me} AND work_date = ${day} AND actual_in IS NOT NULL`, [] as never[])
    if (here && !cr) add({ key: 'closing', icon: '🌙', title: 'Closing report not answered today', detail: 'Due from 5pm; you can answer it early in Waiting for team.', count: 1, urgency: now.getUTCHours() >= 17 ? 'soon' : 'later', href: '/todo?closing=1', who: me1, category: 'Staff management', type: 'Recurring task' })
  }

  // Checklist tasks: late or due now, still to come, finished.
  const tasks = mine.filter(d => d.kind === 'task')
  const late = tasks.filter(d => d.state === 'late' || d.state === 'now')
  const cap = opts.lens === 'notdone' ? 500 : 8
  const meta = (d: Duty) => ({ who: me1, category: d.category ?? undefined, type: d.typeLabel ?? lawTypeLabel(d.lawType) })
  for (const d of late.slice(0, cap)) {
    const mins = nowMin - d.due
    add({ key: `task-${d.id}`, icon: '⏳', title: d.title, time: hhmm(d.due), ...meta(d), detail: `Due ${hhmm(d.due)}${mins > 0 ? `, ${mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`} late` : ''}. Left undone at day end it costs a point.`, count: 1, urgency: mins >= 30 ? 'now' : 'soon', href: `/todo?tile=${d.id}` })
  }
  if (late.length > cap) add({ key: 'tasks-more', icon: '⏳', title: `${late.length - cap} more tasks to do now`, detail: 'Open Waiting for team to see them all.', count: late.length - cap, urgency: 'now', href: '/todo' })
  if (opts.lens === 'notdone') return items.sort((a, b) => (a.urgency === b.urgency ? 0 : a.urgency === 'now' ? -1 : 1))
  for (const d of tasks.filter(x => x.state === 'later')) add({ key: `tasknext-${d.id}`, icon: '🕘', title: d.title, time: hhmm(d.due), ...meta(d), detail: `Due ${hhmm(d.due)}.`, count: 0, urgency: 'later', href: `/todo?tile=${d.id}` })
  for (const d of tasks.filter(x => x.state === 'done' || x.state === 'no')) {
    const done = d.state === 'done'
    add({ key: `taskdone-${d.id}`, icon: done ? '✅' : '➖', title: d.title, time: hhmm(d.due), ...meta(d), state: done ? 'done' : 'not',
      detail: done ? `Done by ${cap1(d.by ?? me)} at ${d.at}.` : `Marked not done by ${cap1(d.by ?? me)} at ${d.at}${d.note ? `: ${d.note}` : ''}.`, count: 0, urgency: 'later' })
  }

  // Weekly and monthly laws, one-off to-dos and pending jobs due today.
  for (const d of mine.filter(x => x.kind === 'periodic' || x.kind === 'oneoff' || x.kind === 'job')) {
    const done = d.state === 'done'
    add({ key: `pd-${d.key}`, icon: d.kind === 'periodic' ? '🔁' : d.kind === 'job' ? '🧾' : '📌', title: d.title, time: d.time || undefined, ...meta(d), detail: d.note ?? (done ? `Done${d.by ? ` by ${cap1(d.by)}` : ''}.` : 'Due today.'),
      count: done ? 0 : 1, state: done ? 'done' : undefined, urgency: done ? 'later' : 'soon', href: d.lawId ? `/laws?law=${d.lawId}` : d.kind === 'job' ? '/pending-jobs' : undefined, hub: d.kind === 'oneoff' ? 'tasks' : undefined })
  }

  // Standing duties and the personal items that wait until dealt with. Cards that answer the item right here (clock notices, approvals, questions, CCTV, sanctions) hide their tile.
  const STAND: Record<string, { href?: string; hub?: string; inline?: boolean; own?: string }> = {
    sign: { href: '/laws?sign=1' }, quiz: { href: '/laws' }, cctv: { href: '/cctv-review', inline: true }, approve: { hub: 'waiting', inline: true },
    mytasks: { hub: 'tasks', own: 'Tasks assigned to you' }, queries: { inline: true, own: 'Questions waiting for your answer' }, ack: { hub: 'violations', own: 'Violations logged against you' },
    'clock-prev': { inline: true, own: 'You did not clock out' }, 'clock-auto': { inline: true, own: 'Check your clock times' }, sanctions: { href: '/penalties', inline: true },
    violations: { href: '/penalties', inline: true }, drafts: { href: '/laws' }, 'pending-jobs': { href: '/pending-jobs' },
  }
  for (const d of mine.filter(x => x.kind === 'standing')) {
    const k = d.key.split(':')[1], m = STAND[k] ?? {}
    const done = d.state === 'done'
    add({ key: `${k}-${d.key.split(':').slice(2).join('-')}`, icon: ({ sign: '✍', quiz: '📝', cctv: '🎥', approve: '🕐', mytasks: '📌', queries: '❓', ack: '⚖', sanctions: '⚖', violations: '⚖', drafts: '📜', 'pending-jobs': '🧾' } as Record<string, string>)[k] ?? '🕐',
      title: !opts.viewing && m.own ? m.own : d.title, detail: d.detail ?? '', count: done ? 0 : d.count ?? 1, state: done ? 'done' : undefined, urgency: urg(d), href: m.href, hub: m.hub, inline: m.inline, ...meta(d) })
  }
  const order = { now: 0, soon: 1, later: 2 }
  return items.sort((a, b) => order[a.urgency] - order[b.urgency])
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
