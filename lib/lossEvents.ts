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

type DayRow = {
  item_id: number
  date: string
  qty_counted: string | null
  wic_qty: string | null
  gmc_qty: string | null
  bills_qty: string | null
  converted_in_qty: string | null
}

function n(v: string | null) { return parseFloat(v ?? '0') || 0 }

export type LossEvent = {
  date: string; item_id: number; item_name: string
  expected: number; counted: number; loss_qty: number; loss_amt: number
  kind: 'loss' | 'gain'
}

export async function computeLossEvents(): Promise<LossEvent[]> {
  const [itemRows, dayRows] = await Promise.all([
    sql`
      SELECT s.item_id, COALESCE(i.canonical_name, s.item_name) AS item_name, i.selling_rate, i.product_type,
             i.units_per_pack, i.converts_to_item_id
      FROM item_stock_summary s
      LEFT JOIN items i ON i.id = s.item_id
      WHERE s.item_name NOT ILIKE 'old stop%'
        AND s.item_name NOT ILIKE 'old- stop%'
    `,
    sql`
      WITH daily_counts AS (
        SELECT item_id, count_date::date AS d, SUM(quantity_counted) AS qty_counted
        FROM stock_counts GROUP BY item_id, count_date::date
      ),
      daily_wic AS (
        SELECT srl.item_id, sr.receipt_date::date AS d, SUM(srl.quantity) AS qty
        FROM sales_receipt_lines srl JOIN sales_receipts sr ON sr.id = srl.receipt_id
        WHERE (sr.customer_name IS NULL OR sr.customer_name <> 'Grony Multimedia as Customer')
        GROUP BY srl.item_id, sr.receipt_date::date
      ),
      daily_gmc AS (
        SELECT srl.item_id, sr.receipt_date::date AS d, SUM(srl.quantity) AS qty
        FROM sales_receipt_lines srl JOIN sales_receipts sr ON sr.id = srl.receipt_id
        WHERE sr.customer_name = 'Grony Multimedia as Customer'
        GROUP BY srl.item_id, sr.receipt_date::date
      ),
      daily_bills AS (
        SELECT bl.item_id, b.bill_date::date AS d, SUM(bl.quantity) AS qty
        FROM bill_lines bl JOIN bills b ON b.id = bl.bill_id
        GROUP BY bl.item_id, b.bill_date::date
      ),
      daily_converted_in AS (
        SELECT i.converts_to_item_id AS item_id, dg.d,
               SUM(dg.qty * COALESCE(i.units_per_pack, 1)) AS qty
        FROM daily_gmc dg
        JOIN items i ON i.id = dg.item_id
        WHERE i.converts_to_item_id IS NOT NULL
          AND COALESCE(i.product_type, 'goods') <> 'service'
        GROUP BY i.converts_to_item_id, dg.d
      ),
      daily_consumed_via_service AS (
        SELECT i.converts_to_item_id AS item_id, dw.d,
               SUM(dw.qty * COALESCE(i.units_per_pack, 1)) AS qty
        FROM daily_wic dw
        JOIN items i ON i.id = dw.item_id
        WHERE i.converts_to_item_id IS NOT NULL
          AND i.product_type = 'service'
        GROUP BY i.converts_to_item_id, dw.d
      ),
      all_dates AS (
        SELECT item_id, d FROM daily_counts
        UNION SELECT item_id, d FROM daily_wic
        UNION SELECT item_id, d FROM daily_gmc
        UNION SELECT item_id, d FROM daily_bills
        UNION SELECT item_id, d FROM daily_converted_in
        UNION SELECT item_id, d FROM daily_consumed_via_service
      )
      SELECT ad.item_id, ad.d::text AS date,
             dc.qty_counted,
             COALESCE(dw.qty, 0) + COALESCE(dcs.qty, 0) AS wic_qty,
             dg.qty AS gmc_qty, db.qty AS bills_qty,
             dci.qty AS converted_in_qty
      FROM all_dates ad
      LEFT JOIN daily_counts dc ON dc.item_id = ad.item_id AND dc.d = ad.d
      LEFT JOIN daily_wic    dw ON dw.item_id = ad.item_id AND dw.d = ad.d
      LEFT JOIN daily_gmc    dg ON dg.item_id = ad.item_id AND dg.d = ad.d
      LEFT JOIN daily_bills  db ON db.item_id = ad.item_id AND db.d = ad.d
      LEFT JOIN daily_converted_in dci ON dci.item_id = ad.item_id AND dci.d = ad.d
      LEFT JOIN daily_consumed_via_service dcs ON dcs.item_id = ad.item_id AND dcs.d = ad.d
      ORDER BY ad.item_id, ad.d ASC
    `,
  ])

  const paperPacks = (itemRows as any[]).filter(it =>
    it.converts_to_item_id != null
    && (it.product_type ?? 'goods') !== 'service'
    && /4x6/i.test(it.item_name) && /pack/i.test(it.item_name))
  const paperPackIds = new Set(paperPacks.map(p => p.item_id))
  const paperSinglesIds = new Set(paperPacks.map(p => p.converts_to_item_id))

  const byItem = new Map<number, DayRow[]>()
  for (const r of dayRows as DayRow[]) {
    if (!byItem.has(r.item_id)) byItem.set(r.item_id, [])
    byItem.get(r.item_id)!.push(r)
  }

  const events: LossEvent[] = []
  // Ghana runs on UTC year-round (no DST/offset), so this is also "today"
  // in local shop time. A count entered today, before the day's sales are
  // all in yet, would otherwise read as a loss just because those
  // not-yet-recorded sales aren't in `expected` -- today only gets a
  // loss/gain figure once it's no longer today.
  const today = new Date().toISOString().slice(0, 10)

  for (const item of itemRows as any[]) {
    const sp = paperPackIds.has(item.item_id)
      ? (parseFloat(item.units_per_pack ?? '0') || 1) * PAPER_SELL_PRICE
      : paperSinglesIds.has(item.item_id)
        ? PAPER_SELL_PRICE
        : parseFloat(item.selling_rate ?? '0') || 0

    let prev: number | null = null
    for (const row of byItem.get(item.item_id) ?? []) {
      const counted = row.qty_counted !== null ? parseFloat(row.qty_counted) : null
      const bills = n(row.bills_qty), w = n(row.wic_qty), g = n(row.gmc_qty), c = n(row.converted_in_qty)
      if (prev === null) {
        if (counted !== null) prev = counted
      } else {
        const expected = parseFloat((prev + bills + c - w - g).toFixed(4))
        if (counted !== null) {
          const loss = parseFloat((expected - counted).toFixed(4))
          const kind: 'loss' | 'gain' | null = loss > 0.001 ? 'loss' : loss < -0.001 ? 'gain' : null
          if (kind && row.date < today) {
            const qty = Math.abs(loss)
            events.push({
              date: row.date,
              item_id: item.item_id,
              item_name: item.item_name,
              expected,
              counted,
              loss_qty: qty,
              loss_amt: parseFloat((qty * sp).toFixed(2)),
              kind,
            })
          }
          prev = counted
        } else {
          prev = expected
        }
      }
    }
  }

  return events
}
