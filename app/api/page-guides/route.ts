import { requireAuth, badRequest, success, handleError, getActorName } from '@/lib/api'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { deleteFile } from '@/lib/fileStorage'
import { PAGE_GUIDES, ensurePageGuideTables } from '@/lib/pageGuides'
import { NextRequest } from 'next/server'

// GET ?page=key           -> { page, title, video_url, custom, seen, can_replace }
// POST { page }           -> marks the guide watched / skipped for this staff member
// DELETE ?page=key        -> (owner level) go back to the built-in guide video
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  const page = req.nextUrl.searchParams.get('page') ?? ''
  if (!PAGE_GUIDES[page]) return badRequest('Unknown page.')
  try {
    await ensurePageGuideTables()
    const who = getActorName(session).toLowerCase()
    const [custom] = await sql`SELECT video_path FROM page_guides WHERE page_key = ${page}`
    const [seen] = await sql`SELECT 1 FROM page_guide_seen WHERE username = ${who} AND page_key = ${page}`
    return success({
      page, title: PAGE_GUIDES[page],
      video_url: custom ? `/api/page-guides/file?p=${encodeURIComponent(String(custom.video_path))}` : `/guides/${page}.mp4`,
      custom: !!custom, seen: !!seen, can_replace: isOwnerLevel(session?.user as never),
    })
  } catch (e) { return handleError('page-guides GET', e) }
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  const { page } = await req.json().catch(() => ({})) as { page?: string }
  if (!page || !PAGE_GUIDES[page]) return badRequest('Unknown page.')
  try {
    await ensurePageGuideTables()
    const who = getActorName(session).toLowerCase()
    await sql`INSERT INTO page_guide_seen (username, page_key) VALUES (${who}, ${page}) ON CONFLICT DO NOTHING`
    return success({ ok: true })
  } catch (e) { return handleError('page-guides POST', e) }
}

export async function DELETE(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session?.user as never)) return badRequest('Only an owner-level account can change guide videos.')
  const page = req.nextUrl.searchParams.get('page') ?? ''
  if (!PAGE_GUIDES[page]) return badRequest('Unknown page.')
  try {
    await ensurePageGuideTables()
    const [row] = await sql`DELETE FROM page_guides WHERE page_key = ${page} RETURNING video_path`
    if (row?.video_path) await deleteFile(String(row.video_path)).catch(() => {})
    return success({ ok: true })
  } catch (e) { return handleError('page-guides DELETE', e) }
}
