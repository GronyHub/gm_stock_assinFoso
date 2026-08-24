import { requireAuth, badRequest, success } from '@/lib/api'
import sql from '@/lib/db'
import { once } from '@/lib/once'
import { NextRequest } from 'next/server'

// Anything not updated in the last 25s is considered stale (tab closed,
// crashed, navigated away without the unmount cleanup firing) and is
// treated as no-longer-present by the GET below, without needing to
// actively delete it.
const STALE_SECONDS = 25

// This is the app's busiest route (every open tab polls the GET and
// heartbeats the POST), so re-running the CREATE on every single call was
// doubling its database traffic to re-confirm a table that already exists.
const ensureUserPresenceTable = once(async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS user_presence (
      staff_name TEXT PRIMARY KEY,
      activity TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `.catch(() => {})
})

export async function GET() {
  try {
    await ensureUserPresenceTable()
    const rows = await sql`
      SELECT staff_name, activity, updated_at
      FROM user_presence
      WHERE updated_at > NOW() - (${STALE_SECONDS} * INTERVAL '1 second')
      ORDER BY updated_at DESC
    `
    return success(rows)
  } catch (e) {
    return success([])
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const staffName = (session!.user as any)?.username ?? session!.user?.name
  if (!staffName) return badRequest('No identity')

  const { activity } = await req.json()
  if (!activity) return badRequest('Missing activity')

  // Presence is a "who's online" nicety, not real data -- a DB hiccup here
  // shouldn't 500 out of whatever the user was actually doing, so fail the
  // same quiet way GET already does.
  try {
    await ensureUserPresenceTable()
    await sql`
      INSERT INTO user_presence (staff_name, activity, updated_at)
      VALUES (${staffName}, ${activity}, NOW())
      ON CONFLICT (staff_name) DO UPDATE SET activity = ${activity}, updated_at = NOW()
    `
  } catch (e) {
    console.error('presence POST error:', e)
  }
  return success({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const staffName = (session!.user as any)?.username ?? session!.user?.name
  try {
    await ensureUserPresenceTable()
    await sql`DELETE FROM user_presence WHERE staff_name = ${staffName}`
  } catch (e) {
    console.error('presence DELETE error:', e)
  }
  return success({ ok: true })
}
