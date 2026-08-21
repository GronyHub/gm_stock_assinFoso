import sql from '@/lib/db'

// Shared by /api/losses/events (the Daily Loss feed) and
// /api/analysis/profit-loss (the Daily Loss column in the daily P&L table)
// -- one item-by-item, day-by-day reconciliation of expected vs counted
// stock, computed once and tagged 'loss' or 'gain' so each caller can
// filter/aggregate however it needs, instead of every consumer re-running
// this same query and algorithm.
//
// Loss valuation: the 4x6 paper chain is valued at ₵20 per sheet (packs =
// packs × sheets-per-pack × ₵20, as papers used for passport work but never
// recorded); everything else at its selling price.
const PAPER_SELL_PRICE = 20

// A count taken between these two dates was a physical tally done the
// morning after, closing out the PREVIOUS day's business -- not a same-day
// snapshot. A count stored with count_date X in this window is reconciled
// against X-1's bills/sales (not X's, which haven't happened relative to
// the count) and any loss/gain it produces is dated X-1. Before
// SHIFT_START, counts were same-day readings. From SHIFT_END (when live
// sale taps went live and GMC conversions started being recorded in real
// time, same as sales and bills) onward, counts are same-day readings
// again -- there's no longer a lag between when stock moves and when it's
// recorded for the "morning after" close-out to correct for.
const SHIFT_START = '2026-07-20'
const SHIFT_END = '2026-08-09'

export type LossEvent = {
  date: string; item_id: number; item_name: string
  expected: number; counted: number; loss_qty: number; loss_amt: number
  kind: 'loss' | 'gain'
  // The counter's plain-text explanation, pulled back out of that day's
  // stock_counts.notes (see parseLossReason below). null for a gain (never
  // prompted for a reason -- gains are blocked outright by gainViolation,
  // so one showing up here at all is from data that predates that guard)
  // or a loss whose count predates the reason requirement.
  reason: string | null
}

// stock_counts.notes packs the counter's reason together with the manager
// acknowledgement and any free-text note the counter also typed -- see
// /api/stock/count's lossNote/finalNotes construction, e.g.
// "[LOSS -3] Reason: spillage (manager counted) · also cleaned the shelf".
// Pulls just the reason text back out for display.
function parseLossReason(notes: string | null): string | null {
  if (!notes) return null
  const m = notes.match(/\[LOSS[^\]]*\]\s*Reason:\s*(.*?)(?:\s*\(manager counted\)|\s*\|\s*Manager said:|\s*·|$)/)
  return m?.[1]?.trim() || null
}

export async function computeLossEvents(): Promise<LossEvent[]> {
  // One row per count event, loss/gain computed against the item's PREVIOUS
  // count -- same cumulative-since-last-count formula as stockGuard's
  // expectedStockAt (prev count + bills + GMC conversions in, minus direct
  // sales, minus service consumption, all summed over the *whole* gap since
  // that previous count), just applied to every count instead of one target
  // date. This used to be computed per-CALENDAR-DAY instead: prev_count came
  // from LAG() over every date with ANY activity (counts, sales, bills), not
  // just count dates, so a sale-only day sitting right before a count made
  // LAG grab NULL instead of the real previous count -- silently dropping
  // the loss for that count entirely. And even when prev_count did resolve,
  // only that single day's own sales/bills were subtracted, not everything
  // since the last count -- fine for a daily-counted item (yesterday IS the
  // whole gap) but wrong for anything on a longer cadence, where real
  // activity on the days in between just never got counted against it.
  const dayRows = await sql`
    WITH daily_counts AS (
      SELECT item_id, count_date::date AS d, SUM(quantity_counted) AS qty_counted, MAX(notes) AS notes
      FROM stock_counts GROUP BY item_id, count_date::date
    ),
    -- eff_d is the date a count is actually reconciled/reported against:
    -- normally its own count_date, but for the SHIFT_START..SHIFT_END
    -- window it's shifted back a day, since the physical count that day
    -- closed out the PREVIOUS day's business (see comment above). Chaining
    -- prev_d/prev_count off eff_d (not the raw date) means the shifted
    -- count's own day of activity naturally rolls into the *next* count's
    -- comparison window instead of vanishing or double-counting.
    dated_counts AS (
      SELECT item_id, d,
             CASE WHEN d >= ${SHIFT_START}::date AND d < ${SHIFT_END}::date THEN d - 1 ELSE d END AS eff_d,
             qty_counted, notes
      FROM daily_counts
    ),
    counts_seq AS (
      SELECT item_id, eff_d, qty_counted, notes,
             LAG(eff_d) OVER (PARTITION BY item_id ORDER BY d) AS prev_d,
             LAG(qty_counted) OVER (PARTITION BY item_id ORDER BY d) AS prev_count
      FROM dated_counts
    ),
    with_loss AS (
      SELECT cs.item_id, cs.eff_d::text AS date, cs.qty_counted, cs.notes,
        CASE WHEN cs.prev_d IS NOT NULL THEN
          (
            cs.prev_count
            + COALESCE((
                SELECT SUM(bl.quantity) FROM bill_lines bl JOIN bills b ON b.id = bl.bill_id
                WHERE bl.item_id = cs.item_id AND b.bill_date::date > cs.prev_d AND b.bill_date::date <= cs.eff_d
              ), 0)
            + COALESCE((
                SELECT SUM(srl.quantity * COALESCE(i2.units_per_pack, 1))
                FROM sales_receipt_lines srl
                JOIN sales_receipts sr ON sr.id = srl.receipt_id
                JOIN items i2 ON i2.id = srl.item_id
                WHERE i2.converts_to_item_id = cs.item_id
                  AND COALESCE(i2.product_type, 'goods') <> 'service'
                  AND sr.customer_name = 'Grony Multimedia as Customer'
                  AND sr.receipt_date::date > cs.prev_d AND sr.receipt_date::date <= cs.eff_d
              ), 0)
            - COALESCE((
                SELECT SUM(srl.quantity)
                FROM sales_receipt_lines srl
                JOIN sales_receipts sr ON sr.id = srl.receipt_id
                WHERE srl.item_id = cs.item_id
                  AND sr.receipt_date::date > cs.prev_d AND sr.receipt_date::date <= cs.eff_d
              ), 0)
            - COALESCE((
                SELECT SUM(srl.quantity * COALESCE(i2.units_per_pack, 1))
                FROM sales_receipt_lines srl
                JOIN sales_receipts sr ON sr.id = srl.receipt_id
                JOIN items i2 ON i2.id = srl.item_id
                WHERE i2.converts_to_item_id = cs.item_id
                  AND i2.product_type = 'service'
                  AND (sr.customer_name IS NULL OR sr.customer_name <> 'Grony Multimedia as Customer')
                  AND sr.receipt_date::date > cs.prev_d AND sr.receipt_date::date <= cs.eff_d
              ), 0)
          ) - cs.qty_counted
        ELSE NULL END AS loss_qty
      FROM counts_seq cs
    )
    SELECT wl.item_id, wl.date, i.canonical_name AS item_name, i.selling_rate, i.product_type,
           i.units_per_pack, i.converts_to_item_id, wl.loss_qty, wl.qty_counted, wl.notes
    FROM with_loss wl
    JOIN item_stock_summary iss ON iss.item_id = wl.item_id
    LEFT JOIN items i ON i.id = wl.item_id
    WHERE wl.loss_qty IS NOT NULL
      AND iss.item_name NOT ILIKE 'old stop%'
      AND iss.item_name NOT ILIKE 'old- stop%'
    ORDER BY wl.item_id, wl.date ASC
  ` as any[]

  const paperPacks = new Map<number, number>()
  const paperSingles = new Map<number, boolean>()

  const events: LossEvent[] = []
  for (const row of dayRows) {
    const lossQty = parseFloat(row.loss_qty ?? '0') || 0
    const kind = lossQty > 0.001 ? 'loss' : lossQty < -0.001 ? 'gain' : null

    if (kind) {
      // Identify paper packs/singles for pricing
      if (row.product_type !== 'service' && row.converts_to_item_id && /4x6/i.test(row.item_name) && /pack/i.test(row.item_name)) {
        paperPacks.set(row.item_id, row.units_per_pack || 1)
      }
      if (row.converts_to_item_id && paperPacks.has(row.converts_to_item_id)) {
        paperSingles.set(row.item_id, true)
      }

      const sp = paperPacks.has(row.item_id)
        ? (paperPacks.get(row.item_id) || 1) * PAPER_SELL_PRICE
        : paperSingles.has(row.item_id)
          ? PAPER_SELL_PRICE
          : parseFloat(row.selling_rate ?? '0') || 0

      const lossAmt = Math.abs(lossQty) * sp

      events.push({
        date: row.date,
        item_id: row.item_id,
        item_name: row.item_name,
        expected: 0,
        counted: parseFloat(row.qty_counted ?? '0') || 0,
        loss_qty: Math.abs(lossQty),
        loss_amt: lossAmt,
        kind,
        reason: parseLossReason(row.notes ?? null),
      })
    }
  }

  return events
}
