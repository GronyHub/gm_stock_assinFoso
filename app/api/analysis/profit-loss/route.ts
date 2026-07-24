import sql from '@/lib/db'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isOwnerLevel } from '@/lib/roles'
import { computeLossEvents } from '@/lib/lossEvents'

// Profit / Loss = cash counted − (bills + expenses + stock loss). Stock loss
// is the same ₵ valuation used by the Daily Loss feed and the Items list's
// Loss Amount column (shrinkage the cash-flow numbers alone don't capture).
// This includes the confidential Salaries expense category, so the whole
// endpoint is owner-level only (same gate as payslip confirmation).
export async function GET() {
  const session = await auth()
  if (!isOwnerLevel(session?.user as any)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const [cashDaily, expenseDaily, billDaily, lossEvents] = await Promise.all([
      sql`
        SELECT receipt_date::date::text AS date, COALESCE(SUM(cash_counted), 0) AS total
        FROM sales_receipts WHERE receipt_date IS NOT NULL GROUP BY 1
      `,
      sql`
        SELECT expense_date::date::text AS date, COALESCE(SUM(amount), 0) AS total
        FROM expenses WHERE expense_date IS NOT NULL GROUP BY 1
      `,
      sql`
        SELECT bill_date::date::text AS date, COALESCE(SUM(total), 0) AS total
        FROM bills WHERE bill_date IS NOT NULL GROUP BY 1
      `,
      computeLossEvents(),
    ])

    const cashMap = Object.fromEntries(cashDaily.map((r: any) => [r.date, Number(r.total)]))
    const expenseMap = Object.fromEntries(expenseDaily.map((r: any) => [r.date, Number(r.total)]))
    const billMap = Object.fromEntries(billDaily.map((r: any) => [r.date, Number(r.total)]))

    const lossMap: Record<string, number> = {}
    for (const e of lossEvents) {
      if (e.kind !== 'loss') continue
      lossMap[e.date] = (lossMap[e.date] ?? 0) + e.loss_amt
    }

    const dates = Array.from(new Set([
      ...Object.keys(cashMap), ...Object.keys(expenseMap), ...Object.keys(billMap), ...Object.keys(lossMap),
    ])).sort().reverse()

    const daily = dates.map(date => {
      const cashCounted = cashMap[date] ?? 0
      const bills = billMap[date] ?? 0
      const expenses = expenseMap[date] ?? 0
      const dailyLoss = parseFloat((lossMap[date] ?? 0).toFixed(2))
      const cashOut = bills + expenses
      return { date, cashCounted, bills, expenses, cashOut, dailyLoss, profit: cashCounted - cashOut - dailyLoss }
    })

    const cashCounted = daily.reduce((s, d) => s + d.cashCounted, 0)
    const expenses = daily.reduce((s, d) => s + d.expenses, 0)
    const bills = daily.reduce((s, d) => s + d.bills, 0)
    const totalLoss = parseFloat(daily.reduce((s, d) => s + d.dailyLoss, 0).toFixed(2))

    const monthlyMap = new Map<string, { cashCounted: number; expenses: number; bills: number; dailyLoss: number }>()
    for (const d of daily) {
      const month = d.date.slice(0, 7)
      const m = monthlyMap.get(month) ?? { cashCounted: 0, expenses: 0, bills: 0, dailyLoss: 0 }
      m.cashCounted += d.cashCounted
      m.expenses += d.expenses
      m.bills += d.bills
      m.dailyLoss += d.dailyLoss
      monthlyMap.set(month, m)
    }
    const monthly = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, m]) => ({
        month, cashCounted: m.cashCounted, expenses: m.expenses, bills: m.bills, dailyLoss: m.dailyLoss,
        profit: m.cashCounted - m.expenses - m.bills - m.dailyLoss,
      }))

    return NextResponse.json({
      totals: { cashCounted, expenses, bills, dailyLoss: totalLoss, profit: cashCounted - expenses - bills - totalLoss },
      monthly,
      daily,
    })
  } catch (e) {
    console.error('profit-loss error:', e)
    return NextResponse.json({ error: 'Failed to load profit & loss' }, { status: 500 })
  }
}
