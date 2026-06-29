import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => [l.split('=')[0].trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const sql = neon(env.DATABASE_URL)

await sql`
  CREATE TABLE IF NOT EXISTS clock_locations (
    id SERIAL PRIMARY KEY,
    staff_name TEXT NOT NULL,
    action TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    distance_meters DOUBLE PRECISION,
    accepted BOOLEAN NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )
`
console.log('✓ clock_locations')
console.log('Done.')
