import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// Anything not updated in the last 25s is considered stale (tab closed,
// crashed, navigated away without the unmount cleanup firing) and is
// treated as no-longer-present by the GET below, without needing to
// actively delete it.
const STALE_SECONDS = 25

export async function GET() {
  try {
    const rows = await sql`
      SELECT staff_name, activity, updated_at
      FROM user_presence
      WHERE updated_at > NOW() - (${STALE_SECONDS} * INTERVAL '1 second')
      ORDER BY updated_at DESC
    `
    return NextResponse.json(rows)
  } catch (e) {
    return NextResponse.json([])
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const staffName = (session.user as any)?.username ?? session.user?.name
  if (!staffName) return NextResponse.json({ error: 'No identity' }, { status: 400 })

  const { activity } = await req.json()
  if (!activity) return NextResponse.json({ error: 'Missing activity' }, { status: 400 })

  await sql`
    INSERT INTO user_presence (staff_name, activity, updated_at)
    VALUES (${staffName}, ${activity}, NOW())
    ON CONFLICT (staff_name) DO UPDATE SET activity = ${activity}, updated_at = NOW()
  `
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const staffName = (session.user as any)?.username ?? session.user?.name
  await sql`DELETE FROM user_presence WHERE staff_name = ${staffName}`
  return NextResponse.json({ ok: true })
}
