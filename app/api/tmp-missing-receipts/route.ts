import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const rows = await sql`
      SELECT id, receipt_number, receipt_date::date AS receipt_date, customer_name,
             COALESCE(jsonb_array_length(attachments), 0) AS attachment_count
      FROM sales_receipts
      WHERE (customer_name IS NULL OR customer_name ILIKE '%walk%' OR customer_name ILIKE '%wic%')
        AND receipt_date >= '2025-10-01' AND receipt_date < '2026-07-01'
      ORDER BY receipt_date
    `
    return NextResponse.json(rows)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
