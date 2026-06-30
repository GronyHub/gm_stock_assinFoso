import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const rows = await sql`
      SELECT id, message, posted_by, created_at
      FROM announcements
      ORDER BY created_at DESC
      LIMIT 5
    `
    return NextResponse.json(rows)
  } catch (e) {
    console.error('announcements GET error:', e)
    return NextResponse.json([])
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any)?.role
  if (!['owner', 'manager'].includes(role)) {
    return NextResponse.json({ error: 'Only owner or manager can post announcements' }, { status: 403 })
  }

  const { message } = await req.json()
  if (!message || !message.trim()) return NextResponse.json({ error: 'Message is required' }, { status: 400 })

  const actor = session.user?.name || (session.user as any)?.username || 'Unknown'

  try {
    const [row] = await sql`
      INSERT INTO announcements (message, posted_by)
      VALUES (${message.trim()}, ${actor})
      RETURNING id, message, posted_by, created_at
    `
    await logActivity(actor, 'posted announcement', message.trim())
    return NextResponse.json(row)
  } catch (e) {
    console.error('announcements POST error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not post: ${detail}` }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any)?.role
  if (!['owner', 'manager'].includes(role)) {
    return NextResponse.json({ error: 'Only owner or manager can remove announcements' }, { status: 403 })
  }

  const { id } = await req.json()
  await sql`DELETE FROM announcements WHERE id = ${Number(id)}`
  return NextResponse.json({ ok: true })
}
