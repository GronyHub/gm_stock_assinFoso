import sql from '@/lib/db'
import { NextResponse } from 'next/server'
import { ensureCountRevisions } from '@/lib/countRevisions'
import { getItemDayRows } from '@/lib/itemDayRows'
import { computeChainLossSummary } from '@/lib/packChain'

export const dynamic = 'force-dynamic'

type DayRow = {
  item_id: number
  date: string
  qty_counted: string | null
  wic_qty: string | null
  gmc_qty: string | null
  bills_qty: string | null
  converted_in_qty: string | null
}

type ItemMeta = {
  item_id: number
  item_name: string
  cf_group: string | null
  calculated_soh: string | null
  selling_rate: string | null
  purchase_rate: string | null
  product_type: string | null
  units_per_pack: string | null
  converts_to_item_id: number | null
}

function n(v: string | null) { return parseFloat(v ?? '0') || 0 }

function aggregateItem(rows: DayRow[], sp: number) {
  let prev: number | null = null
  let lgQty = 0, cnt = 0, wic = 0, gmc = 0, bl = 0, cnv = 0, lossCount = 0, gainCount = 0
  for (const row of rows) {
    const counted = row.qty_counted !== null ? parseFloat(row.qty_counted) : null
    const bills = n(row.bills_qty), w = n(row.wic_qty), g = n(row.gmc_qty), c = n(row.converted_in_qty)
    if (prev === null) {
      if (counted !== null) prev = counted
    } else {
      const expected: number = prev + bills + c - w - g
      if (counted !== null) {
        const diff = expected - counted
        lgQty += diff
        if (diff > 0.0001) lossCount++
        else if (diff < -0.0001) gainCount++
        prev = counted
      }
      else prev = expected
    }
    // cnt (total physical counts) is kept even though the items table no
    // longer displays it -- the service-violation check elsewhere (a
    // service should never have a physical count) still reads it.
    if (counted !== null) cnt += counted
    wic += w; gmc += g; bl += bills; cnv += c
  }
  return {
    lgQty: parseFloat(lgQty.toFixed(4)),
    lgAmt: parseFloat((lgQty * sp).toFixed(2)),
    lossCount,
    gainCount,
    cnt: parseFloat(cnt.toFixed(4)),
    wic: parseFloat(wic.toFixed(4)),
    gmc: parseFloat(gmc.toFixed(4)),
    bl: parseFloat(bl.toFixed(4)),
    cnv: parseFloat(cnv.toFixed(4)),
  }
}

export async function GET() {
  const [itemRows, dayRows] = await Promise.all([
    sql`
      SELECT s.item_id, COALESCE(i.canonical_name, s.item_name) AS item_name, s.cf_group, s.calculated_soh,
             i.selling_rate, i.purchase_rate, i.product_type,
             i.units_per_pack, i.converts_to_item_id
      FROM item_stock_summary s
      LEFT JOIN items i ON i.id = s.item_id
      WHERE s.item_name NOT ILIKE 'old stop%'
        AND s.item_name NOT ILIKE 'old- stop%'
      ORDER BY s.item_name ASC
    `,
    // A good with converts_to_item_id set is credited into its target when it's GMC'd
    // (internal use) -- e.g. taking one "4x6 packs" pack for shop use credits 50 (its
    // units_per_pack) onto "4x6 Photo Paper Singles". A service with converts_to_item_id
    // set instead *deducts* from its target's own WIC, using the service's own real (WIC)
    // sale quantity -- e.g. every "Service - Passport Printing" sold for a real customer
    // consumes 1 (its units_per_pack) singles sheet. Both are derived live from the same
    // sales data GMC/WIC already come from, so they apply automatically to every entry,
    // past and future, with no separate write path to keep in sync.
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

  const items = itemRows as unknown as ItemMeta[]

  // group daily rows by item_id
  const byItem = new Map<number, DayRow[]>()
  for (const r of dayRows as DayRow[]) {
    if (!byItem.has(r.item_id)) byItem.set(r.item_id, [])
    byItem.get(r.item_id)!.push(r)
  }

  // ₵ valuation override for the 4x6 paper chain: a lost pack is worth its
  // papers as missed passport prints (units_per_pack × ₵20/sheet) and a lost
  // single sheet is worth ₵20 -- never the items' own selling prices. Matches
  // the LOSS ₵ column in the pack-chain detail table.
  const PAPER_SELL_PRICE = 20
  const paperPacks = items.filter(it =>
    it.converts_to_item_id != null
    && (it.product_type ?? 'goods') !== 'service'
    && /4x6/i.test(it.item_name) && /pack/i.test(it.item_name))
  const paperPackIds = new Set(paperPacks.map(p => p.item_id))
  const paperSinglesIds = new Set(paperPacks.map(p => p.converts_to_item_id))

  const itemsById = new Map<number, ItemMeta>(items.map(it => [it.item_id, it]))

  // Pack items (a Good with converts_to_item_id set) get their Loss Amount
  // and Num. of Losses from the same chain-aware ledger the pack-chain
  // dropdown already shows -- the TOTAL ₵ column there, summed -- instead
  // of the naive per-item count-vs-expected diff, because that diff ignores
  // the USED/PACK cycle overrun/underrun on the singles side entirely.
  const packItems = items.filter(it =>
    (it.product_type ?? 'goods') !== 'service' && it.converts_to_item_id != null)

  if (packItems.length > 0) await ensureCountRevisions()

  const dayRowsById = new Map<number, ReturnType<typeof getItemDayRows>>()
  function loadDayRows(id: number) {
    if (!dayRowsById.has(id)) dayRowsById.set(id, getItemDayRows(id))
    return dayRowsById.get(id)!
  }

  const chainSummaries = new Map<number, { lossAmt: number; lossCount: number; gainCount: number }>()
  await Promise.all(packItems.map(async pack => {
    const singles = itemsById.get(pack.converts_to_item_id!)
    if (!singles) return
    const [packDayRows, singlesDayRows] = await Promise.all([loadDayRows(pack.item_id), loadDayRows(singles.item_id)])
    const singlesSp = parseFloat(singles.selling_rate ?? '0') || 0
    const sheetPrice = singlesSp > 0 ? singlesSp : PAPER_SELL_PRICE
    const unitsPerPack = parseFloat(pack.units_per_pack ?? '0') || 0
    chainSummaries.set(pack.item_id, computeChainLossSummary(packDayRows, singlesDayRows, unitsPerPack, sheetPrice))
  }))

  const result = items.map(item => {
    const sp = paperPackIds.has(item.item_id)
      ? (parseFloat(item.units_per_pack ?? '0') || 1) * PAPER_SELL_PRICE
      : paperSinglesIds.has(item.item_id)
        ? PAPER_SELL_PRICE
        : parseFloat(item.selling_rate ?? '0') || 0
    const rows = byItem.get(item.item_id) ?? []
    const agg = aggregateItem(rows, sp)
    const chain = chainSummaries.get(item.item_id)
    if (chain) { agg.lgAmt = chain.lossAmt; agg.lossCount = chain.lossCount; agg.gainCount = chain.gainCount }
    return {
      item_id: item.item_id,
      item_name: item.item_name,
      cf_group: item.cf_group,
      product_type: item.product_type,
      soh: item.calculated_soh,
      sp: item.selling_rate,
      cp: item.purchase_rate,
      units_per_pack: item.units_per_pack,
      converts_to_item_id: item.converts_to_item_id,
      ...agg,
    }
  })

  return NextResponse.json(result)
}
