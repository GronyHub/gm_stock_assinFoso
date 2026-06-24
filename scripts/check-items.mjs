import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => [l.split('=')[0].trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const sql = neon(env.DATABASE_URL)

const statuses = await sql`SELECT DISTINCT status, COUNT(*) FROM items GROUP BY status ORDER BY status`
console.log('Item statuses:', statuses)

const total = await sql`SELECT COUNT(*) FROM items`
console.log('Total items:', total[0].count)

const filtered = await sql`SELECT COUNT(*) FROM items WHERE status NOT IN ('inactive','service')`
console.log('After NOT IN filter:', filtered[0].count)

try {
  const summary = await sql`SELECT COUNT(*) FROM item_stock_summary`
  console.log('item_stock_summary rows:', summary[0].count)
} catch (e) {
  console.log('item_stock_summary ERROR:', e.message)
}

const sample = await sql`
  SELECT i.id, i.canonical_name, i.status, COALESCE(s.calculated_soh, 0) AS soh
  FROM items i
  LEFT JOIN item_stock_summary s ON s.item_id = i.id
  WHERE i.status NOT IN ('inactive','service')
  LIMIT 5
`
console.log('Sample rows:', sample)
