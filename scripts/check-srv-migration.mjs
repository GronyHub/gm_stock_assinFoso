import { readFileSync } from 'fs'
import { neon } from '@neondatabase/serverless'
const url = readFileSync('.env.local','utf8').split('\n').find(l=>l.trim().startsWith('postgres')).trim()
const sql = neon(url)

// Service items already in DB
const items = await sql`SELECT COUNT(*) FROM items WHERE product_type='service'`
console.log(`Service items in DB: ${items[0].count}`)

// Check sales_receipt_lines using correct column: raw_item_name
const srvNames = ['Passport','Photocopy','Printing','Typing','Camera','Book Printing','Binding','Scanning','Invitation']
console.log('\nSales lines matching service names:')
for (const s of srvNames) {
  const r = await sql`SELECT COUNT(*) FROM sales_receipt_lines WHERE raw_item_name ILIKE ${'%'+s+'%'}`
  console.log(`  "${s}": ${r[0].count} line(s)`)
}

// Any prezoho source in sales_receipts?
const sources = await sql`SELECT DISTINCT source FROM sales_receipts WHERE source IS NOT NULL LIMIT 10`
console.log('\nSales receipt sources:', sources.map(r=>r.source).join(', ') || 'none')

// Total count of sales receipts
const total = await sql`SELECT COUNT(*) FROM sales_receipts`
console.log('Total sales receipts:', total[0].count)

// Earliest and latest receipt date
const dates = await sql`SELECT MIN(receipt_date)::text, MAX(receipt_date)::text FROM sales_receipts`
console.log('Date range:', dates[0].min, '→', dates[0].max)
