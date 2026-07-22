import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const salesUnresolved = await sql`
    SELECT raw_item_name AS name, COUNT(*)::int AS cnt
    FROM sales_receipt_lines
    WHERE item_id IS NULL OR unresolved = true
    GROUP BY raw_item_name
    ORDER BY cnt DESC
  `

  const billsUnresolved = await sql`
    SELECT bl.raw_item_name AS name, COUNT(*)::int AS cnt,
           MIN(b.bill_date)::date::text AS earliest, MAX(b.bill_date)::date::text AS latest,
           ARRAY_AGG(DISTINCT bl.item_total) AS totals
    FROM bill_lines bl
    JOIN bills b ON b.id = bl.bill_id
    WHERE bl.item_id IS NULL OR bl.unresolved = true
    GROUP BY bl.raw_item_name
    ORDER BY cnt DESC
  `

  const expenseCount = await sql`SELECT COUNT(*)::int AS n FROM expenses`
  const expenseSample = await sql`
    SELECT expense_date::date::text, expense_account, description, amount, source
    FROM expenses ORDER BY expense_date DESC LIMIT 10
  `

  return NextResponse.json({ salesUnresolved, billsUnresolved, expenseCount, expenseSample })
}
