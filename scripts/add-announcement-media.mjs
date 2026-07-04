import { readFileSync } from 'fs'
import { neon } from '@neondatabase/serverless'

const env = readFileSync('.env.local', 'utf8')
const url = env.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=').slice(1).join('=').trim().replace(/^"|"$/g, '')
const sql = neon(url)

// The production announcements table already has author/body/media_urls (not the
// message/posted_by columns the older setup-announcements.mjs implies -- that script
// is stale versus what's actually live). media_urls already existed but as a plain
// text[] array; converting it to JSONB so each entry can carry both { url, type },
// since type (the real upload content-type) is what makes image/video/voice-note
// rendering reliable instead of guessing from the URL.
// Postgres won't auto-cast an existing array default to jsonb in the same statement
// as the type change, so drop it first, convert, then set the new default.
await sql`ALTER TABLE announcements ALTER COLUMN media_urls DROP DEFAULT`
await sql`ALTER TABLE announcements ALTER COLUMN media_urls TYPE JSONB USING to_jsonb(media_urls)`
await sql`ALTER TABLE announcements ALTER COLUMN media_urls SET DEFAULT '[]'::jsonb`
console.log('Done: media_urls converted to JSONB on announcements')
