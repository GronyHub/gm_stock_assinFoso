/**
 * Import pre-Zoho GMC usage (rows 112-130, 137-150 of srv sheet)
 * as sales receipts with customer = 'Grony Multimedia as Customer'.
 * One receipt per month, one line per item.
 * Run: node scripts/import-gmc-prezoho.mjs
 */
import { readFileSync } from 'fs'
import { neon } from '@neondatabase/serverless'

const url = readFileSync('.env.local','utf8').split('\n').find(l=>l.trim().startsWith('postgres')).trim()
const sql = neon(url)

let raw = readFileSync('C:/Users/fiifi/AppData/Local/Temp/gmc_prezoho.json', 'utf8')
if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1)
const months = JSON.parse(raw)

// Get Grony Multimedia customer id
const [cust] = await sql`SELECT id FROM customers WHERE display_name ILIKE '%Grony Multimedia%' LIMIT 1`
const customerId = cust?.id ?? null

console.log('\n══════════════════════════════════════════════════')
console.log('  IMPORT PRE-ZOHO GMC USAGE (srv rows 112-150)')
console.log('══════════════════════════════════════════════════\n')

let receiptsInserted = 0, linesInserted = 0

for (const [date, lines] of Object.entries(months).sort()) {
  const monthTag = date.slice(0, 7)   // e.g. 2023-11
  const receiptNumber = `GMC-PREZOHO-${monthTag}`
  const total = lines.reduce((s, l) => s + l.amount, 0)

  // Insert receipt
  const [receipt] = await sql`
    INSERT INTO sales_receipts (
      receipt_number, receipt_date, payment_mode, customer_name, customer_id,
      deposit_to, currency_code, subtotal, total, balance, adjustment, source
    ) VALUES (
      ${receiptNumber}, ${date}, 'Cash', 'Grony Multimedia as Customer', ${customerId},
      'Cash in hand', 'GHS', ${total}, ${total}, 0, 0, 'prezoho_mlaws'
    )
    ON CONFLICT (receipt_number) DO UPDATE SET receipt_date = EXCLUDED.receipt_date
    RETURNING id
  `

  receiptsInserted++
  process.stdout.write(`\n  ${receiptNumber}  (${lines.length} items, ₵${total.toFixed(2)})\n`)

  // Insert lines
  for (const line of lines) {
    await sql`
      INSERT INTO sales_receipt_lines (
        receipt_id, raw_item_name, unresolved, item_price, item_total,
        quantity, source
      ) VALUES (
        ${receipt.id}, ${line.desc}, true, ${line.amount}, ${line.amount},
        1, 'prezoho_mlaws'
      )
    `
    linesInserted++
    process.stdout.write(`    ₵${String(line.amount).padStart(8)}  ${line.desc}\n`)
  }
}

console.log('\n══════════════════════════════════════════════════')
console.log(`  Receipts inserted : ${receiptsInserted}`)
console.log(`  Lines inserted    : ${linesInserted}`)
console.log('  ✅ Done!\n')
