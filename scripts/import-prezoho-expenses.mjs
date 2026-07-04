/**
 * Import pre-Zoho expenses from srv sheet, rows 153-281.
 * Each non-zero monthly value becomes one expense record.
 * Run: node scripts/import-prezoho-expenses.mjs
 */
import { readFileSync } from 'fs'
import { neon } from '@neondatabase/serverless'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const url = readFileSync('.env.local','utf8').split('\n').find(l=>l.trim().startsWith('postgres')).trim()
const sql = neon(url)

const wb = XLSX.readFile('../(pre-zoho) M-LAWS_ENTRY & srv in Excal.xlsx')
const ws = wb.Sheets['srv']
const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

// Month columns 3-21 (1-indexed) → last date of that period
const MONTH_COLS = [
  { col: 3,  date: '2023-11-30' },
  { col: 4,  date: '2023-12-31' },
  { col: 5,  date: '2024-01-31' },
  { col: 6,  date: '2024-02-29' },
  { col: 7,  date: '2024-03-31' },
  { col: 8,  date: '2024-04-30' },
  { col: 9,  date: '2024-05-31' },
  { col: 10, date: '2024-06-30' },
  { col: 11, date: '2024-07-31' },
  { col: 12, date: '2024-08-21' },
  { col: 13, date: '2024-09-30' },
  { col: 14, date: '2024-10-31' },
  { col: 15, date: '2024-11-30' },
  { col: 16, date: '2024-12-31' },
  { col: 17, date: '2025-01-31' },
  { col: 18, date: '2025-02-28' },
  { col: 19, date: '2025-03-31' },
  { col: 20, date: '2025-04-30' },
  { col: 21, date: '2025-05-31' },
]

// Section headers to skip (no expense data)
const SKIP_ROWS = new Set([158, 206, 215, 234, 247, 258, 261, 265, 268, 272])

// Category by row range
function getCategory(rowNum, desc) {
  const d = (desc || '').toLowerCase()
  if (rowNum <= 154) return 'Printer Expenses'
  if (rowNum === 155) return 'Staff Expenses'        // End of service
  if (rowNum === 156) return 'Data Allowance'
  if (rowNum === 157) return 'Printer Expenses'
  if (rowNum >= 159 && rowNum <= 205) return 'Properties Expenses'
  if (rowNum >= 207 && rowNum <= 213) return 'Cleaning Materials'
  if (rowNum >= 216 && rowNum <= 233) return 'Maintenance & Tools'
  if (rowNum >= 235 && rowNum <= 246) return 'Photo & Video Repairs'
  if (rowNum >= 248 && rowNum <= 257) return 'Carpentry Works'
  if (rowNum === 259 || rowNum === 260) return 'Repairs'
  if (rowNum === 262) return 'Travel & Transport'
  if (rowNum === 263) return 'Food & Water'
  if (rowNum === 264) return 'Clothing'
  if (rowNum === 266) return 'Other Expenses'
  if (rowNum === 267) return 'Properties Expenses'
  if (rowNum === 269) return 'Rent'
  if (rowNum === 270) return 'Utilities'
  if (rowNum === 271) return 'Tax'
  if (rowNum >= 273) return 'Salaries & Wages'
  return 'Other Expenses'
}

console.log('\n══════════════════════════════════════════════════')
console.log('  IMPORT PRE-ZOHO EXPENSES (srv rows 153-281)')
console.log('══════════════════════════════════════════════════\n')

let inserted = 0, skipped = 0
const byCategory = {}

for (let rowNum = 153; rowNum <= 281; rowNum++) {
  if (SKIP_ROWS.has(rowNum)) continue

  const rowData = raw[rowNum - 1]  // 0-indexed
  const desc = (rowData?.[0] || '').toString().trim()
  if (!desc || desc === 'END OF PROPERTIES') continue

  const category = getCategory(rowNum, desc)

  for (const { col, date } of MONTH_COLS) {
    const val = rowData?.[col - 1]  // 0-indexed
    if (val == null || val === 0 || val === '' || isNaN(Number(val))) continue

    const amount = parseFloat(Number(val).toFixed(2))
    if (amount <= 0) continue

    await sql`
      INSERT INTO expenses (
        expense_date, description, expense_account, paid_through,
        currency_code, amount, total, cf_expense_type, source
      ) VALUES (
        ${date}, ${desc}, ${desc}, 'Cash in hand',
        'GHS', ${amount}, ${amount}, ${category}, 'prezoho_mlaws'
      )
    `
    inserted++
    byCategory[category] = (byCategory[category] || 0) + amount
    process.stdout.write(`  ✓ ${date}  ${desc.substring(0,30).padEnd(32)}  ₵${amount}\n`)
  }
  skipped++
}

console.log('\n══════════════════════════════════════════════════')
console.log(`  Inserted: ${inserted} expense records\n`)
console.log('  Totals by category:')
for (const [cat, total] of Object.entries(byCategory).sort((a,b) => b[1]-a[1])) {
  console.log(`    ${cat.padEnd(28)} ₵${total.toFixed(2)}`)
}
const grandTotal = Object.values(byCategory).reduce((s,v)=>s+v,0)
console.log(`\n    ${'GRAND TOTAL'.padEnd(28)} ₵${grandTotal.toFixed(2)}`)
console.log('\n  ✅ Done!\n')
