import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'

// Older rows (or a pre-migration read) may have media_urls as plain URL strings
// rather than { url, type } objects -- normalize so the client can rely on the shape.
function normalizeMedia(media_urls: unknown): { url: string; type: string }[] {
  if (!Array.isArray(media_urls)) return []
  return media_urls.map((m: any) => (typeof m === 'string' ? { url: m, type: '' } : m)).filter((m: any) => m?.url)
}

// Cursor-paginated: ?before=<ISO timestamp> fetches the next 30 older than
// that. Without it, returns the latest 30. The client merges pages instead
// of replacing, so older announcements stay loaded once fetched.
export async function GET(req: NextRequest) {
  try {
    const before = req.nextUrl.searchParams.get('before')
    const rows = before
      ? await sql`
          SELECT id, author, body, media_urls, created_at
          FROM announcements
          WHERE created_at < ${before}
          ORDER BY created_at DESC
          LIMIT 30
        `
      : await sql`
          SELECT id, author, body, media_urls, created_at
          FROM announcements
          ORDER BY created_at DESC
          LIMIT 30
        `
    return NextResponse.json(rows.map((r: any) => ({ ...r, media_urls: normalizeMedia(r.media_urls) })))
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
  const media = normalizeMedia(media_urls)
  if (!text && media.length === 0) return NextResponse.json({ error: 'Message or media is required' }, { status: 400 })

  const actor = session.user?.name || (session.user as any)?.username || 'Unknown'

  try {
    const [row] = await sql`
      INSERT INTO announcements (body, author, media_urls)
      VALUES (${text}, ${actor}, ${JSON.stringify(media)}::jsonb)
      RETURNING id, author, body, media_urls, created_at
    `
    await logActivity(actor, 'posted announcement', text || `${media.length} attachment(s)`)
    return NextResponse.json({ ...row, media_urls: normalizeMedia(row.media_urls) })
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
