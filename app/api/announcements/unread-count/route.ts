import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

async function ensureColumn() {
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS last_seen_announcement_id INTEGER NOT NULL DEFAULT 0`.catch(() => {})
}

// Badge count for the Home shortcut -- announcements posted after whatever
// this user last had the Announcements panel open for (see
// /api/announcements/mark-read, which the panel calls on mount).
export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ count: 0 })

  try {
    await ensureColumn()
    const userId = Number((session.user as any).id)
    const [row] = await sql`
      SELECT COUNT(*)::int AS count
      FROM announcements
      WHERE id > COALESCE((SELECT last_seen_announcement_id FROM app_users WHERE id = ${userId}), 0)
    `
    return NextResponse.json({ count: row?.count ?? 0 })
  } catch (e) {
    console.error('announcements unread-count error:', e)
    return NextResponse.json({ count: 0 })
  }
}
