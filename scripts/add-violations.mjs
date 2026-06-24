import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => [l.split('=')[0].trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const sql = neon(env.DATABASE_URL)

await sql`
  CREATE TABLE IF NOT EXISTS staff_violations (
    id           BIGSERIAL PRIMARY KEY,
    staff_name   TEXT NOT NULL,
    violation    TEXT NOT NULL,
    details      TEXT,
    severity     TEXT NOT NULL DEFAULT 'minor',
    recorded_by  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`
console.log('Table created: staff_violations')
