import { requireAuth, badRequest, success, handleError, getActorName } from '@/lib/api'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { ensureBarcodes } from '@/lib/barcodes'
import { NextRequest } from 'next/server'

// Labels for items that have no barcode of their own. The owner and Joe choose items; each gets the shop's own code "GM" + its number (GM000123), which is
// linked to the item at once, so scanning the printed label finds the item.
// GET  -- active sellable items that have no barcode yet.
// POST { itemIds: number[] } -- links a GM code to each item that has no GM code yet and returns what to print: [{ id, name, price, code }].
export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as never)) return badRequest('Only Joe and Grony make barcode labels.')
  try {
    await ensureBarcodes()
    const rows = await sql`SELECT i.id, i.canonical_name AS name, COALESCE(i.selling_rate, 0)::float AS price FROM active_items i
      WHERE COALESCE(i.sellable, true) AND NOT EXISTS (SELECT 1 FROM item_barcodes b WHERE b.item_id = i.id) ORDER BY i.canonical_name LIMIT 1500`
    return success({ items: rows })
  } catch (e) { return handleError('barcode labels GET', e) }
}
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as never)) return badRequest('Only Joe and Grony make barcode labels.')
  try {
    await ensureBarcodes()
    const b = await req.json().catch(() => ({}))
    const ids = (Array.isArray(b.itemIds) ? b.itemIds : []).map(Number).filter((n: number) => Number.isInteger(n) && n > 0).slice(0, 200)
    if (!ids.length) return badRequest('Choose at least one item.')
    const items = await sql`SELECT id, canonical_name AS name, COALESCE(selling_rate, 0)::float AS price FROM active_items WHERE id = ANY(${ids}) ORDER BY canonical_name`
    const by = getActorName(session)
    const out = []
    for (const it of items) {
      const code = 'GM' + String(it.id).padStart(6, '0')
      await sql`INSERT INTO item_barcodes (barcode, item_id, created_by) VALUES (${code}, ${it.id}, ${by}) ON CONFLICT (barcode) DO NOTHING`
      out.push({ id: it.id, name: it.name, price: it.price, code })
    }
    return success({ labels: out })
  } catch (e) { return handleError('barcode labels POST', e) }
}
