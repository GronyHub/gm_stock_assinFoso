import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { lines } = await req.json()
  // lines: [{ id, item_name, quantity, item_price }]
  for (const line of lines) {
    const total = parseFloat(line.quantity) * parseFloat(line.item_price)
    await sql`
      UPDATE sales_receipt_lines
      SET raw_item_name = ${line.item_name},
          resolved_name = ${line.item_name},
          quantity      = ${parseFloat(line.quantity)},
          item_price    = ${parseFloat(line.item_price)},
          item_total    = ${total}
      WHERE id = ${line.id} AND receipt_id = ${Number(id)}
    `
  }
  // Recalculate receipt total from lines
  await sql`
    UPDATE sales_receipts
    SET total = (SELECT COALESCE(SUM(item_total),0) FROM sales_receipt_lines WHERE receipt_id = ${Number(id)})
    WHERE id = ${Number(id)}
  `
  const updated = await sql`
    SELECT id, receipt_date::date AS receipt_date, customer_name, total AS invoice_amount, cash_counted,
           (cash_counted - total) AS wnw
    FROM sales_receipts WHERE id = ${Number(id)}
  `
  return NextResponse.json(updated[0])
}
