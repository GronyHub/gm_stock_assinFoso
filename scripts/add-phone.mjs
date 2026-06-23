import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>l.split('=')))
process.env.DATABASE_URL = env.DATABASE_URL?.trim()

const sql = neon(process.env.DATABASE_URL)
await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS phone TEXT`
console.log('Done: phone column added to app_users')
