import { readFileSync } from 'fs'
import { neon } from '@neondatabase/serverless'
const url = readFileSync('.env.local','utf8').split('\n').find(l=>l.trim().startsWith('postgres')).trim()
const sql = neon(url)
const cols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='expenses' ORDER BY ordinal_position`
cols.forEach(r => console.log(r.column_name, '-', r.data_type))
const sample = await sql`SELECT * FROM expenses LIMIT 3`
console.log('\nSample rows:')
sample.forEach(r => console.log(JSON.stringify(r)))
