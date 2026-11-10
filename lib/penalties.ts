import sql from '@/lib/db'
import { once } from '@/lib/once'
import { notifyOwners, pushToUsers, pushToShop } from '@/lib/checklistAlerts'
import { isManagerName } from '@/lib/signers'
import { getClockState } from '@/lib/clockState'
import { appliesOn } from '@/lib/dailyChecksShared'

// Penalty points. Every violation costs points (1 for now); points are recorded in a ledger. 20 points = a 3-day
// suspension (10 hours deducted), 30 = a week (20 hours), 50 = dismissal. Crossing a level only RECOMMENDS the sanction;
// the owner or manager approves it. After a sanction the points drop to half the level. Points reduce by 5 after a clean
// week. The first two weeks are a learning period: violations are recorded and warned about, but do not count.
import { TIERS, WARN_AT, FADE_POINTS, FADE_DAYS, MISSED_DAILY_CAP, LEARNING_DAYS, tiersText, firstTier } from '@/lib/penaltyRules'
export { TIERS, WARN_AT, FADE_POINTS, FADE_DAYS, MISSED_DAILY_CAP, LEARNING_DAYS }

// Joe is the manager at the shop, so he decides for the other staff; Grony (in the UK) decides for Joe and may decide for anyone. Nobody decides their own.
export const canDecideFor = (decider: string, subject: string) => decider !== subject.toLowerCase() && (decider === 'grony' || decider === 'joe')
export const notifyDeciders = (subject: string, title: string, body: string) => subject.toLowerCase() === 'joe' ? pushToUsers(['grony'], title, body) : notifyOwners(title, body)

const cap = (n: string) => n.charAt(0).toUpperCase() + n.slice(1)
const dayKey = (d = new Date()) => d.toISOString().slice(0, 10)
const addDays = (day: string, n: number) => { const d = new Date(day + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return dayKey(d) }

export const ensurePenalties = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS staff_penalties (
    id SERIAL PRIMARY KEY, staff TEXT NOT NULL, points INTEGER NOT NULL, kind TEXT NOT NULL DEFAULT 'violation', reason TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual', ref TEXT, day TEXT NOT NULL, law_id INTEGER, counted BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'active', created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), note TEXT)`.catch(() => {})
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS staff_penalties_ref ON staff_penalties (staff, source, ref) WHERE ref IS NOT NULL`.catch(() => {})
  await sql`CREATE INDEX IF NOT EXISTS staff_penalties_staff ON staff_penalties (staff)`.catch(() => {})
  await sql`ALTER TABLE staff_penalties ADD COLUMN IF NOT EXISTS violation TEXT, ADD COLUMN IF NOT EXISTS law_code TEXT, ADD COLUMN IF NOT EXISTS dispute_note TEXT, ADD COLUMN IF NOT EXISTS ack_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS withdraw_reason TEXT`.catch(() => {})
  await sql`CREATE TABLE IF NOT EXISTS penalty_sanctions (
    id SERIAL PRIMARY KEY, staff TEXT NOT NULL, tier INTEGER NOT NULL, points_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'proposed',
    days INTEGER NOT NULL DEFAULT 0, hours INTEGER NOT NULL DEFAULT 0, start_date TEXT, end_date TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), decided_by TEXT, decided_at TIMESTAMPTZ, note TEXT)`.catch(() => {})
  await sql`CREATE TABLE IF NOT EXISTS penalty_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`.catch(() => {})
  await sql`CREATE TABLE IF NOT EXISTS penalty_claims (key TEXT PRIMARY KEY, done_at TIMESTAMPTZ NOT NULL DEFAULT now())`.catch(() => {})
  const today = dayKey()
  await sql`INSERT INTO penalty_settings (key, value) VALUES ('launch', ${today}) ON CONFLICT DO NOTHING`.catch(() => {})
  await sql`INSERT INTO penalty_settings (key, value) VALUES ('start_counting', ${addDays(today, LEARNING_DAYS)}) ON CONFLICT DO NOTHING`.catch(() => {})
})

export async function getSettings() {
  await ensurePenalties()
  const rows = await sql`SELECT key, value FROM penalty_settings` as unknown as { key: string; value: string }[]
  const m: Record<string, string> = {}; for (const r of rows) m[r.key] = r.value
  return { launch: m.launch ?? dayKey(), startCounting: m.start_counting ?? addDays(dayKey(), LEARNING_DAYS) }
}
export async function isCounting(day = dayKey()) { return day >= (await getSettings()).startCounting }

export async function totalPoints(staff: string): Promise<number> {
  await ensurePenalties()
  const [r] = await sql`SELECT COALESCE(SUM(points), 0)::int AS t FROM staff_penalties WHERE staff = ${staff.toLowerCase()} AND counted AND status = 'active'`
  return Math.max(0, Number(r?.t ?? 0))
}

type Add = { staff: string; points?: number; reason: string; source: string; ref?: string; day?: string; lawId?: number | null; status?: 'active' | 'pending'; by?: string; violation?: string; lawCode?: string | null }
// Records a violation. During the learning period it is a warning (does not count); a pending one waits for the owner.
export async function addPoint(a: Add) {
  await ensurePenalties()
  const staff = a.staff.toLowerCase(), day = a.day ?? dayKey(), points = a.points ?? 1, status = a.status ?? 'active'
  const counted = status === 'active' && await isCounting(day)
  const before = await totalPoints(staff)
  const [row] = await sql`INSERT INTO staff_penalties (staff, points, kind, reason, source, ref, day, law_id, counted, status, created_by, violation, law_code)
    VALUES (${staff}, ${points}, 'violation', ${a.reason}, ${a.source}, ${a.ref ?? null}, ${day}, ${a.lawId ?? null}, ${counted}, ${status}, ${a.by ?? 'system'}, ${a.violation ?? null}, ${a.lawCode ?? null})
    ON CONFLICT DO NOTHING RETURNING id, staff, points, reason, counted, status`
  if (!row) return null
  if (status === 'active') {
    if (counted) await afterChange(staff, before, before + points)
    else void pushToUsers([staff], 'Penalty point warning (learning period)', `${a.reason}. From ${(await getSettings()).startCounting} this will cost ${points} point${points === 1 ? '' : 's'}.`)
  }
  return row
}

// The warnings at 10 and 15 points, and the sanction recommendation at 20, 30 and 50.
export async function afterChange(staff: string, before: number, after: number) {
  for (const lvl of WARN_AT) {
    if (before < lvl && after >= lvl) {
      void pushToUsers([staff], `You have ${after} penalty points`, `At ${firstTier.points} points the sanction is a ${firstTier.label}. Keep the laws and the checklist.`)
      void notifyDeciders(staff, `${cap(staff)} reached ${after} penalty points`, `Early warning: ${firstTier.points} points means a ${firstTier.label}.`)
    }
  }
  const tier = [...TIERS].reverse().find(t => after >= t.points)
  if (!tier) return
  const [open] = await sql`SELECT id FROM penalty_sanctions WHERE staff = ${staff} AND tier = ${tier.points} AND (status = 'proposed' OR (status = 'rejected' AND points_at >= ${after}))`
  if (open) return
  await sql`INSERT INTO penalty_sanctions (staff, tier, points_at, status, days, hours) VALUES (${staff}, ${tier.points}, ${after}, 'proposed', ${tier.days}, ${tier.hours})`
  void notifyDeciders(staff, `Sanction to approve: ${cap(staff)}`, `${cap(staff)} has ${after} penalty points. Recommended: ${tier.label}${tier.hours ? ` (${tier.hours} hours deducted)` : ''}. Open Penalties to approve.`)
}

export async function approveSanction(id: number, by: string, startDate?: string) {
  await ensurePenalties()
  const [s] = await sql`SELECT id, staff, tier, status, days, hours FROM penalty_sanctions WHERE id = ${id}`
  if (!s || s.status !== 'proposed') return null
  if (Number(s.tier) >= 50) {
    await sql`UPDATE penalty_sanctions SET status = 'approved', decided_by = ${by}, decided_at = now() WHERE id = ${id}`
    void notifyOwners(`Dismissal approved: ${cap(String(s.staff))}`, 'Deactivate the account in Users when the dismissal is carried out.')
    return { dismissal: true }
  }
  const start = startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : addDays(dayKey(), 1)
  const end = addDays(start, Number(s.days) - 1)
  await sql`UPDATE penalty_sanctions SET status = 'approved', decided_by = ${by}, decided_at = now(), start_date = ${start}, end_date = ${end} WHERE id = ${id}`
  const half = Number(s.tier) / 2, t = await totalPoints(String(s.staff))
  if (t > half) await sql`INSERT INTO staff_penalties (staff, points, kind, reason, source, day, counted, status, created_by)
    VALUES (${String(s.staff)}, ${-(t - half)}, 'reset', ${`Sanction applied: points reduced to ${half}`}, 'sanction', ${dayKey()}, TRUE, 'active', ${by})`
  void pushToUsers([String(s.staff)], 'Sanction approved', `${Number(s.days)}-day suspension from ${start} to ${end}, with ${Number(s.hours)} hours deducted. Your points are now ${half}.`)
  return { start, end }
}
export async function rejectSanction(id: number, by: string) {
  await ensurePenalties()
  await sql`UPDATE penalty_sanctions SET status = 'rejected', decided_by = ${by}, decided_at = now() WHERE id = ${id} AND status = 'proposed'`
}

export async function suspendedMessage(staff: string, day = dayKey()): Promise<string | null> {
  await ensurePenalties()
  const [r] = await sql`SELECT end_date FROM penalty_sanctions WHERE staff = ${staff.toLowerCase()} AND status = 'approved' AND tier < 50 AND start_date <= ${day} AND end_date >= ${day} LIMIT 1`
  return r ? `You are suspended until ${r.end_date}. You cannot clock in or tick tasks during a suspension.` : null
}

// Pending reports (e.g. a behaviour report) wait for the owner; confirming makes it a point, dismissing removes it.
export async function confirmPending(id: number, by: string) {
  const [p] = await sql`SELECT id, staff, points, day, status FROM staff_penalties WHERE id = ${id}`
  if (!p || p.status !== 'pending') return false
  const counted = await isCounting(dayKey())
  const before = await totalPoints(String(p.staff))
  await sql`UPDATE staff_penalties SET status = 'active', counted = ${counted}, created_by = ${by} WHERE id = ${id}`
  if (counted) await afterChange(String(p.staff), before, before + Number(p.points))
  else void pushToUsers([String(p.staff)], 'Penalty point warning (learning period)', 'A report about you was confirmed. After the learning period this will cost a point.')
  return true
}
export async function reversePoint(id: number, by: string) {
  const [p] = await sql`SELECT id, staff, points, counted, status FROM staff_penalties WHERE id = ${id}`
  if (!p || (p.status !== 'active' && p.status !== 'pending')) return false
  await sql`UPDATE staff_penalties SET status = 'reversed', note = ${'Reversed by ' + by} WHERE id = ${id}`
  return true
}

// Points reduce by 5 after a clean week: no new counted point and no earlier reduction in the last 7 days.
export async function fadeTick(day = dayKey()) {
  await ensurePenalties()
  const staff = await sql`SELECT DISTINCT staff FROM staff_penalties WHERE counted AND status = 'active'` as unknown as { staff: string }[]
  for (const { staff: s } of staff) {
    const t = await totalPoints(s)
    if (t <= 0) continue
    const [r] = await sql`SELECT MAX(day) FILTER (WHERE kind = 'violation' AND points > 0) AS lastv, MAX(day) FILTER (WHERE kind = 'fade') AS lastf FROM staff_penalties WHERE staff = ${s} AND counted AND status = 'active'`
    const last = [r?.lastv, r?.lastf].filter(Boolean).sort().pop() as string | undefined
    if (last && day >= addDays(last, FADE_DAYS)) {
      const cut = Math.min(FADE_POINTS, t)
      await sql`INSERT INTO staff_penalties (staff, points, kind, reason, source, day, counted, status, created_by) VALUES (${s}, ${-cut}, 'fade', ${'Clean record for a week: minus ' + cut}, 'fade', ${day}, TRUE, 'active', 'system')`
      void pushToUsers([s], 'Penalty points reduced', `A clean week: ${cut} points removed. You now have ${t - cut}.`)
    }
  }
}

// Day end: every task left undone costs every person who clocked in that day a point, at most MISSED_DAILY_CAP each.
export async function dayEndAssess(day = dayKey()) {
  await ensurePenalties()
  const clock = await getClockState(day)
  if (!clock.everIn.length) return
  const tiles = await sql`SELECT id, title, days, (law_id IS NOT NULL AND law_id IN (SELECT id FROM page_laws WHERE audience = 'managers')) AS mgr FROM daily_check_tiles WHERE active AND frequency = 'daily' AND kind <> 'properties' AND time IS NOT NULL ORDER BY time, id` as unknown as { id: number; title: string; days: string | null; mgr: boolean }[]
  const done = await sql`SELECT DISTINCT tile_id FROM daily_check_events WHERE day = ${day} AND value = 'Done'` as unknown as { tile_id: number }[]
  const doneSet = new Set(done.map(d => d.tile_id))
  const missed = tiles.filter(t => appliesOn(t, day) && !doneSet.has(t.id))
  if (!missed.length) return
  // A managers-only task left undone costs only the managers who clocked in; every other task costs everyone who clocked in.
  for (const name of Array.from(new Set(clock.everIn))) {
    const mine = missed.filter(t => !t.mgr || isManagerName(name))
    if (!mine.length) continue
    const pts = Math.min(mine.length, MISSED_DAILY_CAP)
    const first = mine.slice(0, 2).map(m => m.title.slice(0, 50)).join('; ')
    await addPoint({ staff: name, points: pts, reason: `${mine.length} checklist task${mine.length === 1 ? '' : 's'} left undone today (${first}${mine.length > 2 ? '...' : ''})`, source: 'missed', ref: `missed:${day}`, day })
  }
}

const claim = async (key: string) => (await sql`INSERT INTO penalty_claims (key) VALUES (${key}) ON CONFLICT DO NOTHING RETURNING key`).length > 0

// Once a minute from instrumentation.ts; it only does anything at 08:20 (Monday prompt), 19:20 and 19:30.
export async function penaltiesTick(now = new Date()) {
  if (process.env.PENALTIES === 'off') return
  const hm = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`
  const day = dayKey(now)
  if (now.getUTCDay() === 0) return
  if (hm === '08:20' && now.getUTCDay() === 1) {
    await ensurePenalties()
    if (await claim(`prompt:${day}`)) {
      const st = await getSettings()
      if (day < st.startCounting) {
        const left = Math.max(0, Math.round((Date.parse(st.startCounting) - Date.parse(day)) / 86400000))
        await pushToShop('Penalty points: learning period', `Points start counting on ${st.startCounting} (${left} days). Each violation will cost 1 point. ${firstTier.points} points = a ${firstTier.label}. Follow the laws and finish the checklist.`)
      } else if (day === st.startCounting || (Date.parse(day) - Date.parse(st.startCounting)) / 86400000 < 7) {
        await pushToShop('Penalty points are now counting', `Each violation costs 1 point. ${tiersText()}. A clean week removes ${FADE_POINTS} points.`)
      }
    }
  }
  if (hm === '19:20') { await ensurePenalties(); if (await claim(`dayend:${day}`)) await dayEndAssess(day) }
  if (hm === '19:30') { await ensurePenalties(); if (await claim(`fade:${day}`)) await fadeTick(day) }
}
