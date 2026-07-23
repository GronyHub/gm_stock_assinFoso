import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const rows = await sql`
    SELECT b.id AS bill_id, b.bill_number, b.bill_date, b.vendor_name, b.total,
           bl.id AS line_id, bl.raw_item_name, bl.item_total, bl.item_id, bl.unresolved
    FROM bill_lines bl
    JOIN bills b ON b.id = bl.bill_id
    WHERE bl.item_id IS NULL OR bl.unresolved = true
    ORDER BY b.bill_date, b.id
  `
  const cols = await sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'items'
    ORDER BY ordinal_position
  `
  const existing = await sql`
    SELECT id, canonical_name, product_type, status FROM items
    WHERE canonical_name ILIKE '%unspecified%' OR canonical_name ILIKE '%placeholder%' OR canonical_name ILIKE '%misc%'
  `
  const sources = await sql`SELECT DISTINCT source, is_legacy, track_inventory, sellable, purchasable FROM items WHERE source != 'zoho_historical' LIMIT 20`
  return NextResponse.json({ count: rows.length, rows, itemsColumns: cols, existingPlaceholders: existing, nonZohoSources: sources })
}
