import sql from '@/lib/db'
import { NextResponse } from 'next/server'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export async function GET() {
  const out: Record<string, unknown> = {}

  // 1. Migration check
  try {
    out.tapsTableCols = await sql`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns WHERE table_name = 'live_sale_taps'
      ORDER BY ordinal_position
    `
    out.existingTapsQuantitySample = await sql`
      SELECT id, item_name, quantity, undone, tapped_at FROM live_sale_taps ORDER BY tapped_at DESC LIMIT 10
    `
    out.anyNonOneQuantityBeforeToday = await sql`
      SELECT COUNT(*)::int AS n FROM live_sale_taps WHERE quantity IS DISTINCT FROM 1 AND tapped_at::date < ${todayStr()}
    `
  } catch (e) { out.migrationError = String(e) }

  // 2. product_type distribution + a goods and a service example
  try {
    out.productTypeBreakdown = await sql`
      SELECT COALESCE(product_type, 'NULL') AS product_type, COUNT(*)::int AS n
      FROM active_items GROUP BY COALESCE(product_type, 'NULL') ORDER BY n DESC
    `
    out.sampleGoodsItem = await sql`
      SELECT id, canonical_name, product_type, selling_rate FROM active_items
      WHERE COALESCE(product_type,'goods') = 'goods' AND selling_rate > 0 LIMIT 1
    `
    out.sampleServiceItem = await sql`
      SELECT id, canonical_name, product_type, selling_rate FROM active_items
      WHERE product_type = 'service' AND canonical_name ILIKE 'Service -%' AND selling_rate > 0 LIMIT 1
    `
    out.sampleNullProductTypeItem = await sql`
      SELECT id, canonical_name, product_type, selling_rate FROM active_items
      WHERE product_type IS NULL AND selling_rate > 0 LIMIT 1
    `
  } catch (e) { out.itemsError = String(e) }

  // 3. Today's WIC receipt state before any test
  try {
    out.todaysReceiptBefore = await sql`
      SELECT id, receipt_number, total FROM sales_receipts
      WHERE receipt_date::date = ${todayStr()} AND customer_name IS DISTINCT FROM 'Grony Multimedia as Customer'
    `
  } catch (e) { out.receiptCheckError = String(e) }

  return NextResponse.json(out)
}
