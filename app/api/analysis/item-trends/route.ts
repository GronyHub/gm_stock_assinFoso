import sql from '@/lib/db'
import { NextResponse } from 'next/server'

const MONTHS_BACK = 6

function lastMonths(n: number): string[] {
  const out: string[] = []
  const d = new Date()
  d.setDate(1)
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1)
    out.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

export async function GET() {
  try {
    const months = lastMonths(MONTHS_BACK)
    const startMonth = months[0]

    const [items, monthly] = await Promise.all([
      sql`
        SELECT id AS item_id, canonical_name AS item_name, cf_group, product_type
        FROM items
        WHERE LOWER(status) = 'active'
        ORDER BY canonical_name
      `,
      sql`
        SELECT
          srl.item_id,
          to_char(sr.receipt_date, 'YYYY-MM') AS month,
          SUM(srl.quantity)::float AS qty,
          SUM(srl.item_total)::float AS revenue
        FROM sales_receipt_lines srl
        JOIN sales_receipts sr ON sr.id = srl.receipt_id
        WHERE sr.customer_name IS DISTINCT FROM 'Grony Multimedia as Customer'
          AND sr.receipt_date >= (${startMonth} || '-01')::date
        GROUP BY srl.item_id, to_char(sr.receipt_date, 'YYYY-MM')
      `,
    ])

    const monthIndex = new Map(months.map((m, i) => [m, i]))
    const byItem = new Map<number, { qty: number[]; revenue: number[] }>()
    for (const r of monthly as any[]) {
      const idx = monthIndex.get(r.month)
      if (idx === undefined || r.item_id == null) continue
      if (!byItem.has(r.item_id)) byItem.set(r.item_id, { qty: Array(months.length).fill(0), revenue: Array(months.length).fill(0) })
      const entry = byItem.get(r.item_id)!
      entry.qty[idx] = r.qty ?? 0
      entry.revenue[idx] = r.revenue ?? 0
    }

    const half = Math.floor(months.length / 2)
    const trends = (items as any[]).map(item => {
      const series = byItem.get(item.item_id) ?? { qty: Array(months.length).fill(0), revenue: Array(months.length).fill(0) }
      const recent = series.revenue.slice(-half)
      const prior = series.revenue.slice(0, months.length - half)
      const recentAvg = recent.reduce((a, b) => a + b, 0) / (recent.length || 1)
      const priorAvg = prior.reduce((a, b) => a + b, 0) / (prior.length || 1)

      let pctChange: number
      let direction: 'up' | 'down' | 'flat'
      if (priorAvg === 0 && recentAvg === 0) { pctChange = 0; direction = 'flat' }
      else if (priorAvg === 0) { pctChange = 100; direction = 'up' }
      else {
        pctChange = ((recentAvg - priorAvg) / priorAvg) * 100
        direction = pctChange > 10 ? 'up' : pctChange < -10 ? 'down' : 'flat'
      }

      return {
        item_id: item.item_id,
        item_name: item.item_name,
        cf_group: item.cf_group,
        product_type: item.product_type,
        revenue_series: series.revenue,
        qty_series: series.qty,
        total_revenue: series.revenue.reduce((a, b) => a + b, 0),
        total_qty: series.qty.reduce((a, b) => a + b, 0),
        pct_change: Math.round(pctChange * 10) / 10,
        direction,
      }
    })

    return NextResponse.json({ months, trends })
  } catch (e) {
    console.error('item-trends error:', e)
    return NextResponse.json({ error: 'Failed to load item trends' }, { status: 500 })
  }
}
