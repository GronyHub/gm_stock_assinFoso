import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { NextRequest } from 'next/server'

// Read-only day and month totals from the day receipts (sales_receipts), the whole history back to 2023 --
// replaces the old Sales Rec / Summary screen, which let these records be edited and drift from the Sales Log.
// GMC (internal use, customer 'Grony Multimedia as Customer') is kept apart from sales. WNW only counts days
// whose cash was counted, so an uncounted day doesn't show as a huge shortfall.
// GET            -> { months: [...] }   one row per month, newest first
// GET ?month=YYYY-MM -> { days: [...] } one row per day of that month
const GMC = 'Grony Multimedia as Customer'

export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error
  try {
    const month = req.nextUrl.searchParams.get('month')
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const days = await sql`
        WITH d AS (
          SELECT receipt_date::date AS day,
                 SUM(total) FILTER (WHERE customer_name IS DISTINCT FROM ${GMC}) AS sales,
                 SUM(total) FILTER (WHERE customer_name = ${GMC}) AS gmc,
                 SUM(cash_counted) AS cc,
                 SUM(total) FILTER (WHERE customer_name IS DISTINCT FROM ${GMC} AND cash_counted IS NOT NULL) AS counted_sales
          FROM sales_receipts
          WHERE to_char(receipt_date, 'YYYY-MM') = ${month}
          GROUP BY 1
        )
        SELECT day::text AS day, COALESCE(sales, 0) AS sales, COALESCE(gmc, 0) AS gmc, cc,
               CASE WHEN cc IS NULL THEN NULL ELSE cc - COALESCE(counted_sales, 0) END AS wnw
        FROM d ORDER BY day DESC`
      return success({ days })
    }
    const months = await sql`
      SELECT to_char(receipt_date, 'YYYY-MM') AS month,
             COALESCE(SUM(total) FILTER (WHERE customer_name IS DISTINCT FROM ${GMC}), 0) AS sales,
             COALESCE(SUM(total) FILTER (WHERE customer_name = ${GMC}), 0) AS gmc,
             SUM(cash_counted) AS cc,
             SUM(cash_counted) - SUM(total) FILTER (WHERE customer_name IS DISTINCT FROM ${GMC} AND cash_counted IS NOT NULL) AS wnw,
             COUNT(DISTINCT receipt_date::date) AS days,
             COUNT(DISTINCT receipt_date::date) FILTER (WHERE cash_counted IS NOT NULL) AS days_counted
      FROM sales_receipts
      GROUP BY 1 ORDER BY 1 DESC`
    return success({ months })
  } catch (e) {
    return handleError('analysis/sales-days', e)
  }
}
