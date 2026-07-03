import { readFileSync } from 'fs'
import { neon } from '@neondatabase/serverless'

const env = readFileSync('.env.local', 'utf8')
const url = env.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=').slice(1).join('=').trim().replace(/^"|"$/g, '')
const sql = neon(url)

// Stores [{ url, type }] per announcement -- type (the upload's real content-type) is
// what lets the feed tell images, videos, and voice notes apart reliably.
await sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS media_urls JSONB DEFAULT '[]'::jsonb`
console.log('Done: media_urls column added to announcements')
