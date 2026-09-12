import sql from '@/lib/db'
import { ensureBillExpensesTable } from '@/lib/billExpenses'

export type CountRevision = { old_qty: string | number | null; old_by: string | null; changed_by: string | null; action?: string | null; changed_at: string }

export type ItemDayRow = {
  date: string
  qty_counted: string | null
  counted_by: string | null
  counted_at: string | null
  count_history: CountRevision[] | null
  wic_qty: string | null
  gmc_qty: string | null
  bills_qty: string | null
  sell_price: string | null
  aliases: string | null
  converted_in_qty: string | null
  converted_in_time: string | null
  wic_breakdown: { name: string; qty: number; amount: number }[] | null
  bills_breakdown: { vendor_name: string | null; qty: number }[] | null
  sold_below_cost: boolean
  vcp: string | null
  vcp_bill_id: number | null
  acp: string | null
  // Tap-timestamp-precise EXP/LOSS override -- see the pass at the bottom
  // of getItemDayRows. null on every row for the overwhelming majority of
  // items (anything that's never been a GMC conversion target); only
  // lib/packChain.ts's computeRows reads these, preferring them over its
  // own day-grained calculation when present.
  precise_expected_soh?: number | null
  precise_loss?: number | null
}

// Per-item day-level activity (counts, WIC/GMC sales, bills, pack-chain
// conversions) -- the same shape LossTab's ItemDetail computes loss/gain
// from. Shared by /api/losses/[itemId] (one item on demand) and the pack-
// chain loss aggregation in /api/losses/summary (both sides of a chain, for
// every pack item, on every page load), so the two never drift apart.
export async function getItemDayRows(id: number): Promise<ItemDayRow[]> {
  await ensureBillExpensesTable()
  const rows = await sql`
    WITH daily_converted_in AS (
      -- Credit from another good's GMC take, if that good declares
      -- converts_to_item_id = this item (see /api/losses/summary for the general case).
      SELECT sr.receipt_date::date AS d, SUM(srl.quantity * COALESCE(src.units_per_pack, 1)) AS qty
      FROM sales_receipt_lines srl
      JOIN sales_receipts sr ON sr.id = srl.receipt_id
      JOIN items src ON src.id = srl.item_id
      WHERE src.converts_to_item_id = ${id}
        AND COALESCE(src.product_type, 'goods') <> 'service'
        AND sr.customer_name = 'Grony Multimedia as Customer'
      GROUP BY sr.receipt_date::date
    ),
    daily_converted_in_time AS (
      -- The actual clock time the conversion was tapped in Live Sale, for
      -- display next to the CNV column -- undone taps are excluded (they
      -- carry no qty in daily_converted_in above either) and a day with more
      -- than one tap shows the latest one. Only live-sale-tapped conversions
      -- have a time at all; anything entered another way just shows no time.
      SELECT t.tapped_at::date AS d, MAX(t.tapped_at) AS tapped_at
      FROM live_sale_taps t
      JOIN items src ON src.id = t.item_id
      WHERE src.converts_to_item_id = ${id}
        AND COALESCE(src.product_type, 'goods') <> 'service'
        AND t.undone = false
      GROUP BY t.tapped_at::date
    ),
    daily_consumed_by_service AS (
      -- Deduction from another service's own real (WIC) sales, if that service declares
      -- converts_to_item_id = this item (e.g. Passport Printing consuming this paper).
      -- Kept per-source (grouped by service too) so callers can show a breakdown, not
      -- just a combined total, when more than one service draws on the same stock.
      SELECT sr.receipt_date::date AS d, src.id AS source_id, src.canonical_name AS source_name,
             SUM(srl.quantity * COALESCE(src.units_per_pack, 1)) AS qty,
             SUM(srl.quantity * COALESCE(srl.item_price, 0)) AS amount
      FROM sales_receipt_lines srl
      JOIN sales_receipts sr ON sr.id = srl.receipt_id
      JOIN items src ON src.id = srl.item_id
      WHERE src.converts_to_item_id = ${id}
        AND src.product_type = 'service'
        AND (sr.customer_name IS NULL OR sr.customer_name <> 'Grony Multimedia as Customer')
      GROUP BY sr.receipt_date::date, src.id, src.canonical_name
    ),
    daily_consumed_via_service AS (
      SELECT d, SUM(qty) AS qty,
             json_agg(json_build_object('name', source_name, 'qty', qty, 'amount', amount) ORDER BY source_name) AS breakdown
      FROM daily_consumed_by_service
      GROUP BY d
    ),
    all_dates AS (
      SELECT count_date::date AS d FROM stock_counts WHERE item_id = ${id}
      UNION
      SELECT sr.receipt_date::date
        FROM sales_receipt_lines srl
        JOIN sales_receipts sr ON sr.id = srl.receipt_id
        WHERE srl.item_id = ${id}
      UNION
      SELECT b.bill_date::date
        FROM bill_lines bl
        JOIN bills b ON b.id = bl.bill_id
        WHERE bl.item_id = ${id}
      UNION
      SELECT d FROM daily_converted_in
      UNION
      SELECT d FROM daily_consumed_via_service
      UNION
      -- Dates whose count was deleted still show their row (with the ✗ value).
      SELECT count_date::date FROM stock_count_revisions WHERE item_id = ${id}
    ),
    daily_counts AS (
      -- There's normally exactly one stock_counts row per item per day (see
      -- /api/stock/count's own comment on why a same-day recount replaces
      -- rather than adds), so these aggregates are just that row's values.
      SELECT count_date::date AS d, SUM(quantity_counted) AS qty_counted,
             MAX(counted_by) AS counted_by, MAX(counted_at) AS counted_at
      FROM stock_counts
      WHERE item_id = ${id}
      GROUP BY count_date::date
    ),
    daily_count_history AS (
      -- Previous values of edited/deleted counts, oldest change first, so the
      -- cell can show them inline (struck through when changed, ✗ when
      -- deleted) with who took/changed them.
      SELECT count_date::date AS d,
             json_agg(json_build_object(
               'old_qty', old_qty,
               'old_by', old_counted_by,
               'changed_by', changed_by,
               'action', action,
               'changed_at', changed_at::date::text
             ) ORDER BY changed_at) AS history
      FROM stock_count_revisions
      WHERE item_id = ${id}
      GROUP BY count_date::date
    ),
    daily_wic AS (
      SELECT sr.receipt_date::date AS d, SUM(srl.quantity) AS qty
      FROM sales_receipt_lines srl
      JOIN sales_receipts sr ON sr.id = srl.receipt_id
      WHERE srl.item_id = ${id}
        AND (sr.customer_name IS NULL OR sr.customer_name <> 'Grony Multimedia as Customer')
      GROUP BY sr.receipt_date::date
    ),
    daily_gmc AS (
      SELECT sr.receipt_date::date AS d, SUM(srl.quantity) AS qty
      FROM sales_receipt_lines srl
      JOIN sales_receipts sr ON sr.id = srl.receipt_id
      WHERE srl.item_id = ${id}
        AND sr.customer_name = 'Grony Multimedia as Customer'
      GROUP BY sr.receipt_date::date
    ),
    daily_bills_by_vendor AS (
      SELECT b.bill_date::date AS d, COALESCE(b.vendor_name, 'Unknown') AS vendor_name,
             SUM(bl.quantity) AS qty
      FROM bill_lines bl
      JOIN bills b ON b.id = bl.bill_id
      WHERE bl.item_id = ${id}
      GROUP BY b.bill_date::date, b.vendor_name
    ),
    daily_bills AS (
      SELECT d, SUM(qty) AS qty,
             json_agg(json_build_object('vendor_name', vendor_name, 'qty', qty) ORDER BY vendor_name) AS breakdown
      FROM daily_bills_by_vendor
      GROUP BY d
    ),
    daily_sp AS (
      SELECT sr.receipt_date::date AS d, AVG(srl.item_price) AS sp
      FROM sales_receipt_lines srl
      JOIN sales_receipts sr ON sr.id = srl.receipt_id
      WHERE srl.item_id = ${id} AND srl.item_price IS NOT NULL
        AND (sr.customer_name IS NULL OR sr.customer_name <> 'Grony Multimedia as Customer')
      GROUP BY sr.receipt_date::date
    ),
    daily_vcp_source AS (
      -- VCP (Vendor Cost Price) as of each date -- the most recent real
      -- bill's unit_price for this item on or before that day, not just
      -- today's catalog value, so history shows what cost actually applied
      -- back then.
      SELECT ad.d, lookup.unit_price AS vcp, lookup.bill_id AS vcp_bill_id
      FROM all_dates ad
      LEFT JOIN LATERAL (
        SELECT bl.unit_price, bl.bill_id
        FROM bill_lines bl
        JOIN bills b ON b.id = bl.bill_id
        WHERE bl.item_id = ${id}
          AND b.source IS DISTINCT FROM 'live_sale'
          AND bl.unit_price IS NOT NULL
          AND b.bill_date <= ad.d
        ORDER BY b.bill_date DESC, bl.id DESC
        LIMIT 1
      ) lookup ON true
    ),
    vcp_bill_groups AS (
      -- ACP for each distinct source bill above -- same (date, vendor)
      -- grouping and "representative bill id" convention BillsTab.tsx uses
      -- for its own Shared Expenses column (see that file's groupAggregates
      -- comment): total quantity across every line in the group, and the
      -- group's bill_expenses total attached to its representative id.
      SELECT DISTINCT b0.id AS source_bill_id, grp.total_qty, COALESCE(be.total, 0) AS shared_total
      FROM bills b0
      JOIN LATERAL (
        SELECT MAX(b1.id) AS rep_id, SUM(bl1.quantity) AS total_qty
        FROM bills b1
        JOIN bill_lines bl1 ON bl1.bill_id = b1.id
        WHERE b1.bill_date = b0.bill_date
          AND COALESCE(b1.vendor_name, '') = COALESCE(b0.vendor_name, '')
          AND b1.source IS DISTINCT FROM 'live_sale'
      ) grp ON true
      LEFT JOIN LATERAL (
        SELECT SUM(amount) AS total FROM bill_expenses WHERE bill_id = grp.rep_id
      ) be ON true
      WHERE b0.id IN (SELECT vcp_bill_id FROM daily_vcp_source WHERE vcp_bill_id IS NOT NULL)
    ),
    daily_below_cost AS (
      -- Same condition as /api/flags' costGteSell check (the item-level
      -- "ACP > SP" violation shown on Live Sale) -- compares each WIC sale
      -- line against this item's ACP as of that sale's date (reusing
      -- daily_vcp_source/vcp_bill_groups above, since all_dates already
      -- covers every date this item sold on), not today's catalog value.
      SELECT sr.receipt_date::date AS d, true AS below_cost
      FROM sales_receipt_lines srl
      JOIN sales_receipts sr ON sr.id = srl.receipt_id
      JOIN daily_vcp_source dvs ON dvs.d = sr.receipt_date::date
      LEFT JOIN vcp_bill_groups vbg ON vbg.source_bill_id = dvs.vcp_bill_id
      WHERE srl.item_id = ${id}
        AND dvs.vcp IS NOT NULL
        AND srl.item_price IS NOT NULL
        AND srl.item_price > 0
        AND (dvs.vcp + CASE WHEN vbg.total_qty > 0 THEN vbg.shared_total / vbg.total_qty ELSE 0 END) >= srl.item_price
      GROUP BY sr.receipt_date::date
    ),
    daily_aliases AS (
      -- Only from lines with a real, non-zero quantity -- an empty-shell
      -- line (raw name recorded but no quantity/customer, i.e. not an
      -- actual transaction) shouldn't be shown as "the alias recorded that
      -- day" when nothing else about the day reflects it.
      SELECT d, STRING_AGG(DISTINCT alias, ' / ' ORDER BY alias) AS aliases
      FROM (
        SELECT sr.receipt_date::date AS d, srl.raw_item_name AS alias
        FROM sales_receipt_lines srl
        JOIN sales_receipts sr ON sr.id = srl.receipt_id
        WHERE srl.item_id = ${id}
          AND srl.raw_item_name IS NOT NULL AND TRIM(srl.raw_item_name) <> ''
          AND srl.quantity IS NOT NULL AND srl.quantity <> 0
        UNION ALL
        SELECT b.bill_date::date AS d, bl.raw_item_name AS alias
        FROM bill_lines bl
        JOIN bills b ON b.id = bl.bill_id
        WHERE bl.item_id = ${id}
          AND bl.raw_item_name IS NOT NULL AND TRIM(bl.raw_item_name) <> ''
          AND bl.quantity IS NOT NULL AND bl.quantity <> 0
      ) sub
      GROUP BY d
    )
    SELECT
      ad.d::text AS date,
      dc.qty_counted,
      dc.counted_by,
      dc.counted_at::text AS counted_at,
      dch.history AS count_history,
      -- dcs.qty (consumed via service) is deliberately NOT folded in here --
      -- /api/sales/live-tap already records that exact same consumption as
      -- a negative bill_lines row against this item (regardless of whether
      -- the tap was WIC or GMC), which daily_bills below already picks up.
      -- Adding dcs.qty on top double-counted every WIC-attributed service
      -- sale (GMC-attributed ones were already correctly excluded by
      -- daily_consumed_via_service's own WHERE clause). dcs.breakdown is
      -- still surfaced below for the per-service display -- just no longer
      -- fed into the actual used/expected math.
      COALESCE(dw.qty, 0) AS wic_qty,
      dg.qty  AS gmc_qty,
      db.qty  AS bills_qty,
      dsp.sp  AS sell_price,
      da.aliases,
      dci.qty AS converted_in_qty,
      dcit.tapped_at::text AS converted_in_time,
      dcs.breakdown AS wic_breakdown,
      db.breakdown AS bills_breakdown,
      COALESCE(dbc.below_cost, false) AS sold_below_cost,
      dvs.vcp,
      dvs.vcp_bill_id,
      CASE WHEN dvs.vcp IS NOT NULL
        THEN dvs.vcp + CASE WHEN vbg.total_qty > 0 THEN vbg.shared_total / vbg.total_qty ELSE 0 END
        ELSE NULL END AS acp
    FROM all_dates ad
    LEFT JOIN daily_counts dc ON dc.d = ad.d
    LEFT JOIN daily_wic    dw ON dw.d = ad.d
    LEFT JOIN daily_gmc    dg ON dg.d = ad.d
    LEFT JOIN daily_bills  db ON db.d = ad.d
    LEFT JOIN daily_sp    dsp ON dsp.d = ad.d
    LEFT JOIN daily_aliases da ON da.d = ad.d
    LEFT JOIN daily_converted_in dci ON dci.d = ad.d
    LEFT JOIN daily_converted_in_time dcit ON dcit.d = ad.d
    LEFT JOIN daily_consumed_via_service dcs ON dcs.d = ad.d
    LEFT JOIN daily_count_history dch ON dch.d = ad.d
    LEFT JOIN daily_below_cost dbc ON dbc.d = ad.d
    LEFT JOIN daily_vcp_source dvs ON dvs.d = ad.d
    LEFT JOIN vcp_bill_groups vbg ON vbg.source_bill_id = dvs.vcp_bill_id
    ORDER BY ad.d ASC
  `

  const dayRows = rows as unknown as ItemDayRow[]

  // Tap-timestamp-precise EXP/LOSS override for GMC conversion targets.
  // A CNV (a pack being opened) is itself a ground-truth reset event, same
  // weight as a physical count -- "a new pack means the old one is empty."
  // But day-grained sums can't tell whether a day's WIC/GMC activity
  // happened before or after that day's own pack-open, only
  // live_sale_taps.tapped_at can (e.g. 10 sold that morning belong to the
  // OLD pack; a pack opens at 2pm; 20 more sold that afternoon belong to
  // the NEW one -- the day-grained WIC total of 30 can't be split that
  // way). Computed as a second, chronological-event pass here rather than
  // folded into the CTE above, since it needs to walk in time order, not
  // aggregate by date. Only actually does anything for an item that's
  // been a GMC conversion target at least once (checked below) -- a pure
  // no-op for every other item, whose converted_in_qty is always null.
  if (dayRows.some(r => r.converted_in_qty != null)) {
    const [countEvents, packOpenEvents, directSaleEvents, serviceConsumptionEvents] = await Promise.all([
      sql`
        SELECT counted_at, quantity_counted FROM stock_counts
        WHERE item_id = ${id} AND counted_at IS NOT NULL
        ORDER BY counted_at ASC
      ` as unknown as Promise<{ counted_at: string; quantity_counted: string }[]>,
      // A real GMC purchase of a pack_to_gmc item converting into this
      // target -- confirmed via sales_receipts.customer_name the same way
      // /api/sales/live-taps derives is_gmc, not a stray WIC sale of the
      // pack itself.
      sql`
        SELECT t.tapped_at, t.quantity, COALESCE(i.units_per_pack, 1) AS units_per_pack
        FROM live_sale_taps t
        JOIN items i ON i.id = t.item_id
        JOIN sales_receipts r ON r.id = t.receipt_id
        WHERE i.gmc_type = 'pack_to_gmc' AND i.converts_to_item_id = ${id}
          AND t.undone = false
          AND r.customer_name = 'Grony Multimedia as Customer'
        ORDER BY t.tapped_at ASC
      ` as unknown as Promise<{ tapped_at: string; quantity: number; units_per_pack: string }[]>,
      // A real sale of the target itself (WIC or GMC -- same "used = wic +
      // gmc" the day-grained algorithm already sums), whichever way it was
      // sold in Live Sale.
      sql`
        SELECT tapped_at, quantity FROM live_sale_taps
        WHERE item_id = ${id} AND undone = false
        ORDER BY tapped_at ASC
      ` as unknown as Promise<{ tapped_at: string; quantity: number }[]>,
      // A service_using_gmc item's own real (WIC) tap -- same filter
      // daily_consumed_by_service above already uses, just at tap
      // precision. Never also read this item's negative bill_lines rows
      // as a separate consumption source -- those are the day-grained
      // echo /api/sales/live-tap writes for this exact same tap in the
      // same request; reading both would double-count it.
      sql`
        SELECT t.tapped_at, t.quantity
        FROM live_sale_taps t
        JOIN items i ON i.id = t.item_id
        JOIN sales_receipts r ON r.id = t.receipt_id
        WHERE i.gmc_type = 'service_using_gmc' AND i.converts_to_item_id = ${id}
          AND t.undone = false
          AND r.customer_name IS NULL
        ORDER BY t.tapped_at ASC
      ` as unknown as Promise<{ tapped_at: string; quantity: number }[]>,
    ])

    type PreciseEvent = { at: number; date: string; kind: 'count' | 'pack_open' | 'consume'; qty: number }
    const toDate = (ts: string) => new Date(ts).toISOString().slice(0, 10)
    const events: PreciseEvent[] = [
      ...countEvents.map(c => ({ at: new Date(c.counted_at).getTime(), date: toDate(c.counted_at), kind: 'count' as const, qty: parseFloat(c.quantity_counted) || 0 })),
      ...packOpenEvents.map(p => ({ at: new Date(p.tapped_at).getTime(), date: toDate(p.tapped_at), kind: 'pack_open' as const, qty: (parseFloat(p.units_per_pack) || 1) * Number(p.quantity) })),
      ...directSaleEvents.map(s => ({ at: new Date(s.tapped_at).getTime(), date: toDate(s.tapped_at), kind: 'consume' as const, qty: Number(s.quantity) })),
      ...serviceConsumptionEvents.map(s => ({ at: new Date(s.tapped_at).getTime(), date: toDate(s.tapped_at), kind: 'consume' as const, qty: Number(s.quantity) })),
    ].sort((a, b) => a.at - b.at)

    // Walk chronologically, maintaining a running balance. 'count' and
    // 'pack_open' are hard resets -- whatever the balance was right before
    // one IS that closed cycle's loss (positive) or gain (negative), same
    // sign convention lib/packChain.ts's computeRows already uses.
    // 'consume' before any reset has no budget to judge against yet and is
    // skipped, same rule buildPackCycles documents.
    let balance: number | null = null
    const preciseByDate = new Map<string, { expected: number; loss: number | null }>()
    for (const ev of events) {
      let lossThisEvent: number | null = null
      if (balance === null) {
        if (ev.kind === 'count' || ev.kind === 'pack_open') balance = ev.qty
      } else if (ev.kind === 'count') {
        lossThisEvent = parseFloat((balance - ev.qty).toFixed(4))
        balance = ev.qty
      } else if (ev.kind === 'pack_open') {
        lossThisEvent = parseFloat(balance.toFixed(4))
        balance = ev.qty
      } else {
        balance = parseFloat((balance - ev.qty).toFixed(4))
      }
      if (balance !== null) {
        const existing = preciseByDate.get(ev.date)
        preciseByDate.set(ev.date, {
          expected: balance,
          loss: lossThisEvent !== null ? (existing?.loss ?? 0) + lossThisEvent : (existing?.loss ?? null),
        })
      }
    }

    for (const row of dayRows) {
      const p = preciseByDate.get(row.date)
      if (p) {
        row.precise_expected_soh = p.expected
        row.precise_loss = p.loss
      }
    }
  }

  return dayRows
}
