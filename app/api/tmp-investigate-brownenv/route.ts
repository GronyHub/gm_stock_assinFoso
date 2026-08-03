import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const convTables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND (table_name ILIKE '%convert%' OR table_name ILIKE '%tradeoff%' OR table_name ILIKE '%conversion%')
    `

    // What SOH would 367 have shown right before the July 24 manager count?
    // (previous count was June 19, qty 37 -- see stock_counts dump.)
    const preCountActivity = await sql`
      SELECT
        (SELECT COALESCE(SUM(quantity), 0) FROM sales_receipt_lines sl
          JOIN sales_receipts sr ON sr.id = sl.receipt_id
          WHERE sl.item_id = 367 AND sr.receipt_date > '2026-06-19' AND sr.receipt_date <= '2026-07-24') AS sold_between,
        (SELECT COALESCE(SUM(quantity), 0) FROM bill_lines bl
          JOIN bills b ON b.id = bl.bill_id
          WHERE bl.item_id = 367 AND b.bill_date > '2026-06-19' AND b.bill_date <= '2026-07-24') AS bought_between
    `

    // Every stock_counts row for item 100 (the pack) around the same window,
    // to see if a pack count drop lines up with a singles conversion that
    // never got recorded as a "purchase" for 367.
    const packCounts = await sql`
      SELECT count_date, quantity_counted, notes FROM stock_counts
      WHERE item_id = 100 AND count_date BETWEEN '2026-06-01' AND '2026-08-01'
      ORDER BY count_date
    `

    return NextResponse.json({ convTables, preCountActivity, packCounts })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
