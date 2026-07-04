import { readFileSync } from 'fs'
import { neon } from '@neondatabase/serverless'

const url = readFileSync('.env.local','utf8').split('\n').find(l=>l.trim().startsWith('postgres')).trim()
const sql = neon(url)

// Strip UTF-8 BOM if present
let raw = readFileSync('C:/Users/fiifi/AppData/Local/Temp/prezoho_expenses.json', 'utf8')
if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1)
const records = JSON.parse(raw)

console.log(`\nInserting ${records.length} expense records…\n`)

const byCategory = {}
let inserted = 0

for (const [i, r] of records.entries()) {
  const fakeId = `PREZOHO-MLAWS-${String(i+1).padStart(4,'0')}`
  await sql`
    INSERT INTO expenses (zoho_expense_id, expense_date, description, expense_account, paid_through,
      currency_code, amount, total, cf_expense_type, source)
    VALUES (${fakeId}, ${r.date}, ${r.desc}, ${r.desc}, 'Cash in hand',
      'GHS', ${r.amount}, ${r.amount}, ${r.category}, 'prezoho_mlaws')
  `
  byCategory[r.category] = (byCategory[r.category] || 0) + r.amount
  inserted++
}

console.log(`✓ Inserted ${inserted} records\n`)
console.log('Totals by category:')
for (const [cat, total] of Object.entries(byCategory).sort((a,b) => b[1]-a[1])) {
  console.log(`  ${cat.padEnd(28)} ₵${total.toFixed(2)}`)
}
const grand = Object.values(byCategory).reduce((s,v)=>s+v,0)
console.log(`\n  ${'GRAND TOTAL'.padEnd(28)} ₵${grand.toFixed(2)}\n`)
console.log('✅ Done!\n')
