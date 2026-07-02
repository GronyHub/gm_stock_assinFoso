/**
 * Restore Joe's original payslip values for Nov 2025 – May 2026 from Excel.
 * June 2026 stays at ₵2,000 flat (already set).
 * Run: node scripts/restore-joe-history.mjs
 */
import { readFileSync } from 'fs'
import { neon } from '@neondatabase/serverless'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const envRaw = readFileSync('.env.local', 'utf8')
const url = envRaw.split('\n').find(l => l.trim().startsWith('postgres')).trim()
const sql = neon(url)

const wb = XLSX.readFile('../(pre-zoho) BizIMS.xlsx')
const ws = wb.Sheets['Payslips']
const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

function excelDate(serial) {
  if (!serial || typeof serial !== 'number') return null
  return new Date(Math.round((serial - 25569) * 86400 * 1000)).toISOString().slice(0, 10)
}
function num(v) {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(v)
  return isNaN(n) ? null : n
}
function parseTimeMins(t) {
  if (!t) return null
  const m = t.match(/^(\d+):(\d+)(am|pm)$/i)
  if (!m) return null
  let h = parseInt(m[1]), min = parseInt(m[2])
  if (m[3].toLowerCase() === 'pm' && h !== 12) h += 12
  if (m[3].toLowerCase() === 'am' && h === 12) h = 0
  return h * 60 + min
}

const C = {
  name: 0, hours: 1, payHours: 2, otHours: 3, payOT: 4,
  longevityDays: 6, payLongevity: 7, payDuty: 9, dataAllowance: 10, ssnit: 12, total: 13,
}

const ROW_GROUPS = [0, 16, 32]
const COL_BLOCKS = [0, 17, 32]
const JOE_ROW_OFFSET = 3

console.log('\n══════════════════════════════════════════')
console.log('  RESTORE JOE HISTORICAL PAYSLIPS')
console.log('══════════════════════════════════════════\n')

// ── Nov 2025 – Mar 2026: from main Excel blocks ────────────────────────────
console.log('Restoring Nov 2025 – Mar 2026 from Excel…')
for (const rowGroup of ROW_GROUPS) {
  for (const colBlock of COL_BLOCKS) {
    const monthSerial = raw[rowGroup]?.[colBlock + 1]
    const payMonth = excelDate(monthSerial)
    if (!payMonth) continue

    // Skip April 2026 and beyond — handled separately below
    if (payMonth >= '2026-04-01') continue

    const period = raw[rowGroup + 11]?.[colBlock + 1]
    const r = raw[rowGroup + JOE_ROW_OFFSET]
    const name = r?.[colBlock + C.name]
    if (!name || typeof name !== 'string' || !name.toLowerCase().includes('joe')) continue

    const rec = {
      hours_worked: num(r[colBlock + C.hours]),
      pay_for_hours: num(r[colBlock + C.payHours]),
      overtime_hours: num(r[colBlock + C.otHours]),
      pay_for_overtime: num(r[colBlock + C.payOT]),
      longevity_days: num(r[colBlock + C.longevityDays]),
      pay_for_longevity: num(r[colBlock + C.payLongevity]),
      duty_allowance: num(r[colBlock + C.payDuty]),
      data_allowance: num(r[colBlock + C.dataAllowance]),
      ssnit: num(r[colBlock + C.ssnit]),
      total_salary: num(r[colBlock + C.total]),
      payment_period: typeof period === 'string' ? period : null,
    }

    await sql`
      UPDATE payslips SET
        hours_worked      = ${rec.hours_worked},
        pay_for_hours     = ${rec.pay_for_hours},
        overtime_hours    = ${rec.overtime_hours},
        pay_for_overtime  = ${rec.pay_for_overtime},
        longevity_days    = ${rec.longevity_days},
        pay_for_longevity = ${rec.pay_for_longevity},
        duty_allowance    = ${rec.duty_allowance},
        data_allowance    = ${rec.data_allowance},
        ssnit             = ${rec.ssnit},
        total_salary      = ${rec.total_salary},
        payment_period    = ${rec.payment_period}
      WHERE staff_name = 'Joe' AND pay_month = ${payMonth}
    `
    console.log(`  ✓ Joe  ${payMonth}  ₵${rec.total_salary}`)
  }
}

// ── April 2026: col offset 32, row 49 ─────────────────────────────────────
console.log('\nRestoring April 2026 from Excel…')
const APR_COL = 32
const APR_ROW = 49
const aprMonth = excelDate(raw[46]?.[APR_COL + 1])  // '2026-04-30'
const aprPeriod = raw[58]?.[APR_COL + 1] ?? '1st April, 2026 to 30th April, 2026'
const aprRow = raw[APR_ROW]
if (aprRow && aprMonth) {
  const aprRec = {
    hours_worked: num(aprRow[APR_COL + 1]),
    pay_for_hours: num(aprRow[APR_COL + 2]),
    overtime_hours: num(aprRow[APR_COL + 3]),
    pay_for_overtime: num(aprRow[APR_COL + 4]),
    longevity_days: num(aprRow[APR_COL + 6]),
    pay_for_longevity: num(aprRow[APR_COL + 7]),
    duty_allowance: num(aprRow[APR_COL + 9]),
    data_allowance: num(aprRow[APR_COL + 10]),
    ssnit: null,
    total_salary: num(aprRow[APR_COL + 13]),
  }
  await sql`
    UPDATE payslips SET
      hours_worked      = ${aprRec.hours_worked},
      pay_for_hours     = ${aprRec.pay_for_hours},
      overtime_hours    = ${aprRec.overtime_hours},
      pay_for_overtime  = ${aprRec.pay_for_overtime},
      longevity_days    = ${aprRec.longevity_days},
      pay_for_longevity = ${aprRec.pay_for_longevity},
      duty_allowance    = ${aprRec.duty_allowance},
      data_allowance    = ${aprRec.data_allowance},
      ssnit             = ${aprRec.ssnit},
      total_salary      = ${aprRec.total_salary},
      payment_period    = ${typeof aprPeriod === 'string' ? aprPeriod : '1st April, 2026 to 30th April, 2026'}
    WHERE staff_name = 'Joe' AND pay_month = ${aprMonth}
  `
  console.log(`  ✓ Joe  ${aprMonth}  ₵${aprRec.total_salary}`)
}

// ── May 2026: re-generate from staff_times at ₵5.50/hr ───────────────────
console.log('\nRe-generating May 2026 from staff_times…')
const timesRows = await sql`
  SELECT actual_in, actual_out
  FROM staff_times
  WHERE staff_name = 'joe'
    AND work_date >= '2026-05-01' AND work_date <= '2026-05-31'
    AND actual_in IS NOT NULL AND actual_out IS NOT NULL
`
let totalMins = 0
for (const r of timesRows) {
  const inM = parseTimeMins(r.actual_in), outM = parseTimeMins(r.actual_out)
  if (inM == null || outM == null) continue
  totalMins += outM >= inM ? outM - inM : (outM + 1440) - inM
}
const hours    = parseFloat((totalMins / 60).toFixed(4))
const payHours = parseFloat((hours * 5.50).toFixed(2))
const longDays = 1578
const payLong  = parseFloat((longDays * 0.05).toFixed(2))
const total    = parseFloat((payHours + payLong + 50 + 100).toFixed(2))

await sql`
  UPDATE payslips SET
    hours_worked      = ${hours},
    pay_for_hours     = ${payHours},
    overtime_hours    = 0,
    pay_for_overtime  = 0,
    longevity_days    = ${longDays},
    pay_for_longevity = ${payLong},
    duty_allowance    = 50,
    data_allowance    = 100,
    ssnit             = null,
    total_salary      = ${total},
    payment_period    = '1st May, 2026 to 31st May, 2026'
  WHERE staff_name = 'Joe' AND pay_month = '2026-05-31'
`
console.log(`  ✓ Joe  2026-05-31  ${hours.toFixed(2)}h  ₵${total}`)

// ── Summary ────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════')
const rows = await sql`
  SELECT pay_month::text AS m, total_salary
  FROM payslips WHERE staff_name = 'Joe' ORDER BY pay_month
`
console.log('  Joe payslips now:')
for (const r of rows) console.log(`    ${r.m}  ₵${r.total_salary}`)
console.log('\n  ✅ Done!\n')
