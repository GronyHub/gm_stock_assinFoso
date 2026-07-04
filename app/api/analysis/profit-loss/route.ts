import sql from '@/lib/db'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isOwnerLevel } from '@/lib/roles'

// Profit / Loss = all cash counted − all expenses − all bills. This includes
// the confidential Salaries expense category, so the whole endpoint is
// owner-level only (same gate as payslip confirmation).
export async function GET() {
  const session = await auth()
  if (!isOwnerLevel(session?.user as any)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const [cashTotal, expenseTotal, billTotal, cashMonthly, expenseMonthly, billMonthly] = await Promise.all([
      sql`SELECT COALESCE(SUM(cash_counted), 0) AS total FROM sales_receipts`,
      sql`SELECT COALESCE(SUM(amount), 0) AS total FROM expenses`,
      sql`SELECT COALESCE(SUM(total), 0) AS total FROM bills`,
      sql`
        SELECT to_char(receipt_date, 'YYYY-MM') AS month, COALESCE(SUM(cash_counted), 0) AS total
        FROM sales_receipts WHERE receipt_date IS NOT NULL GROUP BY 1 ORDER BY 1
      `,
      sql`
        SELECT to_char(expense_date, 'YYYY-MM') AS month, COALESCE(SUM(amount), 0) AS total
        FROM expenses WHERE expense_date IS NOT NULL GROUP BY 1 ORDER BY 1
      `,
      sql`
        SELECT to_char(bill_date, 'YYYY-MM') AS month, COALESCE(SUM(total), 0) AS total
        FROM bills WHERE bill_date IS NOT NULL GROUP BY 1 ORDER BY 1
      `,
    ])

    const cashCounted = Number(cashTotal[0]?.total ?? 0)
    const expenses = Number(expenseTotal[0]?.total ?? 0)
    const bills = Number(billTotal[0]?.total ?? 0)

    const cashMap = Object.fromEntries(cashMonthly.map((r: any) => [r.month, Number(r.total)]))
    const expenseMap = Object.fromEntries(expenseMonthly.map((r: any) => [r.month, Number(r.total)]))
    const billMap = Object.fromEntries(billMonthly.map((r: any) => [r.month, Number(r.total)]))

    const months = Array.from(new Set([
      ...cashMonthly.map((r: any) => r.month as string),
      ...expenseMonthly.map((r: any) => r.month as string),
      ...billMonthly.map((r: any) => r.month as string),
    ])).sort()

    const monthly = months.map(month => {
      const cash = cashMap[month] ?? 0
      const exp = expenseMap[month] ?? 0
      const bl = billMap[month] ?? 0
      return { month, cashCounted: cash, expenses: exp, bills: bl, profit: cash - exp - bl }
    })

    return NextResponse.json({
      totals: { cashCounted, expenses, bills, profit: cashCounted - expenses - bills },
      monthly,
    })
  } catch (e) {
    console.error('profit-loss error:', e)
    return NextResponse.json({ error: 'Failed to load profit & loss' }, { status: 500 })
  }
}
