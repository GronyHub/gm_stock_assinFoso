import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// One-off: 19 bill_lines rows that are actually expenses (delivery/momo/
// bank charges, office supplies) misfiled into the bills pipeline instead
// of expenses -- confirmed against the "(pre-zoho) M-LAWS_ENTRY & srv in
// Excal.xlsx" srv sheet's own category rows (Momo charges & E-levy,
// Goods T & T, PROPERTIES section). This only inserts into `expenses` --
// the source bill_lines rows are left untouched, removed in a later step
// once these are verified.
const ROWS: {
  raw: string; date: string; amount: number; account: string; vendor: string | null
}[] = [
  { raw: 'Bank Charge = 10', date: '2025-08-05', amount: 10, account: 'Bank Fees and Charges', vendor: null },
  { raw: 'Bank charge  (LF) = 13', date: '2025-05-02', amount: 13, account: 'Bank Fees and Charges', vendor: null },
  { raw: 'Delivery = 90', date: '2025-05-23', amount: 90, account: 'Delivery / Goods T&T', vendor: null },
  { raw: 'Delivery Charge  (LF) = 200', date: '2025-05-02', amount: 200, account: 'Delivery / Goods T&T', vendor: null },
  { raw: 'Delivery Charge for Goods oredered from Kasoa = 183', date: '2025-08-05', amount: 183, account: 'Delivery / Goods T&T', vendor: 'Kasoa' },
  { raw: 'Delivery T&T = 80', date: '2025-10-13', amount: 80, account: 'Delivery / Goods T&T', vendor: null },
  { raw: 'Delivery for Goods from Data Appcom to Station= 32', date: '2025-08-19', amount: 32, account: 'Delivery of goods from Data Appcom', vendor: 'Data Appcom' },
  { raw: 'Delivery for Goods from Emmanuel Oppong to Driver = 25', date: '2025-08-19', amount: 25, account: 'Delivery of goods from Emmanuel Oppong', vendor: 'Emmanuel Oppong' },
  { raw: 'Delivery for goods Goods ordered from Derrick and Bengid = 353', date: '2025-06-23', amount: 353, account: 'Delivery of goods from Derrick', vendor: 'Derrick and Bengid' },
  { raw: 'Delivery of Goods from Bright and EO to Fosu = 120', date: '2025-08-19', amount: 120, account: 'Delivery of goods from Bright', vendor: 'Bright' },
  { raw: 'Delivery of Goods from Data Appcom to Fosu = 120', date: '2025-08-19', amount: 120, account: 'Delivery of goods from Data Appcom', vendor: 'Data Appcom' },
  { raw: 'Momo Charge = 7', date: '2025-05-23', amount: 7, account: 'Momo Charges & E-levy', vendor: null },
  { raw: 'Momo Charge for Bright = 10.00', date: '2025-08-19', amount: 10, account: 'Momo Charges & E-levy', vendor: 'Bright' },
  { raw: 'Momo Charge for Data Appcom = 20', date: '2025-08-19', amount: 20, account: 'Momo Charges & E-levy', vendor: 'Data Appcom' },
  { raw: 'Momo Charge for Emmanuel Oppong = 9', date: '2025-08-19', amount: 9, account: 'Momo Charges & E-levy', vendor: 'Emmanuel Oppong' },
  { raw: 'Sent to dispatch from Abaka Freepipe juction to Circle  = 30', date: '2025-07-11', amount: 30, account: 'Delivery / Goods T&T', vendor: null },
  { raw: '70*        Goods T & T from Gentle = 70', date: '2025-05-30', amount: 70, account: 'Delivery of goods from Gentle', vendor: 'Gentle' },
  { raw: 'A3 paper cutter        1       = 250', date: '2025-04-17', amount: 250, account: 'Properties / Office Supplies', vendor: null },
  { raw: 'fine glue big size      1       = 25', date: '2025-04-17', amount: 25, account: 'Properties / Office Supplies', vendor: null },
]

export async function GET() {
  const rows = await sql`
    SELECT id, expense_date, description, amount FROM expenses
    WHERE source = 'bill_migration' ORDER BY description, id
  `
  const dupCheck = await sql`
    SELECT description, COUNT(*)::int AS n FROM expenses
    WHERE source = 'bill_migration' GROUP BY description HAVING COUNT(*) > 1
  `
  return NextResponse.json({ total: rows.length, rows, duplicates: dupCheck })
}

export async function POST() {
  const [maxRow] = await sql`
    SELECT COALESCE(MAX(entry_number::int), 0) AS max FROM expenses WHERE entry_number ~ '^[0-9]+$'
  `
  let nextEntry = (maxRow.max as number) + 1
  const inserted = []

  for (const r of ROWS) {
    const entryNumber = String(nextEntry++)
    const zohoExpenseId = `BILLMIG-${Date.now()}-${entryNumber}`
    const [row] = await sql`
      INSERT INTO expenses (zoho_expense_id, expense_date, expense_account, description, vendor_name,
                            amount, total, source, entry_number)
      VALUES (${zohoExpenseId}, ${r.date}, ${r.account}, ${r.raw}, ${r.vendor},
              ${r.amount}, ${r.amount}, 'bill_migration', ${entryNumber})
      RETURNING id, expense_date, expense_account, description, vendor_name, amount
    `
    inserted.push(row)
  }

  return NextResponse.json({ insertedCount: inserted.length, inserted })
}
