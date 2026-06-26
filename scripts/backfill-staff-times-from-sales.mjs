import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => [l.split('=')[0].trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const sql = neon(env.DATABASE_URL)

// Reserved sentinel name -- never a real staff member.
// Marks "the shop had a sale this day, but no staff times were recorded at all."
// Filtered out of /api/transactions/presence so it never shows as a "staff member present".
// Does NOT suppress the "No Times" flag, since that flag specifically checks
// `actual_in IS NOT NULL`, and this placeholder always has actual_in = NULL.
const SENTINEL = '__shop_open__'

const DRY_RUN = process.argv.includes('--dry-run')

console.log(DRY_RUN ? '=== DRY RUN (no writes) ===' : '=== LIVE RUN ===')

const saleDates = await sql`
  SELECT DISTINCT receipt_date::date AS d FROM sales_receipts ORDER BY d
`
console.log(`Distinct sales-receipt dates: ${saleDates.length}`)

const existingDates = await sql`
  SELECT DISTINCT work_date::date AS d FROM staff_times
`
const existingSet = new Set(existingDates.map(r => r.d.toISOString().slice(0, 10)))

const missing = saleDates
  .map(r => r.d.toISOString().slice(0, 10))
  .filter(d => !existingSet.has(d))

console.log(`Sales dates with ZERO staff_times rows: ${missing.length}`)
missing.forEach(d => console.log(`  - ${d}`))

if (!DRY_RUN && missing.length) {
  for (const d of missing) {
    await sql`
      INSERT INTO staff_times (staff_name, work_date, actual_in, actual_out)
      VALUES (${SENTINEL}, ${d}, NULL, NULL)
    `
  }
  console.log(`\nInserted ${missing.length} placeholder rows.`)
} else if (DRY_RUN) {
  console.log('\n(dry run -- nothing written)')
} else {
  console.log('\nNothing to do.')
}
