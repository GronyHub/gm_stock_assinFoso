import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => [l.split('=')[0].trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const sql = neon(env.DATABASE_URL)

await sql`
  CREATE TABLE IF NOT EXISTS user_presence (
    staff_name TEXT PRIMARY KEY,
    activity TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
  )
`
console.log('✓ user_presence')
console.log('Done.')
