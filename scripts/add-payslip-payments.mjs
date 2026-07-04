import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const url = env.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=').slice(1).join('=').trim().replace(/^"|"$/g, '')
const sql = neon(url)

await sql`
  CREATE TABLE IF NOT EXISTS payslip_payments (
    pay_month DATE PRIMARY KEY,
    confirmed_by TEXT NOT NULL,
    confirmed_at TIMESTAMPTZ DEFAULT NOW(),
    total_amount NUMERIC NOT NULL,
    expense_id INTEGER
  )
`
console.log('✓ payslip_payments')
