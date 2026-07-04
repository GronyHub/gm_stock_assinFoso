import { readFileSync } from 'fs'
import { neon } from '@neondatabase/serverless'
const url = readFileSync('.env.local','utf8').split('\n').find(l=>l.trim().startsWith('postgres')).trim()
const sql = neon(url)

// Check sales receipts where customer = Grony Multimedia as Customer
const gmcReceipts = await sql`
  SELECT COUNT(*) FROM sales_receipts WHERE customer_name ILIKE '%Grony Multimedia%'
`
console.log('GMC sales receipts in DB:', gmcReceipts[0].count)

// Sample GMC lines
const gmcLines = await sql`
  SELECT srl.raw_item_name, COUNT(*) as cnt, SUM(srl.item_total) as total
  FROM sales_receipt_lines srl
  JOIN sales_receipts sr ON sr.id = srl.receipt_id
  WHERE sr.customer_name ILIKE '%Grony Multimedia%'
  GROUP BY srl.raw_item_name
  ORDER BY total DESC
  LIMIT 30
`
console.log(`\nGMC line items (${gmcLines.length} distinct):`)
gmcLines.forEach(r => console.log(`  ${String(r.raw_item_name).padEnd(35)} cnt=${r.cnt}  ₵${parseFloat(r.total||0).toFixed(2)}`))

// Spot check specific items from rows 112-150
const checks = ['A4 Sheet','A3 Sheet','Ink','Toner','Lamination','Envelope','Sticker']
console.log('\nSpot check by name:')
for (const s of checks) {
  const r = await sql`
    SELECT COUNT(*) FROM sales_receipt_lines srl
    JOIN sales_receipts sr ON sr.id = srl.receipt_id
    WHERE sr.customer_name ILIKE '%Grony Multimedia%'
      AND srl.raw_item_name ILIKE ${'%'+s+'%'}
  `
  console.log(`  "${s}": ${r[0].count} line(s)`)
}

// Date range of GMC sales
const dates = await sql`
  SELECT MIN(receipt_date)::text, MAX(receipt_date)::text
  FROM sales_receipts WHERE customer_name ILIKE '%Grony Multimedia%'
`
console.log('\nGMC date range:', dates[0].min, '→', dates[0].max)
