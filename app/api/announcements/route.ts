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

async function ensureCategoryColumn() {
  await sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS category TEXT`.catch(() => {})
}

// Cursor-paginated: ?before=<ISO timestamp> fetches the next 30 older than
// that. Without it, returns the latest 30. The client merges pages instead
// of replacing, so older announcements stay loaded once fetched.
//
// Search/filter (all optional, combinable): ?q=<text> matches body or
// author; ?category=<type> matches the exact auto-logged activity type
// (see /api/announcements/categories for the list); ?from=/&to=<YYYY-MM-DD>
// restrict to a date range. Each filter is skipped (via the "param IS NULL
// OR ..." pattern) when not provided, so one query serves every combination.
export async function GET(req: NextRequest) {
  try {
    await ensureCategoryColumn()
    const before = req.nextUrl.searchParams.get('before')
    const q = req.nextUrl.searchParams.get('q')
    const category = req.nextUrl.searchParams.get('category')
    const from = req.nextUrl.searchParams.get('from')
    const to = req.nextUrl.searchParams.get('to')

    const rows = await sql`
      SELECT
        a.id, a.author, a.body, a.media_urls, a.created_at, a.reply_to_id,
        r.author AS reply_to_author, r.body AS reply_to_body
      FROM announcements a
      LEFT JOIN announcements r ON r.id = a.reply_to_id
      WHERE (${before}::timestamptz IS NULL OR a.created_at < ${before}::timestamptz)
        AND (${q}::text IS NULL OR a.body ILIKE '%' || ${q} || '%' OR a.author ILIKE '%' || ${q} || '%')
        AND (${category}::text IS NULL OR a.category = ${category})
        AND (${from}::date IS NULL OR a.created_at::date >= ${from}::date)
        AND (${to}::date IS NULL OR a.created_at::date <= ${to}::date)
      ORDER BY a.created_at DESC
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

  const { body, media_urls, reply_to_id } = await req.json()
  const text = typeof body === 'string' ? body.trim() : ''
  const media = normalizeMedia(media_urls)
  if (!text && media.length === 0) return NextResponse.json({ error: 'Message or media is required' }, { status: 400 })
  const replyToId = Number.isInteger(reply_to_id) ? reply_to_id : null

  const actor = session.user?.name || (session.user as any)?.username || 'Unknown'

  try {
    const [row] = await sql`
      INSERT INTO announcements (body, author, media_urls, reply_to_id)
      VALUES (${text}, ${actor}, ${JSON.stringify(media)}::jsonb, ${replyToId})
      RETURNING id, author, body, media_urls, created_at, reply_to_id
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
