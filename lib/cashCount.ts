import sql from '@/lib/db'

// ONE Cash Counted per day, on the day's walk-in (WIC) receipt (the one the Sales Log header edits). Nothing else may write a second figure over it:
// the closing question and the clock-out check only fill it when it is empty. If a figure is typed that differs from the one already there, the manager is shown both and picks.
export const GMC_NAME = 'Grony Multimedia as Customer'
export class CashConflict extends Error {
  constructor(public day: string, public existing: number, public entered: number) { super(`The cash counted for ${day} is already ₵${existing} (entered earlier). The figure you typed, ₵${entered}, is different. Choose which one is right.`) }
}

export async function walkIn(day: string): Promise<{ id: number; total: number; cc: number | null } | null> {
  const [r] = await sql`SELECT id, total, cash_counted FROM sales_receipts WHERE receipt_date::date = ${day}::date AND customer_name IS DISTINCT FROM ${GMC_NAME} ORDER BY id LIMIT 1`
  return r ? { id: Number(r.id), total: Number(r.total ?? 0), cc: r.cash_counted == null ? null : Number(r.cash_counted) } : null
}
// Fills the figure only when it is empty. Returns false when a figure is already there (it is left as it is).
export async function saveIfEmpty(receiptId: number, v: number): Promise<boolean> {
  const r = await sql`UPDATE sales_receipts SET cash_counted = ${v} WHERE id = ${receiptId} AND cash_counted IS NULL RETURNING id`
  if (r.length) (await import('@/lib/itemsCache')).clearItemsCache()
  return r.length > 0
}

export type CashConflictRow = { day: string; receiptId: number; receiptCc: number; answer: number; by: string | null; salesTotal: number }
// Days (last 90) where the closing answer and the receipt's Cash Counted are two different figures.
export async function cashConflicts(): Promise<CashConflictRow[]> {
  const rows = await sql`SELECT a.day::text AS day, a.answer, a.by_who, r.id AS rid, r.cash_counted AS cc, r.total
    FROM question_group_answers a JOIN question_group_items i ON i.id = a.item_id AND i.key = 'cash_counted'
    JOIN sales_receipts r ON r.receipt_date::date = a.day::date AND r.customer_name IS DISTINCT FROM ${GMC_NAME}
    WHERE a.day::date >= (CURRENT_DATE - 90) AND r.cash_counted IS NOT NULL AND ABS(r.cash_counted - a.answer::numeric) > 0.005 ORDER BY a.day DESC`.catch(() => []) as unknown as { day: string; answer: string; by_who: string | null; rid: number; cc: string; total: string }[]
  return rows.map(r => ({ day: String(r.day).slice(0, 10), receiptId: Number(r.rid), receiptCc: Number(r.cc), answer: Number(r.answer), by: r.by_who, salesTotal: Number(r.total ?? 0) }))
}
// The manager's choice: this figure is right. The receipt and the closing answer both get it, so they cannot differ.
export async function resolveCash(day: string, value: number): Promise<boolean> {
  const w = await walkIn(day); if (!w) return false
  await sql`UPDATE sales_receipts SET cash_counted = ${value} WHERE id = ${w.id}`
  await sql`UPDATE question_group_answers SET answer = ${String(value)}, at = now() WHERE day = ${day} AND item_id IN (SELECT id FROM question_group_items WHERE key = 'cash_counted')`
  ;(await import('@/lib/itemsCache')).clearItemsCache()
  return true
}
