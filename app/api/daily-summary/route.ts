import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { expectedStockAt } from '@/lib/stockGuard'
import { verifySaleLine, type VerifyStatus } from '@/lib/saleVerify'
import { NextRequest } from 'next/server'

function shiftDate(date: string, days: number) {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

type ItemLineRow = { item_id: number | null; item_name: string; qty: string | number; total: string | number }
type StockInfo = { previousStock: number | null; currentStock: number | null }

// Before/After stock for each item sold that day -- purely from
// stock_counts/bills/sales history (lib/stockGuard.expectedStockAt, the same
// formula the gain-guard uses). Informational only: it does NOT gate the
// verify status below, since an item can be sold correctly long before
// anyone physically counts it again.
async function computeStockInfo(items: ItemLineRow[], date: string) {
  const ids = Array.from(new Set(items.map(r => r.item_id).filter((id): id is number => id != null)))
  if (ids.length === 0) return new Map<number, StockInfo>()

  const prevDate = shiftDate(date, -1)
  const products = await sql`SELECT id, product_type FROM items WHERE id = ANY(${ids})`
  const productType = new Map(products.map((p: any) => [p.id, p.product_type]))

  // Parallelize both date computations instead of sequential N+1 calls
  const [prevResults, currResults] = await Promise.all([
    computeExpectedStockBatch(ids, prevDate),
    computeExpectedStockBatch(ids, date),
  ])

  const stockByItem = new Map<number, StockInfo>()
  for (const id of ids) {
    if (productType.get(id) === 'service') {
      stockByItem.set(id, { previousStock: null, currentStock: null })
    } else {
      stockByItem.set(id, {
        previousStock: prevResults.get(id) ?? null,
        currentStock: currResults.get(id) ?? null,
      })
    }
  }

  return stockByItem
}

// Compute expected stock for all items on a specific date in a single query
async function computeExpectedStockBatch(itemIds: number[], date: string): Promise<Map<number, number | null>> {
  const result = new Map<number, number | null>()

  const rows = await sql`
    WITH last_counts AS (
      SELECT DISTINCT ON (item_id) item_id, count_date::date AS d, SUM(quantity_counted) AS qty
      FROM stock_counts
      WHERE item_id = ANY(${itemIds}) AND count_date::date < ${date}
      GROUP BY item_id, count_date::date
      ORDER BY item_id, count_date::date DESC
    )
    SELECT lc.item_id, lc.d,
      COALESCE(lc.qty, 0) +
      COALESCE((SELECT SUM(bl.quantity) FROM bill_lines bl JOIN bills b ON b.id = bl.bill_id
                WHERE bl.item_id = lc.item_id AND b.bill_date::date > lc.d AND b.bill_date::date <= ${date}), 0) +
      COALESCE((SELECT SUM(srl.quantity * COALESCE(i2.units_per_pack, 1)) FROM sales_receipt_lines srl
                JOIN sales_receipts sr ON sr.id = srl.receipt_id JOIN items i2 ON i2.id = srl.item_id
                WHERE i2.converts_to_item_id = lc.item_id AND COALESCE(i2.product_type, 'goods') <> 'service'
                AND sr.customer_name = 'Grony Multimedia as Customer' AND sr.receipt_date::date > lc.d AND sr.receipt_date::date <= ${date}), 0) -
      COALESCE((SELECT SUM(srl.quantity) FROM sales_receipt_lines srl JOIN sales_receipts sr ON sr.id = srl.receipt_id
                WHERE srl.item_id = lc.item_id AND sr.receipt_date::date > lc.d AND sr.receipt_date::date <= ${date}), 0) -
      COALESCE((SELECT SUM(srl.quantity * COALESCE(i2.units_per_pack, 1)) FROM sales_receipt_lines srl
                JOIN sales_receipts sr ON sr.id = srl.receipt_id JOIN items i2 ON i2.id = srl.item_id
                WHERE i2.converts_to_item_id = lc.item_id AND i2.product_type = 'service'
                AND (sr.customer_name IS NULL OR sr.customer_name <> 'Grony Multimedia as Customer')
                AND sr.receipt_date::date > lc.d AND sr.receipt_date::date <= ${date}), 0) AS expected
    FROM last_counts lc
  ` as any[]

  for (const row of rows) {
    result.set(row.item_id, row.expected != null ? parseFloat(row.expected) : null)
  }

  // Items with no prior count return null
  for (const id of itemIds) {
    if (!result.has(id)) {
      result.set(id, null)
    }
  }

  return result
}

type ItemMeta = { status: string | null; costPrice: number | null }

async function fetchItemMeta(items: ItemLineRow[]) {
  const ids = Array.from(new Set(items.map(r => r.item_id).filter((id): id is number => id != null)))
  const rows = ids.length ? await sql`SELECT id, status, purchase_rate FROM items WHERE id = ANY(${ids})` : []
  return new Map<number, ItemMeta>(rows.map((r: any) => [
    r.id,
    { status: r.status, costPrice: r.purchase_rate == null ? null : parseFloat(r.purchase_rate) },
  ]))
}

// Confirms each sale line was recorded correctly (linked to a real, active
// item, positive quantity, amount present) -- see lib/saleVerify for the
// exact rule, shared with /api/sales/verified-dates. Also attaches the
// item's cost price and this line's gross margin (revenue minus qty * cost)
// -- a distinct, accrual-style figure from the day's cash-basis Profit/Loss
// below; see the caption in the UI for why they don't have to match.
function attachChecks(items: ItemLineRow[], stockInfo: Map<number, StockInfo>, metaById: Map<number, ItemMeta>) {
  return items.map(r => {
    const meta = r.item_id != null ? metaById.get(r.item_id) : undefined
    const verifyStatus: VerifyStatus = verifySaleLine({
      itemId: r.item_id,
      itemStatus: meta?.status ?? null,
      quantity: parseFloat(String(r.qty)),
      total: r.total == null ? null : parseFloat(String(r.total)),
    })
    const info = r.item_id != null ? stockInfo.get(r.item_id) : undefined
    const qty = parseFloat(String(r.qty)) || 0
    const total = r.total == null ? null : parseFloat(String(r.total))
    const costPrice = meta?.costPrice ?? null
    const margin = (total != null && costPrice != null) ? total - qty * costPrice : null
    return {
      ...r,
      previousStock: info?.previousStock ?? null,
      currentStock: info?.currentStock ?? null,
      costPrice,
      margin,
      verifyStatus,
    }
  })
}

// End-of-day report for a single date: who worked, what was counted, what
// WIC/GMC bought (so WIC purchases can be spot-checked in tomorrow's count),
// the day's Work Not Written, and the day's Profit/Loss. Meant to be read
// once that day's sales receipt(s) have been entered -- hasReceipt tells the
// client whether that's true yet so it can warn if not.
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

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

    const allLines = [...itemsWIC, ...itemsGMC] as ItemLineRow[]
    const [stockInfo, metaById] = await Promise.all([
      computeStockInfo(allLines, date),
      fetchItemMeta(allLines),
    ])
    const itemsWICChecked = attachChecks(itemsWIC as ItemLineRow[], stockInfo, metaById)
    const itemsGMCChecked = attachChecks(itemsGMC as ItemLineRow[], stockInfo, metaById)
    const allVerified = allLines.length > 0
      && [...itemsWICChecked, ...itemsGMCChecked].every(r => r.verifyStatus === 'verified')

    // Gross margin (SP - CP) on today's actual WIC sales -- an accrual-style
    // figure, separate from the cash-basis profitLoss above. GMC lines are
    // internal use, not revenue, so they're excluded here. Items with no
    // cost price on record can't contribute a margin -- flagged via
    // grossMarginIncomplete so the UI can say the figure is a partial one.
    const grossMarginWIC = itemsWICChecked.reduce((s, r) => s + (r.margin ?? 0), 0)
    const grossMarginIncomplete = itemsWICChecked.some(r => r.margin == null)

    return success({
      date,
      staff,
      dailyCount,
      receipts,
      hasReceipt: receipts.length > 0,
      itemsWIC: itemsWICChecked,
      itemsGMC: itemsGMCChecked,
      allVerified,
      cashCounted,
      wnwTotal,
      bills: { count: Number(bills.count), total: Number(bills.total) },
      expenses: { count: Number(expenses.count), total: Number(expenses.total) },
      profitLoss,
      grossMarginWIC,
      grossMarginIncomplete,
      canSeeAmounts,
    })
  } catch (e) {
    return handleError('daily-summary GET', e)
  }
}
