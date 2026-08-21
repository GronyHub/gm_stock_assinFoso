import sql from '@/lib/db'
import { itemCountIntervalLabels } from '@/lib/countRules'

export type CountDueInfo = {
  itemId: number
  itemName: string
  daysOverdue: number
  // The label itemCountIntervalLabels() gave it, so callers/UI can say
  // *why* it's due (e.g. "Daily" vs "Every 15d") without recomputing.
  cadenceLabel: string
}

// Items from the given set that are currently due for a count -- the hard
// gate before any sale (Live Sale tap, New Sale) or bill can be recorded
// against them. A confirmed count is what keeps "expected stock" from
// drifting silently away from what's actually on the shelf; letting a
// transaction through on stale information is exactly the gap this closes.
//
// Two deliberate carve-outs, both already implied by itemCountIntervalLabels:
// - 'excluded'/'dormant' items are never due -- they're explicitly opted
//   out of counting (dormant additionally requires a bill before it's ever
//   counted again, so gating a bill on THAT would be circular).
// - An item with NO prior count at all is never due *for this guard*, even
//   though it still shows up in the on-screen "needs counting" queues.
//   Blocking would be a chicken-and-egg trap for a bill (a brand-new
//   item's very first restock can't happen before it's counted, but there's
//   nothing on the shelf to count until that restock lands) -- and there's
//   no established baseline yet for a sale to threaten either, same
//   reasoning stockGuard's expectedStockAt already uses (no earlier count
//   = nothing to judge against, so no guard applies).
export async function itemsDueForCount(itemIds: (number | null | undefined)[]): Promise<Map<number, CountDueInfo>> {
  const uniqueIds = Array.from(new Set(itemIds.filter((id): id is number => typeof id === 'number' && Number.isFinite(id))))
  const result = new Map<number, CountDueInfo>()
  if (uniqueIds.length === 0) return result

  const [labels, lastCounts, names] = await Promise.all([
    itemCountIntervalLabels(),
    sql`
      SELECT item_id, MAX(count_date::date)::text AS d
      FROM stock_counts
      WHERE item_id = ANY(${uniqueIds})
      GROUP BY item_id
    ` as unknown as Promise<{ item_id: number; d: string }[]>,
    sql`SELECT id, canonical_name FROM items WHERE id = ANY(${uniqueIds})` as unknown as Promise<{ id: number; canonical_name: string }[]>,
  ])

  const lastCountByItem = new Map(lastCounts.map(r => [r.item_id, r.d]))
  const nameByItem = new Map(names.map(r => [r.id, r.canonical_name]))
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayMs = Date.parse(todayStr + 'T00:00:00Z')

  for (const id of uniqueIds) {
    const label = labels.get(id)
    if (!label || label === 'excluded' || label === 'dormant') continue

    const lastCountDate = lastCountByItem.get(id)
    if (!lastCountDate) continue // never counted -- see carve-out above

    const cadenceDays = label === 'daily' ? 0 : label === '7' ? 7 : /^\d+$/.test(label) ? Number(label) : 15
    const daysSince = Math.floor((todayMs - Date.parse(lastCountDate + 'T00:00:00Z')) / 86400000)
    if (daysSince > cadenceDays) {
      result.set(id, {
        itemId: id,
        itemName: nameByItem.get(id) ?? `Item #${id}`,
        daysOverdue: daysSince - cadenceDays,
        cadenceLabel: label,
      })
    }
  }

  return result
}

// Shared 409 shape every write-path guard below returns, so the frontend
// (once it's built) has one consistent contract to react to across Live
// Sale taps, New Sale, and Bills, regardless of which endpoint fired it.
export function countGuardResponseBody(due: CountDueInfo[]) {
  const names = due.map(d => `"${d.itemName}"`).join(', ')
  return {
    requires_count: true,
    items: due,
    error: due.length === 1
      ? `${names} needs to be counted before this can be recorded -- it's ${due[0].daysOverdue} day${due[0].daysOverdue === 1 ? '' : 's'} overdue.`
      : `${names} need to be counted before this can be recorded.`,
  }
}
