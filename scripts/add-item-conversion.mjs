import { readFileSync } from 'fs'
import { neon } from '@neondatabase/serverless'

const env = readFileSync('.env.local', 'utf8')
const url = env.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=').slice(1).join('=').trim().replace(/^"|"$/g, '')
const sql = neon(url)

// Lets a countable item (e.g. "4x6 packs") declare that a GMC take of it should
// auto-credit another item's stock (e.g. "4x6 Photo Paper Singles"). The existing
// units_per_pack field doubles as the conversion ratio (units credited per 1 GMC unit).
await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS converts_to_item_id INTEGER REFERENCES items(id)`
console.log('Done: converts_to_item_id column added to items')
