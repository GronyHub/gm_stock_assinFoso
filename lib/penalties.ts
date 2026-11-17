import { unmetConditions } from '@/lib/tileConditions'
import { cap } from '@/lib/strings'
import sql from '@/lib/db'
import { once } from '@/lib/once'
import { notifyOwners, pushToUsers, reminder } from '@/lib/checklistAlerts'
import { isManagerName } from '@/lib/signers'
import { getClockState, onShift } from '@/lib/clockState'
import { appliesOn, effectiveDue, addDays } from '@/lib/dailyChecksShared'
import { dutiesForDate } from '@/lib/duties'
import { owes } from '@/lib/assignment'
import { recordActivity } from '@/lib/logger'
import { isShopDay, someoneClockedIn } from '@/lib/rota'
import { parseViolations } from '@/lib/lawViolations'

// Penalty points. Every violation costs points (1 for now); points are recorded in a ledger. 20 points = a 3-day
// suspension (10 hours deducted), 30 = a week (20 hours), 50 = dismissal. Crossing a level only RECOMMENDS the sanction;
// the owner or manager approves it. After a sanction the points drop to half the level. Points reduce by 5 after a clean
// week. The first two weeks are a learning period: violations are recorded and warned about, but do not count.
import { TIERS, WARN_AT, FADE_POINTS, FADE_DAYS, MISSED_DAILY_CAP, LEARNING_DAYS, tiersText, firstTier } from '@/lib/penaltyRules'
export { TIERS, WARN_AT, FADE_POINTS, FADE_DAYS, MISSED_DAILY_CAP, LEARNING_DAYS }

// Joe is the manager at the shop, so he decides for the other staff; Grony (in the UK) decides for Joe and may decide for anyone. Nobody decides their own.
export const canDecideFor = (decider: string, subject: string) => decider !== subject.toLowerCase() && (decider === 'grony' || decider === 'joe')
export const notifyDeciders = (subject: string, title: string, body: string) => subject.toLowerCase() === 'joe' ? pushToUsers(['grony'], title, body) : notifyOwners(title, body)

const dayKey = (d = new Date()) => d.toISOString().slice(0, 10)

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
  // Parts of a point (a task worth 0.2, a violation worth 0.5) wait here and add up across every rule; each time the total reaches a whole point, that point is charged (see settle).
  await sql`CREATE TABLE IF NOT EXISTS penalty_carry (staff TEXT NOT NULL, source TEXT NOT NULL, ref TEXT NOT NULL, points NUMERIC(8,2) NOT NULL, day TEXT NOT NULL, note TEXT, PRIMARY KEY (staff, source, ref))`.catch(() => {})
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

const r2 = (n: number) => Math.round(n * 100) / 100

// The part of a point a person has built up so far (all rules together) that has not yet been charged as a whole point.
export async function carryOf(staff: string): Promise<number> {
  await ensurePenalties()
  const s = staff.toLowerCase()
  const [a] = await sql`SELECT COALESCE(SUM(points), 0)::float AS t FROM penalty_carry WHERE staff = ${s}`
  const [b] = await sql`SELECT COALESCE(SUM(points), 0)::float AS t FROM staff_penalties WHERE staff = ${s} AND source = 'accrued' AND status IN ('active', 'pending')`
  return Math.max(0, r2(Number(a?.t ?? 0) - Number(b?.t ?? 0)))
}

// Charges the whole points that the built-up parts have reached, and takes back any that are no longer reached (a task done late).
export async function settle(staff: string) {
  await ensurePenalties()
  const s = staff.toLowerCase()
  const [a] = await sql`SELECT COALESCE(SUM(points), 0)::float AS t FROM penalty_carry WHERE staff = ${s}`
  const should = Math.floor(Number(a?.t ?? 0) + 0.0001)
  const rows = await sql`SELECT id, points FROM staff_penalties WHERE staff = ${s} AND source = 'accrued' AND status IN ('active', 'pending') ORDER BY id DESC` as unknown as { id: number; points: number }[]
  const has = rows.reduce((n, r) => n + Number(r.points), 0)
  if (should > has) {
    const recent = await sql`SELECT note FROM penalty_carry WHERE staff = ${s} AND note IS NOT NULL ORDER BY day DESC LIMIT 4`
    await addPoint({ staff: s, points: should - has, reason: `Small penalties added up to ${should} point${should === 1 ? '' : 's'} (${recent.map(r => String(r.note).slice(0, 60)).join('; ')})`, source: 'accrued', ref: `accrued:${should}:${Date.now()}`, by: 'system' })
  } else if (should < has) {
    let cut = has - should
    for (const r of rows) {
      if (cut <= 0) break
      const take = Math.min(cut, Number(r.points)); cut -= take
      if (take >= Number(r.points)) await sql`UPDATE staff_penalties SET status = 'withdrawn', withdraw_reason = 'Withdrawn: a task was done late', note = 'Withdrawn: a task was done late' WHERE id = ${r.id}`
      else await sql`UPDATE staff_penalties SET points = ${Number(r.points) - take}, note = 'Reduced: a task was done late' WHERE id = ${r.id}`
    }
  }
}

type Add = { staff: string; points?: number; reason: string; source: string; ref?: string; day?: string; lawId?: number | null; status?: 'active' | 'pending'; by?: string; violation?: string; lawCode?: string | null }
// Records a violation. During the learning period it is a warning (does not count); a pending one waits for the owner.
export async function addPoint(a: Add): Promise<{ id: number; staff: string; points: number; reason: string; counted: boolean; status: string } | null> {
  await ensurePenalties()
  let points = a.points ?? 1
  const staff = a.staff.toLowerCase(), day = a.day ?? dayKey(), status = a.status ?? 'active'
  // A day nobody clocked in is not charged to anyone. People's own decisions (a manual penalty, a behaviour report) and a backdated clock-in always stand.
  if (!['manual', 'behaviour', 'backdate', 'backdate-point', 'accrued'].includes(a.source) && !(await someoneClockedIn(day))) return null
  // A part of a point (0.2, 1.5) is kept and added to the person's build-up; only the whole points are charged now, and whole points follow as the build-up reaches them.
  if (!Number.isInteger(points) && points > 0) {
    if (status !== 'active') points = Math.max(1, Math.round(points))
    else {
      const whole = Math.floor(points), frac = r2(points - whole)
      if (frac > 0) await sql`INSERT INTO penalty_carry (staff, source, ref, points, day, note) VALUES (${staff}, ${a.source}, ${a.ref ?? `${a.source}:${Date.now()}`}, ${frac}, ${day}, ${a.reason.slice(0, 160)}) ON CONFLICT DO NOTHING`
      if (whole === 0) { await settle(staff); return null }
      const row = await addPoint({ ...a, points: whole })
      await settle(staff)
      return row
    }
  }
  const counted = status === 'active' && await isCounting(day)
  const before = await totalPoints(staff)
  const [row] = await sql`INSERT INTO staff_penalties (staff, points, kind, reason, source, ref, day, law_id, counted, status, created_by, violation, law_code)
    VALUES (${staff}, ${points}, 'violation', ${a.reason}, ${a.source}, ${a.ref ?? null}, ${day}, ${a.lawId ?? null}, ${counted}, ${status}, ${a.by ?? 'system'}, ${a.violation ?? null}, ${a.lawCode ?? null})
    ON CONFLICT DO NOTHING RETURNING id, staff, points, reason, counted, status`
  if (!row) return null
  void recordActivity(a.by ?? 'app', status === 'pending' ? 'logged a violation for confirmation' : 'added a penalty point', `${cap(staff)} (${points}): ${a.reason}`.slice(0, 240))
  if (status === 'active') {
    if (counted) await afterChange(staff, before, before + points)
  }
  return row as { id: number; staff: string; points: number; reason: string; counted: boolean; status: string }
}

// The warnings at 10 and 15 points, and the sanction recommendation at 20, 30 and 50.
export async function afterChange(staff: string, before: number, after: number) {
  for (const lvl of WARN_AT) {
    if (before < lvl && after >= lvl) {
      // automatic: shown on screen on Penalty Points (no push)
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
    void recordActivity(by, 'approved a dismissal', cap(String(s.staff)))
    void notifyOwners(`Dismissal approved: ${cap(String(s.staff))}`, 'Deactivate the account in Users when the dismissal is carried out.')
    return { dismissal: true }
  }
  const start = startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : addDays(dayKey(), 1)
  const end = addDays(start, Number(s.days) - 1)
  await sql`UPDATE penalty_sanctions SET status = 'approved', decided_by = ${by}, decided_at = now(), start_date = ${start}, end_date = ${end} WHERE id = ${id}`
  void recordActivity(by, 'approved a suspension', `${cap(String(s.staff))} from ${start} to ${end}`)
  const half = Number(s.tier) / 2, t = await totalPoints(String(s.staff))
  if (t > half) await sql`INSERT INTO staff_penalties (staff, points, kind, reason, source, day, counted, status, created_by)
    VALUES (${String(s.staff)}, ${-(t - half)}, 'reset', ${`Sanction applied: points reduced to ${half}`}, 'sanction', ${dayKey()}, TRUE, 'active', ${by})`
  void pushToUsers([String(s.staff)], 'Sanction approved', `${Number(s.days)}-day suspension from ${start} to ${end}, with ${Number(s.hours)} hours deducted. Your points are now ${half}.`)
  return { start, end }
}
export async function rejectSanction(id: number, by: string) {
  await ensurePenalties()
  await sql`UPDATE penalty_sanctions SET status = 'rejected', decided_by = ${by}, decided_at = now() WHERE id = ${id} AND status = 'proposed'`
  void recordActivity(by, 'decided not to apply a sanction', `sanction ${id}`)
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
  void recordActivity(by, 'confirmed a violation', `${cap(String(p.staff))} (${p.points})`)
  if (counted) await afterChange(String(p.staff), before, before + Number(p.points))
  else { /* pilot point: on screen only */ }
  return true
}
export async function reversePoint(id: number, by: string) {
  const [p] = await sql`SELECT id, staff, points, counted, status FROM staff_penalties WHERE id = ${id}`
  if (!p || (p.status !== 'active' && p.status !== 'pending')) return false
  await sql`UPDATE staff_penalties SET status = 'reversed', note = ${'Reversed by ' + by} WHERE id = ${id}`
  void recordActivity(by, 'took back a penalty point', `${cap(String(p.staff))}`)
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
      void reminder([s], 'Penalty points reduced', `A clean week: ${cut} points removed. You now have ${t - cut}.`)
    }
  }
}

// Day end: every task left undone costs the person it falls on a point, at most MISSED_DAILY_CAP each. Who it falls on and whether it was done come from the one
// duties calculation that Waiting for team and Waiting for me read, so what the screens show is exactly what is charged.
// The undone tasks of a day, by the person they fall on. Only a task that a law stands behind can cost a point (the owner's rule: everything rests on a law),
// and only while that law is live; a COUNT NOW task is covered by the manager's daily counts law instead.
async function owedByOwner(day: string) {
  const clock = await getClockState(day)
  const byOwner = new Map<string, Awaited<ReturnType<typeof dutiesForDate>>>()
  if (!clock.everIn.length) return byOwner
  const live = new Set((await sql`SELECT id FROM page_laws WHERE status = 'live' AND COALESCE(text, '') NOT ILIKE 'COUNT NOW%'`.catch(() => [])).map(r => Number(r.id)))
  const owed = (await dutiesForDate(day)).filter(d => d.lawId != null && live.has(Number(d.lawId)) && !/^COUNT NOW/i.test(d.title) && d.state !== 'done' && d.state !== 'no' && d.owner && clock.everIn.includes(d.owner))
  for (const d of owed) byOwner.set(d.owner!, [...(byOwner.get(d.owner!) ?? []), d])
  return byOwner
}

// What one undone task of a law is worth: the points on its first violation line (1 unless the law says otherwise; 0.2 means five undone tasks make a point).
async function weightsFor(lawIds: number[]) {
  const w = new Map<number, number>()
  if (!lawIds.length) return w
  const rows = await sql`SELECT id, violations, points FROM page_laws WHERE id = ANY(${Array.from(new Set(lawIds))})`.catch(() => []) as unknown as { id: number; violations: string | null; points: number | null }[]
  for (const r of rows) { const v = parseViolations(r.violations)[0]; w.set(Number(r.id), v ? v.points : Number(r.points ?? 1)) }
  return w
}
// A person's day: what their undone tasks add up to (at most MISSED_DAILY_CAP), how many there were and the first two names.
async function dayTotals(day: string) {
  const byOwner = await owedByOwner(day)
  const w = await weightsFor(Array.from(byOwner.values()).flat().map(d => Number(d.lawId)))
  const out = new Map<string, { total: number; n: number; first: string }>()
  for (const [name, mine] of byOwner) {
    const sum = mine.reduce((n, d) => n + (w.get(Number(d.lawId)) ?? 1), 0)
    out.set(name, { total: r2(Math.min(sum, MISSED_DAILY_CAP)), n: mine.length, first: mine.slice(0, 2).map(m => m.title.slice(0, 50)).join('; ') + (mine.length > 2 ? '...' : '') })
  }
  return out
}

export async function dayEndAssess(day = dayKey()) {
  await ensurePenalties()
  for (const [name, t] of await dayTotals(day)) {
    if (t.total <= 0) continue
    const whole = Math.floor(t.total + 0.0001), frac = r2(t.total - whole)
    if (whole > 0) await addPoint({ staff: name, points: whole, reason: `${t.n} checklist task${t.n === 1 ? '' : 's'} left undone today (${t.first})`, source: 'missed', ref: `missed:${day}`, day })
    if (frac > 0) await sql`INSERT INTO penalty_carry (staff, source, ref, points, day, note) VALUES (${name}, 'missed', ${'missed:' + day}, ${frac}, ${day}, ${`${t.n} task${t.n === 1 ? '' : 's'} left undone on ${day}`}) ON CONFLICT (staff, source, ref) DO UPDATE SET points = ${frac}`
    await settle(name)
  }
}

// A task of an earlier day done late (the manager's closing questions, answered the next morning): the day-end point is taken back, or made smaller when other tasks stay undone.
export async function recheckMissed(day: string, note = 'Withdrawn: answered the next morning') {
  await ensurePenalties()
  const pts = await sql`SELECT id, staff, points FROM staff_penalties WHERE ref = ${'missed:' + day} AND source = 'missed' AND status IN ('active', 'pending')` as unknown as { id: number; staff: string; points: number }[]
  const parts = await sql`SELECT staff FROM penalty_carry WHERE ref = ${'missed:' + day} AND source = 'missed'` as unknown as { staff: string }[]
  const people = Array.from(new Set([...pts.map(p => String(p.staff)), ...parts.map(p => String(p.staff))]))
  if (!people.length) return
  const totals = await dayTotals(day)
  for (const who of people) {
    const t = totals.get(who)?.total ?? 0
    const whole = Math.floor(t + 0.0001), frac = r2(t - whole)
    for (const p of pts.filter(x => String(x.staff) === who)) {
      if (whole === 0) await sql`UPDATE staff_penalties SET status = 'withdrawn', withdraw_reason = ${note}, note = ${note} WHERE id = ${p.id}`
      else if (whole < Number(p.points)) await sql`UPDATE staff_penalties SET points = ${whole}, note = ${'Reduced: a task was done the next morning'} WHERE id = ${p.id}`
    }
    if (frac > 0) await sql`UPDATE penalty_carry SET points = ${frac} WHERE staff = ${who} AND source = 'missed' AND ref = ${'missed:' + day}`
    else await sql`DELETE FROM penalty_carry WHERE staff = ${who} AND source = 'missed' AND ref = ${'missed:' + day}`
    await settle(who)
  }
}

const claim = async (key: string) => (await sql`INSERT INTO penalty_claims (key) VALUES (${key}) ON CONFLICT DO NOTHING RETURNING key`).length > 0

// Once a minute from instrumentation.ts; it only does anything at 08:20 (Monday prompt), 19:20 and 19:30.
export async function penaltiesTick(now = new Date()) {
  if (process.env.PENALTIES === 'off') return
  // One-time pilot start (2026-11-12): lateness and absence points are charged from yesterday, and every pilot point is practice that never counts;
  // counting starts on the date the owner sets on the Penalty Points page (21 Nov 2026).
  await ensurePenalties()
  if (await claim('attendance-pilot-2026-11-12')) {
    await sql`INSERT INTO penalty_settings (key, value) VALUES ('start_counting', '2026-11-16') ON CONFLICT (key) DO UPDATE SET value = '2026-11-16'`.catch(() => {})
    const { assessAttendance } = await import('@/lib/attendancePenalties')
    await assessAttendance('2026-11-11').catch(e => console.error('attendance backfill failed:', e instanceof Error ? e.message : String(e)))
  }
  const hm = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`
  const day = dayKey(now)
  if (!(await isShopDay(day))) return
  if (hm === '08:20' && now.getUTCDay() === 1) {
    await ensurePenalties()
    if (await claim(`prompt:${day}`)) {
      const st = await getSettings()
      if (day < st.startCounting) {
        const left = Math.max(0, Math.round((Date.parse(st.startCounting) - Date.parse(day)) / 86400000))
        await reminder('Penalty points: learning period', `Points start counting on ${st.startCounting} (${left} days). Each violation costs the points shown on its law (most cost 1). ${firstTier.points} points = a ${firstTier.label}. Follow the laws and finish the checklist.`)
      } else if (day === st.startCounting || (Date.parse(day) - Date.parse(st.startCounting)) / 86400000 < 7) {
        await reminder('Penalty points are now counting', `Each violation costs the points shown on its law (most cost 1). ${tiersText()}. A clean week removes ${FADE_POINTS} points.`)
      }
    }
  }
  if (hm === '19:20') { await ensurePenalties(); if (await claim(`dayend:${day}`)) { await dayEndAssess(day); await (await import('@/lib/attendancePenalties')).assessAttendance(day).catch(() => {}) } }
  if (hm === '19:30') { await ensurePenalties(); if (await claim(`fade:${day}`)) await fadeTick(day) }
}
