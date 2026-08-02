import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const out: Record<string, unknown> = {}

  // A. Every bill/invoice touched tonight -- total vs actual line sum
  out.restoredBill247 = await sql`
    SELECT b.id, b.bill_number, b.total, COALESCE(SUM(bl.item_total),0) AS lines_sum, COUNT(bl.id)::int AS line_count
    FROM bills b LEFT JOIN bill_lines bl ON bl.bill_id = b.id WHERE b.id = 247 GROUP BY b.id, b.total
  `
  out.touchedInvoices = await sql`
    SELECT iv.id, iv.total, COALESCE(SUM(il.item_total),0) AS lines_sum, COUNT(il.id)::int AS line_count
    FROM invoices iv LEFT JOIN invoice_lines il ON il.invoice_id = iv.id
    WHERE iv.id IN (51, 63, 114, 115, 116, 117, 118, 119)
    GROUP BY iv.id, iv.total ORDER BY iv.id
  `

  // B. Expenses created tonight -- 908/909 (Delivery invoice), 910/911 (Bengid/Humble Beginnings bills), 912 should be gone
  out.expensesCheck = await sql`
    SELECT id, expense_account, amount, expense_date::date::text, vendor_name, entered_by
    FROM expenses WHERE id IN (908, 909, 910, 911, 912) ORDER BY id
  `

  // C. New item sanity
  out.item429 = await sql`SELECT id, canonical_name, cf_group, status, product_type FROM items WHERE id = 429`

  // D. System-wide sweep: ANY bill or invoice, not just ones I touched, where
  // stored total doesn't match its lines' sum
  out.allBillMismatches = await sql`
    SELECT b.id, b.bill_number, b.total, COALESCE(SUM(bl.item_total),0) AS lines_sum
    FROM bills b LEFT JOIN bill_lines bl ON bl.bill_id = b.id
    GROUP BY b.id, b.total
    HAVING b.total IS DISTINCT FROM COALESCE(SUM(bl.item_total),0)
    ORDER BY ABS(b.total - COALESCE(SUM(bl.item_total),0)) DESC
    LIMIT 30
  `
  out.allBillMismatchesTotal = await sql`
    SELECT COUNT(*)::int AS n FROM (
      SELECT b.id FROM bills b LEFT JOIN bill_lines bl ON bl.bill_id = b.id
      GROUP BY b.id, b.total HAVING b.total IS DISTINCT FROM COALESCE(SUM(bl.item_total),0)
    ) t
  `
  out.allInvoiceMismatches = await sql`
    SELECT iv.id, iv.total, COALESCE(SUM(il.item_total),0) AS lines_sum
    FROM invoices iv LEFT JOIN invoice_lines il ON il.invoice_id = iv.id
    GROUP BY iv.id, iv.total
    HAVING iv.total IS DISTINCT FROM COALESCE(SUM(il.item_total),0)
    ORDER BY ABS(iv.total - COALESCE(SUM(il.item_total),0)) DESC
    LIMIT 30
  `
  out.allInvoiceMismatchesTotal = await sql`
    SELECT COUNT(*)::int AS n FROM (
      SELECT iv.id FROM invoices iv LEFT JOIN invoice_lines il ON il.invoice_id = iv.id
      GROUP BY iv.id, iv.total HAVING iv.total IS DISTINCT FROM COALESCE(SUM(il.item_total),0)
    ) t
  `

  // E. Re-confirm unresolved counts across sales/bills/receipts still clean
  const [salesUnresolved] = await sql`SELECT COUNT(*)::int AS n FROM sales_receipt_lines WHERE item_id IS NULL OR unresolved = true`
  const [billsUnresolved] = await sql`SELECT COUNT(*)::int AS n FROM bill_lines WHERE item_id IS NULL OR unresolved = true`
  const [receiptsUnresolved] = await sql`SELECT COUNT(*)::int AS n FROM invoice_lines WHERE item_id IS NULL OR unresolved = true`
  out.unresolvedCounts = { sales: salesUnresolved.n, bills: billsUnresolved.n, receipts: receiptsUnresolved.n }

  // F. active_items vs main list still consistent?
  const aliasWideItems = await sql`SELECT id FROM active_items` as { id: number }[]
  const mainListItems = await sql`
    SELECT s.item_id AS id FROM item_stock_summary s
    WHERE s.item_name NOT ILIKE 'old stop%' AND s.item_name NOT ILIKE 'old- stop%'
  ` as { id: number }[]
  const aSet = new Set(aliasWideItems.map(r => r.id))
  const mSet = new Set(mainListItems.map(r => r.id))
  out.listConsistency = {
    aliasWideCount: aSet.size, mainListCount: mSet.size,
    onlyInAliasWide: [...aSet].filter(id => !mSet.has(id)),
    onlyInMainList: [...mSet].filter(id => !aSet.has(id)),
  }

  return NextResponse.json(out)
}
