import sql from '@/lib/db'
import { PACK_PAIRING_CHAINS } from '@/lib/stockGuard'

// Items counted every single day (hardcoded set chosen by the shop).
export const DAILY_ITEM_IDS = [367, 368, 369, 370, 371, 372, 373, 374, 375, 376]

async function itemRows(itemIds: number[]) {
  if (itemIds.length === 0) return []
  return await sql`
    SELECT
      s.item_id,
      COALESCE(i.canonical_name, s.item_name) AS item_name,
      s.cf_group,
      s.calculated_soh,
      c.last_count_date,
      CASE
        WHEN c.last_count_date::date = CURRENT_DATE THEN 0
        ELSE (CURRENT_DATE - COALESCE(c.last_count_date::date, '1900-01-01'))
      END AS days_overdue
    FROM item_stock_summary s
    LEFT JOIN items i ON i.id = s.item_id
    LEFT JOIN (
      SELECT item_id, MAX(count_date) AS last_count_date
      FROM stock_counts
      GROUP BY item_id
    ) c ON c.item_id = s.item_id
    WHERE s.item_id = ANY(${itemIds})
      AND s.cf_group IS DISTINCT FROM 'Large Format'
      AND COALESCE(i.product_type, 'goods') <> 'service'
      AND (c.last_count_date IS NULL OR c.last_count_date::date < CURRENT_DATE)
    ORDER BY COALESCE(i.canonical_name, s.item_name) ASC
  `
}

// The daily-count item IDs whose name matches a *blocking* pack chain (A4
// Brown Envelope, A4 Lamination, 4x6 -- not A4 Sheet, which is optional).
// Their pack needs a same-day count too, same as packPairingCheck already
// requires at save time -- this just surfaces it as its own line in the
// list up front instead of only reactively when the singles side is saved.
async function blockingPackDailyIds(): Promise<number[]> {
  const rows = await sql`
    SELECT id, canonical_name FROM items WHERE id = ANY(${DAILY_ITEM_IDS})
  ` as { id: number; canonical_name: string }[]
  const blockingChains = PACK_PAIRING_CHAINS.filter(c => c.blocking)
  return rows
    .filter(r => blockingChains.some(c => c.match.test(r.canonical_name)))
    .map(r => r.id)
}

// Items from today's fixed daily-count list that haven't been counted
// today, plus the packs of any blocking-chain item in that list (also not
// yet counted today) -- so the daily list itself shows the pack lines, not
// just a prompt after saving the singles side. A4 Sheet's pack stays out of
// this list since its pairing is optional.
export async function outstandingDailyItems() {
  const dailyRows = await itemRows(DAILY_ITEM_IDS)

  const blockingIds = await blockingPackDailyIds()
  let packRows: Awaited<ReturnType<typeof itemRows>> = []
  if (blockingIds.length > 0) {
    const packs = await sql`
      SELECT id FROM items WHERE converts_to_item_id = ANY(${blockingIds})
    ` as { id: number }[]
    packRows = await itemRows(packs.map(p => p.id))
  }

  return [...dailyRows, ...packRows].sort((a, b) => String(a.item_name).localeCompare(String(b.item_name)))
}
