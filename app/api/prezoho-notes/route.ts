import { requireAuth, getActorName, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest } from 'next/server'

// Pre-Zoho ledger day-cells that held descriptive text instead of a bare
// quantity (see prezoho_text_cells) -- already classified as NOT sales
// during the manual review pass (gmc_use/restock/loss/correction/count
// recount/etc.), so nothing here needs backfilling. This just makes them
// visible per-item instead of only existing as an export the reviewer has
// to cross-reference by hand.
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  const itemId = Number(req.nextUrl.searchParams.get('itemId'))
  if (!Number.isFinite(itemId)) return badRequest('itemId required')

  try {
    const rows = await sql`
      SELECT id, cell_date::text AS cell_date, raw_text, total, cp, category, reviewed
      FROM prezoho_text_cells
      WHERE item_id = ${itemId}
      ORDER BY cell_date ASC
    `
    return success(rows)
  } catch (e) {
    return handleError('prezoho-notes', e)
  }
}

// Marks every one of this item's notes reviewed at once -- these are
// historical context, not individual errors to fix one at a time, so a
// single "seen it" action per item matches how they're actually used.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const body = await req.json() as { itemId?: number; id?: number; reviewed?: boolean }
  const actor = getActorName(session)
  // One note: mark it reviewed, or reopen it ({ id, reviewed: false }) -- nothing is ever deleted.
  if (body.id) {
    try {
      const rows = body.reviewed === false
        ? await sql`UPDATE prezoho_text_cells SET reviewed = false, reviewed_by = NULL, reviewed_at = NULL WHERE id = ${body.id} RETURNING id, item_id`
        : await sql`UPDATE prezoho_text_cells SET reviewed = true, reviewed_by = ${actor}, reviewed_at = NOW() WHERE id = ${body.id} RETURNING id, item_id`
      if (rows.length > 0) await logActivity(actor, body.reviewed === false ? 'reopened a pre-Zoho ledger note' : 'reviewed a pre-Zoho ledger note', `Item #${rows[0].item_id}`)
      return success({ ok: true, count: rows.length })
    } catch (e) { return handleError('prezoho-notes', e) }
  }
  const itemId = body.itemId
  if (!itemId) return badRequest('Missing itemId')
  try {
    const rows = await sql`
      UPDATE prezoho_text_cells
      SET reviewed = true, reviewed_by = ${actor}, reviewed_at = NOW()
      WHERE item_id = ${itemId} AND reviewed = false
      RETURNING id
    `
    if (rows.length > 0) await logActivity(actor, `reviewed ${rows.length} pre-Zoho ledger note(s)`, `Item #${itemId}`)
    return success({ ok: true, count: rows.length })
  } catch (e) {
    return handleError('prezoho-notes', e)
  }
}
