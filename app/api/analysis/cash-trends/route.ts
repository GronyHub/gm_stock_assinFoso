import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const [daily, monthly] = await Promise.all([
      sql`
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
      `,
      sql`
        SELECT
          to_char(receipt_date, 'YYYY-MM') AS month,
          COUNT(*) FILTER (WHERE customer_name IS DISTINCT FROM 'Grony Multimedia as Customer') AS walkin_count,
          COUNT(*) FILTER (WHERE customer_name IS DISTINCT FROM 'Grony Multimedia as Customer' AND cash_counted IS NOT NULL AND cash_counted <> 0) AS walkin_counted,
          SUM(cash_counted) FILTER (WHERE customer_name IS DISTINCT FROM 'Grony Multimedia as Customer') AS total_cash_counted,
          SUM(total) FILTER (WHERE customer_name IS DISTINCT FROM 'Grony Multimedia as Customer') AS total_invoiced,
          AVG(cash_counted - total) FILTER (WHERE customer_name IS DISTINCT FROM 'Grony Multimedia as Customer' AND cash_counted IS NOT NULL) AS avg_discrepancy
        FROM sales_receipts
        WHERE receipt_date >= '2023-11-06'
        GROUP BY 1 ORDER BY 1
      `,
    ])
    return success({ daily, monthly })
  } catch (e) {
    return handleError('analysis/cash-trends', e)
  }
}
