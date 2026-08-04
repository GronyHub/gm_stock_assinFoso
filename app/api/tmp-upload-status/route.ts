import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// Read-only: how many of the target receipts (Oct 2025 - June 2026 matched
// set) currently have at least one attachment, so we know exactly where the
// stopped batch runs left off.
export async function GET() {
  const rows = await sql`
    SELECT id, receipt_number, receipt_date::date AS receipt_date,
      COALESCE(jsonb_array_length(attachments), 0) AS attachment_count
    FROM sales_receipts
    WHERE receipt_date >= '2025-10-01' AND receipt_date < '2026-07-01'
    ORDER BY receipt_date
  `
  const withAttachments = rows.filter((r: any) => r.attachment_count > 0)
  return NextResponse.json({
    totalReceiptsInRange: rows.length,
    receiptsWithAttachments: withAttachments.length,
    totalAttachmentCount: withAttachments.reduce((s: number, r: any) => s + r.attachment_count, 0),
  })
}
