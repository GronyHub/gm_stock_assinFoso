import { readFileSync } from 'fs'
import { neon } from '@neondatabase/serverless'
const url = readFileSync('.env.local','utf8').split('\n').find(l=>l.trim().startsWith('postgres')).trim()
const sql = neon(url)

const sr = await sql`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='sales_receipts' ORDER BY ordinal_position`
console.log('sales_receipts:')
sr.forEach(r => console.log(`  ${r.column_name} (${r.data_type}) ${r.is_nullable==='NO'?'NOT NULL':''}`))

const srl = await sql`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='sales_receipt_lines' ORDER BY ordinal_position`
console.log('\nsales_receipt_lines:')
srl.forEach(r => console.log(`  ${r.column_name} (${r.data_type}) ${r.is_nullable==='NO'?'NOT NULL':''}`))

// Sample receipt to see typical values
const sample = await sql`SELECT * FROM sales_receipts WHERE customer_name ILIKE '%Grony%' LIMIT 1`
console.log('\nSample GMC receipt:', JSON.stringify(sample[0], null, 2))
