/**
 * Import large format media bills (rows 131-134) and ECO SOLVENT expense (row 135)
 * from srv sheet — all April 2025.
 * Rows 131-134 → one bill with 4 lines (vendor purchase of LF media)
 * Row 135 → one expense record (LF consumable)
 */
import { readFileSync } from 'fs'
import { neon } from '@neondatabase/serverless'
const url = readFileSync('.env.local','utf8').split('\n').find(l=>l.trim().startsWith('postgres')).trim()
const sql = neon(url)

const DATE = '2025-04-30'

const BILL_ITEMS = [
  { desc: 'SAV 3FT', amount: 540 },
  { desc: 'SAV 4FT', amount: 640 },
  { desc: 'FS 4FT',  amount: 680 },
  { desc: 'FS 3FT',  amount: 540 },
]
const billTotal = BILL_ITEMS.reduce((s, i) => s + i.amount, 0)

console.log('\n── Inserting large format media bill ──')
const [bill] = await sql`
  INSERT INTO bills (zoho_bill_id, bill_number, bill_date, due_date, status,
    vendor_name, currency_code, subtotal, total, balance, bill_type, source)
  VALUES (
    'PREZOHO-LF-2025-04', 'LF-MEDIA-APR2025', ${DATE}, ${DATE}, 'Paid',
    'Large Format Supplier', 'GHS', ${billTotal}, ${billTotal}, 0, 'Bill', 'prezoho_mlaws'
  )
  ON CONFLICT (zoho_bill_id) DO UPDATE SET bill_date = EXCLUDED.bill_date
  RETURNING id
`
console.log(`  Bill id=${bill.id}  total=₵${billTotal}`)

for (const item of BILL_ITEMS) {
  await sql`
    INSERT INTO bill_lines (bill_id, raw_item_name, unresolved, quantity,
      unit_price, item_total, account, source)
    VALUES (${bill.id}, ${item.desc}, true, 1, ${item.amount}, ${item.amount},
      'Large Format Materials', 'prezoho_mlaws')
  `
  console.log(`  ✓ ${item.desc.padEnd(12)} ₵${item.amount}`)
}

console.log('\n── Inserting ECO SOLVENT expense ──')
await sql`
  INSERT INTO expenses (zoho_expense_id, expense_date, description, expense_account,
    paid_through, currency_code, amount, total, cf_expense_type, source)
  VALUES (
    'PREZOHO-LF-SOLVENT-2025-04', ${DATE}, 'Eco Solvent', 'Large Format Expenses',
    'Cash in hand', 'GHS', 120, 120, 'Large Format Expenses', 'prezoho_mlaws'
  )
  ON CONFLICT (zoho_expense_id) DO NOTHING
`
console.log('  ✓ Eco Solvent  ₵120')

console.log('\n✅ Done!\n')
