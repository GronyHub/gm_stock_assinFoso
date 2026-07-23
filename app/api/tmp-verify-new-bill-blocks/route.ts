import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// Two goods lines from the Aug 2, 2025 Derrick order (M-LAWS_ENTRY!CJS18)
// were never imported at all -- no bills/bill_lines row, resolved or not.
// Follows the exact convention of their 5 sibling lines already in the app
// (one bills row per line item, quantity/unit_price left null, source
// 'bizims_historical', bill_number continuing BIZIMS-CASHO-G-79..83).
const MISSING_GOODS = [
  { raw: 'A4 210g - 1 box (28 packs) = 810', itemId: 9, itemName: 'A4 210 grams', total: 810, billNumber: 'BIZIMS-CASHO-G-84' },
  { raw: 'A4 260g Double - 2 boxes (40 boxes) = 1500', itemId: 7, itemName: 'A4 260g Double', total: 1500, billNumber: 'BIZIMS-CASHO-G-85' },
]

export async function GET() {
  const bills = await sql`SELECT id, bill_number FROM bills WHERE bill_number = ANY(${MISSING_GOODS.map(g => g.billNumber)})`
  const expenses = await sql`SELECT id FROM expenses WHERE description = 'Delivery of goods = 360' AND expense_date::date = '2025-08-02'`
  return NextResponse.json({ existingBills: bills, existingExpenses: expenses })
}

export async function POST() {
  const createdBills = []
  for (const g of MISSING_GOODS) {
    const [bill] = await sql`
      INSERT INTO bills (bill_number, bill_date, vendor_name, total, subtotal, status, source)
      VALUES (${g.billNumber}, '2025-08-02', NULL, ${g.total}, ${g.total}, 'paid', 'bizims_historical')
      RETURNING id, bill_number
    `
    await sql`
      INSERT INTO bill_lines (bill_id, item_id, raw_item_name, resolved_name, item_total, unresolved, source)
      VALUES (${bill.id}, ${g.itemId}, ${g.raw}, ${g.itemName}, ${g.total}, false, 'bizims_historical')
    `
    createdBills.push(bill)
  }

  const [expense] = await sql`
    INSERT INTO expenses (zoho_expense_id, expense_date, expense_account, description, amount, total, source, entry_number)
    VALUES (${'BIZIMS-EXP-' + Date.now()}, '2025-08-02', 'Delivery / Goods T&T', 'Delivery of goods = 360', 360, 360, 'bizims_historical',
            (SELECT COALESCE(MAX(entry_number::int), 0) + 1 FROM expenses WHERE entry_number ~ '^[0-9]+$'))
    RETURNING id, expense_date, expense_account, amount
  `

  return NextResponse.json({ createdBills, expense })
}
