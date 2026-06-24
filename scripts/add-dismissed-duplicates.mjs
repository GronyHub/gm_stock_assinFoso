import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => [l.split('=')[0].trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const sql = neon(env.DATABASE_URL)

await sql`
  CREATE TABLE IF NOT EXISTS dismissed_duplicates (
    id          BIGSERIAL PRIMARY KEY,
    item_id1    INT NOT NULL,
    item_id2    INT NOT NULL,
    dismissed_by TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (item_id1, item_id2)
  )
`
console.log('Table created: dismissed_duplicates')
