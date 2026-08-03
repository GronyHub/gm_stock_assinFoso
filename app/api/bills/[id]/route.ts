import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { isOwnerLevel } from '@/lib/roles'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const lines = await sql`
    SELECT
      COALESCE(resolved_name, raw_item_name) AS item_name,
      quantity,
      unit_price,
      item_total,
      usage_unit
    FROM bill_lines
    WHERE bill_id = ${Number(id)}
    ORDER BY id
  `
  return NextResponse.json(lines)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { bill_date, vendor_name, status } = await req.json()

  const [row] = await sql`
    UPDATE bills
    SET
      bill_date = COALESCE(${bill_date ?? null}, bill_date),
      vendor_name = COALESCE(${vendor_name ?? null}, vendor_name),
      status = COALESCE(${status ?? null}, status)
    WHERE id = ${Number(id)}
    RETURNING id, bill_number, bill_date::date AS bill_date, vendor_name, total, status, entered_by
  `
  const actor = (session.user as any)?.username || session.user?.name || 'Unknown'
  await logActivity(actor, 'edited bill', `Bill #${id}${row.vendor_name ? ` — ${row.vendor_name}` : ''}`)
  return NextResponse.json(row)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isOwnerLevel(session.user as any)) {
    return NextResponse.json({ error: 'Only Grony or Joe can delete a bill' }, { status: 403 })
  }

  const { id } = await params
  const billId = Number(id)

  const [bill] = await sql`SELECT id, bill_number, vendor_name FROM bills WHERE id = ${billId}`
  if (!bill) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await sql`DELETE FROM bill_lines WHERE bill_id = ${billId}`
  await sql`DELETE FROM bills WHERE id = ${billId}`

  const actor = (session.user as any)?.username || session.user?.name || 'Unknown'
  await logActivity(actor, 'deleted bill', `Bill #${billId}${bill.vendor_name ? ` — ${bill.vendor_name}` : ''}`)

  return NextResponse.json({ ok: true })
}
