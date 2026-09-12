import sql from '@/lib/db'

// Per-pack (GMC → GMC) timeline, at TAP-TIMESTAMP precision -- a sibling of
// lib/packChain.ts's buildPackCycles, which does the same "a pack-take
// starts a budget, everything used until the next take belongs to it" idea
// but only at day granularity (from sales_receipt_lines/receipt_date, which
// carries no time component). This one is built entirely from
// live_sale_taps.tapped_at instead, so two packs of the same item opened on
// the same calendar day still get their own separate entries here, with
// consumption correctly split between them by the moment it actually
// happened -- something day-grained data can never represent. Kept as its
// own file rather than folded into packChain.ts since it's a different
// data source (taps, not receipt lines) answering a different question
// (exactly what happened, moment to moment) -- it doesn't feed, and isn't
// fed by, the existing day-grained Loss/Gain math, which is unaffected by
// any of this.
//
// Scope: only tap-sourced events carry a real timestamp. Consumption or
// pack purchases entered any other way (the classic Sales Receipts form,
// a manually edited receipt) have no precise moment to place on a timeline
// and are intentionally left out here -- they're still fully accounted for
// in the existing day-grained Loss/Gain accounting (lib/itemDayRows.ts /
// lib/packChain.ts), just not in this specific view.
export type PackTimelineEntry = {
  start: string // ISO timestamp this pack was opened
  end: string | null // ISO timestamp of the NEXT pack-open, or null if still open
  packItemName: string
  sheetsGiven: number
  used: number // sum of consumption taps strictly within [start, end)
  usedBreakdown: { serviceName: string; qty: number; tappedAt: string }[]
}

export async function buildPackTimeline(targetItemId: number): Promise<PackTimelineEntry[]> {
  const packOpens = await sql`
    SELECT t.tapped_at, t.quantity, i.canonical_name AS pack_name, COALESCE(i.units_per_pack, 1) AS units_per_pack
    FROM live_sale_taps t
    JOIN items i ON i.id = t.item_id
    JOIN sales_receipts r ON r.id = t.receipt_id
    WHERE i.gmc_type = 'pack_to_gmc' AND i.converts_to_item_id = ${targetItemId}
      AND t.undone = false
      AND r.customer_name = 'Grony Multimedia as Customer'
    ORDER BY t.tapped_at ASC
  ` as { tapped_at: string; quantity: number; pack_name: string; units_per_pack: number }[]

  const consumed = await sql`
    SELECT t.tapped_at, t.quantity, i.canonical_name AS service_name
    FROM live_sale_taps t
    JOIN items i ON i.id = t.item_id
    JOIN sales_receipts r ON r.id = t.receipt_id
    WHERE i.gmc_type = 'service_using_gmc' AND i.converts_to_item_id = ${targetItemId}
      AND t.undone = false
      AND r.customer_name IS NULL
    ORDER BY t.tapped_at ASC
  ` as { tapped_at: string; quantity: number; service_name: string }[]

  type Event =
    | { kind: 'open'; tappedAt: string; packName: string; sheetsGiven: number }
    | { kind: 'use'; tappedAt: string; serviceName: string; qty: number }
  const events: Event[] = [
    ...packOpens.map(p => ({ kind: 'open' as const, tappedAt: p.tapped_at, packName: p.pack_name, sheetsGiven: Number(p.units_per_pack) * p.quantity })),
    ...consumed.map(c => ({ kind: 'use' as const, tappedAt: c.tapped_at, serviceName: c.service_name, qty: c.quantity })),
  ].sort((a, b) => new Date(a.tappedAt).getTime() - new Date(b.tappedAt).getTime())

  const entries: PackTimelineEntry[] = []
  let current: PackTimelineEntry | null = null
  for (const e of events) {
    if (e.kind === 'open') {
      if (current) { current.end = e.tappedAt; entries.push(current) }
      current = { start: e.tappedAt, end: null, packItemName: e.packName, sheetsGiven: e.sheetsGiven, used: 0, usedBreakdown: [] }
    } else if (current) {
      // Usage before the first recorded pack-open has no budget to count
      // against, same as buildPackCycles' own rule -- skipped, not attributed.
      current.used = parseFloat((current.used + e.qty).toFixed(4))
      current.usedBreakdown.push({ serviceName: e.serviceName, qty: e.qty, tappedAt: e.tappedAt })
    }
  }
  if (current) entries.push(current)
  return entries.reverse()
}
