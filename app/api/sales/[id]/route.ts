import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const lines = await sql`
    SELECT
      id,
      receipt_id,
      item_id,
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

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const receiptId = Number(id)

  try {
    const [receipt] = await sql`SELECT receipt_number, total FROM sales_receipts WHERE id = ${receiptId}`
    if (!receipt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await sql`DELETE FROM sales_receipt_lines WHERE receipt_id = ${receiptId}`
    await sql`DELETE FROM sales_receipts WHERE id = ${receiptId}`

    const actor = (session.user as any)?.username || session.user?.name || 'Unknown'
    await logActivity(actor, 'deleted sale receipt', `${receipt.receipt_number} · ₵${Number(receipt.total).toFixed(2)}`)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('sales receipt DELETE error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not delete receipt: ${detail}` }, { status: 500 })
  }
}
