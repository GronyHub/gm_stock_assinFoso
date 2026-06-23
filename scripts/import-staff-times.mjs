import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()] })
)
const sql = neon(env.DATABASE_URL)

// Create table
await sql`
  CREATE TABLE IF NOT EXISTS staff_times (
    id SERIAL PRIMARY KEY,
    staff_name TEXT NOT NULL,
    work_date DATE NOT NULL,
    actual_in TEXT,
    actual_out TEXT,
    UNIQUE(staff_name, work_date)
  )
`
console.log('Table ready')

const wb = XLSX.readFile('../Data - Staff Times_Log.xlsx')
const ws = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' })

// Staff: name -> [actual_in_col, actual_out_col]
const staff = [
  { name: 'joe',      inCol: 4,  outCol: 5  },
  { name: 'bino',     inCol: 12, outCol: 13 },
  { name: 'james',    inCol: 20, outCol: 21 },
  { name: 'rawlings', inCol: 28, outCol: 29 },
]

function parseDate(raw) {
  if (!raw) return null
  // e.g. "2025 May. 14th Wed."
  const m = String(raw).match(/(\d{4})\s+(\w+)\.\s+(\d+)/)
  if (!m) return null
  const months = { Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12 }
  const mon = months[m[2]]
  if (!mon) return null
  return `${m[1]}-${String(mon).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`
}

let inserted = 0, skipped = 0
const records = []

for (let r = 3; r < rows.length; r++) {
  const row = rows[r]
  const dateStr = parseDate(row[0])
  if (!dateStr) continue

  for (const s of staff) {
    const ai = row[s.inCol]?.toString().trim() || null
    const ao = row[s.outCol]?.toString().trim() || null
    if (!ai && !ao) continue
    // skip if both are OFF or empty
    if (ai === 'OFF' && (!ao || ao === 'OFF')) continue
    records.push({ name: s.name, date: dateStr, ai, ao })
  }
}

console.log(`Parsed ${records.length} records, importing...`)

for (const rec of records) {
  try {
    await sql`
      INSERT INTO staff_times (staff_name, work_date, actual_in, actual_out)
      VALUES (${rec.name}, ${rec.date}, ${rec.ai}, ${rec.ao})
      ON CONFLICT (staff_name, work_date) DO NOTHING
    `
    inserted++
  } catch (e) {
    console.error('Error:', rec, e.message)
    skipped++
  }
}

console.log(`Done: ${inserted} inserted, ${skipped} skipped`)
