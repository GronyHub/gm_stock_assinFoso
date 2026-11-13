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

export type LockState = { locked: boolean; day: string | null; cash: { receiptId: number; salesTotal: number; counted: number | null } | null; questions: { tileId: number } | null }
const OPEN: LockState = { locked: false, day: null, cash: null, questions: null }

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
    const day = await previousWorkingDay(today)
    if (!day) return OPEN
    const [ex] = await sql`SELECT 1 FROM penalty_claims WHERE key = ${'lock-excused:' + day}`
    if (ex) return OPEN
    const [rc] = await sql`SELECT id, total, cash_counted FROM sales_receipts WHERE receipt_date::date = ${day}::date AND customer_name = ${GMC} ORDER BY id LIMIT 1`
    const cash = rc && rc.cash_counted == null ? { receiptId: Number(rc.id), salesTotal: Number(rc.total ?? 0), counted: null } : null
    const g = (await listGroups()).find(x => x.bridge === 'closing' && x.assignment === 'managers')
    let questions: LockState['questions'] = null
    if (g && g.tile_id != null) {
      const [old] = await sql`SELECT 1 FROM closing_reports WHERE work_date = ${day}::date`   // answered the earlier way
      if (!old && !(await isComplete(g, day))) questions = { tileId: g.tile_id }
    }
    return { locked: !!(cash || questions), day, cash, questions }
  } catch (e) { console.error('manager lock failed (left open):', e instanceof Error ? e.message : String(e)); return OPEN }
}
