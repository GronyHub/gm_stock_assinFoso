import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Get the target item ID for "Passport Picture"
    const [ppService] = await sql`
      SELECT id, canonical_name, converts_to_item_id
      FROM items
      WHERE canonical_name = 'Passport Picture'
        AND gmc_type = 'service_using_gmc'
    `

    if (!ppService) {
      return NextResponse.json({ error: 'Passport Picture service not found' }, { status: 404 })
    }

    const [targetItem] = await sql`
      SELECT id, canonical_name FROM items WHERE id = ${ppService.converts_to_item_id}
    `

    if (!targetItem) {
      return NextResponse.json({ error: 'Target item not found' }, { status: 404 })
    }

    // Get all sales for the target item (these are the transferred sales)
    const sales = await sql`
      SELECT
        srl.id,
        srl.receipt_id,
        srl.item_id,
        srl.resolved_name,
        srl.qty,
        srl.unit_price,
        srl.line_total,
        srl.created_at,
        sr.receipt_date,
        sr.customer_name,
        sr.notes
      FROM sales_receipt_lines srl
      JOIN sales_receipts sr ON srl.receipt_id = sr.id
      WHERE srl.item_id = ${targetItem.id}
      ORDER BY sr.receipt_date DESC
      LIMIT 50
    `

    return NextResponse.json({
      transferred_from: ppService.canonical_name,
      transferred_to: targetItem.canonical_name,
      total_sales_lines: sales.length,
      sales: sales.map(s => ({
        id: s.id,
        receipt_id: s.receipt_id,
        date: s.receipt_date,
        customer: s.customer_name,
        qty: s.qty,
        unit_price: s.unit_price,
        line_total: s.line_total,
        notes: s.notes,
      })),
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
