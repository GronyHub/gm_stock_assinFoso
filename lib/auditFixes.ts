import sql from '@/lib/db'
import { deleteLaw } from '@/lib/lawDelete'

// The owner approved (2026-11-13) the fixes from the duplicate review. Runs once.
//  1. Items: pairs of live items with the same name where BOTH are empty (no sales, bills or purchase orders, no stock) are merged; the one marked Active is kept.
//     Pairs where either has any activity are left for the owner (Display cable, Wedding cards).
//  2. Laws: the second "record a video every day" law, the old "report an absence a day before" law (replaced by "tell the shop if you are late or absent"),
//     and the "social media lead confirms" roll-up of the three posting tasks.
export async function auditFixesOnce() {
  try {
    const c = await sql`INSERT INTO law_migrations (key) VALUES ('audit-fixes-2026-11-13') ON CONFLICT DO NOTHING RETURNING key`
    if (!c.length) return
    const laws = await sql`SELECT id FROM page_laws WHERE (id = 62 AND text ILIKE 'Record at least one video clip%') OR (id = 223 AND title = 'Report a planned absence a day before')
      OR id = (SELECT law_id FROM daily_check_tiles WHERE id = 269 AND title ILIKE 'The social media lead confirms%')` as unknown as { id: number }[]
    for (const l of laws) await deleteLaw(l.id)

    const { mergeItems } = await import('@/lib/mergeItems')
    const pairs = await sql`
      WITH d AS (
        SELECT i.id, LOWER(TRIM(i.canonical_name)) AS nm, (LOWER(COALESCE(i.status, '')) = 'active') AS act,
          (SELECT COUNT(*) FROM sales_receipt_lines x WHERE x.item_id = i.id) + (SELECT COUNT(*) FROM purchase_order_lines x WHERE x.item_id = i.id)
            + (SELECT COUNT(*) FROM bill_lines x WHERE x.item_id = i.id) AS used,
          COALESCE((SELECT calculated_soh FROM item_stock_summary s WHERE s.item_id = i.id), 0) AS soh
        FROM active_items i)
      SELECT nm, array_agg(id ORDER BY act DESC, id) AS ids FROM d GROUP BY nm HAVING COUNT(*) = 2 AND SUM(used) = 0 AND SUM(ABS(soh)) = 0` as unknown as { nm: string; ids: number[] }[]
    let n = 0
    for (const p of pairs) { try { await mergeItems(p.ids[1], p.ids[0], undefined, 'system'); n++ } catch (e) { console.error('audit merge failed:', p.nm, e instanceof Error ? e.message : String(e)) } }
    console.log(`audit fixes: ${laws.length} laws removed, ${n} empty duplicate items merged`)
  } catch (e) { console.error('audit fixes failed:', e instanceof Error ? e.message : String(e)) }
}
