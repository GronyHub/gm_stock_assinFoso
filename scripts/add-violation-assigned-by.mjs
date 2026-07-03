import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const url = env.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=').slice(1).join('=').trim().replace(/^"|"$/g, '')
const sql = neon(url)

await sql`ALTER TABLE violation_assignments ADD COLUMN IF NOT EXISTS assigned_by TEXT`
await sql`ALTER TABLE violation_assignments ADD COLUMN IF NOT EXISTS assigned_on DATE`
console.log('✓ violation_assignments.assigned_by, assigned_on')
