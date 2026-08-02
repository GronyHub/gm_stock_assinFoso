import sql from '@/lib/db'
import { ensureSalesAttachmentsColumn } from '@/lib/salesAttachments'
import { NextResponse } from 'next/server'

export async function GET() {
  await ensureSalesAttachmentsColumn()
  try {
    const rows = await sql`
      SELECT
        id,
        receipt_number,
        receipt_date::date AS receipt_date,
        customer_name,
        total AS invoice_amount,
        cash_counted,
        (cash_counted - total) AS wnw,
        entered_by,
        COALESCE(attachments, '[]'::jsonb) AS attachments
      FROM sales_receipts
      ORDER BY receipt_date DESC, id DESC
    `
    return NextResponse.json(rows)
  } catch {
    // Fallback without entered_by in case column missing
    const rows = await sql`
      SELECT
        id,
        receipt_number,
        receipt_date::date AS receipt_date,
        customer_name,
        total AS invoice_amount,
        cash_counted,
        (cash_counted - total) AS wnw,
        NULL AS entered_by,
        COALESCE(attachments, '[]'::jsonb) AS attachments
      FROM sales_receipts
      ORDER BY receipt_date DESC, id DESC
    `
    return NextResponse.json(rows)
  }
}
