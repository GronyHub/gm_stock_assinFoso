import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { isOwnerLevel } from '@/lib/roles'
import { recordCountRevision } from '@/lib/countRevisions'
import { gainViolation, expectedStockAt } from '@/lib/stockGuard'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { quantity_counted, notes, loss_reason, manager_response } = await req.json()
  if (quantity_counted == null) return NextResponse.json({ error: 'Missing qty' }, { status: 400 })
  if (Number(quantity_counted) < 0 || isNaN(Number(quantity_counted))) {
    return NextResponse.json({ error: 'Not allowed — a count can never be negative. Stock on hand must be 0 or more.' }, { status: 400 })
  }

  const actor = (session.user as any)?.username || session.user?.name || 'Unknown'

  // Keep the previous value so the count cell can show its edit history.
  const [before] = await sql`
    SELECT item_id, count_date::date::text AS count_date, quantity_counted, counted_by
    FROM stock_counts WHERE id = ${id}
  `

  // Gains are not allowed on edits either: the corrected value must still be
  // explainable by the records as of that date.
  let lossNote: string | null = null
  if (before?.item_id && before.count_date) {
    const gainErr = await gainViolation(before.item_id, Number(quantity_counted), before.count_date)
    if (gainErr) return NextResponse.json({ error: gainErr }, { status: 400 })

    // Deepening a loss (or creating one) on edit needs the same acknowledgement
    // as a fresh count: a reason, plus the manager's response for non-managers.
    const isManager = isOwnerLevel(session.user as any)
    const expected = await expectedStockAt(before.item_id, before.count_date)
    const lossQty = expected !== null ? parseFloat((expected - Number(quantity_counted)).toFixed(4)) : 0
    const worsens = Number(quantity_counted) < Number(before.quantity_counted)
    if (expected !== null && lossQty > 0.001 && worsens) {
      if (!loss_reason || !String(loss_reason).trim()) {
        return NextResponse.json({
          requires_loss_reason: true,
          expected, counted: Number(quantity_counted), loss: lossQty, is_manager: isManager,
          error: `Loss detected: expected ${expected}, counted ${quantity_counted} (-${lossQty}). A reason is required before this count can be saved.`,
        }, { status: 409 })
      }
      if (!isManager && (!manager_response || !String(manager_response).trim())) {
        return NextResponse.json({
          requires_loss_reason: true,
          expected, counted: Number(quantity_counted), loss: lossQty, is_manager: isManager,
          error: `Inform the manager of this loss and enter what the manager said before saving.`,
        }, { status: 409 })
      }
      lossNote = `[LOSS -${lossQty}] Reason: ${String(loss_reason).trim()}`
        + (isManager ? ' (manager counted)' : ` | Manager said: ${String(manager_response).trim()}`)
    }
  }

  if (before && Number(before.quantity_counted) !== Number(quantity_counted)) {
    await recordCountRevision({
      stockCountId: Number(id),
      itemId: before.item_id,
      countDate: before.count_date,
      oldQty: before.quantity_counted,
      oldCountedBy: before.counted_by,
      changedBy: actor,
    })
  }

  const finalNotes = [lossNote, (notes && String(notes).trim()) || null].filter(Boolean).join(' · ') || null
  const rows = await sql`
    UPDATE stock_counts
    SET quantity_counted = ${quantity_counted}, notes = ${finalNotes}
    WHERE id = ${id}
    RETURNING id, item_name, count_date::text AS count_date, quantity_counted, notes, counted_by, source
  `
  await logActivity(actor, 'edited stock count', `${rows[0].item_name} · qty ${quantity_counted} on ${rows[0].count_date}`)
  if (lossNote) await logActivity(actor, 'reported count loss', `${rows[0].item_name} · ${rows[0].count_date} — ${lossNote}`)
  return NextResponse.json(rows[0])
}

// Hard delete of a count record -- Grony/Joe only. Removing a count changes
// the loss/gain math for every day after it, so it's owner-level like item
// deletion.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isOwnerLevel(session.user as any)) {
    return NextResponse.json({ error: 'Only Grony or Joe can delete a count' }, { status: 403 })
  }

  const { id } = await params
  const [row] = await sql`
    SELECT id, item_id, item_name, count_date::date::text AS count_date, quantity_counted, counted_by
    FROM stock_counts WHERE id = ${Number(id)}
  `
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const actor = (session.user as any)?.username || session.user?.name || 'Unknown'

  // Keep the deleted value visible in the count cell (shown with a ✗).
  await recordCountRevision({
    stockCountId: Number(id),
    itemId: row.item_id,
    countDate: row.count_date,
    oldQty: row.quantity_counted,
    oldCountedBy: row.counted_by,
    changedBy: actor,
    action: 'deleted',
  })

  await sql`DELETE FROM stock_counts WHERE id = ${Number(id)}`

  await logActivity(actor, 'deleted stock count', `${row.item_name} · qty ${Number(row.quantity_counted)} on ${row.count_date}`)
  return NextResponse.json({ ok: true })
}
