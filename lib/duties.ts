import sql from '@/lib/db'
import { getClockState, type ClockState } from '@/lib/clockState'
import { effectiveDue, appliesOn } from '@/lib/dailyChecksShared'
import { unmetConditions } from '@/lib/tileConditions'
import { rotaShifts, allocatedTo } from '@/lib/allocation'
import { isShopDay, rotaRolesFor } from '@/lib/rota'

// THE one calculation of the checklist duties on a date: every timed daily task, who it falls on, and how it stands. Waiting for team reads all of them,
// Waiting for me reads one person's, so the two can never disagree about whose a task is or whether it is late.
export type DutyState = 'done' | 'no' | 'miss' | 'late' | 'now' | 'later' | 'plan'
export type Duty = {
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
    out.push({ id: t.id, title: t.title, time: t.time, due: d, owner: owner ?? null, role, category: t.category, lawType: t.law_type, lawId: t.law_id, state,
      by: ev && (state === 'done' || state === 'no') ? ev.recorded_by : undefined, note: ev?.note ?? null, at: ev && (state === 'done' || state === 'no') ? hhmm(new Date(ev.recorded_at)) : undefined })
  }
  return out.sort((x, y) => x.due - y.due || x.id - y.id)
}
