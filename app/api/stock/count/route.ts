import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { recordCountRevision } from '@/lib/countRevisions'
import { gainViolation, expectedStockAt } from '@/lib/stockGuard'
import { isOwnerLevel } from '@/lib/roles'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { itemId, qty, notes, loss_reason, manager_response } = await req.json()
  if (!itemId || qty == null) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  if (Number(qty) < 0 || isNaN(Number(qty))) {
    return NextResponse.json({ error: 'Not allowed — a count can never be negative. Stock on hand must be 0 or more.' }, { status: 400 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const item = await sql`SELECT zoho_item_id, canonical_name, product_type, cf_group FROM items WHERE id = ${itemId}`
  if (!item.length) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  // Services are not physical stock -- there is nothing on a shelf to count.
  if (item[0].product_type === 'service' || /^service/i.test(item[0].cf_group ?? '')) {
    return NextResponse.json({ error: `"${item[0].canonical_name}" is a service — services cannot be counted.` }, { status: 400 })
  }

  // Gains are not allowed: a count above what the records support means a
  // bill or GMC record is missing and must be entered first.
  const gainErr = await gainViolation(Number(itemId), Number(qty), today)
  if (gainErr) return NextResponse.json({ error: gainErr }, { status: 400 })

  // Losses must be acknowledged, not silently recorded: the counter gives a
  // reason, informs the manager and enters the manager's response (the
  // manager gives their own explanation when they are the one counting).
  const isManager = isOwnerLevel(session.user as any)
  const expected = await expectedStockAt(Number(itemId), today)
  const lossQty = expected !== null ? parseFloat((expected - Number(qty)).toFixed(4)) : 0
  let lossNote: string | null = null
  if (expected !== null && lossQty > 0.001) {
    if (!loss_reason || !String(loss_reason).trim()) {
      return NextResponse.json({
        requires_loss_reason: true,
        expected, counted: Number(qty), loss: lossQty, is_manager: isManager,
        error: `Loss detected: expected ${expected}, counted ${qty} (-${lossQty}). A reason is required before this count can be saved.`,
      }, { status: 409 })
    }
    if (!isManager && (!manager_response || !String(manager_response).trim())) {
      return NextResponse.json({
        requires_loss_reason: true,
        expected, counted: Number(qty), loss: lossQty, is_manager: isManager,
        error: `Inform the manager of this loss and enter what the manager said before saving.`,
      }, { status: 409 })
    }
    lossNote = `[LOSS -${lossQty}] Reason: ${String(loss_reason).trim()}`
      + (isManager ? ' (manager counted)' : ` | Manager said: ${String(manager_response).trim()}`)
  }

  // session.user.name = display_name (set in auth authorize callback)
  // session.user.username = raw login name (set in jwt/session callbacks)
  const countedBy = session.user?.name || (session.user as any)?.username || null
  const finalNotes = [lossNote, (notes && String(notes).trim()) || null].filter(Boolean).join(' · ') || null

  // One count per item per day: the loss math SUMS counts per date, so a
  // second same-day count (e.g. a manual recount after the daily count)
  // would double the counted quantity. Replace today's count instead.
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
      SET quantity_counted = ${qty}, notes = ${finalNotes}, source = 'app', counted_by = ${countedBy}
      WHERE id = ${existing.id}
    `
    await logActivity(countedBy ?? 'Unknown', 'counted stock', `${item[0].canonical_name} · qty ${qty} (replaced today's earlier count)`)
    if (lossNote) await logActivity(countedBy ?? 'Unknown', 'reported count loss', `${item[0].canonical_name} · counted ${qty} vs expected ${expected} — ${lossNote}`)
  } else {
    await sql`
      INSERT INTO stock_counts (item_id, zoho_item_id, item_name, count_date, quantity_counted, notes, source, counted_by)
      VALUES (${itemId}, ${item[0].zoho_item_id}, ${item[0].canonical_name}, ${today}, ${qty}, ${finalNotes}, 'app', ${countedBy})
    `
    await logActivity(countedBy ?? 'Unknown', 'counted stock', `${item[0].canonical_name} · qty ${qty}`)
    if (lossNote) await logActivity(countedBy ?? 'Unknown', 'reported count loss', `${item[0].canonical_name} · counted ${qty} vs expected ${expected} — ${lossNote}`)
  }
  return NextResponse.json({ ok: true })
}
