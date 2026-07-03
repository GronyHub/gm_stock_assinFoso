import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const rows = await sql`
      SELECT id, message AS body, posted_by AS author,
             COALESCE(media_urls, '[]'::jsonb) AS media_urls, created_at
      FROM announcements
      ORDER BY created_at DESC
      LIMIT 30
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

  const { body, media_urls } = await req.json()
  const text = typeof body === 'string' ? body.trim() : ''
  const media: { url: string; type: string }[] = Array.isArray(media_urls)
    ? media_urls.filter((m: any) => m?.url)
    : []
  if (!text && media.length === 0) return NextResponse.json({ error: 'Message or media is required' }, { status: 400 })

  const actor = session.user?.name || (session.user as any)?.username || 'Unknown'

  try {
    const [row] = await sql`
      INSERT INTO announcements (message, posted_by, media_urls)
      VALUES (${text}, ${actor}, ${JSON.stringify(media)}::jsonb)
      RETURNING id, message AS body, posted_by AS author,
                COALESCE(media_urls, '[]'::jsonb) AS media_urls, created_at
    `
    await logActivity(actor, 'posted announcement', text || `${media.length} attachment(s)`)
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
