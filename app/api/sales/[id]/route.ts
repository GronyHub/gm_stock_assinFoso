import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const lines = await sql`
    SELECT
      id,
      COALESCE(resolved_name, raw_item_name) AS item_name,
      quantity,
      item_price,
      item_total,
      usage_unit
    FROM sales_receipt_lines
    WHERE receipt_id = ${Number(id)}
    ORDER BY id
  `
  return NextResponse.json(lines)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { receipt_date, customer_name, invoice_amount, cash_counted } = await req.json()

  const [row] = await sql`
    UPDATE sales_receipts SET
      receipt_date  = COALESCE(${receipt_date  ?? null}::date, receipt_date),
      customer_name = COALESCE(${customer_name ?? null}, customer_name),
      total         = COALESCE(${invoice_amount ?? null}, total),
      cash_counted  = ${cash_counted ?? null}
    WHERE id = ${Number(id)}
    RETURNING id, receipt_date::date AS receipt_date, customer_name, total AS invoice_amount, cash_counted,
              (cash_counted - total) AS wnw
  `
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}
