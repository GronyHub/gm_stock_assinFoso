import sql from '@/lib/db'
import { getClockState, type ClockState } from '@/lib/clockState'
import { effectiveDue, appliesOn } from '@/lib/dailyChecksShared'
import { unmetConditions } from '@/lib/tileConditions'
import { rotaShifts, allocatedTo } from '@/lib/allocation'
import { isShopDay, rotaRolesFor } from '@/lib/rota'
import { SIGNERS } from '@/lib/signers'
import { inPeriod, WEEKDAYS, type Frequency } from '@/lib/dailyChecksShared'

// THE one calculation of the checklist duties on a date: every timed daily task, who it falls on, and how it stands. Waiting for team reads all of them,
// Waiting for me reads one person's, so the two can never disagree about whose a task is or whether it is late.
export type DutyState = 'done' | 'no' | 'miss' | 'late' | 'now' | 'later' | 'plan'
export type DutyKind = 'task' | 'periodic' | 'standing' | 'oneoff' | 'job'
export type Duty = {
  kind: DutyKind; key: string; detail?: string; count?: number; typeLabel?: string; href?: string
  id: number; title: string; time: string; due: number            // due = minutes after midnight (queued from the first clock-in)
  owner: string | null; role: 'Opener' | 'Closer' | 'Joe' | null    // owner = the one person it falls on (lower case)
  category: string | null; lawType: string | null; lawId: number | null
  state: DutyState; by?: string; note?: string | null; at?: string  // who ended it, with the reason, and when
}
const today = () => new Date().toISOString().slice(0, 10)

export async function dutiesForDate(date: string): Promise<Duty[]> {
  const todayKey = today()
  const future = date > todayKey, isToday = date === todayKey
  if (!(await isShopDay(date))) return []
  const shifts = await rotaShifts(date)
  // The clock as it is (or was); for a day ahead, or today before anyone is in, the rota stands in for it.
  const fromRota = async (): Promise<ClockState> => {
    const rr = await rotaRolesFor(date)
    const ins: Record<string, number> = {}, outs: Record<string, number | null> = {}
    for (const sh of shifts) { ins[sh.n] = sh.from; outs[sh.n] = sh.to }
    return { dayStart: shifts.length ? Math.min(...shifts.map(x => x.from)) : null, present: [], everIn: shifts.map(x => x.n), opener: rr?.opener ?? null, lastOut: rr?.closer ?? null, ins, outs }
  }
  let clock: ClockState = future ? await fromRota() : await getClockState(date)
  const noClockIn = !future && clock.dayStart == null
  if (noClockIn) { if (!isToday) return []; clock = await fromRota() }
  if (clock.dayStart == null) return []
  const all = await sql`SELECT id, title, time, minutes, frequency, kind, days, assignment, category, condition, law_id,
      (SELECT l.law_type FROM page_laws l WHERE l.id = daily_check_tiles.law_id) AS law_type FROM daily_check_tiles
    WHERE active AND frequency = 'daily' AND kind <> 'properties' AND time ~ '^[0-2][0-9]:[0-5][0-9]$'` as unknown as { id: number; title: string; time: string; minutes: number | null; frequency: string; kind: string; days: string | null; assignment: string | null; category: string | null; condition: string | null; law_type: string | null; law_id: number | null }[]
  const evRows = future ? [] : await sql`SELECT tile_id, value, note, recorded_by, recorded_at, extra FROM daily_check_events WHERE day = ${date} ORDER BY recorded_at, id` as unknown as { tile_id: number; value: string; note: string | null; recorded_by: string; recorded_at: string; extra: { overruled?: boolean } | null }[]
  const latest = new Map<number, (typeof evRows)[number]>(); for (const r of evRows) latest.set(r.tile_id, r)
  // A task that depends on a condition is listed when it is asked for today, on an earlier day only if it was actually answered, and ahead (nobody can tell yet).
  const unmet = isToday ? await unmetConditions() : new Set<string>()
  const tiles = all.filter(t => appliesOn(t, date) && (!t.condition || (isToday ? !unmet.has(t.condition) : future || latest.has(t.id))))
  const due = effectiveDue(tiles, clock.dayStart)
  const now = new Date(), nowMin = now.getUTCHours() * 60 + now.getUTCMinutes()
  const hhmm = (d: Date) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
  const out: Duty[] = []
  for (const t of tiles) {
    if (!due.has(t.id)) continue
    const a = t.assignment ?? 'all', d = due.get(t.id)!
    const owner = a === 'opener' ? clock.opener : a === 'closer' ? clock.lastOut : a === 'managers' ? 'joe' : allocatedTo(t.id, d, clock, shifts)
    const role: Duty['role'] = a === 'opener' ? 'Opener' : a === 'closer' ? 'Closer' : a === 'managers' ? 'Joe' : null
    const ev = latest.get(t.id)
    const reasoned = !!ev && ev.value === 'Not done' && !!ev.note && ev.note.trim().length >= 4 && !ev.extra?.overruled
    let state: DutyState
    if (future) state = 'plan'
    else if (ev && ev.value !== 'Not done') state = 'done'
    else if (reasoned) state = 'no'
    else if (!isToday) state = 'miss'
    else if (noClockIn) state = 'later'
    else { const mins = nowMin - d; state = mins >= 15 ? 'late' : mins >= 0 ? 'now' : 'later' }
    out.push({ kind: 'task', key: `t${t.id}`, id: t.id, title: t.title, time: t.time, due: d, owner: owner ?? null, role, category: t.category, lawType: t.law_type, lawId: t.law_id, state,
      by: ev && (state === 'done' || state === 'no') ? ev.recorded_by : undefined, note: ev?.note ?? null, at: ev && (state === 'done' || state === 'no') ? hhmm(new Date(ev.recorded_at)) : undefined })
  }
  return out.sort((x, y) => x.due - y.due || x.id - y.id)
}

// ---- Everything else that is due on a date: standing duties, weekly and monthly laws, one-off to-dos, pending jobs. Read by the same screens as the tasks above.

type StandingRow = { person: string; kind: 'sign' | 'quiz' | 'cctv' | 'approve'; due: string; n: number; done: number }
const STANDING: Record<StandingRow['kind'], { title: string; icon: string; type: string; detail: string }> = {
  sign: { title: 'Company Laws to sign', icon: '✍', type: 'Law to sign', detail: 'Each law is due 24 hours after it goes live.' },
  quiz: { title: 'Law quizzes to pass', icon: '📝', type: 'Law quiz', detail: 'Pass each quiz (75% or more) within 7 days of its law going live.' },
  cctv: { title: 'CCTV reviews to do', icon: '🎥', type: 'Review', detail: 'Days staff worked while Joe was not clocked in. Due within 48 hours.' },
  approve: { title: 'Clock times to approve', icon: '🕐', type: 'Decision', detail: 'Corrections staff sent after a forgotten or supervisor clock-in or clock-out. Due within 48 hours.' },
}
const num = (v: unknown) => Number(v ?? 0)
// One query set for every person: how many of each standing duty fall due on each date, and how many of those are already done.
export async function standingRowsAll(): Promise<StandingRow[]> {
  const out: StandingRow[] = []
  const people = SIGNERS.filter(n => n !== 'grony'), managers = ['joe', 'bino']
  try {
    const sign = await sql`SELECT p.n AS person, (COALESCE(l.live_at, '2000-01-01'::timestamptz) + interval '24 hours')::date::text AS due, COUNT(*)::int AS n,
        COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM law_signatures s WHERE s.law_id = l.id AND s.staff = p.n))::int AS done
      FROM unnest(${people}::text[]) AS p(n) JOIN page_laws l ON l.status = 'live' AND (l.audience = 'staff' OR (l.audience = 'managers' AND p.n = ANY(${managers}::text[]))) GROUP BY 1, 2`
    for (const r of sign) out.push({ person: String(r.person), kind: 'sign', due: String(r.due), n: num(r.n), done: num(r.done) })
  } catch { /* leave out */ }
  try {
    const quiz = await sql`SELECT p.n AS person, (COALESCE(l.live_at, '2000-01-01'::timestamptz) + interval '7 days')::date::text AS due, COUNT(*)::int AS n,
        COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM law_quiz_marks m WHERE m.law_id = l.id AND m.staff = p.n AND m.score::float / NULLIF(m.total, 0) >= 0.75))::int AS done
      FROM unnest(${people}::text[]) AS p(n) JOIN page_laws l ON l.status = 'live' AND (l.audience = 'staff' OR (l.audience = 'managers' AND p.n = ANY(${managers}::text[])))
        AND l.quiz IS NOT NULL AND l.quiz <> '' AND l.quiz <> '[]' GROUP BY 1, 2`
    for (const r of quiz) out.push({ person: String(r.person), kind: 'quiz', due: String(r.due), n: num(r.n), done: num(r.done) })
  } catch { /* leave out */ }
  try {
    const cctv = await sql`SELECT (created_at + interval '48 hours')::date::text AS due, COUNT(*)::int AS n, COUNT(*) FILTER (WHERE status <> 'pending')::int AS done FROM cctv_reviews GROUP BY 1`
    for (const r of cctv) out.push({ person: 'joe', kind: 'cctv', due: String(r.due), n: num(r.n), done: num(r.done) })
  } catch { /* leave out */ }
  try {
    const ap = await sql`SELECT p.n AS person, (c.requested_at + interval '48 hours')::date::text AS due, COUNT(*)::int AS n, COUNT(*) FILTER (WHERE c.status <> 'pending')::int AS done
      FROM unnest(ARRAY['grony','joe']::text[]) AS p(n) JOIN clock_corrections c ON c.staff <> p.n AND COALESCE(c.against, '') <> p.n GROUP BY 1, 2`
    for (const r of ap) out.push({ person: String(r.person), kind: 'approve', due: String(r.due), n: num(r.n), done: num(r.done) })
  } catch { /* leave out */ }
  return out
}

export async function standingDuties(date: string): Promise<Duty[]> {
  const todayKey = today(), rows = await standingRowsAll()
  const out: Duty[] = []
  const mk = (r: { person: string; kind: StandingRow['kind'] }, key: string, state: DutyState, count: number, detail: string): Duty => ({
    kind: 'standing', key: `s:${r.kind}:${r.person}:${key}`, id: -1, title: STANDING[r.kind].title, time: '', due: 24 * 60, owner: r.person, role: null, category: 'Standing duty', lawType: null, lawId: null,
    typeLabel: STANDING[r.kind].type, state, count, detail })
  const group = new Map<string, StandingRow[]>()
  for (const r of rows) group.set(`${r.person}|${r.kind}`, [...(group.get(`${r.person}|${r.kind}`) ?? []), r])
  for (const list of group.values()) {
    const base = list[0]
    if (date === todayKey) {
      const overdue = list.filter(r => r.due < todayKey).reduce((a, r) => a + r.n - r.done, 0)
      const dueToday = list.filter(r => r.due === todayKey)
      const left = dueToday.reduce((a, r) => a + r.n - r.done, 0), total = dueToday.reduce((a, r) => a + r.n, 0)
      if (overdue > 0) out.push(mk(base, 'overdue', 'late', overdue, `${overdue} overdue. ${STANDING[base.kind].detail}`))
      if (total > 0) out.push(mk(base, 'today', left > 0 ? 'now' : 'done', left, left > 0 ? `${left} of ${total} due today. ${STANDING[base.kind].detail}` : `All ${total} due today are done.`))
    } else {
      const here = list.filter(r => r.due === date), total = here.reduce((a, r) => a + r.n, 0), left = here.reduce((a, r) => a + r.n - r.done, 0)
      if (total === 0) continue
      if (date > todayKey) out.push(mk(base, date, 'plan', total, `${total} fall${total === 1 ? 's' : ''} due on this day. ${STANDING[base.kind].detail}`))
      else out.push(mk(base, date, left > 0 ? 'miss' : 'done', left, left > 0 ? `${left} of ${total} not done.` : `All ${total} done.`))
    }
  }
  return out
}

const dowOf = (d: string) => WEEKDAYS[new Date(d + 'T00:00:00Z').getUTCDay()]
const daysIn = (d: string) => new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)), 0)).getUTCDate()

// Weekly and monthly laws (their own tile), one-off to-dos and pending jobs that fall on a date.
export async function otherDuties(date: string, includeManagerLaws: boolean): Promise<Duty[]> {
  const todayKey = today(), future = date > todayKey, isToday = date === todayKey
  const out: Duty[] = []
  const rr = await rotaRolesFor(date).catch(() => null)
  const w = dowOf(date)
  try {
    const tiles = await sql`SELECT t.id, t.title, t.time, t.minutes, t.frequency, t.days, t.weekday, t.assignment, l.id AS law_id, l.month_day, l.category, l.law_type
      FROM daily_check_tiles t JOIN page_laws l ON l.id = t.law_id AND l.tile_id = t.id
      WHERE t.active AND l.status = 'live' AND t.kind <> 'properties' AND t.frequency IN ('weekly', 'monthly') AND (${includeManagerLaws} OR l.audience <> 'managers')` as unknown as { id: number; title: string; time: string | null; frequency: string; days: string | null; weekday: string | null; assignment: string | null; law_id: number; month_day: number | null; category: string | null; law_type: string | null }[]
    const hits = tiles.filter(t => t.frequency === 'weekly' ? w === (t.weekday ?? (t.days ? t.days.split(',')[0].trim() : 'mon')) : t.month_day ? Number(date.slice(8)) === Math.min(t.month_day, daysIn(date)) : date.endsWith('-01'))
    const evs = hits.length && !future ? await sql`SELECT tile_id, day, value, note, recorded_by, recorded_at FROM daily_check_events WHERE tile_id = ANY(${hits.map(t => t.id)}) AND day <= ${date}` as unknown as { tile_id: number; day: string; value: string; note: string | null; recorded_by: string; recorded_at: string }[] : []
    for (const t of hits) {
      const a = t.assignment ?? 'all'
      const ev = evs.filter(e => e.tile_id === t.id && inPeriod(t.frequency as Frequency, e.day, date)).at(-1)
      const doneNow = !!ev && ev.value !== 'Not done'
      out.push({ kind: 'periodic', key: `p${t.id}`, id: t.id, title: t.title, time: t.time ?? t.frequency, due: 23 * 60, role: a === 'opener' ? 'Opener' : a === 'closer' ? 'Closer' : a === 'managers' ? 'Joe' : null,
        owner: a === 'opener' ? rr?.opener ?? null : a === 'closer' ? rr?.closer ?? null : a === 'managers' ? 'joe' : null, category: t.category, lawType: t.law_type, lawId: t.law_id,
        state: future ? 'plan' : doneNow ? 'done' : isToday ? 'now' : 'miss', by: doneNow ? ev!.recorded_by : undefined, note: t.frequency === 'monthly' && !t.month_day ? 'Sometime this month' : null })
    }
  } catch { /* leave out */ }
  try {
    const one = await sql`SELECT id, title, notes, assigned_to, COALESCE(done, false) AS done FROM custom_tasks WHERE submenu = 'To do' AND substr(due_date::text, 1, 10) = ${date}` as unknown as { id: number; title: string; notes: string | null; assigned_to: string | null; done: boolean }[]
    for (const o of one) out.push({ kind: 'oneoff', key: `o${o.id}`, id: -1, title: o.title, time: '', due: 23 * 60 + 30, owner: o.assigned_to ? o.assigned_to.toLowerCase() : null, role: null, category: 'To do items', lawType: null, lawId: null, typeLabel: 'One-off',
      state: o.done ? 'done' : future ? 'plan' : isToday ? 'now' : 'miss', note: o.notes })
  } catch { /* leave out */ }
  try {
    const jobs = await sql`SELECT id, customer, job, status FROM pending_jobs WHERE status <> 'done' AND due_on = ${date}::date` as unknown as { id: number; customer: string; job: string; status: string }[]
    for (const j of jobs) out.push({ kind: 'job', key: `j${j.id}`, id: -1, title: `Pending job · ${j.customer}: ${j.job.slice(0, 90)}`, time: '', due: 23 * 60 + 45, owner: null, role: null, category: 'Pending jobs', lawType: null, lawId: null, typeLabel: 'Customer job',
      state: future ? 'plan' : isToday ? 'now' : 'miss', note: j.status === 'ready' ? 'Ready: waiting for the customer' : null })
  } catch { /* leave out */ }
  return out
}

// Everything due on a date, for one viewer: the checklist tasks (done by the rest of the day's rules), the standing duties of the people the viewer may see, and the rest.
export async function allDutiesForDate(date: string, viewer: { includeManagerLaws: boolean; canSee: (person: string) => boolean }): Promise<Duty[]> {
  const [tasks, standing, other] = await Promise.all([dutiesForDate(date), standingDuties(date), otherDuties(date, viewer.includeManagerLaws)])
  return [...tasks, ...other, ...standing.filter(d => d.owner && viewer.canSee(d.owner))]
}
