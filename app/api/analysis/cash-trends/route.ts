import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Walk-in receipts created through the app store customer_name as NULL --
    // "Walk-in Customer" is only a display fallback, never the literal saved
    // value. Older/imported rows may still have the literal string, so match
    // both instead of just the string (which matched zero real rows).
    const rows = await sql`
      SELECT
        to_char(receipt_date, 'YYYY-MM') AS month,
        COUNT(*) FILTER (WHERE customer_name IS NULL OR LOWER(TRIM(customer_name)) = 'walk in customer') AS walkin_count,
        COUNT(*) FILTER (WHERE (customer_name IS NULL OR LOWER(TRIM(customer_name)) = 'walk in customer') AND cash_counted IS NOT NULL AND cash_counted <> 0) AS walkin_counted,
        SUM(cash_counted) FILTER (WHERE customer_name IS NULL OR LOWER(TRIM(customer_name)) = 'walk in customer') AS total_cash_counted,
        SUM(total) FILTER (WHERE customer_name IS NULL OR LOWER(TRIM(customer_name)) = 'walk in customer') AS total_invoiced,
        AVG(cash_counted - total) FILTER (WHERE (customer_name IS NULL OR LOWER(TRIM(customer_name)) = 'walk in customer') AND cash_counted IS NOT NULL) AS avg_discrepancy
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
