import { requireAuth, badRequest, success, handleError, getActorName } from '@/lib/api'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { saveFile, deleteFile } from '@/lib/fileStorage'
import { PAGE_GUIDES, ensurePageGuideTables } from '@/lib/pageGuides'
import { NextRequest } from 'next/server'

const TYPES: Record<string, string> = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/3gpp': '3gp' }

// POST multipart { page, file } -- an owner-level user replaces a page's guide with their own screen recording.
// Saved on the server's disk only (no database copy: videos are big), up to 200 MB.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session?.user as never)) return badRequest('Only an owner-level account can change guide videos.')
  try {
    const fd = await req.formData()
    const page = String(fd.get('page') ?? '')
    const file = fd.get('file') as File | null
    if (!PAGE_GUIDES[page]) return badRequest('Unknown page.')
    if (!file) return badRequest('No video sent.')
    const ext = TYPES[file.type]
    if (!ext) return badRequest('Videos only (MP4, MOV, WebM or 3GP).')
    if (file.size > 200 * 1024 * 1024) return badRequest('Video too large (200 MB at most).')
    await ensurePageGuideTables()
    const saved = await saveFile(`guides/${page}-${Date.now()}.${ext}`, file, file.type, { backup: false })
    const [old] = await sql`SELECT video_path FROM page_guides WHERE page_key = ${page}`
    await sql`INSERT INTO page_guides (page_key, video_path, uploaded_by) VALUES (${page}, ${saved.pathname}, ${getActorName(session)})
      ON CONFLICT (page_key) DO UPDATE SET video_path = EXCLUDED.video_path, uploaded_by = EXCLUDED.uploaded_by, uploaded_at = now()`
    if (old?.video_path) await deleteFile(String(old.video_path)).catch(() => {})
    return success({ video_url: `/api/page-guides/file?p=${encodeURIComponent(saved.pathname)}` })
  } catch (e) { return handleError('page-guides upload', e) }
}
