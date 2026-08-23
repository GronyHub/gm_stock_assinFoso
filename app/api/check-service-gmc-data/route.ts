import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const services = await sql`
      SELECT
        i.id,
        i.canonical_name,
        i.purchase_rate as cost_price,
        i.expiration_date,
        i.converts_to_item_id,
        i.selling_rate as conversion_rate
      FROM items i
      WHERE i.gmc_type = 'service_using_gmc'
        AND i.status IS NULL
      ORDER BY i.canonical_name
    `

    const results = []

    for (const service of services) {
      const [counts] = await sql`SELECT COUNT(*)::int as n FROM stock_counts WHERE item_id = ${service.id}`
      const [bills] = await sql`SELECT COUNT(*)::int as n FROM bill_lines WHERE item_id = ${service.id}`
      const [sales] = await sql`SELECT COUNT(*)::int as n FROM sales_receipt_lines WHERE item_id = ${service.id}`
      const [losses] = await sql`SELECT COUNT(*)::int as n FROM stock_count_revisions WHERE item_id = ${service.id}`

      const issues = []
      if (service.cost_price !== null) issues.push(`cost_price = ${service.cost_price}`)
      if (service.expiration_date !== null) issues.push(`has expiration_date`)
      if (counts.n > 0) issues.push(`${counts.n} stock_count records`)
      if (bills.n > 0) issues.push(`${bills.n} bill_lines`)
      if (sales.n > 0) issues.push(`${sales.n} sales_receipt_lines`)
      if (losses.n > 0) issues.push(`${losses.n} loss_revisions`)

      results.push({
        id: service.id,
        name: service.canonical_name,
        converts_to: service.converts_to_item_id,
        conversion_rate: service.conversion_rate,
        issues: issues.length > 0 ? issues : ['✓ Clean - no extra data'],
        has_problems: issues.length > 0,
      })
    }

    const problemServices = results.filter(r => r.has_problems)

    return NextResponse.json({
      total_services: results.length,
      services_with_issues: problemServices.length,
      services: results,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
