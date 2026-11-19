import sql from '@/lib/db'
import { once } from '@/lib/once'
import { rotaShifts } from '@/lib/allocation'
import { parseTimeMins } from '@/lib/staffTimes'
import { LATE_GRACE_MIN } from '@/lib/attendancePenalties'

// The rule: hours are paid for the rostered shift. Time before the rostered start, and time after the rostered end, is "extra time": it is paid only when the manager approves it
// (the manager asked the person to come early or stay on). Each extra stretch is one row here, pending until Joe or Grony decides.
export const ensureExtraTime = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS staff_extra_time (
    id SERIAL PRIMARY KEY, staff TEXT NOT NULL, work_date TEXT NOT NULL, kind TEXT NOT NULL, minutes INTEGER NOT NULL, sched TEXT, actual TEXT,
    status TEXT NOT NULL DEFAULT 'pending', decided_by TEXT, decided_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (staff, work_date, kind))`.catch(() => {})
})

const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const dur = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`)

// Called right after a clock-in ('in') or clock-out ('out') at `time` (like "7:56am"). Returns the text to show the person, or null when they are within their rostered time.
export async function checkExtraTime(staff: string, day: string, action: 'in' | 'out', time: string): Promise<{ kind: 'early' | 'late'; minutes: number; text: string } | null> {
  await ensureExtraTime()
  const s = staff.toLowerCase()
  const sh = (await rotaShifts(day)).find(x => x.n === s)
  const at = parseTimeMins(time)
  if (!sh || at == null) return null
  if (action === 'in' && at < sh.from - LATE_GRACE_MIN) {
    const minutes = sh.from - at
    await sql`INSERT INTO staff_extra_time (staff, work_date, kind, minutes, sched, actual) VALUES (${s}, ${day}, 'early', ${minutes}, ${hm(sh.from)}, ${hm(at)})
      ON CONFLICT (staff, work_date, kind) DO UPDATE SET minutes = ${minutes}, actual = ${hm(at)}, status = CASE WHEN staff_extra_time.status = 'approved' THEN 'pending' ELSE staff_extra_time.status END`
    return { kind: 'early', minutes, text: `You clocked in ${dur(minutes)} before your rostered start (${hm(sh.from)}). Those ${dur(minutes)} will not be paid unless the manager approves them.` }
  }
  if (action === 'out' && at > sh.to + LATE_GRACE_MIN) {
    const minutes = at - sh.to
    await sql`INSERT INTO staff_extra_time (staff, work_date, kind, minutes, sched, actual) VALUES (${s}, ${day}, 'late', ${minutes}, ${hm(sh.to)}, ${hm(at)})
      ON CONFLICT (staff, work_date, kind) DO UPDATE SET minutes = ${minutes}, actual = ${hm(at)}, status = CASE WHEN staff_extra_time.status = 'approved' THEN 'pending' ELSE staff_extra_time.status END`
    return { kind: 'late', minutes, text: `You stayed ${dur(minutes)} after your rostered finish (${hm(sh.to)}). Those ${dur(minutes)} will not be paid unless the manager approves that he asked you to stay.` }
  }
  return null
}

export type ExtraRow = { id: number; staff: string; work_date: string; kind: string; minutes: number; sched: string | null; actual: string | null; status: string; decided_by: string | null }
export async function listExtra(opts: { pendingOnly?: boolean; staff?: string; from?: string; to?: string }): Promise<ExtraRow[]> {
  await ensureExtraTime()
  const rows = await sql`SELECT id, staff, work_date, kind, minutes, sched, actual, status, decided_by FROM staff_extra_time
    WHERE (${!opts.pendingOnly} OR status = 'pending') AND (${!opts.staff} OR staff = ${opts.staff ?? ''}) AND (${!opts.from} OR work_date >= ${opts.from ?? ''}) AND (${!opts.to} OR work_date <= ${opts.to ?? ''})
    ORDER BY work_date DESC, id DESC LIMIT 200`
  return rows as unknown as ExtraRow[]
}
export async function decideExtra(id: number, approve: boolean, by: string) {
  await ensureExtraTime()
  const [r] = await sql`UPDATE staff_extra_time SET status = ${approve ? 'approved' : 'rejected'}, decided_by = ${by}, decided_at = now() WHERE id = ${id} RETURNING id, staff, work_date, kind, minutes`
  return r as { id: number; staff: string; work_date: string; kind: string; minutes: number } | undefined
}
// Minutes that are NOT payable for a month: extra time still pending or rejected, per person.
export async function unpaidExtraMinutes(startDate: string, endDate: string): Promise<Record<string, number>> {
  await ensureExtraTime()
  const rows = await sql`SELECT staff, SUM(minutes)::int AS m FROM staff_extra_time WHERE work_date >= ${startDate} AND work_date <= ${endDate} AND status <> 'approved' GROUP BY staff` as unknown as { staff: string; m: number }[]
  return Object.fromEntries(rows.map(r => [r.staff.charAt(0).toUpperCase() + r.staff.slice(1).toLowerCase(), Number(r.m)]))
}
