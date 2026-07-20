import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { expectedStockAt } from '@/lib/stockGuard'
import { NextRequest, NextResponse } from 'next/server'

function shiftDate(date: string, days: number) {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

type ItemLineRow = { item_id: number | null; item_name: string; qty: string | number; total: string | number }
type StockCheck = {
  previousStock: number | null
  currentStock: number | null
  currentStockSource: 'counted' | 'expected' | null
  expectedStock?: number | null
  verifyStatus: 'verified' | 'mismatch' | 'pending' | 'unknown' | 'service' | 'unlinked'
}

// Per item sold that day: stock on record just before the sale, stock on
// record just after (both purely from stock_counts/bills/sales history --
// see lib/stockGuard.expectedStockAt, the same formula the gain-guard uses),
// and whether the sale is actually verified yet. A sale is only truly
// verified once a real count lands on or after this date and matches the
// records-based projection -- until then it's "pending" (this is exactly
// why WIC purchases need to be counted the next day). If the item was also
// physically counted on this same date, that count is used immediately.
async function computeStockChecks(
  items: ItemLineRow[],
  date: string,
  dailyCount: { item_id: number; quantity_counted: string | number }[],
) {
  const ids = Array.from(new Set(items.map(r => r.item_id).filter((id): id is number => id != null)))
  if (ids.length === 0) return new Map<number, StockCheck>()

  const products = await sql`SELECT id, product_type FROM items WHERE id = ANY(${ids})`
  const productType = new Map(products.map((p: any) => [p.id, p.product_type]))
  const countedToday = new Map(dailyCount.map(c => [c.item_id, parseFloat(String(c.quantity_counted)) || 0]))
  const prevDate = shiftDate(date, -1)

  const entries: [number, StockCheck][] = await Promise.all(ids.map(async (id): Promise<[number, StockCheck]> => {
    if (productType.get(id) === 'service') {
      return [id, { previousStock: null, currentStock: null, currentStockSource: null, verifyStatus: 'service' }]
    }
    const [previousStock, expectedStock] = await Promise.all([
      expectedStockAt(id, prevDate),
      expectedStockAt(id, date),
    ])
    if (previousStock === null) {
      return [id, { previousStock: null, currentStock: null, currentStockSource: null, verifyStatus: 'unknown' }]
    }
    const actual = countedToday.get(id)
    if (actual !== undefined) {
      const verified = Math.abs(actual - (expectedStock ?? 0)) <= 0.01
      return [id, {
        previousStock, currentStock: actual, currentStockSource: 'counted',
        expectedStock, verifyStatus: verified ? 'verified' : 'mismatch',
      }]
    }
    return [id, {
      previousStock, currentStock: expectedStock, currentStockSource: 'expected',
      expectedStock, verifyStatus: 'pending',
    }]
  }))

  return new Map(entries)
}

function attachStockChecks(items: ItemLineRow[], checks: Map<number, StockCheck>) {
  return items.map(r => ({
    ...r,
    ...(r.item_id != null && checks.has(r.item_id)
      ? checks.get(r.item_id)
      : { previousStock: null, currentStock: null, currentStockSource: null, verifyStatus: 'unlinked' }),
  }))
}

// End-of-day report for a single date: who worked, what was counted, what
// WIC/GMC bought (so WIC purchases can be spot-checked in tomorrow's count),
// the day's Work Not Written, and the day's Profit/Loss. Meant to be read
// once that day's sales receipt(s) have been entered -- hasReceipt tells the
// client whether that's true yet so it can warn if not.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const date = req.nextUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10)
  const canSeeAmounts = isOwnerLevel(session.user as any)

  try {
    const [staff, dailyCount, receipts, itemsWIC, itemsGMC, billsAgg, expensesAgg] = await Promise.all([
      sql`
        SELECT staff_name, actual_in, actual_out
        FROM staff_times
        WHERE work_date = ${date} AND staff_name <> '__shop_open__'
        ORDER BY staff_name
      `,
      sql`
        SELECT sc.item_id, COALESCE(i.canonical_name, sc.item_name) AS item_name,
               sc.quantity_counted, sc.counted_by
        FROM stock_counts sc
        LEFT JOIN items i ON i.id = sc.item_id
        WHERE sc.count_date::date = ${date}
        ORDER BY item_name
      `,
      sql`
        SELECT id, customer_name, total, cash_counted, (cash_counted - total) AS wnw
        FROM sales_receipts
        WHERE receipt_date::date = ${date}
        ORDER BY id
      `,
      sql`
        SELECT srl.item_id, COALESCE(srl.resolved_name, srl.raw_item_name) AS item_name,
               SUM(srl.quantity) AS qty, SUM(srl.item_total) AS total
        FROM sales_receipt_lines srl
        JOIN sales_receipts sr ON sr.id = srl.receipt_id
        WHERE sr.receipt_date::date = ${date}
          AND sr.customer_name IS DISTINCT FROM 'Grony Multimedia as Customer'
        GROUP BY srl.item_id, 2 ORDER BY 2
      `,
      sql`
        SELECT srl.item_id, COALESCE(srl.resolved_name, srl.raw_item_name) AS item_name,
               SUM(srl.quantity) AS qty, SUM(srl.item_total) AS total
        FROM sales_receipt_lines srl
        JOIN sales_receipts sr ON sr.id = srl.receipt_id
        WHERE sr.receipt_date::date = ${date}
          AND sr.customer_name = 'Grony Multimedia as Customer'
        GROUP BY srl.item_id, 2 ORDER BY 2
      `,
      sql`SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS total FROM bills WHERE bill_date::date = ${date}`,
      sql`
        SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
        FROM expenses
        WHERE expense_date::date = ${date}
          AND (${canSeeAmounts} OR COALESCE(cf_expense_type, 'Uncategorized') <> 'Salaries')
      `,
    ])

    const cashCounted = receipts.reduce((s: number, r: any) => s + (Number(r.cash_counted) || 0), 0)
    const wnwTotal = receipts.reduce((s: number, r: any) => {
      const w = Number(r.wnw) || 0
      return s + (w > 0.001 ? w : 0)
    }, 0)
    const bills = billsAgg[0] ?? { count: 0, total: 0 }
    const expenses = expensesAgg[0] ?? { count: 0, total: 0 }
    const profitLoss = cashCounted - Number(expenses.total) - Number(bills.total)

    const stockChecks = await computeStockChecks([...itemsWIC, ...itemsGMC] as ItemLineRow[], date, dailyCount as any)

    return NextResponse.json({
      date,
      staff,
      dailyCount,
      receipts,
      hasReceipt: receipts.length > 0,
      itemsWIC: attachStockChecks(itemsWIC as ItemLineRow[], stockChecks),
      itemsGMC: attachStockChecks(itemsGMC as ItemLineRow[], stockChecks),
      cashCounted,
      wnwTotal,
      bills: { count: Number(bills.count), total: Number(bills.total) },
      expenses: { count: Number(expenses.count), total: Number(expenses.total) },
      profitLoss,
      canSeeAmounts,
    })
  } catch (e) {
    console.error('daily-summary error:', e)
    return NextResponse.json({ error: 'Failed to load daily summary' }, { status: 500 })
  }
}
