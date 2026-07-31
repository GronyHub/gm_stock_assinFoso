import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const items = await sql`SELECT id, canonical_name, status, cf_group, product_type, selling_rate, purchase_rate FROM items WHERE id IN (3, 9)`
  const alias = await sql`SELECT * FROM item_aliases WHERE id = 61`
  const item3Aliases = await sql`SELECT id, alias_name, alias_type, source FROM item_aliases WHERE item_id = 3`
  const item9Aliases = await sql`SELECT id, alias_name, alias_type, source FROM item_aliases WHERE item_id = 9`
  const item3Sales = await sql`SELECT COUNT(*), COALESCE(SUM(quantity),0) AS qty FROM sales_receipt_lines WHERE item_id = 3`
  const item9Sales = await sql`SELECT COUNT(*), COALESCE(SUM(quantity),0) AS qty FROM sales_receipt_lines WHERE item_id = 9`
  // Lines actually resolved via the raw text "A3 210 grams" specifically
  const linesViaAliasText = await sql`
    SELECT id, receipt_id, item_id, raw_item_name, resolved_name, quantity, item_total
    FROM sales_receipt_lines WHERE raw_item_name ILIKE '%A3 210%' OR resolved_name ILIKE '%A3 210%'
    ORDER BY id DESC LIMIT 20
  `
  return NextResponse.json({ items, alias, item3Aliases, item9Aliases, item3Sales: item3Sales[0], item9Sales: item9Sales[0], linesViaAliasText })
}
