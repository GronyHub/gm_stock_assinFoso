import { readFileSync } from 'fs'
import { neon } from '@neondatabase/serverless'
const url = readFileSync('.env.local','utf8').split('\n').find(l=>l.trim().startsWith('postgres')).trim()
const sql = neon(url)
const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='customers' ORDER BY ordinal_position`
console.log('customers columns:', cols.map(r=>r.column_name).join(', '))
const gmc = await sql`SELECT * FROM customers WHERE display_name ILIKE '%Grony%' OR email ILIKE '%grony%' LIMIT 3`
console.log('GMC customer:', JSON.stringify(gmc[0]))
