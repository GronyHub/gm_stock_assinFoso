import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { getCached } from '@/lib/cacheStore'
import { NextResponse } from 'next/server'

export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error

  try {
    const canSeeAmounts = isOwnerLevel(session?.user as any)
    const data = await getCached('analysis:summary', 300, () => computeSummary(canSeeAmounts))

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'max-age=600',
        'Neon-Caching-Control': 'max-age=600'
      }
    })
  } catch (e) {
    return handleError('analysis/summary', e)
  }
}

async function computeSummary(canSeeAmounts: boolean) {
  try {
    const [
      monthlyRevenue,
      dailyRevenue30,
      topItemsBySales,
      cashDiscrepancyTrend,
      monthlyBillSpend,
      topVendorsBySpend,
      topItemsByBillSpend,
      monthlyExpenses,
      expensesByCategory,
      topLossItems,
      stockValueByGroup,
      lowStockItems,
      countsPerMonth,
      mostCountedItems,
    ] = await Promise.all([
      // SALES ─────────────────────────────────────────────────────────────
      // Consolidate both New Sale (sales_receipts) and Live Sale (live_sale_taps)
      sql`
        SELECT
          to_char(month_date, 'YYYY-MM') AS month,
          SUM(CASE WHEN customer_type = 'wic' THEN amount ELSE 0 END) AS wic,
          SUM(CASE WHEN customer_type = 'gmc' THEN amount ELSE 0 END) AS gmc,
          SUM(amount) AS total
        FROM (
          SELECT to_char(sr.receipt_date, 'YYYY-MM') AS month_date,
            CASE WHEN sr.customer_name = 'Grony Multimedia as Customer' THEN 'gmc' ELSE 'wic' END AS customer_type,
            sr.total AS amount
          FROM sales_receipts sr
          WHERE sr.receipt_date IS NOT NULL
          UNION ALL
          SELECT to_char(lst.tapped_at::date, 'YYYY-MM') AS month_date, 'wic' AS customer_type,
            (lst.price::numeric * lst.quantity) AS amount
          FROM live_sale_taps lst
          WHERE lst.undone = false AND lst.tapped_at IS NOT NULL
        ) combined
        GROUP BY month_date ORDER BY month_date
      `,
      sql`
        SELECT date, SUM(total) AS total
        FROM (
          SELECT sr.receipt_date::date AS date, sr.total
          FROM sales_receipts sr
          WHERE sr.receipt_date >= CURRENT_DATE - INTERVAL '30 days'
          UNION ALL
          SELECT lst.tapped_at::date AS date, (lst.price::numeric * lst.quantity) AS total
          FROM live_sale_taps lst
          WHERE lst.undone = false AND lst.tapped_at >= CURRENT_DATE - INTERVAL '30 days'
        ) combined
        GROUP BY date ORDER BY date
      `,
      sql`
        SELECT item_name,
          SUM(qty) AS qty, SUM(revenue) AS revenue
        FROM (
          SELECT COALESCE(srl.resolved_name, srl.raw_item_name) AS item_name,
            SUM(srl.quantity) AS qty, SUM(srl.item_total) AS revenue
          FROM sales_receipt_lines srl
          WHERE srl.item_total IS NOT NULL
          GROUP BY COALESCE(srl.resolved_name, srl.raw_item_name)
          UNION ALL
          SELECT lst.item_name,
            SUM(lst.quantity) AS qty, SUM(lst.price::numeric * lst.quantity) AS revenue
          FROM live_sale_taps lst
          WHERE lst.undone = false
          GROUP BY lst.item_name
        ) combined
        GROUP BY item_name ORDER BY revenue DESC LIMIT 10
      `,
      sql`
        SELECT to_char(receipt_date, 'YYYY-MM') AS month,
          AVG(cash_counted - total) AS avg_discrepancy
        FROM sales_receipts
        WHERE cash_counted IS NOT NULL AND receipt_date IS NOT NULL
        GROUP BY 1 ORDER BY 1
      `,
      // BILLS ─────────────────────────────────────────────────────────────
      sql`
        SELECT to_char(bill_date, 'YYYY-MM') AS month, SUM(total) AS total
        FROM bills WHERE bill_date IS NOT NULL GROUP BY 1 ORDER BY 1
      `,
      sql`
        SELECT vendor_name, SUM(total) AS total
        FROM bills
        WHERE vendor_name IS NOT NULL
        GROUP BY 1 ORDER BY total DESC LIMIT 10
      `,
      sql`
        SELECT COALESCE(resolved_name, raw_item_name) AS item_name,
          SUM(quantity) AS qty, SUM(item_total) AS spend
        FROM bill_lines
        WHERE item_total IS NOT NULL
        GROUP BY 1 ORDER BY spend DESC LIMIT 10
      `,
      // EXPENSES ──────────────────────────────────────────────────────────
      // Salaries is a confidential category (owner/Joe only) -- excluded from
      // these aggregate totals for everyone else, matching the redaction
      // already applied in /api/expenses and /api/transactions.
      sql`
        SELECT to_char(expense_date, 'YYYY-MM') AS month, SUM(amount) AS total
        FROM expenses
        WHERE expense_date IS NOT NULL
          AND (${canSeeAmounts} OR COALESCE(cf_expense_type, 'Uncategorized') <> 'Salaries')
        GROUP BY 1 ORDER BY 1
      `,
      sql`
        SELECT COALESCE(cf_expense_type, 'Uncategorized') AS category, SUM(amount) AS total
        FROM expenses
        WHERE (${canSeeAmounts} OR COALESCE(cf_expense_type, 'Uncategorized') <> 'Salaries')
        GROUP BY 1 ORDER BY total DESC
      `,
      // ITEMS ─────────────────────────────────────────────────────────────
      sql`
        WITH daily_counts AS (
          SELECT item_id, count_date::date AS d, SUM(quantity_counted) AS qty_counted
          FROM stock_counts GROUP BY item_id, count_date::date
        ),
        daily_wic AS (
          SELECT srl.item_id, sr.receipt_date::date AS d, SUM(srl.quantity) AS qty
          FROM sales_receipt_lines srl JOIN sales_receipts sr ON sr.id = srl.receipt_id
          WHERE sr.customer_name IS DISTINCT FROM 'Grony Multimedia as Customer'
          GROUP BY srl.item_id, sr.receipt_date::date
        ),
        daily_gmc AS (
          SELECT srl.item_id, sr.receipt_date::date AS d, SUM(srl.quantity) AS qty
          FROM sales_receipt_lines srl JOIN sales_receipts sr ON sr.id = srl.receipt_id
          WHERE sr.customer_name = 'Grony Multimedia as Customer'
          GROUP BY srl.item_id, sr.receipt_date::date
        ),
        daily_bills AS (
          SELECT bl.item_id, b.bill_date::date AS d, SUM(bl.quantity) AS qty
          FROM bill_lines bl JOIN bills b ON b.id = bl.bill_id
          GROUP BY bl.item_id, b.bill_date::date
        ),
        all_dates AS (
          SELECT item_id, d FROM daily_counts
          UNION SELECT item_id, d FROM daily_wic
          UNION SELECT item_id, d FROM daily_gmc
          UNION SELECT item_id, d FROM daily_bills
        ),
        joined AS (
          SELECT ad.item_id, ad.d,
            dc.qty_counted, dw.qty AS wic_qty, dg.qty AS gmc_qty, db.qty AS bills_qty,
            LAG(dc.qty_counted) OVER (PARTITION BY ad.item_id ORDER BY ad.d) AS prev_count,
            LAG(ad.d) OVER (PARTITION BY ad.item_id ORDER BY ad.d) AS prev_date
          FROM all_dates ad
          LEFT JOIN daily_counts dc ON dc.item_id = ad.item_id AND dc.d = ad.d
          LEFT JOIN daily_wic dw ON dw.item_id = ad.item_id AND dw.d = ad.d
          LEFT JOIN daily_gmc dg ON dg.item_id = ad.item_id AND dg.d = ad.d
          LEFT JOIN daily_bills db ON db.item_id = ad.item_id AND db.d = ad.d
        ),
        with_loss AS (
          SELECT item_id,
            CASE WHEN qty_counted IS NOT NULL AND prev_count IS NOT NULL
              THEN (prev_count - COALESCE(wic_qty,0) - COALESCE(gmc_qty,0) + COALESCE(bills_qty,0)) - qty_counted
              ELSE NULL END AS loss
          FROM joined
        )
        SELECT i.canonical_name AS item_name, SUM(wl.loss) AS total_loss
        FROM with_loss wl
        JOIN items i ON i.id = wl.item_id
        WHERE wl.loss IS NOT NULL
        GROUP BY i.canonical_name
        HAVING SUM(wl.loss) > 0.01
        ORDER BY total_loss DESC LIMIT 10
      `,
      sql`
        SELECT COALESCE(i.cf_group, 'Ungrouped') AS cf_group,
          SUM(COALESCE(s.calculated_soh, 0) * COALESCE(i.purchase_rate, 0)) AS value
        FROM items i
        LEFT JOIN item_stock_summary s ON s.item_id = i.id
        WHERE i.status IS NULL OR LOWER(i.status) NOT IN ('inactive', 'service')
        GROUP BY 1 ORDER BY value DESC
      `,
      sql`
        SELECT i.canonical_name AS item_name, COALESCE(s.calculated_soh, 0) AS soh
        FROM items i
        LEFT JOIN item_stock_summary s ON s.item_id = i.id
        WHERE (i.status IS NULL OR LOWER(i.status) NOT IN ('inactive', 'service'))
          AND COALESCE(s.calculated_soh, 0) <= 0
        ORDER BY i.canonical_name LIMIT 30
      `,
      // COUNTS ────────────────────────────────────────────────────────────
      sql`
        SELECT to_char(count_date, 'YYYY-MM') AS month, COUNT(*) AS count
        FROM stock_counts WHERE count_date IS NOT NULL GROUP BY 1 ORDER BY 1
      `,
      sql`
        SELECT item_name, COUNT(*) AS times_counted
        FROM stock_counts
        GROUP BY item_name ORDER BY times_counted DESC LIMIT 10
      `,
    ])

    return {
      monthlyRevenue, dailyRevenue30, topItemsBySales, cashDiscrepancyTrend,
      monthlyBillSpend, topVendorsBySpend, topItemsByBillSpend,
      monthlyExpenses, expensesByCategory,
      topLossItems, stockValueByGroup, lowStockItems,
      countsPerMonth, mostCountedItems,
    }
  } catch (e) {
    console.error('analysis summary compute error:', e)
    throw e
  }
}
