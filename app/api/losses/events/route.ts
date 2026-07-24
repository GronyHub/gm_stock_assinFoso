import { computeLossEvents } from '@/lib/lossEvents'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Chronological feed of every LOSS ever detected, across all items, ordered
// by the date the count that surfaced it happened (newest first). One row per
// item per count-day where expected > counted. Gains are excluded -- this is
// the running picture of what the business is losing as it comes in.
//
// ?kind=gain lists GAIN events instead (counted above expected) -- every one
// of those is a record error (missing bill/GMC or count mistake) that should
// be fixed until the list is empty.
export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get('kind') === 'gain' ? 'gain' : 'loss'
  const events = (await computeLossEvents()).filter(e => e.kind === kind)

  // Newest detections first; same-day losses sorted biggest ₵ first.
  events.sort((a, b) => b.date.localeCompare(a.date) || b.loss_amt - a.loss_amt)
  return NextResponse.json(events)
}
