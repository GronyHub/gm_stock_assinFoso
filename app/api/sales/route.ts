import { success } from '@/lib/api'
import sql from '@/lib/db'
import { ensureSalesAttachmentsColumn } from '@/lib/salesAttachments'
import { NextRequest } from 'next/server'
import { ensureDbInitialized } from '@/lib/api/dbInitCache'

export async function GET(req: NextRequest) {
  await ensureDbInitialized()
  await ensureSalesAttachmentsColumn()

  const url = new URL(req.url)
  // SalesTab fetches this with no limit/offset -- it wants every receipt
  // (it derives its year filter and history from the full list), so a low
  // default silently hid everything older than the cap. Only an explicit
  // ?limit caps the result now.
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50000, 50000)
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
    if (rows.length === limit) {
      console.warn(`sales: hit the ${limit}-row cap -- results may be truncated, raise the cap`)
    }
    // Add optional columns if they exist
    const withOptional = rows.map((r: any) => ({
      ...r,
      entered_by: r.entered_by || null,
      attachments: r.attachments || []
    }))
    return success(withOptional)
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
      return success(withOptional)
    } catch (e2) {
      console.error('sales/route.ts fallback error:', e2 instanceof Error ? e2.message : String(e2))
      return success([])
    }
  }
}
