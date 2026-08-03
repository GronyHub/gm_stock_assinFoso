import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Walk-In (W) receipts only -- customer_name null or containing
    // walk/wic, same rule BulkAttachForms.tsx already uses -- grouped by
    // month so the real remaining gap (not just July) is visible before
    // downloading/uploading anything.
    const summary = await sql`
      SELECT to_char(receipt_date, 'YYYY-MM') AS month,
             COUNT(*)::int AS total_w_receipts,
             COUNT(*) FILTER (WHERE COALESCE(jsonb_array_length(attachments), 0) = 0)::int AS missing_attachment
      FROM sales_receipts
      WHERE customer_name IS NULL OR customer_name ILIKE '%walk%' OR customer_name ILIKE '%wic%'
      GROUP BY 1
      ORDER BY 1
    `
    const missingDetail = await sql`
      SELECT id, receipt_number, receipt_date::date AS receipt_date, customer_name
      FROM sales_receipts
      WHERE (customer_name IS NULL OR customer_name ILIKE '%walk%' OR customer_name ILIKE '%wic%')
        AND COALESCE(jsonb_array_length(attachments), 0) = 0
      ORDER BY receipt_date
    `
    return NextResponse.json({ summary, missingDetail })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
