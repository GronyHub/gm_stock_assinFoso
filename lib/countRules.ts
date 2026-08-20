import sql from '@/lib/db'
import { PACK_PAIRING_CHAINS } from '@/lib/stockGuard'

// items.count_excluded (set from an item's own edit form) is checked in
// itemRows/itemNamesOnly below, so it applies uniformly everywhere this
// file's exports are consumed -- the daily queue, the GMC/overdue queues
// (see the API routes' own item joins), the Opener penalty audit, and
// Today's summary all agree an excluded item was never supposed to be
// counted, rather than each surface needing its own copy of the check.

// Items counted every single day (hardcoded set chosen by the shop).
export const DAILY_ITEM_IDS = [367, 368, 369, 370, 371, 372, 373, 374, 375, 376]

// Cardboard and A4 Sheet dropped out of the daily singles count -- A4 Sheet
// is tracked through its pack instead (see PACK_PAIRING_CHAINS below), and
// Cardboard isn't tracked daily at all anymore. Filtered out by name rather
// than trimmed from DAILY_ITEM_IDS so the id list doesn't need editing.
const EXCLUDED_DAILY_SINGLE_NAMES = [/cardboard/i, /a4\s*sheet/i]

// Lazy self-migrating column add, same pattern as
// lib/billAttachments.ts's ensureBillAttachmentsColumn() -- called from
// itemRows/itemNamesOnly below (this file's only two raw item queries)
// and from the item edit PUT route, so the columns exist on first real
// request in an environment with DB access, instead of requiring
// scripts/add-count-cadence-fields.mjs to be run by hand first. Once the
// columns exist this is a fast no-op, so it's cheap to call on every
// request rather than tracking down every consumer route individually
// (the Opener audit and Today's summary both reach these functions
// indirectly).
export async function ensureCountCadenceColumns() {
  await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS count_excluded BOOLEAN NOT NULL DEFAULT false`.catch(() => {})
  await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS count_cadence_days INTEGER`.catch(() => {})
}

async function itemRows(itemIds: number[]) {
  if (itemIds.length === 0) return []
  await ensureCountCadenceColumns()
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
      AND COALESCE(i.count_excluded, false) = false
      AND (c.last_count_date IS NULL OR c.last_count_date::date < CURRENT_DATE)
    ORDER BY COALESCE(i.canonical_name, s.item_name) ASC
  `
}

// The daily-count item IDs whose name matches a *blocking* pack chain (see
// PACK_PAIRING_CHAINS). Their pack needs a same-day count too, same as
// packPairingCheck already requires at save time -- this just surfaces it
// as its own line in the list up front instead of only reactively when the
// singles side is saved.
export async function blockingPackDailyIds(): Promise<number[]> {
  const rows = await sql`
    SELECT id, canonical_name FROM items WHERE id = ANY(${DAILY_ITEM_IDS})
  ` as { id: number; canonical_name: string }[]
  const blockingChains = PACK_PAIRING_CHAINS.filter(c => c.blocking)
  return rows
    .filter(r => blockingChains.some(c => c.match.test(r.canonical_name)))
    .map(r => r.id)
}

async function itemNamesOnly(ids: number[]): Promise<{ id: number; name: string }[]> {
  if (ids.length === 0) return []
  await ensureCountCadenceColumns()
  const rows = await sql`
    SELECT s.item_id AS id, COALESCE(i.canonical_name, s.item_name) AS name
    FROM item_stock_summary s
    LEFT JOIN items i ON i.id = s.item_id
    WHERE s.item_id = ANY(${ids})
      AND s.cf_group IS DISTINCT FROM 'Large Format'
      AND COALESCE(i.product_type, 'goods') <> 'service'
      AND COALESCE(i.count_excluded, false) = false
  `
  return rows as unknown as { id: number; name: string }[]
}

// The full set of items that must be counted every single day (id + name
// only, no count-status) -- the 10 singles minus Cardboard/A4 Sheet, plus
// the pack of any blocking-chain item among them. Shared by
// outstandingDailyItems() (today's still-outstanding subset) and the
// Opener penalty audit (per-day count completion history, see
// /api/violations/auto-check), so both agree on what "the daily list" is.
export async function requiredDailyItemIds(): Promise<{ id: number; name: string }[]> {
  const singles = (await itemNamesOnly(DAILY_ITEM_IDS))
    .filter(r => !EXCLUDED_DAILY_SINGLE_NAMES.some(p => p.test(r.name)))

  const blockingIds = await blockingPackDailyIds()
  let packs: { id: number; name: string }[] = []
  if (blockingIds.length > 0) {
    const packItems = await sql`SELECT id FROM items WHERE converts_to_item_id = ANY(${blockingIds})` as { id: number }[]
    if (packItems.length > 0) packs = await itemNamesOnly(packItems.map(p => p.id))
  }
  return [...singles, ...packs]
}

// Items from today's fixed daily-count list that haven't been counted
// today (minus Cardboard/A4 Sheet, see EXCLUDED_DAILY_SINGLE_NAMES), plus
// the packs of any blocking-chain item in that list (also not yet counted
// today) -- so the daily list itself shows the pack lines, not just a
// prompt after saving the singles side.
export async function outstandingDailyItems() {
  const dailyRows = (await itemRows(DAILY_ITEM_IDS))
    .filter(r => !EXCLUDED_DAILY_SINGLE_NAMES.some(p => p.test(String(r.item_name))))

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

// Every countable item's own effective cadence, as a plain label -- not
// just the ones currently due, unlike the 3 queue endpoints above. Mirrors
// the exact same rules those endpoints (and their WHERE clauses) use, so
// the label an item shows here always matches which queue it'll actually
// show up on: 'excluded' (count_excluded), 'daily' (DAILY_ITEM_IDS minus
// Cardboard/A4 Sheet, or the pack of a blocking-chain daily item),
// a fixed number (count_cadence_days override), '7' (GMC history), or the
// dynamic 15/30-day default (3 identical counts with no bill since -> 30).
// Services aren't in the returned map at all -- they're never countable.
export async function itemCountIntervalLabels(): Promise<Map<number, string>> {
  await ensureCountCadenceColumns()
  const blockingIds = await blockingPackDailyIds()
  const rows = await sql`
    WITH ranked AS (
      SELECT item_id, count_date::date AS d, quantity_counted,
             ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY count_date DESC, id DESC) AS rn
      FROM stock_counts
    ),
    recent AS (
      SELECT item_id,
             COUNT(*) FILTER (WHERE rn <= 3) AS n3,
             COUNT(DISTINCT quantity_counted) FILTER (WHERE rn <= 3) AS distinct3,
             MIN(d) FILTER (WHERE rn <= 3) AS since3
      FROM ranked WHERE rn <= 3
      GROUP BY item_id
    ),
    last_bill AS (
      SELECT bl.item_id, MAX(b.bill_date::date) AS d
      FROM bill_lines bl JOIN bills b ON b.id = bl.bill_id
      GROUP BY bl.item_id
    ),
    gmc_items AS (
      SELECT DISTINCT srl.item_id
      FROM sales_receipt_lines srl
      JOIN sales_receipts sr ON sr.id = srl.receipt_id
      WHERE sr.customer_name = 'Grony Multimedia as Customer' AND srl.item_id IS NOT NULL
    )
    SELECT
      i.id AS item_id,
      CASE
        WHEN COALESCE(i.count_excluded, false) THEN 'excluded'
        WHEN i.id = ANY(${DAILY_ITEM_IDS})
             AND i.canonical_name !~* 'cardboard' AND i.canonical_name !~* 'a4\s*sheet' THEN 'daily'
        WHEN i.converts_to_item_id = ANY(${blockingIds}) THEN 'daily'
        WHEN i.count_cadence_days IS NOT NULL THEN i.count_cadence_days::text
        WHEN i.id IN (SELECT item_id FROM gmc_items) THEN '7'
        ELSE (CASE
          WHEN COALESCE(r.n3, 0) = 3 AND r.distinct3 = 1 AND (lb.d IS NULL OR lb.d <= r.since3)
          THEN '30' ELSE '15'
        END)
      END AS label
    FROM items i
    LEFT JOIN recent r ON r.item_id = i.id
    LEFT JOIN last_bill lb ON lb.item_id = i.id
    WHERE COALESCE(i.product_type, 'goods') <> 'service'
  ` as { item_id: number; label: string }[]
  return new Map(rows.map(r => [r.item_id, r.label]))
}
