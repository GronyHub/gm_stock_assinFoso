import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const rows = await sql`
      WITH last_wic AS (
        SELECT srl.item_id, MAX(sr.receipt_date) AS last_sale_date
        FROM sales_receipt_lines srl
        JOIN sales_receipts sr ON sr.id = srl.receipt_id
        WHERE sr.customer_name IS DISTINCT FROM 'Grony Multimedia as Customer'
        GROUP BY srl.item_id
      )
      SELECT s.item_id, s.item_name, s.cf_group, s.calculated_soh,
             i.purchase_rate, lw.last_sale_date::text AS last_sale_date
      FROM item_stock_summary s
      LEFT JOIN items i ON i.id = s.item_id
      LEFT JOIN last_wic lw ON lw.item_id = s.item_id
      WHERE COALESCE(i.product_type, 'goods') <> 'service'
        AND COALESCE(s.calculated_soh, 0) > 0
        AND s.item_name NOT ILIKE 'old stop%'
        AND s.item_name NOT ILIKE 'old- stop%'
    `

    const today = Date.now()
    const items = (rows as any[]).map(r => {
      const soh = parseFloat(r.calculated_soh ?? '0') || 0
      const cp = parseFloat(r.purchase_rate ?? '0') || 0
      const daysSince = r.last_sale_date
        ? Math.floor((today - new Date(r.last_sale_date + 'T00:00:00').getTime()) / 86400000)
        : null
      return {
        item_id: r.item_id,
        item_name: r.item_name,
        cf_group: r.cf_group,
        soh,
        stock_value: Math.round(soh * cp * 100) / 100,
        last_sale_date: r.last_sale_date,
        days_since_sale: daysSince,
      }
    }).sort((a, b) => {
      const av = a.days_since_sale ?? Infinity
      const bv = b.days_since_sale ?? Infinity
      return bv - av
    })

    return NextResponse.json({ items })
  } catch (e) {
    console.error('dead-stock error:', e)
    return NextResponse.json({ error: 'Failed to load dead stock analysis' }, { status: 500 })
  }
}
