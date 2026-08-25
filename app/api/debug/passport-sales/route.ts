// DEVELOPMENT ONLY - Debug endpoint for database investigations
// This endpoint does not require authentication to allow easier debugging
import sql from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Find all passport and 4x6 related items
    const items = await sql`
      SELECT id, canonical_name, product_type, status
      FROM items
      WHERE LOWER(canonical_name) LIKE '%passport%'
         OR LOWER(canonical_name) LIKE '%4x6%'
      ORDER BY canonical_name
    `

    if (!Array.isArray(items) || items.length === 0) {
      return Response.json({ items: [], message: 'No items found' })
    }

    const itemIds = (items as any[]).map(i => i.id)

    // Get sales summary for each item
    const salesSummary = await sql`
      SELECT
        i.id,
        i.canonical_name,
        COUNT(DISTINCT srl.id)::int as total_sales,
        MIN(sr.receipt_date)::text as first_sale_date,
        MAX(sr.receipt_date)::text as last_sale_date,
        SUM(srl.quantity)::numeric as total_qty_sold
      FROM items i
      LEFT JOIN sales_receipt_lines srl ON srl.item_id = i.id
      LEFT JOIN sales_receipts sr ON sr.id = srl.receipt_id
      WHERE i.id = ANY($1::int[])
      GROUP BY i.id, i.canonical_name
      ORDER BY total_sales DESC NULLS LAST, i.canonical_name
    `

    // Get all distinct raw names recorded for these items
    const rawNamesMismatch = await sql`
      SELECT
        srl.item_id,
        i.canonical_name as current_name,
        srl.raw_item_name as recorded_name,
        COUNT(*)::int as count,
        MIN(sr.receipt_date)::text as first_date,
        MAX(sr.receipt_date)::text as last_date
      FROM sales_receipt_lines srl
      JOIN items i ON i.id = srl.item_id
      LEFT JOIN sales_receipts sr ON sr.id = srl.receipt_id
      WHERE i.id = ANY($1::int[])
        AND LOWER(srl.raw_item_name) != LOWER(i.canonical_name)
      GROUP BY srl.item_id, i.canonical_name, srl.raw_item_name
      ORDER BY srl.item_id, count DESC
    `

    // Get a sample of actual sales records
    const sampleSales = await sql`
      SELECT
        sr.receipt_date::text,
        sr.receipt_number,
        i.id as item_id,
        i.canonical_name as current_item_name,
        srl.raw_item_name as how_it_was_recorded,
        srl.quantity::numeric,
        srl.item_price::numeric,
        CASE WHEN sr.customer_name = 'Grony Multimedia as Customer' THEN 'GMC' ELSE 'WIC' END as sale_type
      FROM sales_receipt_lines srl
      JOIN sales_receipts sr ON sr.id = srl.receipt_id
      JOIN items i ON i.id = srl.item_id
      WHERE i.id = ANY($1::int[])
      ORDER BY sr.receipt_date DESC
      LIMIT 50
    `

    return Response.json({
      items,
      sales_summary: salesSummary,
      raw_name_mismatches: rawNamesMismatch,
      sample_sales: sampleSales,
      analysis: {
        total_passport_4x6_items: itemIds.length,
        items_with_mismatched_names: (rawNamesMismatch as any[]).length,
        total_mismatched_sales: (rawNamesMismatch as any[]).reduce((sum: number, r: any) => sum + r.count, 0),
      }
    }, { status: 200 })
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    console.error('[debug/passport-sales] Error:', error)
    return Response.json({ error, message: 'Database query failed' }, { status: 500 })
  }
}
