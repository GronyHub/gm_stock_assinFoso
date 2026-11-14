import sql from '@/lib/db'
import { isShopDay } from '@/lib/rota'
import { addDays, dayKey } from '@/lib/dailyChecksShared'
import { ensureQuestionGroups, listGroups, isComplete } from '@/lib/questionGroups'
import { ensureClosingReports } from '@/lib/closingReports'
import { ensurePenalties } from '@/lib/penalties'

// THE MANAGER BLOCK. The manager (Joe) cannot use the app until the previous working day is closed properly: its Cash Counted is entered and its manager closing questions are
// answered. Until then every page sends him to "Before you continue" (/start-of-day), where both are done. The owner can excuse a day. Only days from LOCK_FROM count, so
// nothing is demanded of days that were worked before the rule existed.
export const LOCK_FROM = '2026-11-13'
const GMC = 'Grony Multimedia as Customer'

// cash: Cash Counted not entered yet. shortage: it was entered but is LESS than the day's sales total (negative work not written), so the Sales Log has to be put right (or the cash recounted).
// hubOpen: only the shortage is left, so the Items hub (where the Sales Log is) stays open for him; otherwise only the Before-you-continue page is.
export type LockState = { locked: boolean; day: string | null; cash: { receiptId: number; salesTotal: number; counted: number | null } | null; shortage: { receiptId: number; salesTotal: number; counted: number; short: number } | null; questions: { tileId: number } | null; approvals?: number; hubOpen?: boolean }
const OPEN: LockState = { locked: false, day: null, cash: null, shortage: null, questions: null, approvals: 0 }

// The last working day before `today` (a shop day on which somebody clocked in), looking back at most a week.
export async function previousWorkingDay(today = dayKey()): Promise<string | null> {
  for (let n = 1; n <= 7; n++) {
    const d = addDays(today, -n)
    if (d < LOCK_FROM) return null
    if (!(await isShopDay(d).catch(() => true))) continue
    const w = await sql`SELECT 1 FROM staff_times WHERE work_date = ${d} AND actual_in IS NOT NULL AND staff_name <> '__shop_open__' LIMIT 1`.catch(() => [])
    if (w.length) return d
  }
  return null
}

// Cash Counted still missing for the previous working day (not excused), or null. Used to make it compulsory before the manager clocks in.
// The oldest day in the last 7 that still has no Cash Counted (owner, 14 Nov 2026: the manager must enter any missing day), else the previous working day.
async function dayToCount(today: string): Promise<string | null> {
  const [m] = await sql`SELECT receipt_date::date::text AS d FROM sales_receipts WHERE customer_name = ${GMC} AND cash_counted IS NULL AND receipt_date::date < ${today}::date AND receipt_date::date >= (${today}::date - 7) ORDER BY receipt_date, id LIMIT 1`.catch(() => [])
  return m?.d ? String(m.d) : await previousWorkingDay(today)
}
export async function missingCashCounted(today = dayKey()): Promise<{ day: string; receiptId: number; salesTotal: number } | null> {
  const day = await dayToCount(today)
  if (!day) return null
  await ensurePenalties()
  const [ex] = await sql`SELECT 1 FROM penalty_claims WHERE key = ${'lock-excused:' + day}`
  if (ex) return null
  const [rc] = await sql`SELECT id, total, cash_counted FROM sales_receipts WHERE receipt_date::date = ${day}::date AND customer_name = ${GMC} ORDER BY id LIMIT 1`
  return rc && rc.cash_counted == null ? { day, receiptId: Number(rc.id), salesTotal: Number(rc.total ?? 0) } : null
}

// Saves Cash Counted on a day's sales receipt, the same as the Sales Log (PUT /api/sales/[id]).
export async function saveCashCounted(receiptId: number, counted: number) {
  await sql`UPDATE sales_receipts SET cash_counted = ${counted} WHERE id = ${receiptId}`
  ;(await import('@/lib/itemsCache')).clearItemsCache()
  cache = null
}

let cache: { at: number; today: string; v: LockState } | null = null
// Cached for 30 seconds (every page change asks); `fresh` bypasses it, for the page where the manager has just entered something.
export async function lockStateForManager(today = dayKey(), fresh = false): Promise<LockState> {
  if (!fresh && cache && cache.today === today && Date.now() - cache.at < 30000) return cache.v
  const v = await computeLock(today)
  cache = { at: Date.now(), today, v }
  return v
}
async function computeLock(today: string): Promise<LockState> {
  try {
    await ensurePenalties(); await ensureQuestionGroups(); await ensureClosingReports()
    // An approver may not carry on while a staff member's clock time from an EARLIER day is still waiting for their decision (requests they may decide: not their own, not one for a clock-out they set).
    const [ap] = await sql`SELECT COUNT(*)::int AS n FROM clock_corrections WHERE status = 'pending' AND staff <> 'joe' AND COALESCE(against, '') <> 'joe' AND requested_at < ${today + 'T00:00:00Z'}::timestamptz`.catch(() => [{ n: 0 }])
    const approvals = Number(ap?.n ?? 0)
    const day = await dayToCount(today)
    if (!day) return { ...OPEN, locked: approvals > 0, approvals }
    const [ex] = await sql`SELECT 1 FROM penalty_claims WHERE key = ${'lock-excused:' + day}`
    if (ex) return { ...OPEN, locked: approvals > 0, approvals }
    const [rc] = await sql`SELECT id, total, cash_counted FROM sales_receipts WHERE receipt_date::date = ${day}::date AND customer_name = ${GMC} ORDER BY id LIMIT 1`
    const total = Number(rc?.total ?? 0)
    const cash = rc && rc.cash_counted == null ? { receiptId: Number(rc.id), salesTotal: total, counted: null } : null
    const shortage = rc && rc.cash_counted != null && Number(rc.cash_counted) < total - 0.005 ? { receiptId: Number(rc.id), salesTotal: total, counted: Number(rc.cash_counted), short: Math.round((total - Number(rc.cash_counted)) * 100) / 100 } : null
    const g = (await listGroups()).find(x => x.bridge === 'closing' && x.assignment === 'managers')
    let questions: LockState['questions'] = null
    if (g && g.tile_id != null) {
      const [old] = await sql`SELECT 1 FROM closing_reports WHERE work_date = ${day}::date`   // answered the earlier way
      if (!old && !(await isComplete(g, day))) questions = { tileId: g.tile_id }
    }
    return { locked: !!(cash || questions || shortage || approvals > 0), day, cash, shortage, questions, approvals, hubOpen: !cash && !questions && approvals === 0 && !!shortage }
  } catch (e) { console.error('manager lock failed (left open):', e instanceof Error ? e.message : String(e)); return OPEN }
}
