import sql from '@/lib/db'
import { ensureSalesAttachmentsColumn } from '@/lib/salesAttachments'
import { NextResponse, NextRequest } from 'next/server'
import { initializeDatabase } from '@/lib/dbInitialize'

export async function GET(req: NextRequest) {
  await initializeDatabase()
  await ensureSalesAttachmentsColumn()

  const url = new URL(req.url)
  const limit = Math.min(Number(url.searchParams.get('limit')) || 500, 2000)
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0)

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
      LIMIT ${limit}
      OFFSET ${offset}
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
      LIMIT ${limit}
      OFFSET ${offset}
    `
    return NextResponse.json(rows)
  }
}
