import sql from '@/lib/db'
import { NextResponse } from 'next/server'

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

// Same replay logic as /api/losses/summary (expected = prev + bills + convertedIn - wic - gmc,
// loss = expected - counted whenever a count actually happens) -- but also buckets each day's
// loss delta into the month it occurred, so a trend over time can be built alongside the
// cumulative per-item totals.
function aggregateItem(rows: DayRow[]) {
  let prev: number | null = null
  let lgQty = 0
  const monthly: Record<string, number> = {}
  let hasActivity = false
  for (const row of rows) {
    const counted = row.qty_counted !== null ? parseFloat(row.qty_counted) : null
    const bills = n(row.bills_qty), w = n(row.wic_qty), g = n(row.gmc_qty), c = n(row.converted_in_qty)
    if (counted !== null) hasActivity = true
    if (prev === null) {
      if (counted !== null) prev = counted
    } else {
      const expected: number = prev + bills + c - w - g
      if (counted !== null) {
        const delta = expected - counted
        lgQty += delta
        const month = row.date.slice(0, 7)
        monthly[month] = (monthly[month] ?? 0) + delta
        prev = counted
      } else {
        prev = expected
      }
    }
  }
  return { lgQty: parseFloat(lgQty.toFixed(4)), monthly, hasActivity }
}

export async function GET() {
  try {
    const [itemRows, dayRows] = await Promise.all([
      sql`
        SELECT s.item_id, s.item_name, s.cf_group, i.selling_rate, i.product_type
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

    const byItem = new Map<number, DayRow[]>()
    for (const r of dayRows as DayRow[]) {
      if (!byItem.has(r.item_id)) byItem.set(r.item_id, [])
      byItem.get(r.item_id)!.push(r)
    }

    const monthlyTotals: Record<string, { qty: number; value: number }> = {}
    const itemAgg: { item_id: number; item_name: string; cf_group: string | null; lgQty: number; lgAmt: number; hasActivity: boolean }[] = []

    for (const item of itemRows as any[]) {
      if (item.product_type === 'service') continue
      const sp = parseFloat(item.selling_rate ?? '0') || 0
      const rows = byItem.get(item.item_id) ?? []
      const { lgQty, monthly, hasActivity } = aggregateItem(rows)
      const lgAmt = Math.round(lgQty * sp * 100) / 100

      for (const [month, qtyDelta] of Object.entries(monthly)) {
        if (!monthlyTotals[month]) monthlyTotals[month] = { qty: 0, value: 0 }
        monthlyTotals[month].qty += qtyDelta
        monthlyTotals[month].value += qtyDelta * sp
      }

      itemAgg.push({ item_id: item.item_id, item_name: item.item_name, cf_group: item.cf_group, lgQty, lgAmt, hasActivity })
    }

    const monthlyLoss = Object.entries(monthlyTotals)
      .map(([month, v]) => ({ month, qty: Math.round(v.qty * 100) / 100, value: Math.round(v.value * 100) / 100 }))
      .sort((a, b) => a.month.localeCompare(b.month))

    const withActivity = itemAgg.filter(i => i.hasActivity)

    const topByValue = [...withActivity].sort((a, b) => b.lgAmt - a.lgAmt).slice(0, 10)
    const topByQty = [...withActivity].sort((a, b) => b.lgQty - a.lgQty).slice(0, 10)
    const leastByValue = [...withActivity].sort((a, b) => Math.abs(a.lgAmt) - Math.abs(b.lgAmt)).slice(0, 10)

    const groupTotals = new Map<string, number>()
    for (const i of withActivity) {
      const g = i.cf_group ?? 'Ungrouped'
      groupTotals.set(g, (groupTotals.get(g) ?? 0) + i.lgAmt)
    }
    const lossByGroup = Array.from(groupTotals.entries())
      .map(([cf_group, value]) => ({ cf_group, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value)

    return NextResponse.json({ monthlyLoss, topByValue, topByQty, leastByValue, lossByGroup })
  } catch (e) {
    console.error('loss-trends error:', e)
    return NextResponse.json({ error: 'Failed to load loss trends' }, { status: 500 })
  }
}
