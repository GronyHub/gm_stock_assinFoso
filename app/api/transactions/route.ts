import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json([], { status: 401 })

    const results: any[] = []

    // Bills
    try {
      const rows = await sql`
        SELECT 'bill' AS type, id, bill_date::text AS date,
               vendor_name AS description, total::text AS total,
               bill_number AS ref
        FROM bills ORDER BY bill_date DESC, id DESC LIMIT 300
      `
      results.push(...rows)
    } catch {}

    // Sales
    try {
      const rows = await sql`
        SELECT 'sale' AS type, id, receipt_date::text AS date,
               customer_name AS description, total::text AS total,
               receipt_number AS ref
        FROM sales_receipts ORDER BY receipt_date DESC, id DESC LIMIT 300
      `
      results.push(...rows)
    } catch {}

    // Counts (grouped by date + person)
    try {
      const rows = await sql`
        SELECT 'count' AS type, MIN(id) AS id, count_date::text AS date,
               COALESCE(counted_by, 'Unknown') AS description,
               NULL AS total, NULL AS ref,
               COUNT(*)::int AS item_count, counted_by AS by
        FROM stock_counts
        GROUP BY count_date, counted_by
        ORDER BY count_date DESC LIMIT 200
      `
      results.push(...rows)
    } catch {}

    // Expenses
    try {
      const rows = await sql`
        SELECT 'expense' AS type, id, expense_date::text AS date,
               COALESCE(expense_account, 'Expense') AS description,
               amount::text AS total, NULL AS ref
        FROM expenses ORDER BY expense_date DESC, id DESC LIMIT 200
      `
      results.push(...rows)
    } catch {}

    // Sort by date desc, id desc
    results.sort((a, b) => {
      const d = String(b.date ?? '').localeCompare(String(a.date ?? ''))
      if (d !== 0) return d
      return Number(b.id ?? 0) - Number(a.id ?? 0)
    })

    return NextResponse.json(results)
  } catch (e) {
    console.error('transactions route error:', e)
    return NextResponse.json([])
  }
}
