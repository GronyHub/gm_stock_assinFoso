import { requireAuth, getActorName, notFound, success } from '@/lib/api'
import { getIdParam } from '@/lib/api/params'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { isOwnerLevel } from '@/lib/roles'
import { ensureBillAttachmentsColumn, normalizeAttachments } from '@/lib/billAttachments'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const billId = await getIdParam(params)
  const lines = await sql`
    SELECT
      COALESCE(resolved_name, raw_item_name) AS item_name,
      quantity,
      unit_price,
      item_total,
      usage_unit
    FROM bill_lines
    WHERE bill_id = ${billId}
    ORDER BY id
  `
  return success(lines)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth()
  if (error) return error

  const billId = await getIdParam(params)
  const { bill_date, vendor_name, status, attachments } = await req.json()
  const attachmentsJson = attachments !== undefined ? JSON.stringify(normalizeAttachments(attachments)) : null
  const vendorNameProvided = vendor_name !== undefined

  await ensureBillAttachmentsColumn()
  const [row] = await sql`
    UPDATE bills
    SET
      bill_date = COALESCE(${bill_date ?? null}, bill_date),
      vendor_name = CASE WHEN ${vendorNameProvided} THEN ${vendor_name ?? null} ELSE vendor_name END,
      status = COALESCE(${status ?? null}, status),
      attachments = COALESCE(${attachmentsJson}::jsonb, attachments)
    WHERE id = ${billId}
    RETURNING id, bill_number, bill_date::date AS bill_date, vendor_name, total, status, entered_by,
              COALESCE(attachments, '[]'::jsonb) AS attachments
  `
  if (!row) return notFound()
  const actor = getActorName(session)
  await logActivity(actor, 'edited bill', `Bill #${billId}${row.vendor_name ? ` — ${row.vendor_name}` : ''}`)
  return success(row)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as any)) {
    return NextResponse.json({ error: 'Only Grony or Joe can delete a bill' }, { status: 403 })
  }

  const billId = await getIdParam(params)

  const [bill] = await sql`SELECT id, bill_number, vendor_name FROM bills WHERE id = ${billId}`
  if (!bill) return notFound()

  await sql`DELETE FROM bill_lines WHERE bill_id = ${billId}`
  await sql`DELETE FROM bills WHERE id = ${billId}`

  const actor = getActorName(session)
  await logActivity(actor, 'deleted bill', `Bill #${billId}${bill.vendor_name ? ` — ${bill.vendor_name}` : ''}`)

  return success({ ok: true })
}
