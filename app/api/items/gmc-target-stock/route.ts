import { auth } from '@/lib/auth'
import { getGmcTargetSohMap } from '@/lib/gmcStock'
import { NextResponse } from 'next/server'

// Current stock of every item that's a GMC conversion TARGET (something a
// pack_to_gmc item credits, or a service_using_gmc item draws down -- see
// items.converts_to_item_id). Not cached, unlike gmc-ids -- a staff member
// buying a new pack (see /api/sales/live-tap's reset block) needs this to
// read fresh right away, since the whole point is warning them before/as a
// target runs low, not a few minutes late. Uses the pack-reset-aware walk
// in lib/gmcStock.ts, not item_stock_summary.calculated_soh -- that view
// has no concept of a pack-open resetting the count, so it drifts further
// from reality with every tap once its last real physical count ages.
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const gmcMap = await getGmcTargetSohMap()
  return NextResponse.json(Array.from(gmcMap, ([item_id, calculated_soh]) => ({ item_id, calculated_soh })))
}
