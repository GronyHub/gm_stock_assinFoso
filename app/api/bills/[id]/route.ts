import { requireAuth, getActorName, notFound, success, unauthorized } from '@/lib/api'
import { getIdParam } from '@/lib/api/params'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { isOwnerLevel } from '@/lib/roles'
import { ensureBillAttachmentsColumn, ensureBillEnteredByColumn, normalizeAttachments } from '@/lib/billAttachments'
import { syncVcpForItems } from '@/lib/vcpSync'
import { recomputePoReceived } from '@/lib/poReceipts'
import { NextRequest } from 'next/server'

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

  try {
    await ensureBillAttachmentsColumn()
    await ensureBillEnteredByColumn()
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

    // A bill created by receiving a Purchase Order has its own, separate
    // "received on" date in purchase_order_receipts (shown as the PO's
    // Receiving History) -- editing the bill's date here left that row
    // pointing at the old date, so the two screens disagreed about when the
    // delivery actually happened. Keep them in lockstep.
    if (bill_date) {
      await sql`UPDATE purchase_order_receipts SET received_date = ${bill_date} WHERE bill_id = ${billId}`
    }

    const actor = getActorName(session)
    // 10 minutes flat, same as 'added bill' -- see app/api/bills/route.ts's own
    // comment on the "typing" duration convention.
    await logActivity(actor, 'edited bill', `Bill #${billId}${row.vendor_name ? ` — ${row.vendor_name}` : ''}`, 600)
    return success(row)
  } catch (err) {
    console.error('Error updating bill:', err)
    return new Response(
      JSON.stringify({ error: `Database error: ${err instanceof Error ? err.message : 'Unknown error'}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as any)) {
    return unauthorized()
  }

  const billId = await getIdParam(params)

  const [bill] = await sql`SELECT id, bill_number, vendor_name FROM bills WHERE id = ${billId}`
  if (!bill) return notFound()

  const affectedLines = await sql`SELECT item_id FROM bill_lines WHERE bill_id = ${billId}` as { item_id: number | null }[]

  // If this bill came from receiving a Purchase Order, put that order back to
  // "not received" for these goods so it can be received again.
  const poLinks = await sql`SELECT DISTINCT po_id FROM purchase_order_receipts WHERE bill_id = ${billId}` as { po_id: number }[]
  await sql`DELETE FROM purchase_order_receipts WHERE bill_id = ${billId}`
  await sql`DELETE FROM bill_lines WHERE bill_id = ${billId}`
  await sql`DELETE FROM bills WHERE id = ${billId}`
  for (const l of poLinks) await recomputePoReceived(l.po_id)

  const actor = getActorName(session)
  await logActivity(actor, 'deleted bill', `Bill #${billId}${bill.vendor_name ? ` — ${bill.vendor_name}` : ''}`)
  await syncVcpForItems(affectedLines.map(l => l.item_id))

  return success({ ok: true })
}
