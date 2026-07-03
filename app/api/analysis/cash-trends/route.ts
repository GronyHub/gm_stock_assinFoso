import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const rows = await sql`
      SELECT
        to_char(receipt_date, 'YYYY-MM') AS month,
        COUNT(*) FILTER (WHERE LOWER(TRIM(customer_name)) = 'walk in customer') AS walkin_count,
        COUNT(*) FILTER (WHERE LOWER(TRIM(customer_name)) = 'walk in customer' AND cash_counted IS NOT NULL AND cash_counted <> 0) AS walkin_counted,
        SUM(cash_counted) FILTER (WHERE LOWER(TRIM(customer_name)) = 'walk in customer') AS total_cash_counted,
        SUM(total) FILTER (WHERE LOWER(TRIM(customer_name)) = 'walk in customer') AS total_invoiced,
        AVG(cash_counted - total) FILTER (WHERE LOWER(TRIM(customer_name)) = 'walk in customer' AND cash_counted IS NOT NULL) AS avg_discrepancy
      FROM sales_receipts
      WHERE receipt_date IS NOT NULL
      GROUP BY 1 ORDER BY 1
    `
    return NextResponse.json(rows)
  } catch (e) {
    console.error('cash trends error:', e)
    return NextResponse.json({ error: 'Failed to load cash trends' }, { status: 500 })
  }
}
