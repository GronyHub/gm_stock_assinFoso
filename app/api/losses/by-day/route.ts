import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { reconciliationByCount } from '@/lib/lossEvents'
import { getCached } from '@/lib/cacheStore'

export const dynamic = 'force-dynamic'

// The items behind each day's Daily Loss (the figure on the Sales Log day line and in Profit & Loss): the same loss records, with who counted, when, the source and the reason.
// Dated the way the P&L dates them. Owner and Joe only (like the P&L). Kept for 5 minutes.
type Row = { item_id: number; name: string; expected: number; counted: number; loss_qty: number; loss_amt: number; reason: string | null; by: string | null; at: string | null; source: string | null }
export async function GET() {
  const { session, error } = await requireAuth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (error || role === 'staff') return error || badRequest('Forbidden')
  try {
    const out = await getCached('losses:by-day', 300, async () => {
      const since = new Date(Date.now() - 130 * 86400000).toISOString().slice(0, 10)
      const rec = [...(await reconciliationByCount()).values()].filter(r => r.kind === 'loss' && r.date >= since)
      const counts = await sql`SELECT DISTINCT ON (item_id, count_date::date) item_id, count_date::date::text AS d, counted_by, source, counted_at::text AS at
        FROM stock_counts WHERE count_date::date >= (${since}::date - 2) ORDER BY item_id, count_date::date, counted_at DESC NULLS LAST` as unknown as { item_id: number; d: string; counted_by: string | null; source: string | null; at: string | null }[]
      const by = new Map(counts.map(c => [`${c.item_id}|${c.d}`, c]))
      const days: Record<string, Row[]> = {}
      for (const r of rec) {
        const c = by.get(`${r.item_id}|${String(r.rawDate).slice(0, 10)}`)
        ;(days[r.date] ??= []).push({ item_id: r.item_id, name: r.itemName, expected: r.expected ?? 0, counted: r.counted, loss_qty: Math.abs(r.lossQty ?? 0), loss_amt: r.lossAmt ?? 0, reason: r.reason ?? null, by: c?.counted_by ?? null, at: c?.at ?? null, source: c?.source ?? null })
      }
      for (const k of Object.keys(days)) days[k].sort((a, b) => b.loss_amt - a.loss_amt)
      return days
    })
    return success(out)
  } catch (e) { return handleError('losses by-day', e) }
}
