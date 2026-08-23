import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const results = await sql`
      SELECT
        i.canonical_name as service_name,
        target.canonical_name as gmc_target_item,
        i.purchase_rate as cost_price,
        (SELECT COUNT(*)::int FROM stock_counts WHERE item_id = i.id) as stock_counts,
        (SELECT COUNT(*)::int FROM bill_lines WHERE item_id = i.id) as bills,
        (SELECT COUNT(*)::int FROM sales_receipt_lines WHERE item_id = i.id) as sales,
        (SELECT COUNT(*)::int FROM stock_count_revisions WHERE item_id = i.id) as losses,
        i.selling_rate as conversion_rate
      FROM items i
      LEFT JOIN items target ON i.converts_to_item_id = target.id
      WHERE i.gmc_type = 'service_using_gmc'
        AND i.status IS NULL
      ORDER BY i.canonical_name
    `

    const allClean = results.every(r =>
      r.cost_price === null &&
      r.stock_counts === 0 &&
      r.bills === 0 &&
      r.sales === 0 &&
      r.losses === 0
    )

    return NextResponse.json({
      all_clean: allClean,
      total_services: results.length,
      services: results,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
