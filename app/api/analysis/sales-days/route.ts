import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { NextRequest } from 'next/server'

// Read-only day and month totals from the day receipts (sales_receipts), the whole history back to 2023 --
// replaces the old Sales Rec / Summary screen, which let these records be edited and drift from the Sales Log.
// GMC (internal use, customer 'Grony Multimedia as Customer') is kept apart from sales. WNW only counts days
// whose cash was counted, so an uncounted day doesn't show as a huge shortfall.
// GET            -> { months: [...] }   one row per month, newest first
// GET ?month=YYYY-MM -> { days: [...] } one row per day of that month
// GET ?day=YYYY-MM-DD  -> { lines: [...] } what was sold that day (item, qty, price, amount, who), read-only
const GMC = 'Grony Multimedia as Customer'

export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error
  try {
    const day = req.nextUrl.searchParams.get('day')
    if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
      const lines = await sql`
        SELECT l.id, COALESCE(l.resolved_name, l.raw_item_name, '?') AS item, l.quantity, l.item_price, l.item_total,
               (r.customer_name = ${GMC}) AS is_gmc, r.customer_name
        FROM sales_receipts r JOIN sales_receipt_lines l ON l.receipt_id = r.id
        WHERE r.receipt_date::date = ${day}
        ORDER BY (r.customer_name = ${GMC}) NULLS FIRST, r.id, l.id`
      return success({ lines })
    }
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
