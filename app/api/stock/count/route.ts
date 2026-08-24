import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { recordCountRevision } from '@/lib/countRevisions'
import { gainViolation, expectedStockAt, packPairingCheck } from '@/lib/stockGuard'
import { isOwnerLevel } from '@/lib/roles'
import { once } from '@/lib/once'
import { NextRequest } from 'next/server'

// count_date stays date-only (every day-level query across the app groups/
// filters on it) -- the actual clock time a count was taken lives in this
// separate column instead, so nothing that already relies on count_date
// meaning "just a date" has to change.
const ensureCountedAtColumn = once(async () => {
  await sql`ALTER TABLE stock_counts ADD COLUMN IF NOT EXISTS counted_at TIMESTAMP`.catch(() => {})
})

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  try {
    await ensureCountedAtColumn()
    const { itemId, qty, notes, loss_reason, manager_response } = await req.json()
    if (!itemId || qty == null) return badRequest('Missing fields')
    if (Number(qty) < 0 || isNaN(Number(qty))) {
      return badRequest('Not allowed — a count can never be negative. Stock on hand must be 0 or more.')
    }

    const today = new Date().toISOString().slice(0, 10)
    const item = await sql`SELECT zoho_item_id, canonical_name, product_type, cf_group FROM items WHERE id = ${itemId}`
    if (!item.length) return badRequest('Item not found')

    if (item[0].product_type === 'service' || /^service/i.test(item[0].cf_group ?? '')) {
      return badRequest(`"${item[0].canonical_name}" is a service — services cannot be counted.`)
    }

    const gainErr = await gainViolation(Number(itemId), Number(qty), today)
    if (gainErr) return badRequest(gainErr)

    const pairing = await packPairingCheck(Number(itemId), item[0].canonical_name, today)
    if (pairing?.blocking) {
      return success({
        requires_pack_count: true,
        packs: pairing.packs,
        error: `"${item[0].canonical_name}" is paired with ${pairing.packs.map(p => p.name).join(' / ')} — count the pack too before this can be saved.`,
      })
    }

    const isManager = isOwnerLevel(session.user as any)
    const expected = await expectedStockAt(Number(itemId), today)
    const lossQty = expected !== null ? parseFloat((expected - Number(qty)).toFixed(4)) : 0
    let lossNote: string | null = null
    if (expected !== null && lossQty > 0.001) {
      if (!loss_reason || !String(loss_reason).trim()) {
        return success({
          requires_loss_reason: true,
          expected, counted: Number(qty), loss: lossQty, is_manager: isManager,
          error: `Loss detected: expected ${expected}, counted ${qty} (-${lossQty}). A reason is required before this count can be saved.`,
        })
      }
      if (!isManager && (!manager_response || !String(manager_response).trim())) {
        return success({
          requires_loss_reason: true,
          expected, counted: Number(qty), loss: lossQty, is_manager: isManager,
          error: `Inform the manager of this loss and enter what the manager said before saving.`,
        })
      }
      lossNote = `[LOSS -${lossQty}] Reason: ${String(loss_reason).trim()}`
        + (isManager ? ' (manager counted)' : ` | Manager said: ${String(manager_response).trim()}`)
    }

    const countedBy = session.user?.name || (session.user as any)?.username || null
    const finalNotes = [lossNote, (notes && String(notes).trim()) || null].filter(Boolean).join(' · ') || null

    const [existing] = await sql`
      SELECT id, quantity_counted, counted_by FROM stock_counts
      WHERE item_id = ${itemId} AND count_date::date = ${today}
      ORDER BY id DESC LIMIT 1
    `
    if (existing) {
      if (Number(existing.quantity_counted) !== Number(qty)) {
        await recordCountRevision({
          stockCountId: existing.id,
          itemId: Number(itemId),
          countDate: today,
          oldQty: existing.quantity_counted,
        oldCountedBy: existing.counted_by,
        changedBy: countedBy,
      })
    }
    await sql`
      UPDATE stock_counts
      SET quantity_counted = ${qty}, notes = ${finalNotes}, source = 'app', counted_by = ${countedBy}, counted_at = NOW()
      WHERE id = ${existing.id}
    `
    await logActivity(countedBy ?? 'Unknown', 'counted stock', `${item[0].canonical_name} · qty ${qty} (replaced today's earlier count)`)
    if (lossNote) await logActivity(countedBy ?? 'Unknown', 'reported count loss', `${item[0].canonical_name} · counted ${qty} vs expected ${expected} — ${lossNote}`)
  } else {
    await sql`
      INSERT INTO stock_counts (item_id, zoho_item_id, item_name, count_date, quantity_counted, notes, source, counted_by, counted_at)
      VALUES (${itemId}, ${item[0].zoho_item_id}, ${item[0].canonical_name}, ${today}, ${qty}, ${finalNotes}, 'app', ${countedBy}, NOW())
    `
    await logActivity(countedBy ?? 'Unknown', 'counted stock', `${item[0].canonical_name} · qty ${qty}`)
    if (lossNote) await logActivity(countedBy ?? 'Unknown', 'reported count loss', `${item[0].canonical_name} · counted ${qty} vs expected ${expected} — ${lossNote}`)
  }
  return success({
    ok: true,
    ...(pairing && !pairing.blocking ? { pack_count_suggested: pairing.packs } : {}),
  })
  } catch (e) {
    return handleError('stock/count', e)
  }
}
