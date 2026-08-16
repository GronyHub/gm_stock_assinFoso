import sql from '@/lib/db'
import { ensureSalesAttachmentsColumn } from '@/lib/salesAttachments'
import { NextResponse } from 'next/server'
import { initializeDatabase } from '@/lib/dbInitialize'

export async function GET() {
  await initializeDatabase()
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
        COALESCE(attachments, '[]'::jsonb) AS attachments,
        'sales_receipt' AS source
      FROM sales_receipts
      UNION ALL
      SELECT
        -id AS id,
        'LIVE-' || id::text AS receipt_number,
        tapped_at::date AS receipt_date,
        NULL AS customer_name,
        SUM(price::numeric * quantity) AS invoice_amount,
        NULL AS cash_counted,
        NULL AS wnw,
        staff_name AS entered_by,
        '[]'::jsonb AS attachments,
        'live_sale_taps' AS source
      FROM live_sale_taps
      WHERE undone = false
      GROUP BY tapped_at::date, id, staff_name
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
        COALESCE(attachments, '[]'::jsonb) AS attachments,
        'sales_receipt' AS source
      FROM sales_receipts
      UNION ALL
      SELECT
        -id AS id,
        'LIVE-' || id::text AS receipt_number,
        tapped_at::date AS receipt_date,
        NULL AS customer_name,
        SUM(price::numeric * quantity) AS invoice_amount,
        NULL AS cash_counted,
        NULL AS wnw,
        staff_name AS entered_by,
        '[]'::jsonb AS attachments,
        'live_sale_taps' AS source
      FROM live_sale_taps
      WHERE undone = false
      GROUP BY tapped_at::date, id, staff_name
      ORDER BY receipt_date DESC, id DESC
    `
    return NextResponse.json(rows)
  }
}
