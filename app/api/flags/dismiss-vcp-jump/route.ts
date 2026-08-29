import { requireAuth, getActorName, badRequest, success } from '@/lib/api'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { ensureDismissedVcpJumpsTable } from '@/lib/vcpJumpDismissals'
import { NextRequest } from 'next/server'

// Confirms one item's one bill-to-bill VCP jump as a genuine price change
// (not a data-entry error) so it stops showing up in /api/flags' vcpJumps
// and Item 360's own per-day computeVcpJumps -- same "record it, don't
// re-derive a fix" idea as /api/flags/dismiss-duplicate, just for this
// violation.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { itemId, billId } = await req.json() as { itemId: number; billId: number }
  if (!itemId || !billId) return badRequest('Missing itemId/billId')

  await ensureDismissedVcpJumpsTable()
  const actor = getActorName(session)
  await sql`
    INSERT INTO dismissed_vcp_jumps (item_id, bill_id, dismissed_by)
    VALUES (${itemId}, ${billId}, ${actor})
    ON CONFLICT (item_id, bill_id) DO NOTHING
  `
  await logActivity(actor, 'confirmed VCP jump as correct', `Item #${itemId} · Bill #${billId}`)
  return success({ ok: true })
}

// ?itemId= -- the bill ids already confirmed for this one item, so Item
// 360's own client-side computeVcpJumps can filter them straight out.
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const itemId = Number(url.searchParams.get('itemId'))
  if (!itemId) return badRequest('Missing itemId')

  await ensureDismissedVcpJumpsTable()
  const rows = await sql`SELECT bill_id FROM dismissed_vcp_jumps WHERE item_id = ${itemId}` as { bill_id: number }[]
  return success(rows.map(r => r.bill_id))
}
