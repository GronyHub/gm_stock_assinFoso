import { readFileSync } from 'fs'
import { neon } from '@neondatabase/serverless'

const envRaw = readFileSync('.env.local', 'utf8')
const url = envRaw.split('\n').find(l => l.trim().startsWith('postgres')).trim()
const sql = neon(url)

console.log('\nSetting Joe salary to ₵2,000 flat for all months…\n')

const rows = await sql`
  UPDATE payslips SET
    hours_worked      = null,
    pay_for_hours     = null,
    overtime_hours    = null,
    pay_for_overtime  = null,
    longevity_days    = null,
    pay_for_longevity = null,
    duty_allowance    = null,
    data_allowance    = null,
    ssnit             = null,
    total_salary      = 2000
  WHERE staff_name = 'Joe'
  RETURNING pay_month::text AS m
`

for (const r of rows) console.log(`  ✓ Joe  ${r.m}  ₵2,000`)
console.log(`\n  Updated ${rows.length} payslip(s).\n`)
