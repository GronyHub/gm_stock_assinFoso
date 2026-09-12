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
  // Self-contained per-cycle tally for a GMC conversion target -- see the
  // pass at the bottom of getItemDayRows. Set only on the date a pack was
  // actually opened (converted_in_qty > 0); every other row is null. Only
  // lib/packChain.ts's computeRows reads these, to override that date's
  // loss (never the day-grained available/expected chain).
  cycle_given?: number | null
  cycle_used?: number | null
  cycle_closed?: boolean | null
  // Same-day split of this date's own USED total around the exact moment a
  // pack was tapped open -- e.g. 15 used that day = 6 before the CNV tap
  // (still belongs to the OLD cycle) + 9 after (belongs to the NEW one).
  // Set only on a date where converted_in_qty > 0; null everywhere else.
  cnv_used_before?: number | null
  cnv_used_after?: number | null
  // Running Stock On Hand for a GMC conversion target -- what's physically
  // at the shop as of THIS date, resetting at every pack-open (a new pack
  // is assumed to replace whatever was left of the old one) and every
  // physical count (ground truth), decreasing in between as real sales/
  // consumption come in. A different question from the cycle tally above
  // (which measures usage against ONE pack, for loss/gain) -- this is the
  // running total across every pack, forward-filled onto every date. Set
  // for every date once the item has been a GMC conversion target at
  // least once; null for every other item.
  gmc_soh?: number | null
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

  // Self-contained per-cycle tally for GMC conversion targets. A CNV (a
  // pack being opened) starts a fresh, independent cycle: it supplies
  // `sheetsGiven` units, and every real sale/consumption from that exact
  // moment onward -- until the NEXT pack-open, whatever day that falls on
  // -- counts as `used` against it. Unlike a running balance, cycles never
  // chain: a discrepancy in one cycle can never propagate into another.
  // Deliberately count-independent (a physical count plays no part here --
  // loss/gain is read straight off given vs. used). Day-grained sums can't
  // tell whether a day's activity happened before or after that day's own
  // pack-open, only live_sale_taps.tapped_at can (e.g. 10 sold that
  // morning belong to the OLD pack; a pack opens at 2pm; 20 more sold that
  // afternoon belong to the NEW one), so this walks in real time order
  // rather than aggregating by date. Only actually does anything for an
  // item that's been a GMC conversion target at least once (checked
  // below) -- a pure no-op for every other item, whose converted_in_qty is
  // always null.
  if (dayRows.some(r => r.converted_in_qty != null)) {
    const [packOpenEvents, directSaleEvents, serviceConsumptionEvents, countEvents] = await Promise.all([
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
      // A physical count -- ground truth for the running SOH walk further
      // below (a count always wins over any estimate), but deliberately
      // NOT read into the cycle tally above, which stays count-independent
      // on purpose.
      sql`
        SELECT counted_at, quantity_counted FROM stock_counts
        WHERE item_id = ${id} AND counted_at IS NOT NULL
        ORDER BY counted_at ASC
      ` as unknown as Promise<{ counted_at: string; quantity_counted: string }[]>,
    ])

    type CycleEvent = { at: number; date: string; kind: 'pack_open' | 'consume'; qty: number }
    const toDate = (ts: string) => new Date(ts).toISOString().slice(0, 10)
    // Real, tap-timestamped events only -- kept separate from the merged
    // `events` list below because the before/after split further down
    // needs to know which dates have genuine sub-day precision.
    const preciseEvents: CycleEvent[] = [
      ...packOpenEvents.map(p => ({ at: new Date(p.tapped_at).getTime(), date: toDate(p.tapped_at), kind: 'pack_open' as const, qty: (parseFloat(p.units_per_pack) || 1) * Number(p.quantity) })),
      ...directSaleEvents.map(s => ({ at: new Date(s.tapped_at).getTime(), date: toDate(s.tapped_at), kind: 'consume' as const, qty: Number(s.quantity) })),
      ...serviceConsumptionEvents.map(s => ({ at: new Date(s.tapped_at).getTime(), date: toDate(s.tapped_at), kind: 'consume' as const, qty: Number(s.quantity) })),
    ]

    // Pre-live fallback: live_sale_taps only exists from whenever the Live
    // Sale feature actually launched, so a pack opened (or sold from)
    // before that has no tap row at all and would otherwise be invisible
    // here -- exactly the plain, fraction-less older CNV rows (18 Aug, 27
    // Jul, ...) that never got a cycle. For any date with NO tap-sourced
    // event at all, fall back to the same day-grained totals the rest of
    // this function already computed (converted_in_qty/wic_qty/gmc_qty/
    // wic_breakdown -- no fresh query needed), anchored at a fixed time of
    // day so it still sorts correctly against real tap timestamps on other
    // dates. This can only lose precision (no before/after split, no
    // sub-day ordering) on days it applies to -- it never re-processes a
    // date that already has real tap data, so it can't double-count.
    const preciseDates = new Set(preciseEvents.map(e => e.date))
    const numVal = (v: string | null) => v ? parseFloat(v) || 0 : 0
    const fallbackEvents: CycleEvent[] = []
    for (const row of dayRows) {
      if (preciseDates.has(row.date)) continue
      const given = numVal(row.converted_in_qty)
      const used = numVal(row.wic_qty) + numVal(row.gmc_qty) + (row.wic_breakdown ?? []).reduce((s, b) => s + b.qty, 0)
      if (given <= 0 && used <= 0) continue
      const dayAt = new Date(row.date + 'T12:00:00.000Z').getTime()
      if (given > 0) fallbackEvents.push({ at: dayAt, date: row.date, kind: 'pack_open', qty: given })
      if (used > 0) fallbackEvents.push({ at: dayAt + 1, date: row.date, kind: 'consume', qty: used })
    }
    const events = [...preciseEvents, ...fallbackEvents].sort((a, b) => a.at - b.at)

    let cur: { startDate: string; given: number; used: number } | null = null
    const cycleByDate = new Map<string, { given: number; used: number; closed: boolean }>()
    for (const ev of events) {
      if (ev.kind === 'pack_open') {
        if (cur && cur.startDate === ev.date) {
          // A second pack opened the same calendar day as the still-open
          // cycle's own start -- merge into one cell, consistent with how
          // daily_converted_in above already sums same-day pack quantities.
          cur.given = parseFloat((cur.given + ev.qty).toFixed(4))
        } else {
          if (cur) cycleByDate.set(cur.startDate, { given: cur.given, used: cur.used, closed: true })
          cur = { startDate: ev.date, given: ev.qty, used: 0 }
        }
      } else if (cur) {
        // Consumption before the very first ever pack-open has no budget
        // to judge against yet -- skipped, same rule buildPackCycles
        // documents.
        cur.used = parseFloat((cur.used + ev.qty).toFixed(4))
      }
    }
    if (cur) cycleByDate.set(cur.startDate, { given: cur.given, used: cur.used, closed: false })

    for (const row of dayRows) {
      const c = cycleByDate.get(row.date)
      if (c) {
        row.cycle_given = c.given
        row.cycle_used = c.used
        row.cycle_closed = c.closed
      }
    }

    // Running Stock On Hand -- what's physically at the shop as of any
    // given date. A different question from the cycle tally above (which
    // measures usage against ONE pack, for loss/gain): this is the running
    // total across EVERY pack, so it resets at every pack-open (same
    // premise the whole feature started from -- a new pack means the old
    // one is assumed empty/replaced) AND at every physical count (ground
    // truth), decreasing by real consumption in between. Shares the same
    // merged pack_open/consume events as the cycle tally, plus counts
    // (deliberately excluded from the cycle tally, but very much a reset
    // here). Same same-day-merge rule as the cycle tally: two pack-opens
    // on one calendar date combine into a single reset.
    type SohEvent = CycleEvent | { at: number; date: string; kind: 'count'; qty: number }
    const sohEvents: SohEvent[] = [
      ...events,
      ...countEvents.map(c => ({ at: new Date(c.counted_at).getTime(), date: toDate(c.counted_at), kind: 'count' as const, qty: parseFloat(c.quantity_counted) || 0 })),
    ].sort((a, b) => a.at - b.at)

    let sohBalance: number | null = null
    let sohResetDate: string | null = null
    const sohByDate = new Map<string, number>()
    for (const ev of sohEvents) {
      if (ev.kind === 'pack_open') {
        sohBalance = sohResetDate === ev.date && sohBalance !== null ? parseFloat((sohBalance + ev.qty).toFixed(4)) : ev.qty
        sohResetDate = ev.date
      } else if (ev.kind === 'count') {
        sohBalance = ev.qty
        sohResetDate = ev.date
      } else if (sohBalance !== null) {
        sohBalance = parseFloat((sohBalance - ev.qty).toFixed(4))
      }
      if (sohBalance !== null) sohByDate.set(ev.date, sohBalance)
    }
    // dayRows is already ordered oldest-first (see the main query's own
    // ORDER BY) -- forward-fill so a date with no SOH-relevant event of
    // its own (e.g. a pure bill/receiving day) still carries the balance
    // as of the most recent one, rather than showing a gap.
    let lastSoh: number | null = null
    for (const row of dayRows) {
      const s = sohByDate.get(row.date)
      if (s !== undefined) lastSoh = s
      if (lastSoh !== null) row.gmc_soh = lastSoh
    }

    // Same-day before/after split, for the USED column's own display (e.g.
    // "15(6/9)") -- distinct from the cycle tally above, which accumulates
    // used across however many days a cycle stays open. This is strictly
    // about un-blending ONE day's total around that day's own pack-open
    // moment: a day's consumption before the tap still belongs to the OLD
    // cycle (already folded into its `used` above), consumption after
    // belongs to the NEW one -- both true regardless of which day the
    // cycle that opened it started on. Built from preciseEvents only, not
    // the fallback-augmented `events` -- a pre-live (day-grained) pack-open
    // has no real tap time to split around, so it's deliberately left
    // unsplit rather than shown as a misleading "0/total".
    const packOpenAtByDate = new Map<string, number>()
    for (const ev of preciseEvents) {
      if (ev.kind !== 'pack_open') continue
      const existing = packOpenAtByDate.get(ev.date)
      if (existing === undefined || ev.at < existing) packOpenAtByDate.set(ev.date, ev.at)
    }
    const usedSplitByDate = new Map<string, { before: number; after: number }>()
    for (const ev of preciseEvents) {
      if (ev.kind !== 'consume') continue
      const cnvAt = packOpenAtByDate.get(ev.date)
      if (cnvAt === undefined) continue
      const split = usedSplitByDate.get(ev.date) ?? { before: 0, after: 0 }
      if (ev.at < cnvAt) split.before = parseFloat((split.before + ev.qty).toFixed(4))
      else split.after = parseFloat((split.after + ev.qty).toFixed(4))
      usedSplitByDate.set(ev.date, split)
    }
    for (const row of dayRows) {
      const s = usedSplitByDate.get(row.date)
      if (s) {
        row.cnv_used_before = s.before
        row.cnv_used_after = s.after
      } else if (packOpenAtByDate.has(row.date)) {
        // A CNV was recorded this day but nothing sold either side of it.
        row.cnv_used_before = 0
        row.cnv_used_after = 0
      }
    }
  }

  return dayRows
}
