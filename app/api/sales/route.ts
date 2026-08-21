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
        (cash_counted - total) AS wnw
      FROM sales_receipts
      ORDER BY receipt_date DESC, id DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `
    // Add optional columns if they exist
    const withOptional = rows.map((r: any) => ({
      ...r,
      entered_by: r.entered_by || null,
      attachments: r.attachments || []
    }))
    return NextResponse.json(withOptional)
  } catch (e) {
    console.error('sales/route.ts GET error:', e instanceof Error ? e.message : String(e))
    // Fallback without entered_by in case column missing
    try {
      const rows = await sql`
        SELECT
          id,
          receipt_number,
          receipt_date::date AS receipt_date,
          customer_name,
          total AS invoice_amount,
          cash_counted,
          (cash_counted - total) AS wnw
        FROM sales_receipts
        ORDER BY receipt_date DESC, id DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `
      console.log('sales/route.ts fallback returned', rows.length, 'rows')
      const withOptional = rows.map((r: any) => ({
        ...r,
        entered_by: null,
        attachments: []
      }))
      return NextResponse.json(withOptional)
    } catch (e2) {
      console.error('sales/route.ts fallback error:', e2 instanceof Error ? e2.message : String(e2))
      return NextResponse.json([])
    }
  }
}
