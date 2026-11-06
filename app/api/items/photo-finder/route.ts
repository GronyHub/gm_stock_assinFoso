import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensureItemPictureColumn } from '@/lib/itemPictures'
import { findPhotos, suggestQuery } from '@/lib/photoFinder'
import { NextRequest } from 'next/server'

// GET                 -> goods items (active only, see AGENTS.md) with their photo state and a suggested search
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
      SELECT id, canonical_name AS name, TRIM(cf_group) AS "group", image_url, image_credit
      FROM active_items
      WHERE COALESCE(product_type, 'goods') <> 'service' AND canonical_name NOT ILIKE '%unspecified%'
      ORDER BY TRIM(cf_group) NULLS LAST, canonical_name`
    return success(rows.map(r => ({ ...r, suggest: suggestQuery(String(r.name), r.group as string | null) })))
  } catch (e) { return handleError('photo finder GET', e) }
}
