/**
 * Full payslip setup:
 * 1. Create staff_profiles table
 * 2. De-duplicate existing payslips
 * 3. Add UNIQUE constraint to payslips
 * 4. Import April 2026 from Excel
 * 5. Generate May 2026 from staff_times at ₵5.50/hr
 * 6. Generate June 2026 from staff_times at ₵5.50/hr
 * 7. Add Grony's ₵4,000 flat for all months
 *
 * Run: node scripts/setup-payslips-full.mjs
 */

import { readFileSync } from 'fs'
import { neon } from '@neondatabase/serverless'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

// ── DB ────────────────────────────────────────────────────────────────────────
const envRaw = readFileSync('.env.local', 'utf8')
const url = envRaw.split('\n').find(l => l.trim().startsWith('postgres')).trim()
const sql = neon(url)

// ── Helpers ───────────────────────────────────────────────────────────────────
function excelToDate(s) { return new Date(Math.round((s-25569)*86400*1000)).toISOString().slice(0,10) }
function parseTimeMins(t) {
  if (!t) return null
  const m = t.match(/^(\d+):(\d+)(am|pm)$/i)
  if (!m) return null
  let h = parseInt(m[1]), min = parseInt(m[2])
  if (m[3].toLowerCase() === 'pm' && h !== 12) h += 12
  if (m[3].toLowerCase() === 'am' && h === 12) h = 0
  return h * 60 + min
}
function minsToHrs(mins) { return parseFloat((mins/60).toFixed(4)) }
const fmt = n => `₵${parseFloat(n).toFixed(2)}`

console.log('\n══════════════════════════════════════════════════')
console.log('  GRONY PAYSLIP FULL SETUP')
console.log('══════════════════════════════════════════════════\n')

// ── 1. staff_profiles table ───────────────────────────────────────────────────
console.log('1. Creating staff_profiles table…')
await sql`
  CREATE TABLE IF NOT EXISTS staff_profiles (
    id            SERIAL PRIMARY KEY,
    staff_name    TEXT UNIQUE NOT NULL,
    full_name     TEXT,
    start_date    DATE,
    date_of_birth DATE,
    ghana_card    TEXT,
    ssnit_number  TEXT,
    phone         TEXT,
    address       TEXT,
    bank_name     TEXT,
    bank_account  TEXT,
    momo_number   TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
  )
`

// Seed known start dates (from original Excel)
const knownProfiles = [
  { staff_name: 'Joe',      start_date: '2022-02-07' },
  { staff_name: 'Bino',     start_date: '2024-08-06' },
  { staff_name: 'James',    start_date: '2021-07-13' },
  { staff_name: 'Rawlings', start_date: '2025-08-25' },
  { staff_name: 'Grony',    start_date: null },
]
for (const p of knownProfiles) {
  await sql`
    INSERT INTO staff_profiles (staff_name, start_date)
    VALUES (${p.staff_name}, ${p.start_date})
    ON CONFLICT (staff_name) DO UPDATE SET start_date = EXCLUDED.start_date
  `
}
console.log('   ✓ staff_profiles seeded with start dates\n')

// ── 2. De-duplicate payslips ──────────────────────────────────────────────────
console.log('2. Removing duplicate payslips (keeping lowest id per staff+month)…')
const deleted = await sql`
  DELETE FROM payslips
  WHERE id NOT IN (
    SELECT MIN(id) FROM payslips GROUP BY staff_name, pay_month
  )
  RETURNING id
`
console.log(`   ✓ Removed ${deleted.length} duplicates\n`)

// ── 3. Add UNIQUE constraint ──────────────────────────────────────────────────
console.log('3. Adding UNIQUE constraint on payslips(staff_name, pay_month)…')
try {
  await sql`ALTER TABLE payslips ADD CONSTRAINT payslips_staff_month_unique UNIQUE (staff_name, pay_month)`
  console.log('   ✓ Constraint added\n')
} catch {
  console.log('   (constraint already exists)\n')
}

// ── 4. April 2026 from Excel ──────────────────────────────────────────────────
console.log('4. Importing April 2026 payslips from Excel…')
const wb = XLSX.readFile('../(pre-zoho) BizIMS.xlsx')
const ws = wb.Sheets['Payslips']
const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
const APR_COL = 32
const APR_MONTH = excelToDate(raw[46][APR_COL + 1])  // '2026-04-30'
const APR_PERIOD = '1st April, 2026 to 30th April, 2026'
const aprStaff = [
  { name: 'Joe',      row: 49 },
  { name: 'Bino',     row: 50 },
  { name: 'James',    row: 51 },
  { name: 'Rawlings', row: 52 },
]
for (const { name, row } of aprStaff) {
  const r = raw[row]
  const rec = {
    staff_name: name, pay_month: APR_MONTH, payment_period: APR_PERIOD,
    hours_worked: r[APR_COL+1], pay_for_hours: r[APR_COL+2],
    overtime_hours: r[APR_COL+3], pay_for_overtime: r[APR_COL+4],
    longevity_days: r[APR_COL+6], pay_for_longevity: r[APR_COL+7],
    duty_allowance: r[APR_COL+9], data_allowance: r[APR_COL+10],
    ssnit: null, total_salary: r[APR_COL+13],
  }
  await sql`
    INSERT INTO payslips (staff_name,pay_month,payment_period,hours_worked,pay_for_hours,
      overtime_hours,pay_for_overtime,longevity_days,pay_for_longevity,duty_allowance,data_allowance,ssnit,total_salary)
    VALUES (${rec.staff_name},${rec.pay_month},${rec.payment_period},${rec.hours_worked},${rec.pay_for_hours},
      ${rec.overtime_hours},${rec.pay_for_overtime},${rec.longevity_days},${rec.pay_for_longevity},
      ${rec.duty_allowance},${rec.data_allowance},${rec.ssnit},${rec.total_salary})
    ON CONFLICT (staff_name, pay_month) DO NOTHING
  `
  console.log(`   ✓ ${name.padEnd(10)} ${fmt(rec.total_salary)}`)
}
console.log()

// ── 5 & 6. May + June 2026 from staff_times at ₵5.50/hr ─────────────────────
const HOURLY  = 5.50
const DUTY    = 50.00
const DATA    = 100.00
const LONG_DAYS  = { Joe: 1578, Bino: 667, James: 1787, Rawlings: 283 }
const LONG_RATE  = 0.05
// Joe is flat ₵2,000 from June 2026 onwards; for months before that he's hourly
const HOURLY_STAFF = ['Bino', 'James', 'Rawlings']
const JOE_FLAT_FROM = '2026-06-01'  // Joe flat ₵2,000 starting this month

async function generateMonthFromTimes(startDate, endDate, payMonth, periodLabel) {
  console.log(`  Generating ${periodLabel}…`)
  const timesRows = await sql`
    SELECT staff_name, actual_in, actual_out
    FROM staff_times
    WHERE work_date >= ${startDate} AND work_date <= ${endDate}
      AND actual_in IS NOT NULL AND actual_out IS NOT NULL
  `
  const staffMins = {}
  for (const r of timesRows) {
    const name = r.staff_name.charAt(0).toUpperCase() + r.staff_name.slice(1)
    const inM = parseTimeMins(r.actual_in), outM = parseTimeMins(r.actual_out)
    if (inM == null || outM == null) continue
    staffMins[name] = (staffMins[name] ?? 0) + (outM >= inM ? outM - inM : (outM + 1440) - inM)
  }
  // Hourly staff
  for (const name of HOURLY_STAFF) {
    const hours     = minsToHrs(staffMins[name] ?? 0)
    const payHours  = parseFloat((hours * HOURLY).toFixed(2))
    const longDays  = LONG_DAYS[name]
    const payLong   = parseFloat((longDays * LONG_RATE).toFixed(2))
    const total     = parseFloat((payHours + payLong + DUTY + DATA).toFixed(2))
    await sql`
      INSERT INTO payslips (staff_name,pay_month,payment_period,hours_worked,pay_for_hours,
        overtime_hours,pay_for_overtime,longevity_days,pay_for_longevity,duty_allowance,data_allowance,ssnit,total_salary)
      VALUES (${name},${payMonth},${periodLabel},${hours},${payHours},
        0,0,${longDays},${payLong},${DUTY},${DATA},null,${total})
      ON CONFLICT (staff_name, pay_month) DO UPDATE SET
        hours_worked=${hours}, pay_for_hours=${payHours}, longevity_days=${longDays},
        pay_for_longevity=${payLong}, duty_allowance=${DUTY}, data_allowance=${DATA},
        overtime_hours=0, pay_for_overtime=0, total_salary=${total}
    `
    console.log(`   ✓ ${name.padEnd(10)} ${hours.toFixed(2)}h  ${fmt(total)}`)
  }
  // Joe: flat ₵2,000 from June 2026, hourly before that
  if (payMonth >= JOE_FLAT_FROM) {
    await sql`
      INSERT INTO payslips (staff_name,pay_month,payment_period,hours_worked,pay_for_hours,
        overtime_hours,pay_for_overtime,longevity_days,pay_for_longevity,duty_allowance,data_allowance,ssnit,total_salary)
      VALUES ('Joe',${payMonth},${periodLabel},null,null,null,null,null,null,null,null,null,2000)
      ON CONFLICT (staff_name, pay_month) DO UPDATE SET
        hours_worked=null, pay_for_hours=null, longevity_days=null,
        pay_for_longevity=null, duty_allowance=null, data_allowance=null,
        overtime_hours=null, pay_for_overtime=null, total_salary=2000
    `
    console.log(`   ✓ Joe        flat  ${fmt(2000)}`)
  } else {
    const joeHours = minsToHrs(staffMins['Joe'] ?? 0)
    const joePayHrs = parseFloat((joeHours * HOURLY).toFixed(2))
    const joeLongDays = LONG_DAYS['Joe']
    const joePayLong = parseFloat((joeLongDays * LONG_RATE).toFixed(2))
    const joeTotal = parseFloat((joePayHrs + joePayLong + DUTY + DATA).toFixed(2))
    await sql`
      INSERT INTO payslips (staff_name,pay_month,payment_period,hours_worked,pay_for_hours,
        overtime_hours,pay_for_overtime,longevity_days,pay_for_longevity,duty_allowance,data_allowance,ssnit,total_salary)
      VALUES ('Joe',${payMonth},${periodLabel},${joeHours},${joePayHrs},
        0,0,${joeLongDays},${joePayLong},${DUTY},${DATA},null,${joeTotal})
      ON CONFLICT (staff_name, pay_month) DO UPDATE SET
        hours_worked=${joeHours}, pay_for_hours=${joePayHrs}, longevity_days=${joeLongDays},
        pay_for_longevity=${joePayLong}, duty_allowance=${DUTY}, data_allowance=${DATA},
        overtime_hours=0, pay_for_overtime=0, total_salary=${joeTotal}
    `
    console.log(`   ✓ Joe        ${joeHours.toFixed(2)}h  ${fmt(joeTotal)}`)
  }
  console.log()
}

console.log('5. Generating May 2026 payslips (₵5.50/hr)…')
await generateMonthFromTimes('2026-05-01', '2026-05-31', '2026-05-31', '1st May, 2026 to 31st May, 2026')

console.log('6. Generating June 2026 payslips (₵5.50/hr)…')
await generateMonthFromTimes('2026-06-01', '2026-06-30', '2026-06-30', '1st June, 2026 to 30th June, 2026')

// ── 7. Grony ₵4,000 for all months ──────────────────────────────────────────
console.log('7. Adding Grony ₵4,000 payslips for all months…')
const existingMonths = await sql`SELECT DISTINCT pay_month::text AS m FROM payslips WHERE staff_name != 'Grony' ORDER BY m`
const MONTH_LABELS = {
  '2025-11-01': '29th October, 2025 to 30th November, 2025',
  '2025-12-31': '1st December, 2025 to 31st December, 2025',
  '2026-01-31': '1st January, 2026 to 31st January, 2026',
  '2026-02-28': '1st February, 2026 to 28th February, 2026',
  '2026-03-31': '1st March, 2026 to 31st March, 2026',
  '2026-04-30': '1st April, 2026 to 30th April, 2026',
  '2026-05-31': '1st May, 2026 to 31st May, 2026',
  '2026-06-30': '1st June, 2026 to 30th June, 2026',
}
for (const { m } of existingMonths) {
  const period = MONTH_LABELS[m] ?? m
  await sql`
    INSERT INTO payslips (staff_name, pay_month, payment_period,
      hours_worked, pay_for_hours, overtime_hours, pay_for_overtime,
      longevity_days, pay_for_longevity, duty_allowance, data_allowance,
      ssnit, total_salary)
    VALUES ('Grony', ${m}, ${period}, null, null, null, null,
            null, null, null, null, null, 4000)
    ON CONFLICT (staff_name, pay_month) DO NOTHING
  `
  console.log(`   ✓ Grony  ${m}  ₵4,000`)
}
console.log()

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('══════════════════════════════════════════════════')
const summary = await sql`
  SELECT pay_month::text AS m,
         COUNT(*) AS staff_count,
         SUM(total_salary)::numeric(10,2) AS total
  FROM payslips GROUP BY pay_month ORDER BY pay_month
`
console.log('  Final payslip summary:')
console.log(`  ${'Month'.padEnd(14)} Staff  Total`)
console.log('  ' + '─'.repeat(34))
for (const r of summary) {
  console.log(`  ${r.m.padEnd(14)} ${String(r.staff_count).padEnd(7)} ${fmt(r.total)}`)
}
console.log('\n  ✅ All done!\n')
