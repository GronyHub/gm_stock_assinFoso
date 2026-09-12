import sql from '@/lib/db'

// Shared GMC conversion-target Stock On Hand math -- used both by Item
// 360's full per-date history (lib/itemDayRows.ts) and by every other
// place that shows a GMC target's CURRENT stock (see getGmcTargetSohMap
// below), so the two can never silently disagree the way item_stock_
// summary.calculated_soh and Item 360 currently do.

export type GmcSohEvent = { at: number; date: string; kind: 'pack_open' | 'consume' | 'count'; qty: number }

// Walks one item's chronologically-sorted SOH events and returns the
// running balance as of each date it changes on. pack_open and count are
// hard resets -- "a new pack means the old one is assumed empty/replaced",
// the same premise the whole GMC-tracking feature started from, and a
// physical count is ground truth the same way. consume decreases the
// balance in between. Two pack-opens on the same calendar date (before
// any consumption between them) combine into a single reset, consistent
// with how the day-grained CNV total already sums same-day pack
// quantities elsewhere in this codebase.
export function walkGmcSohByDate(eventsSorted: GmcSohEvent[]): Map<string, number> {
  let balance: number | null = null
  let resetDate: string | null = null
  const byDate = new Map<string, number>()
  for (const ev of eventsSorted) {
    if (ev.kind === 'pack_open') {
      balance = resetDate === ev.date && balance !== null ? parseFloat((balance + ev.qty).toFixed(4)) : ev.qty
      resetDate = ev.date
    } else if (ev.kind === 'count') {
      balance = ev.qty
      resetDate = ev.date
    } else if (balance !== null) {
      balance = parseFloat((balance - ev.qty).toFixed(4))
    }
    if (balance !== null) byDate.set(ev.date, balance)
  }
  return byDate
}

const numVal = (v: string | null | undefined) => (v ? parseFloat(v) || 0 : 0)
const toDate = (ts: string) => new Date(ts).toISOString().slice(0, 10)

// Current (as-of-right-now) Stock On Hand for every GMC conversion target
// item (items.gmc_type = 'gmc'), computed the same tap-precise, pack-
// reset-aware way as Item 360 -- NOT item_stock_summary.calculated_soh,
// which has no concept of a pack-open resetting the count and drifts
// further from reality with every tap once its last real physical count
// ages. Batched across every target item in one pass (there are only a
// handful of these, confirmed live) rather than looping getItemDayRows
// per item, which would run a much heavier multi-CTE query (VCP/ACP/
// aliases/bills-breakdown) that's irrelevant to a plain stock number.
// Deliberately uncached, like /api/items/gmc-target-stock already is --
// this must reflect a tap that just happened, not a stale snapshot.
export async function getGmcTargetSohMap(): Promise<Map<number, number>> {
  const targets = await sql`SELECT id FROM items WHERE gmc_type = 'gmc'` as unknown as { id: number }[]
  const targetIds = targets.map(t => t.id)
  if (targetIds.length === 0) return new Map()

  const [packOpenEvents, directSaleEvents, serviceConsumptionEvents, countEvents,
    fallbackConvIn, fallbackDirect, fallbackService] = await Promise.all([
    // A real GMC purchase of a pack_to_gmc item converting into one of
    // these targets -- same shape as getItemDayRows's own packOpenEvents.
    sql`
      SELECT i.converts_to_item_id AS target_id, t.tapped_at, t.quantity, COALESCE(i.units_per_pack, 1) AS units_per_pack
      FROM live_sale_taps t
      JOIN items i ON i.id = t.item_id
      JOIN sales_receipts r ON r.id = t.receipt_id
      WHERE i.gmc_type = 'pack_to_gmc' AND i.converts_to_item_id = ANY(${targetIds})
        AND t.undone = false AND r.customer_name = 'Grony Multimedia as Customer'
    ` as unknown as Promise<{ target_id: number; tapped_at: string; quantity: number; units_per_pack: string }[]>,
    // A real sale of a target itself (WIC or GMC), whichever way it was
    // sold in Live Sale.
    sql`
      SELECT item_id AS target_id, tapped_at, quantity FROM live_sale_taps
      WHERE item_id = ANY(${targetIds}) AND undone = false
    ` as unknown as Promise<{ target_id: number; tapped_at: string; quantity: number }[]>,
    // A service_using_gmc item's own real (WIC) tap drawing on one of
    // these targets.
    sql`
      SELECT i.converts_to_item_id AS target_id, t.tapped_at, t.quantity
      FROM live_sale_taps t
      JOIN items i ON i.id = t.item_id
      JOIN sales_receipts r ON r.id = t.receipt_id
      WHERE i.gmc_type = 'service_using_gmc' AND i.converts_to_item_id = ANY(${targetIds})
        AND t.undone = false AND r.customer_name IS NULL
    ` as unknown as Promise<{ target_id: number; tapped_at: string; quantity: number }[]>,
    // Physical counts -- ground truth, same as getItemDayRows's countEvents.
    sql`
      SELECT item_id AS target_id, counted_at, quantity_counted FROM stock_counts
      WHERE item_id = ANY(${targetIds}) AND counted_at IS NOT NULL
    ` as unknown as Promise<{ target_id: number; counted_at: string; quantity_counted: string }[]>,
    // Pre-live (day-grained) fallback, for a date with no tap-sourced
    // event at all -- the same 3 quantities getItemDayRows's main CTE
    // already sources (daily_converted_in / wic+gmc / consumed-via-
    // service), as their own minimal batched queries instead of the full
    // multi-CTE query, since VCP/ACP/aliases/bills-breakdown are
    // irrelevant to a plain stock number and meaningfully heavier.
    sql`
      SELECT src.converts_to_item_id AS target_id, sr.receipt_date::date::text AS d,
             SUM(srl.quantity * COALESCE(src.units_per_pack, 1)) AS qty
      FROM sales_receipt_lines srl
      JOIN sales_receipts sr ON sr.id = srl.receipt_id
      JOIN items src ON src.id = srl.item_id
      WHERE src.converts_to_item_id = ANY(${targetIds})
        AND COALESCE(src.product_type, 'goods') <> 'service'
        AND sr.customer_name = 'Grony Multimedia as Customer'
      GROUP BY src.converts_to_item_id, sr.receipt_date::date
    ` as unknown as Promise<{ target_id: number; d: string; qty: string }[]>,
    sql`
      SELECT srl.item_id AS target_id, sr.receipt_date::date::text AS d, SUM(srl.quantity) AS qty
      FROM sales_receipt_lines srl
      JOIN sales_receipts sr ON sr.id = srl.receipt_id
      WHERE srl.item_id = ANY(${targetIds})
      GROUP BY srl.item_id, sr.receipt_date::date
    ` as unknown as Promise<{ target_id: number; d: string; qty: string }[]>,
    sql`
      SELECT src.converts_to_item_id AS target_id, sr.receipt_date::date::text AS d,
             SUM(srl.quantity * COALESCE(src.units_per_pack, 1)) AS qty
      FROM sales_receipt_lines srl
      JOIN sales_receipts sr ON sr.id = srl.receipt_id
      JOIN items src ON src.id = srl.item_id
      WHERE src.converts_to_item_id = ANY(${targetIds})
        AND src.product_type = 'service'
        AND (sr.customer_name IS NULL OR sr.customer_name <> 'Grony Multimedia as Customer')
      GROUP BY src.converts_to_item_id, sr.receipt_date::date
    ` as unknown as Promise<{ target_id: number; d: string; qty: string }[]>,
  ])

  const preciseByTarget = new Map<number, GmcSohEvent[]>()
  const pushPrecise = (targetId: number, ev: GmcSohEvent) => {
    const arr = preciseByTarget.get(targetId) ?? []
    arr.push(ev)
    preciseByTarget.set(targetId, arr)
  }
  for (const p of packOpenEvents) pushPrecise(p.target_id, { at: new Date(p.tapped_at).getTime(), date: toDate(p.tapped_at), kind: 'pack_open', qty: (numVal(p.units_per_pack) || 1) * Number(p.quantity) })
  for (const s of directSaleEvents) pushPrecise(s.target_id, { at: new Date(s.tapped_at).getTime(), date: toDate(s.tapped_at), kind: 'consume', qty: Number(s.quantity) })
  for (const s of serviceConsumptionEvents) pushPrecise(s.target_id, { at: new Date(s.tapped_at).getTime(), date: toDate(s.tapped_at), kind: 'consume', qty: Number(s.quantity) })
  for (const c of countEvents) pushPrecise(c.target_id, { at: new Date(c.counted_at).getTime(), date: toDate(c.counted_at), kind: 'count', qty: numVal(c.quantity_counted) })

  // Only fall back for a (target, date) with no precise tap event of its
  // own -- never re-process a date that already has real tap data.
  const preciseDatesByTarget = new Map<number, Set<string>>()
  for (const [targetId, evs] of preciseByTarget) {
    preciseDatesByTarget.set(targetId, new Set(evs.map(e => e.date)))
  }
  const fallbackByTargetDate = new Map<number, Map<string, { given: number; used: number }>>()
  const addFallback = (targetId: number, d: string, given: number, used: number) => {
    if (preciseDatesByTarget.get(targetId)?.has(d)) return
    const byDate = fallbackByTargetDate.get(targetId) ?? new Map<string, { given: number; used: number }>()
    const cur = byDate.get(d) ?? { given: 0, used: 0 }
    cur.given += given
    cur.used += used
    byDate.set(d, cur)
    fallbackByTargetDate.set(targetId, byDate)
  }
  for (const r of fallbackConvIn) addFallback(r.target_id, r.d, numVal(r.qty), 0)
  for (const r of fallbackDirect) addFallback(r.target_id, r.d, 0, numVal(r.qty))
  for (const r of fallbackService) addFallback(r.target_id, r.d, 0, numVal(r.qty))

  const result = new Map<number, number>()
  for (const targetId of targetIds) {
    const merged: GmcSohEvent[] = [...(preciseByTarget.get(targetId) ?? [])]
    for (const [d, { given, used }] of fallbackByTargetDate.get(targetId) ?? []) {
      const dayAt = new Date(d + 'T12:00:00.000Z').getTime()
      if (given > 0) merged.push({ at: dayAt, date: d, kind: 'pack_open', qty: given })
      if (used > 0) merged.push({ at: dayAt + 1, date: d, kind: 'consume', qty: used })
    }
    merged.sort((a, b) => a.at - b.at)
    const byDate = walkGmcSohByDate(merged)
    if (byDate.size === 0) continue
    const lastDate = Array.from(byDate.keys()).sort().pop()!
    result.set(targetId, byDate.get(lastDate)!)
  }
  return result
}
