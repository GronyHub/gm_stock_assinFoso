import { requireAuth, getActorName, notFound, success, handleError } from '@/lib/api'
import { getIdParam } from '@/lib/api/params'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { ensureSalesAttachmentsColumn, normalizeAttachments } from '@/lib/salesAttachments'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const receiptId = await getIdParam(params)
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
    WHERE receipt_id = ${receiptId}
    ORDER BY id
  `
  return success(lines)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const receiptId = await getIdParam(params)
  const { receipt_date, customer_name, invoice_amount, cash_counted, attachments } = await req.json()
  const attachmentsJson = attachments !== undefined ? JSON.stringify(normalizeAttachments(attachments)) : null

  try {
    await ensureSalesAttachmentsColumn()

    const [row] = await sql`
      UPDATE sales_receipts SET
        receipt_date  = COALESCE(${receipt_date  ?? null}::date, receipt_date),
        customer_name = COALESCE(${customer_name ?? null}, customer_name),
        total         = COALESCE(${invoice_amount ?? null}, total),
        cash_counted  = COALESCE(${cash_counted ?? null}, cash_counted),
        attachments   = COALESCE(${attachmentsJson}::jsonb, attachments)
      WHERE id = ${receiptId}
      RETURNING id, receipt_date::date AS receipt_date, customer_name, total AS invoice_amount, cash_counted,
                (cash_counted - total) AS wnw, COALESCE(attachments, '[]'::jsonb) AS attachments
    `
    if (!row) return notFound()
    return success(row)
  } catch (e) {
    return handleError('sales receipt PUT', e)
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth()
  if (error) return error

  const receiptId = await getIdParam(params)

  try {
    const [receipt] = await sql`SELECT receipt_number, total FROM sales_receipts WHERE id = ${receiptId}`
    if (!receipt) return notFound()

    await sql`DELETE FROM sales_receipt_lines WHERE receipt_id = ${receiptId}`
    await sql`DELETE FROM sales_receipts WHERE id = ${receiptId}`

    const actor = getActorName(session)
    await logActivity(actor, 'deleted sale receipt', `${receipt.receipt_number} · ₵${Number(receipt.total).toFixed(2)}`)

    return success({ ok: true })
  } catch (e) {
    return handleError('sales receipt DELETE', e)
  }
}
