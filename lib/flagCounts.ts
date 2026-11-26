import sql from '@/lib/db'
import { FLAGS } from '@/lib/flagRegistry'

// How many items are open on each flag right now, read the same way the Flags page and the daily 5-flags law read them. Kept for two minutes.
let cache: { at: number; data: Record<string, number> } | null = null
export async function openFlagCounts(): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.at < 2 * 60 * 1000) return cache.data
  const out: Record<string, number> = {}
  const [neg] = await sql`SELECT COUNT(*)::int AS n FROM item_stock_summary s JOIN active_items i ON i.id = s.item_id WHERE s.calculated_soh < 0 AND COALESCE(i.product_type, 'goods') <> 'service'`.catch(() => [{ n: 0 }])
  out.neg_soh = Number(neg?.n ?? 0)
  const [pr] = await sql`SELECT COUNT(*) FILTER (WHERE COALESCE(selling_rate, 0) = 0)::int AS no_sp, COUNT(*) FILTER (WHERE COALESCE(product_type, 'goods') <> 'service' AND COALESCE(purchase_rate, 0) = 0)::int AS no_cp FROM active_items`.catch(() => [{ no_sp: 0, no_cp: 0 }])
  out.no_sp = Number(pr?.no_sp ?? 0); out.no_cp = Number(pr?.no_cp ?? 0)
  try {
    const lists = await (await (await import('@/app/api/flags/route')).GET()).json() as Record<string, unknown>
    for (const f of FLAGS) if (f.list.startsWith('flags:')) { const v = lists[f.list.slice(6)]; out[f.key] = Array.isArray(v) ? v.length : 0 }
  } catch (e) { console.error('flag counts failed:', e instanceof Error ? e.message : String(e)) }
  try {
    const d = await (await (await import('@/app/api/stock/daily/route')).GET()).json(), o = await (await (await import('@/app/api/stock/overdue/route')).GET()).json()
    out.to_count = (Array.isArray(d) ? d.length : 0) + (Array.isArray(o) ? o.length : 0)
  } catch { out.to_count = 0 }
  cache = { at: Date.now(), data: out }
  return out
}
