import { requireAuth, badRequest, success, handleError, getActorName } from '@/lib/api'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { ensureBarcodes, cleanBarcode } from '@/lib/barcodes'
import { logActivity } from '@/lib/logger'
import { NextRequest } from 'next/server'

// GET ?code=  -- the ACTIVE item this barcode belongs to: { item } or { item: null } when it has not been linked yet.
// GET ?itemId= -- the barcodes of one item.
// POST { code, itemId } -- link a scanned barcode to an item (any staff member: the first scan of a new barcode).
// DELETE ?code= -- unlink (owner and Joe).
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error
  try {
    await ensureBarcodes()
    const itemId = Number(req.nextUrl.searchParams.get('itemId'))
    if (itemId) return success({ barcodes: await sql`SELECT barcode, created_by, created_at FROM item_barcodes WHERE item_id = ${itemId} ORDER BY created_at` })
    const code = cleanBarcode(req.nextUrl.searchParams.get('code'))
    if (!code) return badRequest('No barcode.')
    // active_items: a merged (retired) item must never be offered again.
    const [row] = await sql`SELECT i.id, i.canonical_name AS name, COALESCE(i.selling_rate, 0)::float AS selling_price, COALESCE(s.calculated_soh, 0)::float AS soh
      FROM item_barcodes b JOIN active_items i ON i.id = b.item_id LEFT JOIN item_stock_summary s ON s.item_id = i.id WHERE b.barcode = ${code}`
    return success({ code, item: row ?? null })
  } catch (e) { return handleError('items barcode GET', e) }
}
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await ensureBarcodes()
    const b = await req.json().catch(() => ({}))
    const code = cleanBarcode(b.code), itemId = Number(b.itemId)
    if (code.length < 4 || !itemId) return badRequest('Scan a barcode and choose its item.')
    const [item] = await sql`SELECT id, canonical_name FROM active_items WHERE id = ${itemId}`
    if (!item) return badRequest('That item is not active.')
    const [ex] = await sql`SELECT item_id FROM item_barcodes WHERE barcode = ${code}`
    if (ex && Number(ex.item_id) !== itemId) return badRequest('This barcode already belongs to another item. Ask Joe or Grony to unlink it first.')
    const by = getActorName(session)
    await sql`INSERT INTO item_barcodes (barcode, item_id, created_by) VALUES (${code}, ${itemId}, ${by}) ON CONFLICT DO NOTHING`
    void logActivity(by, 'linked a barcode', `${code} -> ${item.canonical_name}`)
    return success({ ok: true })
  } catch (e) { return handleError('items barcode POST', e) }
}
export async function DELETE(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as never)) return badRequest('Only Joe and Grony unlink a barcode.')
  try {
    await ensureBarcodes()
    const code = cleanBarcode(req.nextUrl.searchParams.get('code'))
    await sql`DELETE FROM item_barcodes WHERE barcode = ${code}`
    return success({ ok: true })
  } catch (e) { return handleError('items barcode DELETE', e) }
}
