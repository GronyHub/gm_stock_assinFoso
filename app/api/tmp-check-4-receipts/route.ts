import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const rows = await sql`
    SELECT il.id AS line_id, il.raw_item_name, il.resolved_name, il.item_id, il.unresolved,
      il.quantity, il.item_price, il.item_total,
      i.id AS invoice_id, i.invoice_number, i.invoice_date::date AS invoice_date,
      i.customer_name, i.document_type
    FROM invoice_lines il
    JOIN invoices i ON i.id = il.invoice_id
    WHERE il.item_id IS NULL OR il.unresolved = true
    ORDER BY i.invoice_date DESC
  `
  return NextResponse.json(rows)
}
