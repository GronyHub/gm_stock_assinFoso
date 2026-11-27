import sql from '@/lib/db'
import { reconciliationByCount } from '@/lib/lossEvents'
import { getCached } from '@/lib/cacheStore'

// The loss records, by day, as the P&L dates them: expected against counted, the ₵ value, the reason, and who counted, when and the source. The whole history is worked out once and kept for 5 minutes.
export type LossRow = { item_id: number; name: string; expected: number; counted: number; loss_qty: number; loss_amt: number; reason: string | null; by: string | null; at: string | null; source: string | null }
export async function lossDays(): Promise<Record<string, LossRow[]>> {
  return await getCached('losses:by-day', 300, async () => {
    const rec = [...(await reconciliationByCount()).values()].filter(r => r.kind === 'loss')
    const counts = await sql`SELECT DISTINCT ON (item_id, count_date::date) item_id, count_date::date::text AS d, counted_by, source, counted_at::text AS at
      FROM stock_counts ORDER BY item_id, count_date::date, counted_at DESC NULLS LAST` as unknown as { item_id: number; d: string; counted_by: string | null; source: string | null; at: string | null }[]
    const by = new Map(counts.map(c => [`${c.item_id}|${c.d}`, c]))
    const days: Record<string, LossRow[]> = {}
    for (const r of rec) {
      const c = by.get(`${r.item_id}|${String(r.rawDate).slice(0, 10)}`)
      ;(days[r.date] ??= []).push({ item_id: r.item_id, name: r.itemName, expected: r.expected ?? 0, counted: r.counted, loss_qty: Math.abs(r.lossQty ?? 0), loss_amt: r.lossAmt ?? 0, reason: r.reason ?? null, by: c?.counted_by ?? null, at: c?.at ?? null, source: c?.source ?? null })
    }
    for (const k of Object.keys(days)) days[k].sort((a, b) => b.loss_amt - a.loss_amt)
    return days
  })
}
