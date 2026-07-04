import { readFileSync } from 'fs'
import { neon } from '@neondatabase/serverless'
const url = readFileSync('.env.local','utf8').split('\n').find(l=>l.trim().startsWith('postgres')).trim()
const sql = neon(url)

const b = await sql`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='bills' ORDER BY ordinal_position`
console.log('bills:')
b.forEach(r => console.log(`  ${r.column_name} (${r.data_type}) ${r.is_nullable==='NO'?'NOT NULL':''}`))

const bl = await sql`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='bill_lines' ORDER BY ordinal_position`
console.log('\nbill_lines:')
bl.forEach(r => console.log(`  ${r.column_name} (${r.data_type}) ${r.is_nullable==='NO'?'NOT NULL':''}`))

const sample = await sql`SELECT * FROM bills LIMIT 1`
console.log('\nSample bill:', JSON.stringify(sample[0], null, 2))
