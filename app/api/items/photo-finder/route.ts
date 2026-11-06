import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensureItemPictureColumn } from '@/lib/itemPictures'
import { findPhotos, suggestQuery } from '@/lib/photoFinder'
import { NextRequest } from 'next/server'

// GET                 -> goods items (active only, see AGENTS.md; photo columns read from items itself, since the
//                        active_items view keeps the column list it had when it was created) with their photo state and a suggested search
// GET ?q=words&group= -> free-licence photo matches from Wikimedia Commons for those words
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error
  try {
    const q = req.nextUrl.searchParams.get('q')
    if (q !== null) {
      if (q.trim().length < 2) return badRequest('Type at least 2 letters.')
      return success(await findPhotos(q.trim().slice(0, 100), 8, req.nextUrl.searchParams.get('group')))
    }
    await ensureItemPictureColumn()
    const rows = await sql`
      SELECT a.id, a.canonical_name AS name, TRIM(a.cf_group) AS "group", i.image_url, i.image_credit
      FROM active_items a JOIN items i ON i.id = a.id
      WHERE COALESCE(a.product_type, 'goods') <> 'service' AND a.canonical_name NOT ILIKE '%unspecified%'
      ORDER BY TRIM(a.cf_group) NULLS LAST, a.canonical_name`
    return success(rows.map(r => ({ ...r, suggest: suggestQuery(String(r.name), r.group as string | null) })))
  } catch (e) { return handleError('photo finder GET', e) }
}
