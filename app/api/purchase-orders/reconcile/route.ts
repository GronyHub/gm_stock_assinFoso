import { requireAuth, success, handleError } from '@/lib/api'
import { reconcileAllPoReceipts } from '@/lib/poReceipts'
import { logActivity } from '@/lib/logger'
import { getActorName } from '@/lib/api'

// POST -> compare every PO with the existing Bills and remove the "received"
// mark from any whose bill is missing. Returns what was fixed.
export async function POST() {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    const fixed = await reconcileAllPoReceipts()
    if (fixed.length) await logActivity(getActorName(session), 'reset purchase orders to not received', fixed.map(f => f.po_number).join(', '))
    return success({ fixed })
  } catch (e) { return handleError('purchase-orders/reconcile', e) }
}
