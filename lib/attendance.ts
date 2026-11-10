import sql from '@/lib/db'
import { once } from '@/lib/once'
import { parseTimeMins } from '@/lib/staffTimes'
import { notifyOwners, pushToUsers } from '@/lib/checklistAlerts'
import { SIGNERS } from '@/lib/signers'
import { metaTick } from '@/lib/metaLaws'

// Ghana is on GMT, so UTC days and times are the shop's.
export const to12h = (mins: number) => { const h = Math.floor(mins / 60) % 24, m = mins % 60; const ap = h >= 12 ? 'pm' : 'am'; const hh = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${hh}:${String(m).padStart(2, '0')}${ap}` }
export const hhmmTo12h = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return to12h(h * 60 + m) }
const today = () => new Date().toISOString().slice(0, 10)
const cap = (n: string) => n.charAt(0).toUpperCase() + n.slice(1)
export const CLOSING_MINS = 19 * 60

export const ensureAttendance = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS clock_corrections (
    id SERIAL PRIMARY KEY, staff TEXT NOT NULL, work_date TEXT NOT NULL, kind TEXT NOT NULL, proposed_out TEXT NOT NULL, basis TEXT,
    status TEXT NOT NULL DEFAULT 'pending', requested_at TIMESTAMPTZ NOT NULL DEFAULT now(), decided_by TEXT, decided_at TIMESTAMPTZ, note TEXT)`.catch(() => {})
  await sql`CREATE TABLE IF NOT EXISTS clock_prompts (day TEXT NOT NULL, staff TEXT NOT NULL, answer TEXT NOT NULL, at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (day, staff))`.catch(() => {})
  await sql`CREATE TABLE IF NOT EXISTS staff_queries (
    id SERIAL PRIMARY KEY, staff TEXT NOT NULL, from_user TEXT NOT NULL, about TEXT NOT NULL, work_date TEXT, review_day TEXT, status TEXT NOT NULL DEFAULT 'open',
    answer TEXT, asked_at TIMESTAMPTZ NOT NULL DEFAULT now(), answered_at TIMESTAMPTZ)`.catch(() => {})
  await sql`CREATE TABLE IF NOT EXISTS clock_autos (
    id SERIAL PRIMARY KEY, staff TEXT NOT NULL, work_date TEXT NOT NULL, out_time TEXT NOT NULL, basis TEXT, status TEXT NOT NULL DEFAULT 'notified',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (staff, work_date))`.catch(() => {})
  await sql`CREATE TABLE IF NOT EXISTS cctv_reviews (
    work_date TEXT PRIMARY KEY, windows TEXT NOT NULL, staff TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_by TEXT, reviewed_at TIMESTAMPTZ, sales_ok BOOLEAN, laws_ok BOOLEAN, note TEXT)`.catch(() => {})
})

// The last thing a staff member did that can only be done AT the shop: a Live Sale tap, a Daily Checklist tick (photos, cleaning, closing) or a
// shop routine tick. Looking at pages or reading laws does not count, because that can be done from anywhere. Never before clock-in, never after closing.
export async function lastActivityMins(staff: string, day: string, clockInMins: number): Promise<number> { return (await lastActivity(staff, day, clockInMins)).mins }
export async function lastActivity(staff: string, day: string, clockInMins: number): Promise<{ mins: number; found: boolean }> {
  let best = clockInMins, found = false
  const take = (m: unknown) => { if (m) { const d = new Date(m as string); if (d.toISOString().slice(0, 10) === day) { const v = d.getUTCHours() * 60 + d.getUTCMinutes(); if (v > clockInMins) { found = true; best = Math.max(best, v) } } } }
  const sources: (() => Promise<unknown>)[] = [
    async () => take((await sql`SELECT MAX(tapped_at) AS m FROM live_sale_taps WHERE LOWER(staff_name) = ${staff} AND tapped_at::date = ${day}::date AND NOT undone`)[0]?.m),
    async () => take((await sql`SELECT MAX(recorded_at) AS m FROM daily_check_events WHERE LOWER(recorded_by) = ${staff} AND day = ${day}`)[0]?.m),
    async () => take((await sql`SELECT MAX(recorded_at) AS m FROM shop_routine_events WHERE LOWER(recorded_by) = ${staff} AND recorded_at::date = ${day}::date`)[0]?.m),
    async () => take((await sql`SELECT MAX(created_at) AS m FROM sale_buyers WHERE LOWER(created_by) = ${staff} AND created_at::date = ${day}::date`)[0]?.m),
  ]
  for (const f of sources) { try { await f() } catch { /* a missing table is skipped */ } }
  return { mins: Math.min(Math.max(best, clockInMins), CLOSING_MINS), found }
}

// An open record: clocked in on a day, never clocked out.
export async function openRecords(staff: string, onlyBefore?: string) {
  const rows = await sql`SELECT work_date::text AS d, actual_in FROM staff_times WHERE LOWER(staff_name) = ${staff} AND actual_in IS NOT NULL AND actual_out IS NULL AND staff_name <> '__shop_open__'
    AND work_date >= (${today()}::date - 60) ORDER BY work_date` as unknown as { d: string; actual_in: string }[]
  return onlyBefore ? rows.filter(r => r.d < onlyBefore) : rows
}

// The law: nobody is left clocked in. When someone has not clocked out, the app clocks them out at the time of their last shop-only action and tells them.
// With no such action at all there is nothing to base a time on, so nothing is set and the person is asked to enter their time (the next-day gate).
export async function autoClockOut(day: string, includeToday = false) {
  await ensureAttendance()
  const rows = await sql`SELECT LOWER(staff_name) AS n, work_date::text AS d, actual_in FROM staff_times WHERE actual_in IS NOT NULL AND actual_out IS NULL AND staff_name <> '__shop_open__' AND work_date <= ${includeToday ? day : new Date(Date.parse(day) - 86400000).toISOString().slice(0, 10)} AND work_date >= (${day}::date - 60)` as unknown as { n: string; d: string; actual_in: string }[]
  let n = 0
  for (const r of rows) {
    if (!SIGNERS.includes(r.n) || r.n === 'grony') continue
    const inM = parseTimeMins(r.actual_in); if (inM == null) continue
    const a = await lastActivity(r.n, r.d, inM)
    if (!a.found) continue
    const out = to12h(a.mins)
    await setClockOut(r.n, r.d, out, 'auto', 'system')
    await sql`INSERT INTO clock_autos (staff, work_date, out_time, basis) VALUES (${r.n}, ${r.d}, ${out}, 'your last action at the shop in the app') ON CONFLICT DO NOTHING`
    n++
    void pushToUsers([r.n], 'You were clocked out for you', `You did not clock out on ${r.d}. The app set your time out to ${out}, your last action at the shop. Open the app to tap OK or send the correct time.`)
  }
  return n
}

export async function setClockOut(staff: string, day: string, out12: string, source: string, by: string) {
  await sql`ALTER TABLE staff_times ADD COLUMN IF NOT EXISTS out_source TEXT`.catch(() => {})
  await sql`UPDATE staff_times SET actual_out = ${out12}, out_source = ${source}, entered_by = ${by} WHERE LOWER(staff_name) = ${staff} AND work_date = ${day}`
}

export async function applyApproval(id: number, by: string, overrideHHMM?: string) {
  await ensureAttendance()
  const [c] = await sql`SELECT id, staff, work_date, proposed_out, status FROM clock_corrections WHERE id = ${id}`
  if (!c || c.status !== 'pending') return null
  const out = overrideHHMM && /^\d{1,2}:\d{2}$/.test(overrideHHMM) ? hhmmTo12h(overrideHHMM) : String(c.proposed_out)
  await setClockOut(String(c.staff), String(c.work_date), out, 'approved', by)
  await sql`UPDATE clock_corrections SET status = 'approved', decided_by = ${by}, decided_at = now(), proposed_out = ${out} WHERE id = ${id}`
  void pushToUsers([String(c.staff)], 'Clock-out time approved', `Your time out for ${c.work_date} is ${out}.`)
  return out
}

// ---- unsupervised periods: staff clocked in while Joe was not ----
type Win = { from: number; to: number }
const merge = (a: Win[]) => { const s = [...a].sort((x, y) => x.from - y.from), o: Win[] = []; for (const w of s) { const l = o[o.length - 1]; if (l && w.from <= l.to) l.to = Math.max(l.to, w.to); else o.push({ ...w }) } return o }
const subtract = (a: Win[], b: Win[]) => { let out = a; for (const x of b) { const n: Win[] = []; for (const w of out) { if (x.to <= w.from || x.from >= w.to) n.push(w); else { if (x.from > w.from) n.push({ from: w.from, to: x.from }); if (x.to < w.to) n.push({ from: x.to, to: w.to }) } } out = n } return out }

export async function unsupervisedFor(day: string): Promise<{ windows: Win[]; staff: string[] }> {
  const rows = await sql`SELECT LOWER(staff_name) AS n, actual_in, actual_out FROM staff_times WHERE work_date = ${day} AND actual_in IS NOT NULL AND staff_name <> '__shop_open__'` as unknown as { n: string; actual_in: string; actual_out: string | null }[]
  const iv = (r: { actual_in: string; actual_out: string | null }): Win | null => { const a = parseTimeMins(r.actual_in); if (a == null) return null; const b = parseTimeMins(r.actual_out) ?? CLOSING_MINS; return b > a ? { from: a, to: b } : null }
  const staffRows = rows.filter(r => r.n !== 'joe' && r.n !== 'grony')
  const staffWins = merge(staffRows.map(iv).filter((w): w is Win => !!w))
  const joeWins = merge(rows.filter(r => r.n === 'joe').map(iv).filter((w): w is Win => !!w))
  const windows = subtract(staffWins, joeWins).filter(w => w.to - w.from >= 10)
  const present = Array.from(new Set(staffRows.filter(r => { const w = iv(r); return !!w && windows.some(x => w.from < x.to && w.to > x.from) }).map(r => r.n)))
  return { windows, staff: present }
}

export const REVIEW_FROM = '2026-11-05' // the day the checklist and laws began; earlier days are not reviewed

export async function detectReviews(throughDay: string, includeToday: boolean) {
  await ensureAttendance()
  const days = await sql`SELECT DISTINCT work_date::text AS d FROM staff_times WHERE work_date >= ${REVIEW_FROM} AND work_date <= ${throughDay} ORDER BY d` as unknown as { d: string }[]
  let created = 0
  for (const { d } of days) {
    if (d === today() && !includeToday) continue
    const u = await unsupervisedFor(d)
    if (!u.windows.length) continue
    const [ex] = await sql`SELECT status FROM cctv_reviews WHERE work_date = ${d}`
    if (!ex) {
      await sql`INSERT INTO cctv_reviews (work_date, windows, staff) VALUES (${d}, ${JSON.stringify(u.windows)}, ${JSON.stringify(u.staff)}) ON CONFLICT DO NOTHING`
      created++
    } else if (ex.status === 'pending') {
      await sql`UPDATE cctv_reviews SET windows = ${JSON.stringify(u.windows)}, staff = ${JSON.stringify(u.staff)} WHERE work_date = ${d}`
    }
  }
  if (created) void pushToUsers(['joe'], 'CCTV review due', `${created} day${created === 1 ? '' : 's'} with staff at work and you not clocked in. Open the CCTV review.`)
  return created
}

const claim = async (key: string) => { await sql`CREATE TABLE IF NOT EXISTS penalty_claims (key TEXT PRIMARY KEY, done_at TIMESTAMPTZ NOT NULL DEFAULT now())`; return (await sql`INSERT INTO penalty_claims (key) VALUES (${key}) ON CONFLICT DO NOTHING RETURNING key`).length > 0 }

// Once a minute (instrumentation.ts): 19:00 still-at-the-shop push; 19:40 review detection; reminders for the owners every 2 hours.
export async function attendanceTick(now = new Date()) {
  if (process.env.ATTENDANCE === 'off') return
  if (now.getUTCDay() === 0) return
  const day = now.toISOString().slice(0, 10)
  const hm = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`
  const min = now.getUTCMinutes(), hr = now.getUTCHours()
  if (hm === '19:00' && await claim(`stillhere:${day}`)) {
    await ensureAttendance()
    const rows = await sql`SELECT LOWER(staff_name) AS n FROM staff_times WHERE work_date = ${day} AND actual_in IS NOT NULL AND actual_out IS NULL AND staff_name <> '__shop_open__'` as unknown as { n: string }[]
    const who = rows.map(r => r.n).filter(n => SIGNERS.includes(n) && n !== 'grony')
    if (who.length) await pushToUsers(who, 'Are you still at the shop?', 'It is 7pm and you have not clocked out. Open the app and tell us.')
  }
  if (hm === '19:40' && await claim(`cctv:${day}`)) { await detectReviews(day, true) }
  if (hm === '08:15' && await claim(`joeheads:${day}`)) {
    await pushToUsers(['joe'], 'Today: what earns a penalty point', 'Every checklist task left undone, a CCTV review or a decision waiting more than 48 hours, and a law not signed or confirmed. The app adds these itself.')
  }
  if (hm === '19:25' && await claim(`meta:${day}`)) { await metaTick(day).catch(e => console.error('meta tick failed:', e instanceof Error ? e.message : String(e))) }
  if (hm === '07:00' && await claim(`cctvcatch:${day}`)) { await detectReviews(day, false) }
  // Every morning: anyone with an earlier day still open is asked to enter their time out (they cannot go on in the app until they do).
  if (hm === '07:10' && await claim(`autoclock:${day}`)) { await autoClockOut(day).catch(e => console.error('auto clock-out failed:', e instanceof Error ? e.message : String(e))) }
  if (hm === '23:30' && await claim(`autoclocktoday:${day}`)) { await autoClockOut(day, true).catch(() => {}) }
  if (await claim('autoretro-v1')) { await autoClockOut(day).catch(e => console.error('auto clock-out retro failed:', e instanceof Error ? e.message : String(e))) }
  if (hm === '07:30' && await claim(`openprev:${day}`)) {
    await ensureAttendance()
    for (const n of SIGNERS.filter(x => x !== 'grony')) {
      const open = (await openRecords(n)).filter(r => r.d < day)
      if (open.length) await pushToUsers([n], 'You did not clock out', `${open.length} day${open.length === 1 ? '' : 's'} without a time out (${open.slice(0, 3).map(o => o.d).join(', ')}). Open the app and enter your time out.`)
    }
  }
  if (min === 0 && hr >= 8 && hr <= 20 && hr % 2 === 0) {
    await ensureAttendance()
    if (await claim(`remind:${day}:${hr}`)) {
      const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM clock_corrections WHERE status = 'pending' AND staff <> 'joe'`
      if (Number(n) > 0) await notifyOwners('Clock-out times to approve', `${n} correction${Number(n) === 1 ? '' : 's'} waiting for you. Open the Daily Checklist.`)
      const [{ j }] = await sql`SELECT COUNT(*)::int AS j FROM clock_corrections WHERE status = 'pending' AND staff = 'joe'`
      if (Number(j) > 0) await pushToUsers(['grony'], 'Joe\'s clock-out time to approve', 'Open the Daily Checklist.')
      const [{ sn }] = await sql`SELECT COUNT(*)::int AS sn FROM penalty_sanctions WHERE status = 'proposed' AND staff <> 'joe'`.catch(() => [{ sn: 0 }])
      const [{ dp }] = await sql`SELECT COUNT(*)::int AS dp FROM staff_penalties WHERE status IN ('pending', 'disputed') AND staff <> 'joe'`.catch(() => [{ dp: 0 }])
      if (Number(sn) + Number(dp) > 0) await pushToUsers(['joe'], 'Decisions waiting for you', `${Number(sn) ? sn + ' sanction(s) to approve. ' : ''}${Number(dp) ? dp + ' violation(s) to confirm or review.' : ''} Open Penalties.`)
      const [{ r }] = await sql`SELECT COUNT(*)::int AS r FROM cctv_reviews WHERE status = 'pending' AND work_date < ${day}`
      if (Number(r) > 0) await pushToUsers(['joe'], 'CCTV review still due', `${r} day${Number(r) === 1 ? '' : 's'} waiting for your review.`)
    }
  }
}
export { cap }
