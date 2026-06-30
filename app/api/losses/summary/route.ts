import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type DayRow = {
  item_id: number
  date: string
  qty_counted: string | null
  wic_qty: string | null
  gmc_qty: string | null
  bills_qty: string | null
}

function n(v: string | null) { return parseFloat(v ?? '0') || 0 }

function aggregateItem(rows: DayRow[], sp: number) {
  let prev: number | null = null
  let lgQty = 0, cnt = 0, wic = 0, gmc = 0, bl = 0
  for (const row of rows) {
    const counted = row.qty_counted !== null ? parseFloat(row.qty_counted) : null
    const bills = n(row.bills_qty), w = n(row.wic_qty), g = n(row.gmc_qty)
    if (prev === null) {
      if (counted !== null) prev = counted
    } else {
      const expected: number = prev + bills - w - g
      if (counted !== null) { lgQty += expected - counted; prev = counted }
      else prev = expected
    }
    if (counted !== null) cnt += counted
    wic += w; gmc += g; bl += bills
  }
  return {
    lgQty: parseFloat(lgQty.toFixed(4)),
    lgAmt: parseFloat((lgQty * sp).toFixed(2)),
    cnt: parseFloat(cnt.toFixed(4)),
    wic: parseFloat(wic.toFixed(4)),
    gmc: parseFloat(gmc.toFixed(4)),
    bl: parseFloat(bl.toFixed(4)),
  }
}

export async function GET() {
  const [itemRows, dayRows] = await Promise.all([
    sql`
      SELECT s.item_id, s.item_name, s.cf_group, s.calculated_soh,
             i.selling_rate, i.purchase_rate, i.product_type
      FROM item_stock_summary s
      LEFT JOIN items i ON i.id = s.item_id
      WHERE s.item_name NOT ILIKE 'old stop%'
        AND s.item_name NOT ILIKE 'old- stop%'
        AND s.item_name NOT ILIKE 'service%'
        AND s.item_name NOT ILIKE 'service-%'
      ORDER BY s.item_name ASC
    `,
    sql`
      WITH all_dates AS (
        SELECT item_id, count_date::date AS d FROM stock_counts WHERE quantity_counted IS NOT NULL
        UNION
        SELECT srl.item_id, sr.receipt_date::date
          FROM sales_receipt_lines srl JOIN sales_receipts sr ON sr.id = srl.receipt_id
          WHERE srl.quantity IS NOT NULL
        UNION
        SELECT bl.item_id, b.bill_date::date
          FROM bill_lines bl JOIN bills b ON b.id = bl.bill_id
          WHERE bl.quantity IS NOT NULL
      ),
      daily_counts AS (
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
      )
      SELECT ad.item_id, ad.d::text AS date,
             dc.qty_counted, dw.qty AS wic_qty, dg.qty AS gmc_qty, db.qty AS bills_qty
      FROM all_dates ad
      LEFT JOIN daily_counts dc ON dc.item_id = ad.item_id AND dc.d = ad.d
      LEFT JOIN daily_wic    dw ON dw.item_id = ad.item_id AND dw.d = ad.d
      LEFT JOIN daily_gmc    dg ON dg.item_id = ad.item_id AND dg.d = ad.d
      LEFT JOIN daily_bills  db ON db.item_id = ad.item_id AND db.d = ad.d
      ORDER BY ad.item_id, ad.d ASC
    `,
  ])

  // group daily rows by item_id
  const byItem = new Map<number, DayRow[]>()
  for (const r of dayRows as DayRow[]) {
    if (!byItem.has(r.item_id)) byItem.set(r.item_id, [])
    byItem.get(r.item_id)!.push(r)
  }

  const result = (itemRows as any[]).map(item => {
    const sp = parseFloat(item.selling_rate ?? '0') || 0
    const rows = byItem.get(item.item_id) ?? []
    const agg = aggregateItem(rows, sp)
    return {
      item_id: item.item_id,
      item_name: item.item_name,
      cf_group: item.cf_group,
      product_type: item.product_type,
      soh: item.calculated_soh,
      sp: item.selling_rate,
      cp: item.purchase_rate,
      ...agg,
    }
  })

  return NextResponse.json(result)
}
