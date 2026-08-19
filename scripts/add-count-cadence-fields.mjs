import { readFileSync } from 'fs'
import { neon } from '@neondatabase/serverless'

const env = readFileSync('.env.local', 'utf8')
const url = env.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=').slice(1).join('=').trim().replace(/^"|"$/g, '')
const sql = neon(url)

// Per-item overrides for the count-due queues (/api/stock/daily,
// gmc-weekly, overdue) -- set from an item's own edit form. Both default
// to "use the automatic rule" (false / null) so nothing changes for any
// item nobody has touched: count_excluded opts an item out of being
// counted at all, count_cadence_days overrides the computed 7-day
// (GMC)/15-or-30-day (everything else) cadence with a fixed number of
// days when the automatic guess is wrong for that specific item.
await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS count_excluded BOOLEAN NOT NULL DEFAULT false`
await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS count_cadence_days INTEGER`
console.log('Done: count_excluded and count_cadence_days columns added to items')
