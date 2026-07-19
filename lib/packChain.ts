import type { ItemDayRow } from '@/lib/itemDayRows'

// Pure pack-chain loss/gain math, shared between the item detail UI
// (LossTab.tsx, which renders every row of this) and the items-summary
// aggregation (which only needs the totals) -- one implementation so the
// two can never disagree about what a chain's loss actually is.

export function numVal(v: string | null) { return v ? parseFloat(v) || 0 : 0 }

export type ComputedRow = ItemDayRow & { available: number | null; used: number; expected_soh: number | null; loss: number | null }

// Walks a single item's day rows (oldest first) building a running expected
// stock level -- expected = last known count + bought − used (WIC+GMC) −
// converted out + converted in -- and diffing it against each new physical
// count. Returns newest first (the order every caller renders in).
export function computeRows(rows: ItemDayRow[]): ComputedRow[] {
  const result: ComputedRow[] = []
  let prev: number | null = null
  for (const row of rows) {
    const bills = numVal(row.bills_qty), wic = numVal(row.wic_qty), gmc = numVal(row.gmc_qty)
    const convertedIn = numVal(row.converted_in_qty)
    const used = parseFloat((wic + gmc).toFixed(4))
    const counted = row.qty_counted !== null ? parseFloat(row.qty_counted) : null
    let available: number | null = null, expected: number | null = null, loss: number | null = null
    if (prev === null) {
      if (counted !== null) { prev = counted; expected = counted }
    } else {
      available = parseFloat((prev + bills + convertedIn).toFixed(4))
      expected = parseFloat((available - used).toFixed(4))
      if (counted !== null) { loss = parseFloat((expected - counted).toFixed(4)); prev = counted }
      else prev = expected
    }
    result.push({ ...row, available, used, expected_soh: expected, loss })
  }
  return result.reverse()
}

/* Per-pack (GMC → GMC) cycles: every GMC take starts a cycle with a known
   sheet budget (packs × sheets-per-pack). All recorded sheet usage until the
   NEXT GMC take belongs to that cycle. Assuming a new pack is only opened
   when the previous one is finished, budget − used = sheets unaccounted for
   in that cycle. This measures loss purely from GMC and sales records --
   completely independent of physical counts and their errors. */
export type PackCycle = {
  start: string
  end: string | null      // date the next pack was taken; null = still running
  sheetsGiven: number
  used: number
}
export function buildPackCycles(singlesNewestFirst: ComputedRow[]): PackCycle[] {
  const chrono = [...singlesNewestFirst].reverse()
  const cycles: PackCycle[] = []
  let current: PackCycle | null = null
  for (const r of chrono) {
    const conv = numVal(r.converted_in_qty)
    if (conv > 0) {
      if (current) { current.end = r.date; cycles.push(current) }
      // Usage on the opening day belongs to the fresh pack.
      current = { start: r.date, end: null, sheetsGiven: conv, used: r.used }
    } else if (current) {
      current.used = parseFloat((current.used + r.used).toFixed(4))
    }
    // Usage before the first recorded GMC has no budget to count against.
  }
  if (current) cycles.push(current)
  return cycles.reverse()
}

/* Pack-chain merge: pack-level rows joined with the target (singles) rows
   they convert into, by date, so packs/singles/services can be read as one
   table. */
export type PackChainRow = {
  date: string
  packCnt: string | null; packCntBy: string | null; packCntHistory: ItemDayRow['count_history']
  packBl: string | null; packGmc: string | null; packWic: string | null; packSellPrice: string | null
  packExp: number | null; packLoss: number | null
  singlesCnt: string | null; singlesCntBy: string | null; singlesCntHistory: ItemDayRow['count_history']; singlesConvIn: string | null
  singlesBreakdown: { name: string; qty: number; amount: number }[]
  singlesWicQty: string | null; singlesSellPrice: string | null
  singlesUsed: number; singlesExp: number | null; singlesLoss: number | null
}
export function buildPackChainRows(packRows: ComputedRow[], singlesRows: ComputedRow[]): PackChainRow[] {
  const map = new Map<string, PackChainRow>()
  for (const r of packRows) {
    map.set(r.date, {
      date: r.date, packCnt: r.qty_counted, packCntBy: r.counted_by, packCntHistory: r.count_history, packBl: r.bills_qty, packGmc: r.gmc_qty, packWic: r.wic_qty, packSellPrice: r.sell_price,
      packExp: r.expected_soh, packLoss: r.loss,
      singlesCnt: null, singlesCntBy: null, singlesCntHistory: null, singlesConvIn: null, singlesBreakdown: [],
      singlesWicQty: null, singlesSellPrice: null,
      singlesUsed: 0, singlesExp: null, singlesLoss: null,
    })
  }
  for (const r of singlesRows) {
    const existing = map.get(r.date) ?? {
      date: r.date, packCnt: null, packCntBy: null, packCntHistory: null, packBl: null, packGmc: null, packWic: null, packSellPrice: null, packExp: null, packLoss: null,
      singlesCnt: null, singlesCntBy: null, singlesCntHistory: null, singlesConvIn: null, singlesBreakdown: [],
      singlesWicQty: null, singlesSellPrice: null,
      singlesUsed: 0, singlesExp: null, singlesLoss: null,
    }
    existing.singlesCnt = r.qty_counted
    existing.singlesCntBy = r.counted_by
    existing.singlesCntHistory = r.count_history
    existing.singlesConvIn = r.converted_in_qty
    existing.singlesBreakdown = r.wic_breakdown ?? []
    existing.singlesWicQty = r.wic_qty
    existing.singlesSellPrice = r.sell_price
    existing.singlesUsed = r.used
    existing.singlesExp = r.expected_soh
    existing.singlesLoss = r.loss
    map.set(r.date, existing)
  }
  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date))
}

// Pack side only, valued as papers (packs lost × singles-per-pack ×
// sheetPrice) -- never the pack's own selling price, because a missing pack
// is treated as singles that were used but never recorded.
export function packSideCedis(row: PackChainRow, unitsPerPack: number, sheetPrice: number): number | null {
  if (row.packLoss === null) return null
  return parseFloat((row.packLoss * (unitsPerPack > 0 ? unitsPerPack : 0) * sheetPrice).toFixed(2))
}

// ₵ value of one pack cycle's USED/PACK ledger -- positive = loss (sheets
// given but never recorded used), negative = gain (used beyond what the
// pack gave).
export function cycleCedisValue(cyc: PackCycle, sheetPrice: number): number {
  return parseFloat(((cyc.sheetsGiven - cyc.used) * sheetPrice).toFixed(2))
}

// A cycle's LOSS side isn't certain until it closes -- more usage might
// still come in before the next pack, so "sheets left over" could still get
// used up. Its GAIN side (already using more than the pack gave) is
// different: that's already true today and can only grow from here, so it's
// surfaced the moment it happens instead of waiting for the pack to close.
// Returns null when there's nothing to report yet.
export function realizedCycleCedis(cyc: PackCycle, sheetPrice: number): number | null {
  const value = cycleCedisValue(cyc, sheetPrice)
  if (cyc.end !== null) return value
  return value < -0.001 ? value : null
}

// The chain's TOTAL ₵ column, summed: pack-side loss/gain (packs × singles-
// per-pack × sheetPrice) plus each closed cycle's USED/PACK ledger ₵, per
// date. Loss Amount = net of all of it (gains offset losses, same
// convention as a plain item's own lgAmt); Num. of Losses = how many of
// those dates came out as a real loss; Gain Amount = the ₵ sum of the
// dates that came out as a real gain instead (pack-side + cycle-side
// combined, same unit as Loss Amount -- the two are opposite halves of one
// ledger).
export function computeChainLossSummary(packDayRows: ItemDayRow[], singlesDayRows: ItemDayRow[], unitsPerPack: number, sheetPrice: number): { lossAmt: number; lossCount: number; gainAmt: number } {
  const packRows = computeRows(packDayRows)
  const singlesRows = computeRows(singlesDayRows)
  const chainRows = buildPackChainRows(packRows, singlesRows)
  const cycles = buildPackCycles(singlesRows)
  const cyclesByStart = new Map(cycles.map(c => [c.start, c]))

  let lossAmt = 0, lossCount = 0, gainAmt = 0
  for (const row of chainRows) {
    const cyc = cyclesByStart.get(row.date)
    const pCedis = packSideCedis(row, unitsPerPack, sheetPrice)
    const cCedis = cyc ? realizedCycleCedis(cyc, sheetPrice) : null
    if (pCedis === null && cCedis === null) continue
    const total = (pCedis ?? 0) + (cCedis ?? 0)
    lossAmt += total
    if (total > 0.001) lossCount++
    else if (total < -0.001) gainAmt += -total
  }
  return { lossAmt: parseFloat(lossAmt.toFixed(2)), lossCount, gainAmt: parseFloat(gainAmt.toFixed(2)) }
}
