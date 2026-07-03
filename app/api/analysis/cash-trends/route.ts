import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // WIC = any real customer sale, i.e. everything except GMC (internal use,
    // customer_name = 'Grony Multimedia as Customer') -- same classification
    // used everywhere else in the app (monthly revenue, dup-receipts, losses).
    const rows = await sql`
      SELECT
        receipt_date::date AS day,
        COUNT(*) FILTER (WHERE customer_name IS DISTINCT FROM 'Grony Multimedia as Customer') AS walkin_count,
        COUNT(*) FILTER (WHERE customer_name IS DISTINCT FROM 'Grony Multimedia as Customer' AND cash_counted IS NOT NULL AND cash_counted <> 0) AS walkin_counted,
        SUM(cash_counted) FILTER (WHERE customer_name IS DISTINCT FROM 'Grony Multimedia as Customer') AS total_cash_counted,
        SUM(total) FILTER (WHERE customer_name IS DISTINCT FROM 'Grony Multimedia as Customer') AS total_invoiced,
        AVG(cash_counted - total) FILTER (WHERE customer_name IS DISTINCT FROM 'Grony Multimedia as Customer' AND cash_counted IS NOT NULL) AS avg_discrepancy
      FROM sales_receipts
      WHERE receipt_date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY 1 ORDER BY 1
    `
    return NextResponse.json(rows)
  } catch (e) {
    console.error('cash trends error:', e)
    return NextResponse.json({ error: 'Failed to load cash trends' }, { status: 500 })
  }
}
