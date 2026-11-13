import sql from '@/lib/db'
import { once } from '@/lib/once'
import { SIGNERS } from '@/lib/signers'
import { recordActivity } from '@/lib/logger'
import { parseTimeMins } from '@/lib/staffTimes'
import { ensureAttendance, lastActivity, setClockOut, to12h } from '@/lib/attendance'
import { pushToUsers } from '@/lib/checklistAlerts'

// PRESENCE CHECK. From 18:00, when someone clocks out and says nobody else is still at the shop, every other person still clocked in is asked to confirm they are there. They have
// CHECK_SECONDS to confirm. If they do not, they are clocked out at the time of their last shop-only action (the same law as the 7pm "still at the shop?" and the next-day clock-out).
export const CHECK_FROM_MINS = 18 * 60
export const CHECK_SECONDS = 60
const cap = (n: string) => n.charAt(0).toUpperCase() + n.slice(1)
const today = () => new Date().toISOString().slice(0, 10)

export const ensurePresence = once(async () => {
  await ensureAttendance()
  await sql`CREATE TABLE IF NOT EXISTS presence_checks (id SERIAL PRIMARY KEY, day TEXT NOT NULL, staff TEXT NOT NULL, raised_by TEXT NOT NULL, asked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL, status TEXT NOT NULL DEFAULT 'open', result_out TEXT, decided_at TIMESTAMPTZ)`.catch(() => {})
})

// Everyone else still clocked in today (not the person asking, not the owner).
export async function othersStillIn(me: string, day = today()): Promise<string[]> {
  await ensurePresence()
  const rows = await sql`SELECT LOWER(staff_name) AS n FROM staff_times WHERE work_date = ${day} AND actual_in IS NOT NULL AND actual_out IS NULL AND staff_name <> '__shop_open__'` as unknown as { n: string }[]
  return rows.map(r => r.n).filter(n => n !== me && SIGNERS.includes(n) && n !== 'grony')
}

// "Nobody else is here": ask each of the others to confirm.
export async function raiseChecks(by: string): Promise<string[]> {
  await ensurePresence()
  const now = new Date()
  if (now.getUTCHours() * 60 + now.getUTCMinutes() < CHECK_FROM_MINS) return []
  const day = today(), who = await othersStillIn(by, day), asked: string[] = []
  for (const n of who) {
    const [open] = await sql`SELECT id FROM presence_checks WHERE day = ${day} AND staff = ${n} AND status = 'open'`
    if (open) continue
    await sql`INSERT INTO presence_checks (day, staff, raised_by, expires_at) VALUES (${day}, ${n}, ${by}, now() + ${CHECK_SECONDS + ' seconds'}::interval)`
    asked.push(n)
    // An activity of the person who clocked out, so a push is right: it reaches a phone that is in a pocket.
    void pushToUsers([n], `${cap(by)} says you are not at the shop`, `Open the app and confirm you are still here within ${CHECK_SECONDS} seconds, or you will be clocked out.`)
  }
  if (asked.length) void recordActivity(by, 'said nobody else is at the shop', `Asked ${asked.map(cap).join(', ')} to confirm`)
  return asked
}

export async function openCheckFor(me: string) {
  await ensurePresence()
  const find = async () => (await sql`SELECT id, raised_by, EXTRACT(EPOCH FROM (expires_at - now()))::int AS left FROM presence_checks WHERE staff = ${me} AND status = 'open' AND day = ${today()} ORDER BY id DESC LIMIT 1`)[0]
  let c = await find()
  if (c && Number(c.left) <= 0) { await expireDue(); c = await find() }   // time is up: clock them out now rather than waiting for the minute tick
  return c ? { id: Number(c.id), by: String(c.raised_by), secondsLeft: Math.max(0, Number(c.left)) } : null
}

export async function confirmCheck(me: string, id: number): Promise<boolean> {
  await ensurePresence()
  const r = await sql`UPDATE presence_checks SET status = 'confirmed', decided_at = now() WHERE id = ${id} AND staff = ${me} AND status = 'open' AND expires_at > now() - interval '5 seconds' RETURNING id`
  if (r.length) void recordActivity(me, 'confirmed still at the shop', 'after being asked')
  return r.length > 0
}

// Checks nobody confirmed in time: clock the person out at their last shop-only action. With no such action there is nothing to base a time on, so they are left open and enter their time next day.
export async function expireDue(): Promise<number> {
  await ensurePresence()
  const due = await sql`UPDATE presence_checks SET status = 'expired', decided_at = now() WHERE status = 'open' AND expires_at <= now() RETURNING id, day, staff, raised_by` as unknown as { id: number; day: string; staff: string; raised_by: string }[]
  let n = 0
  for (const c of due) {
    try {
      const [rec] = await sql`SELECT actual_in, actual_out FROM staff_times WHERE LOWER(staff_name) = ${c.staff} AND work_date = ${c.day} AND actual_in IS NOT NULL`
      if (!rec || rec.actual_out) continue
      const inM = parseTimeMins(String(rec.actual_in)); if (inM == null) continue
      const a = await lastActivity(c.staff, c.day, inM)
      if (!a.found) { void pushToUsers([c.staff], 'You did not confirm you are at the shop', 'Open the app and enter the time you left.'); continue }
      const out = to12h(a.mins)
      await setClockOut(c.staff, c.day, out, 'auto', 'system')
      await sql`INSERT INTO clock_autos (staff, work_date, out_time, basis) VALUES (${c.staff}, ${c.day}, ${out}, ${cap(c.raised_by) + ' said you were not at the shop and you did not confirm: your last action at the shop'}) ON CONFLICT DO NOTHING`
      await sql`UPDATE presence_checks SET result_out = ${out} WHERE id = ${c.id}`
      n++
      void recordActivity('app', 'clocked someone out after no confirmation', `${cap(c.staff)} at ${out} (last action at the shop)`)
      void pushToUsers([c.staff], 'You were clocked out', `You did not confirm you were at the shop. Your time out is ${out}, your last action. Open the app to tap OK or send the correct time.`)
    } catch (e) { console.error('presence expiry failed:', e instanceof Error ? e.message : String(e)) }
  }
  return n
}
