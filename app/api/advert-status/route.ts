import { requireAuth, getActorName, badRequest, success, handleError } from '@/lib/api'
import { ensureDbInitialized } from '@/lib/api/dbInitCache'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { ensureAdvertStatusTable } from '@/lib/advertStatus'
import { NextRequest } from 'next/server'

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  try {
    await ensureDbInitialized()
    await ensureAdvertStatusTable()
    const rows = await sql`
      SELECT
        i.id AS item_id, i.canonical_name AS item_name, i.cf_group,
        COALESCE(i.product_type, 'goods') AS product_type,
        COALESCE(s.has_advert, false) AS has_advert,
        s.notes, s.updated_by, s.updated_at
      FROM active_items i
      LEFT JOIN item_audio_advert_status s ON s.item_id = i.id
      ORDER BY has_advert ASC, i.cf_group NULLS LAST, i.canonical_name
    `
    return success(rows)
  } catch (e) {
    return handleError('advert-status GET', e)
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { item_id, has_advert, notes } = await req.json()
  if (!item_id) return badRequest('Missing item_id')

  const updatedBy = getActorName(session)

  try {
    await ensureDbInitialized()
    await ensureAdvertStatusTable()
    await sql`
      INSERT INTO item_audio_advert_status (item_id, has_advert, notes, updated_by, updated_at)
      VALUES (${item_id}, ${!!has_advert}, ${notes || null}, ${updatedBy}, now())
      ON CONFLICT (item_id) DO UPDATE
      SET has_advert = ${!!has_advert}, notes = ${notes || null}, updated_by = ${updatedBy}, updated_at = now()
    `
    await logActivity(updatedBy, has_advert ? 'marked advert recorded' : 'marked advert missing', `item #${item_id}`)
    return success({ ok: true })
  } catch (e) {
    return handleError('advert-status POST', e)
  }
}
