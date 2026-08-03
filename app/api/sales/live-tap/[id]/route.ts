import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'

// Undo -- used both by the quick "Undo" that appears right after your own
// tap, and by the audit log for reversing a tap noticed later. Never a hard
// delete: the tap row stays, just marked `undone`, so the log keeps an
// honest record of what was tapped and later reversed instead of it just
// vanishing. Idempotent -- undoing an already-undone tap is a no-op, not
// an error, so a double-tap on the Undo button itself can't decrement twice.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const [tap] = await sql`SELECT * FROM live_sale_taps WHERE id = ${Number(id)}`
    if (!tap) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (tap.undone) return NextResponse.json({ ok: true, alreadyUndone: true })

    await sql`UPDATE live_sale_taps SET undone = true WHERE id = ${tap.id}`

    if (tap.receipt_line_id) {
      const [line] = await sql`
        UPDATE sales_receipt_lines
        SET quantity = quantity::numeric - 1, item_total = item_total::numeric - ${tap.price}
        WHERE id = ${tap.receipt_line_id}
        RETURNING id, quantity
      `
      if (line && Number(line.quantity) <= 0) {
        await sql`DELETE FROM sales_receipt_lines WHERE id = ${line.id}`
      }
      if (tap.receipt_id) {
        await sql`
          UPDATE sales_receipts SET total = (SELECT COALESCE(SUM(item_total), 0) FROM sales_receipt_lines WHERE receipt_id = ${tap.receipt_id})
          WHERE id = ${tap.receipt_id}
        `
      }
    }

    const actor = session.user?.name || (session.user as { username?: string })?.username || 'Unknown'
    await logActivity(actor, 'undid live sale tap', `${tap.item_name} · ₵${Number(tap.price).toFixed(2)} (tapped by ${tap.staff_name})`)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('live-tap undo error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not undo tap: ${detail}` }, { status: 500 })
  }
}
