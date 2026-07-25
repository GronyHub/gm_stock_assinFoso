import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

async function ensureColumn() {
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS last_seen_announcement_id INTEGER NOT NULL DEFAULT 0`.catch(() => {})
}

// Called when the Announcements panel (Home tab) mounts -- advances this
// user's read cursor to the newest announcement so the Home badge clears.
export async function POST() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 })

  try {
    await ensureColumn()
    const userId = Number((session.user as any).id)
    await sql`
      UPDATE app_users
      SET last_seen_announcement_id = GREATEST(last_seen_announcement_id, COALESCE((SELECT MAX(id) FROM announcements), 0))
      WHERE id = ${userId}
    `
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('announcements mark-read error:', e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
