import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { isOwnerLevel } from '@/lib/roles'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { quantity_counted, notes } = await req.json()
  if (quantity_counted == null) return NextResponse.json({ error: 'Missing qty' }, { status: 400 })

  const rows = await sql`
    UPDATE stock_counts
    SET quantity_counted = ${quantity_counted}, notes = ${notes || null}
    WHERE id = ${id}
    RETURNING id, item_name, count_date::text AS count_date, quantity_counted, notes, counted_by, source
  `
  const actor = (session.user as any)?.username || session.user?.name || 'Unknown'
  await logActivity(actor, 'edited stock count', `${rows[0].item_name} · qty ${quantity_counted} on ${rows[0].count_date}`)
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
    SELECT id, item_name, count_date::text AS count_date, quantity_counted FROM stock_counts WHERE id = ${Number(id)}
  `
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await sql`DELETE FROM stock_counts WHERE id = ${Number(id)}`

  const actor = (session.user as any)?.username || session.user?.name || 'Unknown'
  await logActivity(actor, 'deleted stock count', `${row.item_name} · qty ${Number(row.quantity_counted)} on ${row.count_date}`)
  return NextResponse.json({ ok: true })
}
