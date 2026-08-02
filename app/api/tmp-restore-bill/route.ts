import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const expense = await sql`SELECT * FROM expenses WHERE id = 912`
  return NextResponse.json({ expense })
}

export async function POST() {
  const [expense] = await sql`SELECT * FROM expenses WHERE id = 912`
  if (!expense) return NextResponse.json({ error: 'expense 912 not found -- already handled?' }, { status: 404 })

  // Delete the wrongly-created expense
  await sql`DELETE FROM expenses WHERE id = 912`

  // Recreate the bill + its single unresolved line, matching the original
  // (bill_number BIZIMS-CASHO-G-5, vendor Humble Beginning, ₵5390, 2025-10-13)
  const [bill] = await sql`
    INSERT INTO bills (bill_number, bill_date, vendor_name, total, subtotal, status, source, zoho_bill_id)
    VALUES ('BIZIMS-CASHO-G-5', '2025-10-13', 'Humble Beginning', 5390, 5390, 'paid', 'app', 'BIZIMS-CASHO-G-5')
    RETURNING id, bill_number
  `
  const [line] = await sql`
    INSERT INTO bill_lines (bill_id, item_id, raw_item_name, resolved_name, item_total, unresolved, source)
    VALUES (${bill.id}, NULL, 'Goods from Humble Beginning = 5390', NULL, 5390, true, 'app')
    RETURNING id
  `

  return NextResponse.json({ deletedExpense: expense, restoredBill: bill, restoredLine: line })
}
