import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const expenses = await sql`
    SELECT id, expense_date::date::text, expense_account, description, amount, source
    FROM expenses WHERE expense_date::date = '2025-08-02'
  `
  const allAug2Bills = await sql`
    SELECT b.id, b.bill_number, b.vendor_name, b.total, bl.raw_item_name, bl.item_total
    FROM bills b LEFT JOIN bill_lines bl ON bl.bill_id = b.id
    WHERE b.bill_date::date = '2025-08-02'
    ORDER BY b.id, bl.id
  `
  return NextResponse.json({ expenses, allAug2Bills })
}
