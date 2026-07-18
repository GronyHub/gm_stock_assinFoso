'use client'
import { Fragment, useState, useEffect, useMemo, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { fmtDate } from '@/lib/fmtDate'
import { isOwnerLevel } from '@/lib/roles'

/* ── types ── */
type SummaryRow = {
  item_id: number
  item_name: string
  cf_group: string | null
  product_type: string | null
  soh: string | null
  sp: string | null
  cp: string | null
  units_per_pack: string | null
  converts_to_item_id: number | null
  lgAmt: number
  lgQty: number
  cnt: number
  wic: number
  gmc: number
  bl: number
  cnv: number
}

type CountRevision = { old_qty: string | number | null; old_by: string | null; changed_by: string | null; action?: string | null; changed_at: string }

type DayRow = {
  date: string
  qty_counted: string | null
  counted_by: string | null
  count_history: CountRevision[] | null
  wic_qty: string | null
  gmc_qty: string | null
  bills_qty: string | null
  sell_price: string | null
  aliases: string | null
  converted_in_qty: string | null
  wic_breakdown: { name: string; qty: number; amount: number }[] | null
}
type ComputedRow = DayRow & { available: number | null; used: number; expected_soh: number | null; loss: number | null }

type SortCol = 'item_name' | 'cf_group' | 'product_type' | 'lgAmt' | 'lgQty' | 'cnt' | 'wic' | 'gmc' | 'bl' | 'soh' | 'sp' | 'cp'
type SortDir = 'asc' | 'desc'

const EMPTY_FORM = { item_name: '', cf_group: '', selling_rate: '', purchase_rate: '', units_per_pack: '', unit_name: '', converts_to_item_id: '' }

/* ── helpers ── */
function numVal(v: string | null) { return v ? parseFloat(v) || 0 : 0 }
function fmtN(n: number | null) {
  if (n === null) return '—'
  return n % 1 === 0 ? String(n) : n.toFixed(2)
}
function fmtQs(v: string | null) {
  if (!v) return '—'
  const n = parseFloat(v)
  return isNaN(n) || n === 0 ? '—' : n % 1 === 0 ? String(n) : n.toFixed(2)
}
function fmtQ(v: number) {
  if (v === 0) return '—'
  return v % 1 === 0 ? String(v) : v.toFixed(2)
}
function fmtCcy(v: string | null) {
  if (!v) return '—'
  const x = parseFloat(v)
  return isNaN(x) || x === 0 ? '—' : x.toFixed(0)
}
function fmtAmt(v: number) {
  if (v === 0) return '—'
  const s = Math.abs(v) >= 100 ? Math.abs(v).toFixed(0) : Math.abs(v).toFixed(1)
  return (v > 0 ? '+' : '-') + s
}
function fmtLg(v: number) {
  if (v === 0) return '—'
  const s = Math.abs(v) % 1 === 0 ? String(Math.abs(v)) : Math.abs(v).toFixed(2)
  return (v > 0 ? '+' : '-') + s
}
// Strips the "—" placeholder these fmt* helpers return for empty/zero
// values, for cells that should render fully blank instead.
function blankDash(s: string) { return s === '—' ? '' : s }
function shortSourceName(name: string) {
  return name.replace(/^service\s*-\s*/i, '').slice(0, 10)
}
// Initial of the staff member who took the count, shown in brackets beside
// the CNT value (same style as the ₵ amounts on the service cells). James and
// Joe both start with J, so they get two letters: JM and JO.
function initialOf(name: string | null | undefined): string | null {
  const t = (name ?? '').trim()
  if (!t) return null
  const lower = t.toLowerCase()
  if (lower.startsWith('james')) return 'JM'
  if (lower.startsWith('joe')) return 'JO'
  return t.charAt(0).toUpperCase()
}

/* Staff accountability for a loss row: the loss surfaced at this row's count,
   so it happened somewhere between the PREVIOUS count and this one. Instead of
   blaming everyone who appeared, blame is apportioned by TIME SPENT at the
   shop inside that window -- hours present are opportunity, so each staff
   member's share of the total staffed hours is their share of exposure.
   Clock-in/out times (from staff_times) drive it; a missing clock-out is
   assumed to run to the latest clock-out that day (or 6pm if nobody's is
   recorded). */
type StaffPresence = { name: string; in: string | null; out: string | null }
type Exposure = { name: string; mins: number; pct: number; range: string | null }

function parseTimeMins12(t: string | null): number | null {
  if (!t) return null
  const m = t.match(/^(\d+):(\d+)(am|pm)$/i)
  if (!m) return null
  let h = parseInt(m[1])
  const min = parseInt(m[2])
  const ap = m[3].toLowerCase()
  if (ap === 'pm' && h !== 12) h += 12
  if (ap === 'am' && h === 12) h = 0
  return h * 60 + min
}

function hrsLabel(mins: number) {
  const h = Math.floor(mins / 60), m = Math.round(mins % 60)
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

function staffExposure(rows: PackChainRow[], idx: number, presence: Record<string, StaffPresence[]>): {
  from: string | null; fromBy: string | null; endBy: string | null; shares: Exposure[]; days: number
} {
  const row = rows[idx]
  let from: string | null = null, fromBy: string | null = null
  for (let j = idx + 1; j < rows.length; j++) {
    if (rows[j].packCnt !== null || rows[j].singlesCnt !== null) {
      from = rows[j].date
      fromBy = rows[j].singlesCntBy ?? rows[j].packCntBy
      break
    }
  }
  const minsBy = new Map<string, number>()
  const rangeBy = new Map<string, string>()
  let days = 0
  for (const [d, staff] of Object.entries(presence)) {
    if (!((from === null || d > from) && d <= row.date)) continue
    days++
    const outs = staff.map(s => parseTimeMins12(s.out)).filter((v): v is number => v !== null)
    const dayMaxOut = outs.length ? Math.max(...outs) : 18 * 60
    for (const s of staff) {
      const inM = parseTimeMins12(s.in)
      if (inM === null) continue
      const outM = parseTimeMins12(s.out) ?? dayMaxOut
      const dur = outM >= inM ? outM - inM : outM + 1440 - inM
      minsBy.set(s.name, (minsBy.get(s.name) ?? 0) + dur)
      if (!rangeBy.has(s.name)) rangeBy.set(s.name, `${s.in}–${s.out ?? '?'}`)
    }
  }
  const total = Array.from(minsBy.values()).reduce((a, b) => a + b, 0)
  const shares: Exposure[] = Array.from(minsBy.entries())
    .map(([name, mins]) => ({
      name, mins,
      pct: total > 0 ? Math.round((mins / total) * 100) : 0,
      range: days === 1 ? (rangeBy.get(name) ?? null) : null,
    }))
    .sort((a, b) => b.mins - a.mins)
  return { from, fromBy, endBy: row.singlesCntBy ?? row.packCntBy, shares, days }
}

function capName(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

/* Per-pack (GMC → GMC) cycles: every GMC take starts a cycle with a known
   sheet budget (packs × sheets-per-pack). All recorded sheet usage until the
   NEXT GMC take belongs to that cycle. Assuming a new pack is only opened
   when the previous one is finished, budget − used = sheets unaccounted for
   in that cycle. This measures loss purely from GMC and sales records --
   completely independent of physical counts and their errors. */
type PackCycle = {
  start: string
  end: string | null      // date the next pack was taken; null = still running
  sheetsGiven: number
  used: number
}
function buildPackCycles(singlesNewestFirst: ComputedRow[]): PackCycle[] {
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

// CNT cell content with its full history shown INLINE, stacked oldest first:
// a changed count keeps its old value struck through (value and counter's
// initial both crossed out); a deleted count keeps its value marked with a
// red ✗. In both cases the amber initial after it is the staff member who
// made the change/deletion. The current count (if any) sits below, untouched.
function CntValue({ qty, countedBy, history, blank }: { qty: string | null; countedBy: string | null; history: CountRevision[] | null | undefined; blank?: boolean }) {
  const text = fmtQs(qty)
  const hist = history ?? []
  if (text === '—' && hist.length === 0) return blank ? null : <span className="text-gray-300">—</span>
  return (
    <span className="inline-flex flex-col items-center leading-tight">
      {hist.map((h, i) => {
        const deleted = h.action === 'deleted'
        const oldText = fmtQs(h.old_qty == null ? null : String(h.old_qty))
        return (
          <span key={i} className="whitespace-nowrap"
            title={`${deleted ? 'Deleted' : 'Changed'} by ${h.changed_by ?? 'unknown'} on ${fmtDate(h.changed_at)}`}>
            {deleted && <span className="text-red-600">✗</span>}
            <span className={deleted ? 'text-red-600' : 'line-through text-gray-400'}>
              {oldText}
              {initialOf(h.old_by) && <span className="text-[6px]"> ({initialOf(h.old_by)})</span>}
            </span>
            {initialOf(h.changed_by) && (
              <span className="text-amber-600 text-[6px] font-bold"> {initialOf(h.changed_by)}</span>
            )}
          </span>
        )
      })}
      {text !== '—' && (
        <span className="whitespace-nowrap">
          {text}
          {initialOf(countedBy) && <span className="text-blue-500 text-[6px]"> ({initialOf(countedBy)})</span>}
        </span>
      )}
    </span>
  )
}

function computeRows(rows: DayRow[]): ComputedRow[] {
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

/* ── Pack-chain merge: pack-level rows joined with the target (singles) rows they
   convert into, by date, so packs/singles/services can be read as one table. ── */
type PackChainRow = {
  date: string
  packCnt: string | null; packCntBy: string | null; packCntHistory: CountRevision[] | null
  packBl: string | null; packGmc: string | null; packWic: string | null; packSellPrice: string | null
  packExp: number | null; packLoss: number | null
  singlesCnt: string | null; singlesCntBy: string | null; singlesCntHistory: CountRevision[] | null; singlesConvIn: string | null
  singlesBreakdown: { name: string; qty: number; amount: number }[]
  singlesWicQty: string | null; singlesSellPrice: string | null
  singlesUsed: number; singlesExp: number | null; singlesLoss: number | null
}
function buildPackChainRows(packRows: ComputedRow[], singlesRows: ComputedRow[]): PackChainRow[] {
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

/* Omissions: records that should exist but don't, found by cross-checking the
   singles side against the packs side of the same row AND against earlier
   rows. A gain on singles (counted more than expected, e.g. 3 → 46 overnight)
   means a pack was physically opened — so the packs section should show a
   matching GMC take or a count loss that day. A gain with no explanation on
   its own row usually corrects an EARLIER count error, so it is traded off
   against the most recent unsettled losses (e.g. a +1 pack gain in July
   cancels 1 of a -15 pack loss from April, making it -14). Each finding
   carries a fix: the record to add/remove, or the trade-off to note. */
type Omission = { issue: string; fix: string }
type LossLedgerEntry = { date: string; original: number; remaining: number }

// Every lost 4x6 paper is valued as a missed passport print: ₵20 per single.
// Lost packs are converted to papers first (packs × papers-per-pack × ₵20) --
// never valued at the pack's own selling price, because a missing pack is
// treated as papers that were used for passport work but never recorded.
const PAPER_SELL_PRICE = 20

// Net ₵ value of a row's losses/gains: packs are worth their papers.
// Positive = money lost, negative = gain. Null when the row has no L/G at all.
// sheetPrice is the chain's per-single price (₵20 for 4x6 photo paper, the
// singles item's own selling price for other chains, e.g. ₵2 envelopes).
function rowLossCedis(row: PackChainRow, unitsPerPack: number, sheetPrice: number): number | null {
  if (row.packLoss === null && row.singlesLoss === null) return null
  const packPapers = (row.packLoss ?? 0) * (unitsPerPack > 0 ? unitsPerPack : 0)
  return parseFloat((((row.singlesLoss ?? 0) + packPapers) * sheetPrice).toFixed(2))
}

// Pack side only, valued the same way (packs lost × singles-per-pack ×
// sheetPrice) -- used by the single-service layout so the pack side's own
// ₵ figure can be shown apart from the singles-side cycle ₵ figure, then
// combined into one TOTAL LOSS/GAIN AMOUNT per row.
function packSideCedis(row: PackChainRow, unitsPerPack: number, sheetPrice: number): number | null {
  if (row.packLoss === null) return null
  return parseFloat((row.packLoss * (unitsPerPack > 0 ? unitsPerPack : 0) * sheetPrice).toFixed(2))
}

// ₵ value of one closed pack cycle's USED/PACK ledger -- positive = loss
// (sheets given but never recorded used), negative = gain (used beyond what
// the pack gave).
function cycleCedisValue(cyc: PackCycle, sheetPrice: number): number {
  return parseFloat(((cyc.sheetsGiven - cyc.used) * sheetPrice).toFixed(2))
}

// Consume a gain from earlier unsettled losses, most recent first. Returns
// which losses it cancels against and how much of the gain found no match.
function settleAgainstLedger(ledger: LossLedgerEntry[], gain: number) {
  const matches: { date: string; original: number; taken: number; remainingAfter: number }[] = []
  let left = gain
  for (let i = ledger.length - 1; i >= 0 && left > 0.001; i--) {
    const e = ledger[i]
    if (e.remaining <= 0.001) continue
    const taken = Math.min(e.remaining, left)
    e.remaining = parseFloat((e.remaining - taken).toFixed(4))
    left = parseFloat((left - taken).toFixed(4))
    matches.push({ date: e.date, original: e.original, taken, remainingAfter: e.remaining })
  }
  return { matches, unmatched: left }
}

function tradeOffText(matches: { date: string; original: number; taken: number; remainingAfter: number }[], unit: string) {
  return matches.map(m =>
    `${fmtN(m.taken)} of the -${fmtN(m.original)} ${unit} loss on ${fmtDate(m.date)}`
    + (m.remainingAfter > 0.001 ? ` (leaving -${fmtN(m.remainingAfter)} there)` : ' (clearing it fully)')
  ).join(' and ')
}

function computePackChainOmissions(rowsDesc: PackChainRow[], unitsPerPack: number, packName: string): Map<string, Omission[]> {
  const out = new Map<string, Omission[]>()
  const chron = [...rowsDesc].reverse() // walk oldest → newest so ledgers only ever look backwards
  const packLossLedger: LossLedgerEntry[] = []
  const singlesLossLedger: LossLedgerEntry[] = []
  let lastPackCountDate: string | null = null

  for (const row of chron) {
    const notes: Omission[] = []
    const conv = numVal(row.singlesConvIn)
    const packGmc = numVal(row.packGmc)
    const packLoss = row.packLoss ?? 0 // >0 = packs missing at count, <0 = packs gained

    const singlesGain = row.singlesLoss !== null && row.singlesLoss < -0.001 ? -row.singlesLoss : 0
    if (singlesGain > 0) {
      const packsEst = unitsPerPack > 0 ? singlesGain / unitsPerPack : null
      const estN = packsEst !== null ? Math.max(1, Math.round(packsEst)) : 1
      const est = packsEst !== null
        ? `≈${packsEst % 1 === 0 ? packsEst : packsEst.toFixed(1)} pack${packsEst > 1.05 ? 's' : ''}`
        : 'a pack'
      // A singles gain close to a full pack points at an unrecorded pack
      // opening; a small stray gain more likely corrects an earlier count.
      const looksLikeAPack = packsEst !== null && packsEst >= 0.5
      if (looksLikeAPack && conv === 0 && packGmc === 0) {
        if (packLoss > 0.001) {
          notes.push({
            issue: `+${fmtN(singlesGain)} singles suggest ${est} was used by GMC, and the packs side lost ${fmtN(packLoss)} at count — `
              + `the pack was opened but never recorded on GMC`,
            fix: `record a GMC sale of ${estN} ${packName} on this date — one record cancels both the +${fmtN(singlesGain)} singles gain and the -${fmtN(packLoss)} pack loss`,
          })
        } else {
          notes.push({
            issue: `+${fmtN(singlesGain)} singles suggest ${est} was used by GMC, but the ${packName} section shows no GMC and no loss/deduction that day — `
              + `the pack take was not recorded anywhere`,
            fix: `record a GMC sale of ${estN} ${packName} on this date to cancel the +${fmtN(singlesGain)} singles gain; if the packs then show a gain, that day's pack count still included the opened pack — correct the pack count too`,
          })
        }
      } else {
        // Not pack-shaped (or conversions already recorded) — try cancelling
        // against earlier unsettled singles losses first: a later gain paired
        // with an earlier loss is one counting error, not two events.
        const { matches, unmatched } = settleAgainstLedger(singlesLossLedger, singlesGain)
        if (matches.length > 0) {
          notes.push({
            issue: `+${fmtN(singlesGain)} singles gained beyond what the records explain — likely an earlier count error resurfacing`,
            fix: `trade it off against ${tradeOffText(matches, 'singles')}`
              + (unmatched > 0.001 ? `; the remaining +${fmtN(unmatched)} still needs a recount or a GMC record` : ' — no new record needed, both entries were one count error'),
          })
        } else {
          notes.push({
            issue: `+${fmtN(singlesGain)} singles beyond what the recorded pack conversions explain`,
            fix: `recount the singles, or record an extra GMC pack if another one was opened`,
          })
        }
      }
    }

    if (row.singlesExp !== null && row.singlesExp < -0.001) {
      notes.push({
        issue: `more singles used than were available${(packGmc === 0 && conv === 0) ? ' while the packs section shows no GMC deduction' : ''} — `
          + `a GMC pack record is missing`,
        fix: `record the GMC pack that supplied these singles — it cancels the shortfall`,
      })
    }

    // Pack-side gains: first check the same row (a gain matching the day's
    // GMC take means the pack was never physically opened), then trade off
    // against earlier unsettled pack losses (a stray gain after a long gap
    // corrects an earlier count error), and only then suspect a missing bill.
    const packGain = packLoss < -0.001 ? -packLoss : 0
    if (packGain > 0) {
      const packBl = numVal(row.packBl)
      const singlesLost = row.singlesLoss !== null && row.singlesLoss > 0.001 ? row.singlesLoss : 0
      const plural = packGain === 1 ? '' : 's'
      const gmcMatchesGain = packGmc > 0 && Math.abs(packGain - packGmc) < 0.5
      const singlesLostTheConv = unitsPerPack > 0 && singlesLost > 0
        && Math.abs(singlesLost - packGain * unitsPerPack) <= unitsPerPack * 0.25
      const gapNote = lastPackCountDate ? ` (first pack count since ${fmtDate(lastPackCountDate)})` : ''
      if (gmcMatchesGain && singlesLostTheConv) {
        notes.push({
          issue: `+${fmtN(packGain)} pack${plural} gained while GMC shows ${fmtN(packGmc)} taken and the singles side lost ${fmtN(singlesLost)} — `
            + `the GMC was recorded but the pack was never actually opened`,
          fix: `remove (or reduce) that GMC record — it cancels both the +${fmtN(packGain)} pack gain and the -${fmtN(singlesLost)} singles loss`,
        })
      } else if (gmcMatchesGain) {
        notes.push({
          issue: `+${fmtN(packGain)} pack${plural} gained, matching the ${fmtN(packGmc)} taken on GMC — `
            + `the pack may not have actually been opened`,
          fix: `verify that GMC record; removing it cancels the +${fmtN(packGain)} pack gain`,
        })
      } else {
        const { matches, unmatched } = settleAgainstLedger(packLossLedger, packGain)
        if (matches.length > 0) {
          notes.push({
            issue: `+${fmtN(packGain)} pack${plural} gained${gapNote} — packs don't appear from nowhere; this likely corrects an earlier count error`,
            fix: `trade it off against ${tradeOffText(matches, 'pack')}`
              + (unmatched > 0.001 ? `; the remaining +${fmtN(unmatched)} still needs a bill record or recount` : ' — no new record needed, the earlier count was simply off'),
          })
        } else if (packBl === 0) {
          notes.push({
            issue: `+${fmtN(packGain)} pack${plural} appeared with no bill recorded${gapNote}`,
            fix: `record the missing purchase bill of ${fmtN(packGain)} ${packName} — it cancels this gain`,
          })
        } else {
          notes.push({
            issue: `+${fmtN(packGain)} pack${plural} beyond what the records explain`,
            fix: `recount the packs or check the bill quantity for this date`,
          })
        }
      }
    }

    // Record this row's losses so later gains can settle against them.
    if (packLoss > 0.001) packLossLedger.push({ date: row.date, original: packLoss, remaining: packLoss })
    const singlesLoss = row.singlesLoss !== null && row.singlesLoss > 0.001 ? row.singlesLoss : 0
    if (singlesLoss > 0) singlesLossLedger.push({ date: row.date, original: singlesLoss, remaining: singlesLoss })
    if (row.packCnt !== null) lastPackCountDate = row.date

    if (notes.length) out.set(row.date, notes)
  }
  return out
}

/* Single-service pack-chain layout (e.g. A4 Brown Envelope: Pack -> Env.
   Sing. <- Service - A4 Brown). Unlike the multi-service 4x6 chain, a
   single-service chain gets full SP/AMOUNT/CP/PROFIT economics on both the
   pack side (whole packs sold directly, WIC) and the singles side (singles
   sold via the one service, WIC BOUGHT), plus a combined TOTAL LOSS/GAIN
   AMOUNT and a WORK NOT WRITTEN column (raw cash-reconciliation data --
   cash counted beyond what was invoiced that day, across all receipts --
   shown as-is rather than as an inferred suggestion, so a possible loss and
   a same-day pile of unassigned cash can be compared directly). Loss/gain
   here is driven by two independent ledgers, shown side by side rather than
   merged: the pack side's own count-based LOSS/GAIN, and the singles side's
   cycle-based USED/PACK ledger (sheets a pack gave vs. sheets recorded used
   before the next pack) -- the trusted, count-independent measure. */

// Condensed to a single line for the merged MANAGER GUIDELINES cell: keeps
// the headline of an omission and the primary instruction of its fix,
// dropping the longer reasoning clause.
function shortOmissionLine(o: Omission): string {
  const issue = o.issue.split(' — ')[0].trim()
  const fix = o.fix.split(/ — |; /)[0].trim()
  return `${issue} → ${fix}`
}

// Cross-checks the USED/PACK cycle ledger (count-independent, the trusted
// measure -- pure GMC + sales records) against the singles-side physical
// counts taken DURING that same cycle, so a discrepancy tells you what kind
// of problem it is:
//  - both agree on a shortfall -> two independent signals confirm a real loss
//  - the cycle flags a shortfall but the count never caught it -> sheets are
//    leaving without a sale/service record (e.g. given away), not a count
//    problem
//  - the count lost sheets but the cycle's records are clean -> probably a
//    counting error, not real stock loss
//  - the cycle shows MORE used than the pack gave -> should never happen;
//    points at an unrecorded GMC take or leftover from the previous pack
// Anchored to the day the cycle closes (the next pack was taken), alongside
// the existing count-based reasoning above. (Work Not Written is its own
// visible column now, so it's no longer folded into this text.)
function computeCycleOmissions(rowsDesc: PackChainRow[], closedCycles: PackCycle[], sheetPrice: number): Map<string, Omission[]> {
  const out = new Map<string, Omission[]>()
  for (const cyc of closedCycles) {
    if (cyc.end === null) continue
    const diff = parseFloat((cyc.sheetsGiven - cyc.used).toFixed(2))
    const countTotal = parseFloat(rowsDesc
      .filter(r => r.date > cyc.start && r.date <= cyc.end! && r.singlesLoss !== null)
      .reduce((s, r) => s + (r.singlesLoss as number), 0)
      .toFixed(2))
    if (Math.abs(diff) < 0.001 && Math.abs(countTotal) < 0.001) continue

    let note: Omission | null = null
    if (diff > 0.001 && countTotal > 0.001) {
      note = {
        issue: `USED/PACK shows ${fmtQ(diff)} sheets unaccounted for from this pack, and the count over the same period also lost ${fmtN(countTotal)} — two independent signals agree`,
        fix: `treat as a confirmed loss worth ₵${fmtN(diff * sheetPrice)}`,
      }
    } else if (diff > 0.001 && countTotal <= 0.001) {
      note = {
        issue: `USED/PACK shows ${fmtQ(diff)} sheets this pack gave but were never recorded as used, yet the count over the same period shows no matching loss`,
        fix: `sheets may be leaving without a sale/service record (e.g. given away) — check usage, not the count`,
      }
    } else if (diff <= 0.001 && countTotal > 0.001) {
      note = {
        issue: `the count lost ${fmtN(countTotal)} over this pack's cycle, but USED/PACK shows every sheet this pack gave is accounted for in records`,
        fix: `likely a count error, not real stock loss — recount before treating it as a loss`,
      }
    } else if (diff < -0.001) {
      const gainNote = countTotal < -0.001 ? `, and the count also gained ${fmtN(Math.abs(countTotal))}` : ''
      note = {
        issue: `USED/PACK shows ${fmtQ(Math.abs(diff))} more sheets used than this pack gave${gainNote}`,
        fix: `check for an unrecorded GMC pack take, or leftover sheets carried from the previous pack`,
      }
    }
    if (note) out.set(cyc.end, [...(out.get(cyc.end) ?? []), note])
  }
  return out
}

// A row "has a loss" for the Loss Only filter (and the row highlighting) if
// either its own pack count came up short, or (for the row where a pack
// cycle closes) USED/PACK shows a shortfall.
function rowHasLoss(row: PackChainRow, packCyclesByStart: Map<string, PackCycle>): boolean {
  if ((row.packLoss ?? 0) > 0.001) return true
  const cyc = packCyclesByStart.get(row.date)
  if (cyc && cyc.end !== null && (cyc.sheetsGiven - cyc.used) > 0.001) return true
  return false
}
// Mirror of rowHasLoss for the Gain Only filter -- a pack count came in
// above expected, or (on the row where a pack cycle closes) USED/PACK shows
// more used than the pack gave.
function rowHasGain(row: PackChainRow, packCyclesByStart: Map<string, PackCycle>): boolean {
  if (row.packLoss !== null && row.packLoss < -0.001) return true
  const cyc = packCyclesByStart.get(row.date)
  if (cyc && cyc.end !== null && (cyc.sheetsGiven - cyc.used) < -0.001) return true
  return false
}

function SingleServicePackChainTable({
  item, targetName, packChainRows, packChainOmissionsByDate, packCyclesByStart, closedCycles,
  packLossTotal, packGainTotal, cycleLossTotal, cycleGainTotal,
  unitsPerPack, sheetPrice, sheetCP, sp, onDateClick, packChainBreakdownNames, showPrices, wnwByDate, lossOnly, gainOnly,
}: {
  item: SummaryRow; targetName: string; packChainRows: PackChainRow[]
  packChainOmissionsByDate: Map<string, Omission[]>; packCyclesByStart: Map<string, PackCycle>; closedCycles: PackCycle[]
  packLossTotal: number; packGainTotal: number; cycleLossTotal: number; cycleGainTotal: number
  unitsPerPack: number; sheetPrice: number; sheetCP: number; sp: number
  onDateClick?: (date: string, itemName: string) => void
  packChainBreakdownNames: string[]
  showPrices: boolean
  wnwByDate: Map<string, number>
  lossOnly: boolean
  gainOnly: boolean
}) {
  const packCpVal = parseFloat(item.cp ?? '0') || 0
  const svcName = packChainBreakdownNames[0]
  const packLossCedisTotal = packLossTotal * unitsPerPack * sheetPrice
  const packGainCedisTotal = packGainTotal * unitsPerPack * sheetPrice
  const grandTotalCedis = packChainRows.reduce((s, r) => s + (packSideCedis(r, unitsPerPack, sheetPrice) ?? 0), 0)
    + closedCycles.reduce((s, c) => s + cycleCedisValue(c, sheetPrice), 0)
  // EXP COUNT / ACTUAL COUNT sit as trailing standalone columns (after WNW),
  // so they're no longer part of the singles group span.
  // Gains should never happen on the pack side (any gain means a record is
  // missing) -- once there's genuinely nothing to show, the column is just
  // dead space, so it drops out entirely and reappears the moment a real
  // gain needs flagging.
  const showPackGain = packGainTotal > 0.001
  const packColSpan = (showPrices ? 12 : 8) - (showPackGain ? 0 : 1)
  const singlesColSpan = showPrices ? 9 : 5
  const totalColSpan = 1 + packColSpan + singlesColSpan + 5 // date + pack + singles + total + WNW + 2 count cols + guidance

  const visibleRows = lossOnly ? packChainRows.filter(r => rowHasLoss(r, packCyclesByStart))
    : gainOnly ? packChainRows.filter(r => rowHasGain(r, packCyclesByStart))
    : packChainRows

  // Per-row guideline content, condensed to one line. Consecutive rows with
  // identical content (almost always the common "—, no omission" rows) are
  // merged into a single spanning cell instead of repeating it.
  const cycleOmissionsByDate = computeCycleOmissions(packChainRows, closedCycles, sheetPrice)
  const rowMetas = visibleRows.map((row) => {
    const omissions = [...(packChainOmissionsByDate.get(row.date) ?? []), ...(cycleOmissionsByDate.get(row.date) ?? [])]
    const omissionLines = omissions.map(shortOmissionLine)
    return { omissions, omissionLines, key: JSON.stringify(omissionLines) }
  })
  const guidelineRowSpan: number[] = new Array(rowMetas.length).fill(1)
  for (let i = 0; i < rowMetas.length; i++) {
    if (i > 0 && rowMetas[i].key === rowMetas[i - 1].key) { guidelineRowSpan[i] = 0; continue }
    let span = 1
    while (i + span < rowMetas.length && rowMetas[i + span].key === rowMetas[i].key) span++
    guidelineRowSpan[i] = span
  }

  return (
    <>
      <p className="text-[8px] font-bold text-gray-500 px-1.5 py-1 bg-gray-50 border-b border-gray-200">
        Combined view: {item.item_name} → {targetName} → service
      </p>
      {/* width: max-content (not a manually-summed pixel value, and not left
          unset) -- table-layout: fixed with width:auto doesn't reliably
          expand to the full colgroup sum when the table sits inside a
          w-max-sized ancestor on mobile Chrome, which left a gap of blank
          space rather than showing the next column. max-content forces the
          table to size itself from its columns, and can't drift out of sync
          the way a hand-maintained pixel sum can. */}
      <table className="table-fixed border-collapse text-[8px]" style={{ width: 'max-content' }}>
        <colgroup>
          <col style={{width:'62px'}} />
          <col style={{width:'22px'}} /><col style={{width:'22px'}} />
          {showPrices && <><col style={{width:'40px'}} /><col style={{width:'48px'}} /><col style={{width:'36px'}} /><col style={{width:'40px'}} /></>}
          <col style={{width:'22px'}} /><col style={{width:'28px'}} /><col style={{width:'34px'}} />
          <col style={{width:'22px'}} />
          {showPackGain && <col style={{width:'24px'}} />}
          <col style={{width:'34px'}} />
          <col style={{width:'20px'}} />
          {showPrices && <><col style={{width:'40px'}} /><col style={{width:'48px'}} /><col style={{width:'36px'}} /><col style={{width:'40px'}} /></>}
          <col style={{width:'30px'}} /><col style={{width:'20px'}} /><col style={{width:'20px'}} />
          <col style={{width:'34px'}} />
          <col style={{width:'34px'}} />
          <col style={{width:'40px'}} />
          <col style={{width:'36px'}} /><col style={{width:'48px'}} />
          <col style={{width:'480px'}} />
        </colgroup>
        <thead className="sticky top-0 z-10">
          <tr className="text-gray-800 font-bold">
            <th rowSpan={2} className="py-0.5 border-b-2 border-gray-500 text-left pl-0.5 align-bottom sticky left-0 z-20 bg-slate-600 text-white">DATE</th>
            <th colSpan={packColSpan} className="py-0.5 border-b border-gray-400 text-center border-l-2 border-l-amber-600 bg-amber-500">{item.item_name}</th>
            <th colSpan={singlesColSpan} className="py-0.5 border-b border-gray-400 text-center border-l-2 border-l-indigo-600 bg-indigo-500 text-white">{targetName}</th>
            <th rowSpan={2} className="py-0.5 border-b-2 border-gray-500 text-center align-bottom border-l-2 border-l-gray-600 leading-tight bg-slate-600 text-white"
              title={`TOTAL LOSS/GAIN AMOUNT — combined ₵ for the row: pack side (packs × singles-per-pack × ₵${sheetPrice}) plus the singles side's own USED/PACK cycle ₵.`}>
              TOTAL<span className="block">₵</span>
            </th>
            <th rowSpan={2} className="py-0.5 border-b-2 border-gray-500 text-center align-bottom border-l-2 border-l-gray-600 bg-slate-600 text-white"
              title="Work Not Written — cash counted beyond what was invoiced that day, across ALL receipts (not just this item's chain). A large amount is a candidate explanation for an otherwise-unrecorded loss.">
              WNW<span className="block">₵</span>
            </th>
            <th rowSpan={2} className="py-0.5 border-b-2 border-gray-400 text-center align-bottom border-l-2 border-l-gray-600 bg-gray-200 text-gray-500"
              title="Secondary cross-check only, from the daily count ledger -- not the primary loss measure.">
              EXP COUNT
            </th>
            <th rowSpan={2} className="py-0.5 border-b-2 border-gray-400 text-center align-bottom border-l border-gray-400 bg-gray-200 text-gray-500"
              title="Secondary cross-check only -- physical count">
              ACTUAL COUNT
            </th>
            <th rowSpan={2} className="py-0.5 border-b-2 border-gray-500 text-center align-bottom border-l-2 border-l-gray-600 bg-slate-600 text-white">
              MANAGER GUIDELINES<span className="block font-normal text-[6px]">(omissions)</span>
            </th>
          </tr>
          <tr className="text-gray-800 font-bold">
            <th className="py-0.5 border-b-2 border-gray-500 text-center border-l-2 border-l-amber-600 bg-amber-400" title="Bought/received">BL</th>
            <th className="py-0.5 border-b-2 border-gray-500 text-center border-l border-amber-300 bg-amber-400" title="Whole packs sold directly to a walk-in customer">WIC</th>
            {showPrices && <>
              <th className="py-0.5 border-b-2 border-gray-500 text-center border-l border-amber-300 bg-amber-400" title="Average direct sale price that day">SP</th>
              <th className="py-0.5 border-b-2 border-gray-500 text-center border-l border-amber-300 bg-amber-400" title="Revenue from direct pack sales that day">AMOUNT</th>
              <th className="py-0.5 border-b-2 border-gray-500 text-center border-l border-amber-300 bg-amber-400" title="Purchase cost per pack">CP</th>
              <th className="py-0.5 border-b-2 border-gray-500 text-center border-l border-amber-300 bg-amber-400" title="Per-unit margin: SP − CP">PROFIT</th>
            </>}
            <th className="py-0.5 border-b-2 border-gray-500 text-center border-l border-amber-300 bg-amber-400" title="Taken for internal use (credits singles below)">GMC</th>
            <th className="py-0.5 border-b-2 border-gray-500 text-center border-l border-amber-300 bg-amber-400" title="Running expected stock">EXP</th>
            <th className="py-0.5 border-b-2 border-gray-500 text-center border-l border-amber-300 bg-amber-400" title="Physical count">CNT</th>
            <th className="py-0.5 border-b-2 border-gray-500 text-center border-l border-amber-300 bg-amber-400" title="Packs missing at count. Column total shown below the label.">
              LOSS<span className="block text-red-700">{packLossTotal > 0 ? `-${fmtQ(packLossTotal)}` : '0'}</span>
            </th>
            {showPackGain && (
              <th className="py-0.5 border-b-2 border-gray-500 text-center border-l border-amber-300 bg-amber-400" title="Packs gained at count. Gains should ALWAYS be 0 -- any gain means a record is missing.">
                GAIN
                <span className="block">+{fmtQ(packGainTotal)}</span>
              </th>
            )}
            <th className="py-0.5 border-b-2 border-gray-500 text-center border-l-2 border-l-gray-600 bg-amber-400"
              title={`LOSS/GAIN AMT — pack side only: packs lost/gained × singles-per-pack × ₵${sheetPrice}`}>L/G ₵</th>
            <th className="py-0.5 border-b-2 border-gray-500 text-center border-l-2 border-l-indigo-600 bg-indigo-400 text-white" title="Singles sold that day -- via the service if this chain still has one, otherwise direct sales of the singles item itself">QTY</th>
            {showPrices && <>
              <th className="py-0.5 border-b-2 border-gray-500 text-center border-l border-indigo-300 bg-indigo-400 text-white" title="Average sale price that day">SP</th>
              <th className="py-0.5 border-b-2 border-gray-500 text-center border-l border-indigo-300 bg-indigo-400 text-white" title="Revenue from the service that day">AMOUNT</th>
              <th className="py-0.5 border-b-2 border-gray-500 text-center border-l border-indigo-300 bg-indigo-400 text-white" title="Purchase cost per single">CP</th>
              <th className="py-0.5 border-b-2 border-gray-500 text-center border-l border-indigo-300 bg-indigo-400 text-white" title="Per-unit margin: SP − CP">PROFIT</th>
            </>}
            <th className="py-0.5 border-b-2 border-gray-500 text-center border-l border-indigo-300 bg-indigo-400 text-white leading-tight"
              title="USED/PACK — on rows where a GMC pack was taken: total sheets recorded as used (service + direct sales) from this pack until the NEXT pack was taken -- the pack's full cycle, measured purely from records, independent of counts.">
              USED<span className="block">/PACK</span>
            </th>
            <th className="py-0.5 border-b-2 border-gray-500 text-center border-l border-indigo-300 bg-indigo-400 text-white" title="Sheets a pack gave but were never recorded as used, by count. Column total (closed packs) shown below.">
              LOSS<span className="block text-red-200">{cycleLossTotal > 0 ? `-${fmtQ(cycleLossTotal)}` : '0'}</span>
            </th>
            <th className="py-0.5 border-b-2 border-gray-500 text-center border-l border-indigo-300 bg-indigo-400 text-white" title="Sheets used beyond what the pack gave -- should ALWAYS be 0; either leftover from a previous pack or an unrecorded GMC take.">
              GAIN
              <span className="block">
                {cycleGainTotal > 0 ? `+${fmtQ(cycleGainTotal)}` : '0'}
              </span>
            </th>
            <th className="py-0.5 border-b-2 border-gray-500 text-center border-l border-indigo-300 bg-indigo-400 text-white" title={`LOSS/GAIN AMT — USED/PACK ledger valued at ₵${sheetPrice} per single. Column total (closed packs) shown below.`}>
              L/G ₵<span className="block text-red-200">{cycleLossTotal > 0 ? `-₵${fmtN(cycleLossTotal * sheetPrice)}` : '0'}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.length === 0 ? (
            <tr><td colSpan={totalColSpan} className="text-center py-3 text-gray-400 text-[9px]">{lossOnly ? 'No loss rows.' : gainOnly ? 'No gain rows.' : 'No rows.'}</td></tr>
          ) : visibleRows.map((row, i) => {
            const { omissionLines } = rowMetas[i]
            const packWicQty = numVal(row.packWic)
            const packSpVal = numVal(row.packSellPrice) || sp
            const packAmount = packWicQty > 0 ? packWicQty * packSpVal : 0
            const packProfit = packSpVal - packCpVal
            // Prefer the named service's own breakdown (exact revenue from real
            // sale lines) when one exists; once there's no service left drawing
            // on this item (e.g. it was merged directly into the singles item),
            // fall back to the singles item's own direct WIC sales for that day.
            const svcB = svcName ? row.singlesBreakdown.find(b => b.name === svcName) : undefined
            const directQty = numVal(row.singlesWicQty)
            const directSpVal = numVal(row.singlesSellPrice) || sheetPrice
            const singlesQty = svcB ? (svcB.qty ?? 0) : directQty
            const singlesAmount = svcB ? (svcB.amount ?? 0) : (directQty > 0 ? directQty * directSpVal : 0)
            const singlesSpVal = svcB ? (singlesQty > 0 ? singlesAmount / singlesQty : sheetPrice) : directSpVal
            const singlesProfit = singlesSpVal - sheetCP
            const cyc = packCyclesByStart.get(row.date)
            const cycOpen = cyc ? cyc.end === null : false
            const cycDiff = cyc ? parseFloat((cyc.sheetsGiven - cyc.used).toFixed(2)) : null
            const pCedis = packSideCedis(row, unitsPerPack, sheetPrice)
            const cCedis = cyc && !cycOpen ? cycleCedisValue(cyc, sheetPrice) : null
            const totalCedisRow = pCedis === null && cCedis === null ? null : (pCedis ?? 0) + (cCedis ?? 0)
            return (
              <tr key={i} className={`border-b border-gray-200 ${rowHasLoss(row, packCyclesByStart) ? 'bg-red-50' : rowHasGain(row, packCyclesByStart) ? 'bg-orange-50' : 'bg-white'}`}>
                <td className="pl-0.5 py-0.5 font-bold text-gray-500 whitespace-nowrap sticky left-0 bg-inherit">
                  {onDateClick ? (
                    <button onClick={() => onDateClick(row.date, item.item_name)} className="text-blue-600 hover:underline">{fmtDate(row.date)}</button>
                  ) : fmtDate(row.date)}
                </td>
                <td className="text-center py-0.5 font-bold border-l-2 border-l-amber-600 text-blue-600">{blankDash(fmtQs(row.packBl))}</td>
                <td className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-600">{blankDash(fmtQs(row.packWic))}</td>
                {showPrices && <>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-600">{packWicQty > 0 ? `₵${fmtN(packSpVal)}` : null}</td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-600">{packWicQty > 0 ? `₵${fmtN(packAmount)}` : null}</td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-500">₵{fmtN(packCpVal)}</td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-500">₵{fmtN(packProfit)}</td>
                </>}
                <td className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-600">{blankDash(fmtQs(row.packGmc))}</td>
                <td className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-400">{blankDash(fmtN(row.packExp))}</td>
                <td className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-900 whitespace-nowrap">
                  <CntValue qty={row.packCnt} countedBy={row.packCntBy} history={row.packCntHistory} blank />
                </td>
                <td className="text-center py-0.5 font-bold border-l border-gray-300">
                  {row.packLoss === null ? null
                    : row.packLoss > 0.001 ? <span className="text-red-600">-{fmtN(row.packLoss)}</span>
                    : <span className="text-gray-400">0</span>}
                </td>
                {showPackGain && (
                  <td className="text-center py-0.5 font-bold border-l border-gray-300">
                    {row.packLoss !== null && row.packLoss < -0.001
                      ? <span title="A gain should never happen -- a record is missing.">+{fmtN(Math.abs(row.packLoss))}</span>
                      : row.packLoss === null ? null
                      : <span className="text-gray-400">0</span>}
                  </td>
                )}
                <td className="text-center py-0.5 font-bold border-l-2 border-l-gray-600 whitespace-nowrap">
                  {pCedis === null ? null
                    : pCedis > 0.001 ? <span className="text-red-600">-₵{fmtN(pCedis)}</span>
                    : pCedis < -0.001 ? <span className="text-green-600">+₵{fmtN(Math.abs(pCedis))}</span>
                    : <span className="text-gray-400">0</span>}
                </td>
                <td className="text-center py-0.5 font-bold border-l-2 border-l-indigo-600 text-gray-600">{singlesQty === 0 ? null : fmtQ(singlesQty)}</td>
                {showPrices && <>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-600">{singlesQty > 0 ? `₵${fmtN(singlesSpVal)}` : null}</td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-600">{singlesQty > 0 ? `₵${fmtN(singlesAmount)}` : null}</td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-500">₵{fmtN(sheetCP)}</td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-500">₵{fmtN(singlesProfit)}</td>
                </>}
                {!cyc ? (
                  <>
                    <td className="text-center py-0.5 border-l-2 border-l-gray-600" />
                    <td className="text-center py-0.5 border-l border-gray-300" />
                    <td className="text-center py-0.5 border-l border-gray-300" />
                    <td className="text-center py-0.5 border-l border-gray-300" />
                  </>
                ) : (
                  <>
                    <td className="text-center py-0.5 font-bold border-l-2 border-l-gray-600 whitespace-nowrap leading-tight"
                      title={cycOpen ? 'This pack is still in use -- no next GMC take yet' : `Sheets used from this take until the next pack on ${fmtDate(cyc.end!)}`}>
                      <span className="block text-purple-700">{fmtQ(cyc.used)}</span>
                      <span className="block text-gray-400">/{fmtQ(cyc.sheetsGiven)}</span>
                      {cycOpen && <span className="block text-blue-600 text-[6px] font-semibold">open</span>}
                    </td>
                    <td className="text-center py-0.5 font-bold border-l border-gray-300 whitespace-nowrap">
                      {cycOpen ? null
                        : (cycDiff as number) > 0.001 ? <span className="text-red-600">-{fmtQ(cycDiff as number)}</span>
                        : <span className="text-gray-400">0</span>}
                    </td>
                    <td className="text-center py-0.5 font-bold border-l border-gray-300 whitespace-nowrap">
                      {cycOpen ? null
                        : (cycDiff as number) < -0.001 ? (
                          <span title="Sheets used beyond what this pack gave -- should be 0.">+{fmtQ(Math.abs(cycDiff as number))}</span>
                        ) : <span className="text-gray-400">0</span>}
                    </td>
                    <td className="text-center py-0.5 font-bold border-l border-gray-300 whitespace-nowrap">
                      {cycOpen ? null
                        : (cycDiff as number) > 0.001 ? <span className="text-red-600">-₵{fmtN((cycDiff as number) * sheetPrice)}</span>
                        : (cycDiff as number) < -0.001 ? <span className="text-green-600">+₵{fmtN(Math.abs(cycDiff as number) * sheetPrice)}</span>
                        : <span className="text-gray-400">0</span>}
                    </td>
                  </>
                )}
                <td className="text-center py-0.5 font-bold border-l-2 border-l-gray-600 whitespace-nowrap">
                  {totalCedisRow === null ? null
                    : totalCedisRow > 0.001 ? <span className="text-red-600">-₵{fmtN(totalCedisRow)}</span>
                    : totalCedisRow < -0.001 ? <span className="text-green-600">+₵{fmtN(Math.abs(totalCedisRow))}</span>
                    : <span className="text-gray-400">0</span>}
                </td>
                <td className="text-center py-0.5 font-bold border-l-2 border-l-gray-600 text-amber-700 whitespace-nowrap"
                  title="Work Not Written -- cash counted beyond what was invoiced that day, across all receipts (not just this item's chain).">
                  {(() => {
                    const wnw = wnwByDate.get(row.date) ?? 0
                    return wnw > 0.001 ? `₵${fmtN(wnw)}` : null
                  })()}
                </td>
                <td className="text-center py-0.5 font-bold border-l-2 border-l-gray-600 text-gray-400">{blankDash(fmtN(row.singlesExp))}</td>
                <td className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-400 whitespace-nowrap">
                  <CntValue qty={row.singlesCnt} countedBy={row.singlesCntBy} history={row.singlesCntHistory} blank />
                </td>
                {guidelineRowSpan[i] > 0 && (
                  <td rowSpan={guidelineRowSpan[i]} className="text-left py-0.5 pl-1 pr-1 border-l-2 border-l-gray-600 border-b border-gray-200 whitespace-nowrap overflow-hidden text-ellipsis align-top">
                    {omissionLines.length === 0 ? null : (
                      <div className="whitespace-nowrap overflow-hidden text-ellipsis" title={omissionLines.join(' · ')}>
                        <span className="text-orange-700 font-semibold">{omissionLines.join(' · ')}</span>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
          <tr className="bg-gray-100 border-t-2 border-gray-400 font-bold">
            <td colSpan={packColSpan} className="text-right pr-1 py-1 text-gray-600 text-[7px] border-l-2 border-l-amber-600">
              {`Pack side, net of gains: ${packLossCedisTotal > 0.001 ? `-₵${fmtN(packLossCedisTotal)}` : '0'}${packGainCedisTotal > 0.001 ? ` (⚠+₵${fmtN(packGainCedisTotal)} gained)` : ''}`}
            </td>
            <td colSpan={singlesColSpan} className="text-right pr-1 py-1 text-gray-600 text-[7px] border-l-2 border-l-indigo-600">
              {`over ${closedCycles.length} closed pack${closedCycles.length === 1 ? '' : 's'} → USED/PACK, net of gains: ${cycleLossTotal > 0.001 ? `-₵${fmtN(cycleLossTotal * sheetPrice)}` : '0'}${cycleGainTotal > 0.001 ? ` (⚠+₵${fmtN(cycleGainTotal * sheetPrice)} gained)` : ''}`}
            </td>
            <td className="text-center py-1 border-l-2 border-l-gray-600 whitespace-nowrap">
              {grandTotalCedis > 0.001 ? <span className="text-red-600">-₵{fmtN(parseFloat(grandTotalCedis.toFixed(2)))}</span>
                : grandTotalCedis < -0.001 ? <span className="text-green-600">+₵{fmtN(Math.abs(parseFloat(grandTotalCedis.toFixed(2))))}</span>
                : <span className="text-gray-400">0</span>}
            </td>
            <td className="border-l-2 border-l-gray-600" />
            <td className="border-l-2 border-l-gray-600" />
            <td className="border-l border-gray-400" />
            <td className="border-l-2 border-l-gray-600" />
          </tr>
        </tbody>
      </table>
    </>
  )
}

function rowSortVal(row: SummaryRow, col: SortCol): number | string {
  switch (col) {
    case 'item_name': return row.item_name.toLowerCase()
    case 'cf_group': return (row.cf_group ?? '').toLowerCase()
    case 'product_type': return (row.product_type ?? '').toLowerCase()
    case 'lgAmt': return row.lgAmt
    case 'lgQty': return row.lgQty
    case 'cnt': return row.cnt
    case 'wic': return row.wic
    case 'gmc': return row.gmc
    case 'bl': return row.bl
    case 'soh': return parseFloat(row.soh ?? '0') || 0
    case 'sp': return parseFloat(row.sp ?? '0') || 0
    case 'cp': return parseFloat(row.cp ?? '0') || 0
  }
}

/* ── compact th with sort indicator ── */
const thBase = 'py-1 font-bold cursor-pointer select-none whitespace-nowrap border border-black'
function SortTh({ label, col, sort, onSort, cls = '' }: {
  label: string; col: SortCol
  sort: { col: SortCol; dir: SortDir }
  onSort: (col: SortCol) => void
  cls?: string
}) {
  const active = sort.col === col
  const arrow = active ? (sort.dir === 'desc' ? '↓' : '↑') : ''
  return (
    <th onClick={() => onSort(col)}
      className={`${thBase} ${cls} ${active ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}>
      {label}{arrow && <span className="ml-0.5 text-[7px]">{arrow}</span>}
    </th>
  )
}

/* ── edit form ── */
const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 text-[9px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400'

function ItemEditForm({ form, onChange, groups, itemId, isService, allItems }: {
  form: typeof EMPTY_FORM; onChange: (f: typeof EMPTY_FORM) => void; groups: string[]
  itemId: number; isService: boolean; allItems: { item_id: number; item_name: string }[]
}) {
  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...form, [k]: e.target.value })
  return (
    <div className="space-y-1 p-2 bg-gray-50 border-b border-gray-200">
      <input placeholder="Item name *" value={form.item_name} onChange={set('item_name')} className={inputCls} />
      <select value={form.cf_group} onChange={set('cf_group')} className={inputCls}>
        <option value="">— No group —</option>
        {groups.map(g => <option key={g} value={g}>{g}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-1">
        <input placeholder="SP" type="number" value={form.selling_rate} onChange={set('selling_rate')} className={inputCls} />
        <input placeholder="CP" type="number" value={form.purchase_rate} onChange={set('purchase_rate')} className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-1">
        <input placeholder="Units/pack" type="number" value={form.units_per_pack} onChange={set('units_per_pack')} className={inputCls} />
        <input placeholder="Unit" value={form.unit_name} onChange={set('unit_name')} className={inputCls} />
      </div>
      <div>
        <label className="text-[8px] font-bold text-gray-500 block mb-0.5">
          {isService
            ? 'On sale (WIC), deduct "Units/pack" of this service from:'
            : 'On GMC, credit "Units/pack" of this item into:'}
        </label>
        <select value={form.converts_to_item_id} onChange={set('converts_to_item_id')} className={inputCls}>
          <option value="">— No conversion —</option>
          {allItems.filter(i => i.item_id !== itemId).map(i => (
            <option key={i.item_id} value={i.item_id}>{i.item_name}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

/* ── expanded item detail ── */
/* ── Alias picker: search unresolved raw names, attach/detach to this item ── */
type AliasRecord = { id: number; name: string }
type UnresolvedName = { name: string; cnt: number; confirmed: boolean }

function AliasPicker({ itemId, current, onChange }: {
  itemId: number
  current: AliasRecord[]
  onChange: (next: AliasRecord[]) => void
}) {
  const [salesNames, setSalesNames] = useState<UnresolvedName[] | null>(null)
  const [billNames, setBillNames] = useState<UnresolvedName[] | null>(null)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/aliases/unresolved').then(r => r.json()).then(d => setSalesNames(Array.isArray(d) ? d : []))
    fetch('/api/aliases/unresolved-bills').then(r => r.json()).then(d => setBillNames(Array.isArray(d) ? d : []))
  }, [])

  const candidates = useMemo(() => {
    const seen = new Set(current.map(a => a.name.toLowerCase().trim()))
    const all = [
      ...(salesNames ?? []).map(n => ({ ...n, source: 'sales' as const })),
      ...(billNames ?? []).map(n => ({ ...n, source: 'bills' as const })),
    ]
    const q = query.trim().toLowerCase()
    return all
      .filter(n => !n.confirmed && !seen.has(n.name.toLowerCase().trim()))
      .filter(n => !q || n.name.toLowerCase().includes(q))
      .slice(0, 25)
  }, [salesNames, billNames, current, query])

  async function add(name: string, source: 'sales' | 'bills') {
    setBusy(true)
    const res = await fetch('/api/aliases/confirm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias_name: name, item_id: itemId, source }),
    })
    setBusy(false)
    if (res.ok) onChange([...current, { id: -Date.now(), name }]) // optimistic id placeholder, refreshed on next load
  }

  async function remove(alias: AliasRecord) {
    setBusy(true)
    await fetch(`/api/aliases/${alias.id}`, { method: 'DELETE' })
    setBusy(false)
    onChange(current.filter(a => a.id !== alias.id))
  }

  return (
    <div className="space-y-1">
      {current.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {current.map(a => (
            <span key={a.id} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[8px] font-semibold px-1.5 py-0.5 rounded-full">
              {a.name}
              <button onClick={() => remove(a)} disabled={busy} className="text-blue-400 hover:text-red-500 font-bold">×</button>
            </span>
          ))}
        </div>
      )}
      <input value={query} onChange={e => setQuery(e.target.value)}
        placeholder="Search unresolved names to attach…"
        className="w-full bg-gray-100 border border-gray-300 rounded px-1.5 py-1 text-[9px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400" />
      {query.trim() && (
        <div className="border border-gray-200 rounded bg-white max-h-28 overflow-y-auto">
          {candidates.length === 0 ? (
            <p className="text-[8px] text-gray-400 px-1.5 py-1">No matching unresolved names</p>
          ) : candidates.map(c => (
            <button key={`${c.source}-${c.name}`} onClick={() => add(c.name, c.source)} disabled={busy}
              className="w-full text-left px-1.5 py-1 text-[8px] text-gray-800 hover:bg-blue-50 border-b border-gray-100 last:border-0 flex items-center justify-between">
              <span className="truncate">{c.name}</span>
              <span className="text-gray-400 shrink-0 ml-1">{c.source} · {c.cnt}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Match picker: search canonical items of the opposite product_type ── */
type MatchRecord = { id: number; name: string }
type CandidateItem = { item_id: number; item_name: string; product_type: string | null }

function MatchPicker({ itemId, itemName, isService, current, candidatePool, onChange }: {
  itemId: number; itemName: string; isService: boolean
  current: MatchRecord[]
  candidatePool: CandidateItem[]
  onChange: (next: MatchRecord[]) => void
}) {
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)

  const candidates = useMemo(() => {
    const seen = new Set(current.map(m => m.name.toLowerCase().trim()))
    const q = query.trim().toLowerCase()
    return candidatePool
      .filter(c => !seen.has(c.item_name.toLowerCase().trim()))
      .filter(c => !q || c.item_name.toLowerCase().includes(q))
      .slice(0, 25)
  }, [candidatePool, current, query])

  async function add(name: string) {
    setBusy(true)
    const body = isService ? { good_name: name, service_name: itemName } : { good_name: itemName, service_name: name }
    const res = await fetch('/api/good-service-matches', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const d = await res.json().catch(() => null)
    setBusy(false)
    if (res.ok) onChange([...current, { id: d?.id ?? -Date.now(), name }])
  }

  async function remove(match: MatchRecord) {
    setBusy(true)
    await fetch(`/api/good-service-matches/${match.id}`, { method: 'DELETE' })
    setBusy(false)
    onChange(current.filter(m => m.id !== match.id))
  }

  return (
    <div className="space-y-1">
      {current.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {current.map(m => (
            <span key={m.id} className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 text-[8px] font-semibold px-1.5 py-0.5 rounded-full">
              {m.name}
              <button onClick={() => remove(m)} disabled={busy} className="text-purple-400 hover:text-red-500 font-bold">×</button>
            </span>
          ))}
        </div>
      )}
      <input value={query} onChange={e => setQuery(e.target.value)}
        placeholder={`Search ${isService ? 'goods' : 'services'} to attach…`}
        className="w-full bg-gray-100 border border-gray-300 rounded px-1.5 py-1 text-[9px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400" />
      {query.trim() && (
        <div className="border border-gray-200 rounded bg-white max-h-28 overflow-y-auto">
          {candidates.length === 0 ? (
            <p className="text-[8px] text-gray-400 px-1.5 py-1">No matching {isService ? 'goods' : 'services'}</p>
          ) : candidates.map(c => (
            <button key={c.item_id} onClick={() => add(c.item_name)} disabled={busy}
              className="w-full text-left px-1.5 py-1 text-[8px] text-gray-800 hover:bg-purple-50 border-b border-gray-100 last:border-0 truncate">
              {c.item_name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}


/* ── Merge picker: fold one item's history into another under a chosen name.
   The pool spans BOTH goods and services -- a good/service pairing that's
   really the same real-world thing under two names (e.g. a service that's
   just an alias for a singles item) is a legitimate merge, not a mistake, so
   it isn't restricted to same-type candidates. Each result is tagged with
   its type so a mixed list stays unambiguous. ── */
function MergeItemPicker({ itemId, itemName, typeLabel, mergePool, onMerged }: {
  itemId: number; itemName: string
  typeLabel: 'service' | 'good'
  mergePool: CandidateItem[]
  onMerged: () => void
}) {
  const [search, setSearch] = useState('')
  const [target, setTarget] = useState<{ item_id: number; item_name: string } | null>(null)
  const [open, setOpen] = useState(false)
  const [finalChoice, setFinalChoice] = useState<'this' | 'other' | 'custom'>('this')
  const [customName, setCustomName] = useState('')
  const [merging, setMerging] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const filtered = search.length >= 1 && !target
    ? mergePool.filter(s => s.item_name.toLowerCase().includes(search.toLowerCase())).slice(0, 25)
    : []

  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [])

  const finalName = finalChoice === 'this' ? itemName : finalChoice === 'other' ? (target?.item_name ?? '') : customName.trim()

  async function merge() {
    if (!target || !finalName) return
    setMerging(true)
    await fetch('/api/items/merge', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loser_id: target.item_id, winner_id: itemId, final_name: finalName }),
    })
    setMerging(false)
    setTarget(null); setSearch(''); setCustomName(''); setFinalChoice('this')
    onMerged()
  }

  return (
    <div className="space-y-1.5">
      <div ref={ref} className="relative">
        <input value={target ? target.item_name : search}
          onChange={e => { setSearch(e.target.value); setTarget(null); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search items to merge with…"
          className="w-full bg-gray-100 border border-gray-300 rounded px-1.5 py-1 text-[9px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400" />
        {open && filtered.length > 0 && (
          <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-32 overflow-y-auto">
            {filtered.map(s => (
              <button key={s.item_id} onMouseDown={e => e.preventDefault()}
                onClick={() => { setTarget(s); setSearch(s.item_name); setOpen(false) }}
                className="w-full text-left px-1.5 py-1 text-[9px] text-gray-800 hover:bg-blue-50 border-b border-gray-100 last:border-0 truncate">
                {s.item_name}
                <span className={`ml-1 text-[7px] font-semibold ${s.product_type === 'service' ? 'text-purple-500' : 'text-teal-600'}`}>
                  ({s.product_type === 'service' ? 'service' : 'good'})
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {target && (
        <div className="space-y-1 bg-white border border-gray-200 rounded p-1.5">
          <p className="text-[8px] font-bold text-gray-500">Final name for the merged {typeLabel}:</p>
          <label className="flex items-center gap-1 text-[9px] text-gray-700">
            <input type="radio" checked={finalChoice === 'this'} onChange={() => setFinalChoice('this')} />
            <span className="truncate">{itemName}</span>
          </label>
          <label className="flex items-center gap-1 text-[9px] text-gray-700">
            <input type="radio" checked={finalChoice === 'other'} onChange={() => setFinalChoice('other')} />
            <span className="truncate">{target.item_name}</span>
          </label>
          <label className="flex items-center gap-1 text-[9px] text-gray-700">
            <input type="radio" checked={finalChoice === 'custom'} onChange={() => setFinalChoice('custom')} />
            <span>A different name…</span>
          </label>
          {finalChoice === 'custom' && (
            <input value={customName} onChange={e => setCustomName(e.target.value)}
              placeholder={`Type the final ${typeLabel} name`}
              className="w-full bg-gray-100 border border-gray-300 rounded px-1.5 py-1 text-[9px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400" />
          )}
          <button onClick={merge} disabled={merging || !finalName}
            className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-[9px] font-bold rounded py-1 transition">
            {merging ? 'Merging…' : `Merge — combined history becomes "${finalName || '…'}"`}
          </button>
        </div>
      )}
    </div>
  )
}

function ItemDetail({ item, groups, allItems, currentAliases, currentMatches, candidatePool, mergePool, isOwnerLevelUser, autoEdit, onSaved, onRelationsSaved, onMerged, onDateClick, showPrices, lossOnly, gainOnly }: {
  item: SummaryRow; groups: string[]; allItems: { item_id: number; item_name: string }[]
  currentAliases: AliasRecord[]; currentMatches: MatchRecord[]
  candidatePool: CandidateItem[]
  mergePool: CandidateItem[]
  isOwnerLevelUser: boolean
  autoEdit: boolean
  onSaved: (u: Partial<SummaryRow>) => void
  onRelationsSaved: (aliases: AliasRecord[], matches: MatchRecord[]) => void
  onMerged: () => void
  onDateClick?: (date: string, itemName: string) => void
  showPrices?: boolean
  gainOnly?: boolean
  lossOnly?: boolean
}) {
  const [dayRows, setDayRows] = useState<DayRow[] | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [aliases, setAliases] = useState<AliasRecord[]>(currentAliases)
  const [matches, setMatches] = useState<MatchRecord[]>(currentMatches)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function deleteItem() {
    setDeleting(true); setDeleteError('')
    const res = await fetch(`/api/items/${item.item_id}`, { method: 'DELETE' })
    const d = await res.json().catch(() => ({}))
    setDeleting(false)
    if (res.ok) { setEditing(false); onMerged() }
    else setDeleteError(d.error || 'Could not delete item.')
  }

  useEffect(() => {
    fetch(`/api/losses/${item.item_id}`).then(r => r.json())
      .then(d => setDayRows(Array.isArray(d) ? d : []))
      .catch(() => setDayRows([]))
  }, [item.item_id])

  // Combined view for any pack-style GOOD that converts into a singles item
  // (4x6 packs, envelope packs, ...): its row expands into a single table
  // spanning packs -> singles -> whatever draws on those singles, so lapses
  // anywhere in the chain are visible in one place.
  const isPackChain = item.product_type !== 'service' && item.converts_to_item_id != null
  const [targetDayRows, setTargetDayRows] = useState<DayRow[] | null>(null)

  // Who was at the shop on each date, with their clock-in/out times -- used
  // to apportion loss exposure by hours actually spent, not mere presence.
  const [presence, setPresence] = useState<Record<string, StaffPresence[]> | null>(null)

  useEffect(() => {
    if (!isPackChain) return
    fetch('/api/staff-times/all').then(r => r.json())
      .then(d => {
        const map: Record<string, StaffPresence[]> = {}
        for (const r of (Array.isArray(d) ? d : [])) {
          if (!r.actual_in || !r.work_date) continue
          ;(map[r.work_date] ??= []).push({ name: r.staff_name, in: r.actual_in, out: r.actual_out })
        }
        setPresence(map)
      })
      .catch(() => setPresence({}))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPackChain])

  // Per-single ₵ value for this chain: the singles item's own selling price
  // (e.g. ₵2 per envelope), falling back to the ₵20 photo-paper rule when the
  // target has no price set.
  const [sheetPrice, setSheetPrice] = useState<number>(PAPER_SELL_PRICE)
  // Singles item's own purchase rate -- for the WIC BOUGHT CP/PROFIT columns
  // on the single-service pack-chain layout.
  const [sheetCP, setSheetCP] = useState<number>(0)

  useEffect(() => {
    if (!isPackChain || item.converts_to_item_id == null) return
    fetch(`/api/items/${item.converts_to_item_id}`).then(r => r.json())
      .then(d => {
        const sp = parseFloat(d?.selling_price ?? '0') || 0
        setSheetPrice(sp > 0 ? sp : PAPER_SELL_PRICE)
        setSheetCP(parseFloat(d?.purchase_rate ?? '0') || 0)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPackChain, item.converts_to_item_id])

  useEffect(() => {
    if (!isPackChain || item.converts_to_item_id == null) { setTargetDayRows(null); return }
    fetch(`/api/losses/${item.converts_to_item_id}`).then(r => r.json())
      .then(d => setTargetDayRows(Array.isArray(d) ? d : []))
      .catch(() => setTargetDayRows([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPackChain, item.converts_to_item_id])

  // Work Not Written (cash counted beyond what was invoiced, per receipt) --
  // a shop-wide daily reconciliation figure, unrelated to any one item. When
  // this chain shows a possible stock loss with no record explaining it, a
  // same-day WNW amount is a candidate explanation: the missing stock may
  // have gone into an unwritten job whose cash still turned up. Summed per
  // day from positive-WNW receipts only (a same-day cash shortfall on some
  // other receipt is a separate problem).
  const [wnwByDate, setWnwByDate] = useState<Map<string, number> | null>(null)
  useEffect(() => {
    if (!isPackChain) return
    fetch('/api/sales').then(r => r.json())
      .then(d => {
        const map = new Map<string, number>()
        for (const r of (Array.isArray(d) ? d : [])) {
          const w = parseFloat(r?.wnw ?? '0') || 0
          if (w <= 0.001 || !r?.receipt_date) continue
          const date = String(r.receipt_date).slice(0, 10)
          map.set(date, parseFloat(((map.get(date) ?? 0) + w).toFixed(2)))
        }
        setWnwByDate(map)
      })
      .catch(() => setWnwByDate(new Map()))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPackChain])

  function startEdit() {
    setForm({
      item_name: item.item_name, cf_group: item.cf_group ?? '', selling_rate: item.sp ?? '', purchase_rate: item.cp ?? '',
      units_per_pack: item.units_per_pack ?? '', unit_name: '',
      converts_to_item_id: item.converts_to_item_id ? String(item.converts_to_item_id) : '',
    })
    setAliases(currentAliases)
    setMatches(currentMatches)
    setEditing(true)
  }

  useEffect(() => {
    if (autoEdit) startEdit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEdit])

  async function saveEdit() {
    setSaving(true)
    await fetch(`/api/items/${item.item_id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_name: form.item_name || undefined,
        cf_group: form.cf_group || null,
        selling_rate: form.selling_rate ? parseFloat(form.selling_rate) : null,
        purchase_rate: form.purchase_rate ? parseFloat(form.purchase_rate) : null,
        units_per_pack: form.units_per_pack ? parseFloat(form.units_per_pack) : null,
        unit_name: form.unit_name || null,
        converts_to_item_id: form.converts_to_item_id ? Number(form.converts_to_item_id) : null,
      }),
    })
    setSaving(false); setEditing(false)
    onSaved({
      item_name: form.item_name || item.item_name, cf_group: form.cf_group || null, sp: form.selling_rate || item.sp, cp: form.purchase_rate || item.cp,
      units_per_pack: form.units_per_pack || null,
      converts_to_item_id: form.converts_to_item_id ? Number(form.converts_to_item_id) : null,
    })
    onRelationsSaved(aliases, matches)
  }

  const computed = dayRows ? computeRows(dayRows) : null
  const sp = parseFloat(item.sp ?? '0') || 0
  const totalLoss = computed ? parseFloat(computed.reduce((s, r) => s + (r.loss ?? 0), 0).toFixed(4)) : 0
  const totalCost = parseFloat((totalLoss * sp).toFixed(2))
  const lgCls = `text-center font-bold border-l border-gray-300 py-0.5 ${totalLoss > 0 ? 'text-red-600' : totalLoss < 0 ? 'text-green-600' : 'text-gray-400'}`

  // When 2+ services independently draw on this item's stock, show each one as its own
  // column (instead of one combined "Used" number) so they can be told apart.
  const breakdownNames = computed
    ? Array.from(new Set(computed.flatMap(r => (r.wic_breakdown ?? []).map(b => b.name)))).sort()
    : []
  const showBreakdown = breakdownNames.length >= 2
  const breakdownColW = showBreakdown ? Math.max(4, Math.min(6, Math.floor(14 / breakdownNames.length))) : 0
  const aliasW = 100 - 71 - breakdownColW * breakdownNames.length

  const targetComputed = targetDayRows ? computeRows(targetDayRows) : null
  const targetName = allItems.find(a => a.item_id === item.converts_to_item_id)?.item_name ?? 'target item'
  const packChainRows = isPackChain && computed && targetComputed ? buildPackChainRows(computed, targetComputed) : []
  const packChainOmissionsByDate = packChainRows.length > 0
    ? computePackChainOmissions(packChainRows, numVal(item.units_per_pack), item.item_name)
    : new Map<string, Omission[]>()
  const packCycles = isPackChain && targetComputed ? buildPackCycles(targetComputed) : []
  const packCyclesByStart = new Map(packCycles.map(c => [c.start, c]))
  // Column totals shown in the (sticky) header row. Gains should always be 0
  // -- any gain means a record is missing -- so they're flagged loudly.
  const packLossTotal = parseFloat(packChainRows.reduce((s, r) => s + ((r.packLoss ?? 0) > 0.001 ? (r.packLoss as number) : 0), 0).toFixed(2))
  const packGainTotal = parseFloat(packChainRows.reduce((s, r) => s + ((r.packLoss ?? 0) < -0.001 ? -(r.packLoss as number) : 0), 0).toFixed(2))
  const closedCycles = packCycles.filter(c => c.end !== null)
  const cycleLossTotal = parseFloat(closedCycles.reduce((s, c) => s + Math.max(0, c.sheetsGiven - c.used), 0).toFixed(2))
  const cycleGainTotal = parseFloat(closedCycles.reduce((s, c) => s + Math.max(0, c.used - c.sheetsGiven), 0).toFixed(2))
  const packChainBreakdownNames = targetComputed
    ? Array.from(new Set(targetComputed.flatMap(r => (r.wic_breakdown ?? []).map(b => b.name)))).sort()
    : []
  const packChainColW = Math.max(4, Math.min(6, Math.floor(12 / Math.max(1, packChainBreakdownNames.length))))
  const unitsPerPack = numVal(item.units_per_pack)
  // Single-service chains (e.g. A4 Brown Envelope) get the fuller
  // SP/AMOUNT/CP/PROFIT economics layout below; multi-service chains (e.g.
  // 4x6, with Passport + Picture Printing) keep the per-service breakdown table.
  const singleServiceChain = packChainBreakdownNames.length <= 1

  return (
    // For the pack-chain view the wrapper grows to the table's full width
    // (w-max) instead of clipping it (overflow-hidden), so the detail panel
    // can scroll sideways while the frozen DATE column stays put.
    <div className={`bg-white border border-gray-200 rounded-lg mt-0.5 ${isPackChain ? 'w-max min-w-full' : 'overflow-hidden'}`}>
      {editing && (
        <div className="px-2 pt-1.5 pb-2 space-y-2">
          <div className="flex items-center justify-end gap-1">
            <button onClick={saveEdit} disabled={saving} className="text-[8px] font-bold text-white bg-green-600 px-1.5 py-0.5 rounded disabled:opacity-50">{saving ? '…' : 'Save'}</button>
            <button onClick={() => setEditing(false)} className="text-[8px] font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">✕</button>
          </div>
          <ItemEditForm form={form} onChange={setForm} groups={groups} itemId={item.item_id} isService={item.product_type === 'service'} allItems={allItems} />
          <div>
            <label className="text-[8px] font-bold text-gray-500 block mb-0.5">Aliases</label>
            <AliasPicker itemId={item.item_id} current={aliases} onChange={setAliases} />
          </div>
          <div>
            <label className="text-[8px] font-bold text-gray-500 block mb-0.5">
              {item.product_type === 'service' ? 'Goods used for this service' : 'Services this good is used for'}
            </label>
            <MatchPicker itemId={item.item_id} itemName={item.item_name} isService={item.product_type === 'service'}
              current={matches} candidatePool={candidatePool} onChange={setMatches} />
          </div>
          {isOwnerLevelUser && (
            <div>
              <label className="text-[8px] font-bold text-gray-500 block mb-0.5">
                Merge with another {item.product_type === 'service' ? 'service' : 'good'}
              </label>
              <MergeItemPicker itemId={item.item_id} itemName={item.item_name}
                typeLabel={item.product_type === 'service' ? 'service' : 'good'} mergePool={mergePool}
                onMerged={() => { setEditing(false); onMerged() }} />
            </div>
          )}
          {isOwnerLevelUser && (
            <div>
              <label className="text-[8px] font-bold text-gray-500 block mb-0.5">Delete this item</label>
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)}
                  className="w-full bg-gray-100 hover:bg-red-50 text-red-600 text-[10px] font-semibold rounded py-1.5 transition">
                  Delete Item
                </button>
              ) : (
                <div className="space-y-1">
                  <p className="text-[10px] text-red-600">
                    Only possible if it has no sales, bills, or stock counts. This can't be undone
                    -- merge it into another item instead if it has history.
                  </p>
                  <div className="flex gap-1">
                    <button onClick={deleteItem} disabled={deleting}
                      className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-[10px] font-semibold rounded py-1.5 transition">
                      {deleting ? 'Deleting…' : 'Yes, Delete Permanently'}
                    </button>
                    <button onClick={() => { setConfirmDelete(false); setDeleteError('') }}
                      className="px-3 py-1.5 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded">
                      Cancel
                    </button>
                  </div>
                  {deleteError && <p className="text-[10px] text-red-600 font-medium">{deleteError}</p>}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* detail table -- the Available/Used narrative format is only for items
          where 2+ services share stock (e.g. 4x6 singles); every other item
          keeps the original DATE/₵/L-G/WIC/GMC/SP/BL/CNV/EXP layout. */}
      {!dayRows || (isPackChain && !targetDayRows) ? (
        <p className="text-[9px] text-gray-400 text-center py-3">Loading…</p>
      ) : isPackChain ? (
        packChainRows.length === 0 ? (
          <p className="text-[9px] text-gray-400 text-center py-3">No activity.</p>
        ) : singleServiceChain ? (
          <SingleServicePackChainTable
            item={item} targetName={targetName} packChainRows={packChainRows}
            packChainOmissionsByDate={packChainOmissionsByDate}
            packCyclesByStart={packCyclesByStart} closedCycles={closedCycles}
            packLossTotal={packLossTotal} packGainTotal={packGainTotal}
            cycleLossTotal={cycleLossTotal} cycleGainTotal={cycleGainTotal}
            unitsPerPack={unitsPerPack} sheetPrice={sheetPrice} sheetCP={sheetCP} sp={sp}
            onDateClick={onDateClick}
            packChainBreakdownNames={packChainBreakdownNames}
            showPrices={showPrices ?? false}
            wnwByDate={wnwByDate ?? new Map()}
            lossOnly={lossOnly ?? false}
            gainOnly={gainOnly ?? false}
          />
        ) : (
          <>
            <p className="text-[8px] font-bold text-gray-500 px-1.5 py-1 bg-gray-50 border-b border-gray-200">
              Combined view: {item.item_name} → {targetName} → services
            </p>
            <table className="table-fixed border-collapse text-[8px]"
              style={{ width: `${62 + 2 * 48 + 10 * 36 + packChainBreakdownNames.length * 60 + 56 + 64 + 72 + 64 + 480 + 320}px` }}>
              {/* Pixel-widths: date frozen at its text width, numeric columns as
                  thin as their numbers, OMISSIONS wide (480px) so its text stays
                  on 1-2 lines, and ASK STAFF last & wide (320px) so its content
                  fits ~2 lines instead of stacking tall. The table scrolls
                  sideways inside the detail panel; the date column stays frozen. */}
              <colgroup>
                <col style={{width:'62px'}} />
                <col style={{width:'48px'}} />
                <col style={{width:'36px'}} />
                <col style={{width:'36px'}} />
                <col style={{width:'36px'}} />
                <col style={{width:'36px'}} />
                <col style={{width:'36px'}} />
                <col style={{width:'36px'}} />
                <col style={{width:'36px'}} />
                <col style={{width:'64px'}} />
                <col style={{width:'72px'}} />
                <col style={{width:'64px'}} />
                {packChainBreakdownNames.map(n => <col key={n} style={{width:'60px'}} />)}
                <col style={{width:'48px'}} />
                <col style={{width:'36px'}} />
                <col style={{width:'36px'}} />
                <col style={{width:'36px'}} />
                <col style={{width:'56px'}} />
                <col style={{width:'480px'}} />
                <col style={{width:'320px'}} />
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="bg-amber-500 text-gray-800 font-bold">
                  <th rowSpan={2} className="py-0.5 border-b-2 border-gray-400 text-left pl-0.5 align-bottom sticky left-0 z-20 bg-amber-500">DATE</th>
                  <th colSpan={7} className="py-0.5 border-b border-gray-400 text-center border-l-2 border-l-gray-600">
                    {item.item_name}
                  </th>
                  <th colSpan={8 + packChainBreakdownNames.length} className="py-0.5 border-b border-gray-400 text-center border-l-2 border-l-gray-600">
                    {targetName}
                  </th>
                  <th rowSpan={2} className="py-0.5 border-b-2 border-gray-400 text-center align-bottom border-l-2 border-l-gray-600"
                    title={`Losses valued in cedis at ₵${sheetPrice} per single. Pack losses count as packs × singles-per-pack × ₵${sheetPrice} — treated as singles that were used but never recorded, NOT at the pack's own selling price.`}>
                    LOSS ₵
                  </th>
                  <th rowSpan={2} className="py-0.5 border-b-2 border-gray-400 text-center align-bottom border-l-2 border-l-gray-600"
                    title="Records that should exist but are missing — e.g. singles jumped up with no GMC pack recorded. These distort the gains/losses.">
                    OMISSIONS
                  </th>
                  <th rowSpan={2} className="py-0.5 border-b-2 border-gray-400 text-center align-bottom border-l-2 border-l-gray-600"
                    title="Exposure to this loss, apportioned by hours each staff member actually spent at the shop between the previous count and this one (from clock-in/out times) — not a general blame for merely being present. Also shows who counted at each end and, for one-day windows, each person's arrival–departure times.">
                    ASK STAFF
                  </th>
                </tr>
                <tr className="bg-amber-400 text-gray-800 font-bold">
                  <th className="py-0.5 border-b-2 border-gray-400 text-center border-l-2 border-l-gray-600" title="Physical count">CNT</th>
                  <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400" title="Bought/received">BL</th>
                  <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400" title="Taken for internal use (credits singles below)">GMC</th>
                  <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400" title="Sold as whole packs to a real customer">WIC</th>
                  <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400" title="Running expected stock">EXP</th>
                  <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400"
                    title="Packs missing at count. Column total shown below the label.">
                    LOSS
                    <span className="block text-red-700">{packLossTotal > 0 ? `-${fmtQ(packLossTotal)}` : '0'}</span>
                  </th>
                  <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400"
                    title="Packs gained at count. Gains should ALWAYS be 0 — any gain means a record is missing (unrecorded bill, wrong GMC, or an earlier count error). Column total shown below the label.">
                    GAIN
                    <span className={`block ${packGainTotal > 0 ? 'bg-red-600 text-white rounded px-0.5' : 'text-green-800'}`}>
                      {packGainTotal > 0 ? `⚠+${fmtQ(packGainTotal)}` : '0'}
                    </span>
                  </th>
                  <th className="py-0.5 border-b-2 border-gray-400 text-center border-l-2 border-l-gray-600" title="Credited in from pack GMC take">CONV</th>
                  <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400"
                    title="On rows where a GMC pack was taken: total sheets recorded as used (services + direct sales) from this pack until the NEXT pack was taken — the pack's full cycle, measured purely from records, independent of counts.">
                    USED/PACK
                  </th>
                  <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400"
                    title={`Singles a pack gave but never recorded as used before the next pack, valued at ₵${sheetPrice} each. Column total (closed packs) shown below the label.`}>
                    PACK LOSS
                    <span className="block text-red-700">{cycleLossTotal > 0 ? `-₵${fmtN(cycleLossTotal * sheetPrice)}` : '0'}</span>
                  </th>
                  <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400"
                    title="Sheets used BEYOND what the pack gave — should ALWAYS be 0; any value means leftover from a previous pack or an unrecorded GMC take. Column total shown below the label.">
                    PACK GAIN
                    <span className={`block ${cycleGainTotal > 0 ? 'bg-red-600 text-white rounded px-0.5' : 'text-green-800'}`}>
                      {cycleGainTotal > 0 ? `⚠+${fmtQ(cycleGainTotal)}` : '0'}
                    </span>
                  </th>
                  {packChainBreakdownNames.map(n => (
                    <th key={n} title={n} className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400">
                      {shortSourceName(n)}
                    </th>
                  ))}
                  <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400" title="Physical count">CNT</th>
                  <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400" title="Total used across all services">USED</th>
                  <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400" title="Running expected stock">EXP</th>
                  <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400" title="Count loss/gain on singles">L/G</th>
                </tr>
              </thead>
              <tbody>
                {packChainRows.map((row, i) => {
                  const omissions = packChainOmissionsByDate.get(row.date) ?? []
                  const hasLoss = (row.packLoss ?? 0) > 0.001 || (row.singlesLoss ?? 0) > 0.001
                  const ask = hasLoss && presence ? staffExposure(packChainRows, i, presence) : null
                  return (
                  <tr key={i} className={`border-b border-gray-200 ${(row.singlesLoss ?? 0) > 0.001 || (row.packLoss ?? 0) > 0.001 ? 'bg-red-50' : omissions.length > 0 ? 'bg-orange-50' : 'bg-white'}`}>
                    <td className="pl-0.5 py-0.5 font-bold text-gray-500 whitespace-nowrap sticky left-0 bg-inherit">
                      {onDateClick ? (
                        <button onClick={() => onDateClick(row.date, item.item_name)} className="text-blue-600 hover:underline">
                          {fmtDate(row.date)}
                        </button>
                      ) : fmtDate(row.date)}
                    </td>
                    <td className="text-center py-0.5 font-bold border-l-2 border-l-gray-600 text-gray-900 whitespace-nowrap">
                      <CntValue qty={row.packCnt} countedBy={row.packCntBy} history={row.packCntHistory} />
                    </td>
                    <td className="text-center py-0.5 font-bold border-l border-gray-300 text-blue-600">{fmtQs(row.packBl)}</td>
                    <td className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-600">{fmtQs(row.packGmc)}</td>
                    <td className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-600">{fmtQs(row.packWic)}</td>
                    <td className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-400">{fmtN(row.packExp)}</td>
                    <td className="text-center py-0.5 font-bold border-l border-gray-300">
                      {row.packLoss === null ? <span className="text-gray-300">—</span>
                        : row.packLoss > 0.001 ? <span className="text-red-600">-{fmtN(row.packLoss)}</span>
                        : <span className="text-gray-400">0</span>}
                    </td>
                    <td className="text-center py-0.5 font-bold border-l border-gray-300">
                      {row.packLoss !== null && row.packLoss < -0.001
                        ? <span className="bg-red-600 text-white rounded px-0.5" title="A gain should never happen — a record is missing (unrecorded bill, wrong GMC, or an earlier count error). See OMISSIONS.">⚠+{fmtN(Math.abs(row.packLoss))}</span>
                        : row.packLoss === null ? <span className="text-gray-300">—</span>
                        : <span className="text-gray-400">0</span>}
                    </td>
                    <td className="text-center py-0.5 font-bold border-l-2 border-l-gray-600 text-teal-600">{fmtQs(row.singlesConvIn)}</td>
                    {(() => {
                      // Pack-cycle accounting on the day the pack was taken:
                      // sheets used from this GMC take until the next one.
                      const cyc = packCyclesByStart.get(row.date)
                      if (!cyc) return (
                        <>
                          <td className="text-center py-0.5 border-l border-gray-300"><span className="text-gray-300">—</span></td>
                          <td className="text-center py-0.5 border-l border-gray-300"><span className="text-gray-300">—</span></td>
                          <td className="text-center py-0.5 border-l border-gray-300"><span className="text-gray-300">—</span></td>
                        </>
                      )
                      const diff = parseFloat((cyc.sheetsGiven - cyc.used).toFixed(2))
                      const open = cyc.end === null
                      return (
                        <>
                          <td className="text-center py-0.5 font-bold border-l border-gray-300 whitespace-nowrap"
                            title={open ? 'This pack is still in use — no next GMC take yet' : `Sheets used from this take until the next pack on ${fmtDate(cyc.end!)}`}>
                            <span className="text-purple-700">{fmtQ(cyc.used)}</span>
                            <span className="text-gray-400"> / {fmtQ(cyc.sheetsGiven)}</span>
                            {open && <span className="block text-blue-600 text-[6px] font-semibold">in progress</span>}
                          </td>
                          <td className="text-center py-0.5 font-bold border-l border-gray-300 whitespace-nowrap">
                            {open ? <span className="text-gray-300">—</span>
                              : diff > 0.001 ? (
                                <span className="text-red-600">-₵{fmtN(diff * sheetPrice)}<span className="block text-[6px]">-{fmtQ(diff)} sheets</span></span>
                              ) : <span className="text-green-600">✓</span>}
                          </td>
                          <td className="text-center py-0.5 font-bold border-l border-gray-300 whitespace-nowrap">
                            {open ? <span className="text-gray-300">—</span>
                              : diff < -0.001 ? (
                                <span className="bg-red-600 text-white rounded px-0.5"
                                  title="Sheets used beyond what this pack gave — should be 0. Either leftover from the previous pack, or a GMC take was not recorded.">
                                  ⚠+{fmtQ(Math.abs(diff))}
                                </span>
                              ) : <span className="text-gray-400">0</span>}
                          </td>
                        </>
                      )
                    })()}
                    {packChainBreakdownNames.map(n => {
                      const b = row.singlesBreakdown.find(x => x.name === n)
                      const qty = b?.qty ?? 0, amount = b?.amount ?? 0
                      return (
                        <td key={n} className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-600 whitespace-nowrap overflow-hidden">
                          {qty === 0 ? '—' : <>{fmtQ(qty)}<span className="text-blue-500 text-[6px]"> (₵{fmtN(amount)})</span></>}
                        </td>
                      )
                    })}
                    <td className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-900 whitespace-nowrap">
                      <CntValue qty={row.singlesCnt} countedBy={row.singlesCntBy} history={row.singlesCntHistory} />
                    </td>
                    <td className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-600">{fmtQ(row.singlesUsed)}</td>
                    <td className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-400">{fmtN(row.singlesExp)}</td>
                    <td className="text-center py-0.5 font-bold border-l border-gray-300">
                      {row.singlesLoss === null ? <span className="text-gray-300">—</span>
                        : row.singlesLoss > 0.001 ? <span className="text-red-600">-{fmtN(row.singlesLoss)}</span>
                        : row.singlesLoss < -0.001 ? <span className="text-green-600">+{fmtN(Math.abs(row.singlesLoss))}</span>
                        : <span className="text-gray-400">0</span>}
                    </td>
                    <td className="text-center py-0.5 font-bold border-l-2 border-l-gray-600 whitespace-nowrap">
                      {(() => {
                        const cedis = rowLossCedis(row, numVal(item.units_per_pack), sheetPrice)
                        if (cedis === null) return <span className="text-gray-300">—</span>
                        if (cedis > 0.001) return <span className="text-red-600">-₵{fmtN(cedis)}</span>
                        if (cedis < -0.001) return <span className="text-green-600">+₵{fmtN(Math.abs(cedis))}</span>
                        return <span className="text-gray-400">0</span>
                      })()}
                    </td>
                    <td className="text-left py-0.5 pl-1 pr-0.5 border-l-2 border-l-gray-600 whitespace-normal break-words leading-tight">
                      {omissions.length === 0 ? <span className="text-gray-300">—</span> : omissions.map((o, oi) => (
                        <div key={oi} className={oi > 0 ? 'mt-1 pt-1 border-t border-orange-200' : ''}>
                          <span className="text-orange-700 font-semibold">{o.issue}</span>
                          <span className="text-blue-700"> 💡 Fix: {o.fix}</span>
                        </div>
                      ))}
                    </td>
                    <td className="text-left py-0.5 pl-1 pr-1 border-l-2 border-l-gray-600 whitespace-normal break-words leading-tight align-top">
                      {!hasLoss ? <span className="text-gray-300">—</span>
                        : !presence ? <span className="text-gray-300">…</span>
                        : ask && ask.shares.length > 0 ? (
                          <>
                            {/* Shares inline (comma-separated) so the wide column
                                keeps them to ~1 line; the count window is line 2. */}
                            <span>
                              {ask.shares.map((s, si) => {
                                const topShare = si === 0 && ask.shares.length > 1 && s.pct > Math.round(100 / ask.shares.length) + 5
                                return (
                                  <span key={s.name} className="whitespace-nowrap">
                                    {si > 0 && <span className="text-gray-300">, </span>}
                                    <span className={topShare ? 'text-red-700 font-bold' : 'text-gray-800 font-semibold'}>
                                      {capName(s.name)}
                                    </span>
                                    <span className="text-gray-500"> {hrsLabel(s.mins)}·{s.pct}%</span>
                                    {s.range && <span className="text-gray-400 text-[6px]"> ({s.range})</span>}
                                  </span>
                                )
                              })}
                            </span>
                            <span className="block text-gray-400">
                              {ask.from
                                ? `count${initialOf(ask.fromBy) ? ` by ${initialOf(ask.fromBy)}` : ''} ${fmtDate(ask.from)} → count${initialOf(ask.endBy) ? ` by ${initialOf(ask.endBy)}` : ''} ${fmtDate(row.date)}`
                                : `up to count${initialOf(ask.endBy) ? ` by ${initialOf(ask.endBy)}` : ''} ${fmtDate(row.date)}`}
                            </span>
                          </>
                        ) : (
                          <span className="text-orange-600">no clock-ins recorded for this period — attendance gap is itself a red flag</span>
                        )}
                    </td>
                  </tr>
                  )
                })}
                {(() => {
                  const totalCedis = packChainRows.reduce((s, r) => s + (rowLossCedis(r, numVal(item.units_per_pack), sheetPrice) ?? 0), 0)
                  return (
                    <tr className="bg-gray-100 border-t-2 border-gray-400 font-bold">
                      <td colSpan={9} className="text-right pr-1 py-1 text-gray-600 text-[7px]">
                        {`over ${closedCycles.length} closed pack${closedCycles.length === 1 ? '' : 's'} →`}
                      </td>
                      <td className="border-l border-gray-300" />
                      <td className="text-center py-1 border-l border-gray-300 whitespace-nowrap"
                        title="Total sheets given but never recorded as used, over all closed pack cycles">
                        {cycleLossTotal > 0.001 ? <span className="text-red-600">-₵{fmtN(cycleLossTotal * sheetPrice)}</span>
                          : <span className="text-gray-400">0</span>}
                      </td>
                      <td className="text-center py-1 border-l border-gray-300 whitespace-nowrap"
                        title="Total sheets used beyond what packs gave — should be 0">
                        {cycleGainTotal > 0.001 ? <span className="bg-red-600 text-white rounded px-0.5">⚠+{fmtQ(cycleGainTotal)}</span>
                          : <span className="text-gray-400">0</span>}
                      </td>
                      <td colSpan={4 + packChainBreakdownNames.length} className="text-right pr-1 py-1 text-gray-600">
                        TOTAL (net of gains)
                      </td>
                      <td className="text-center py-1 border-l-2 border-l-gray-600 whitespace-nowrap">
                        {totalCedis > 0.001 ? <span className="text-red-600">-₵{fmtN(parseFloat(totalCedis.toFixed(2)))}</span>
                          : totalCedis < -0.001 ? <span className="text-green-600">+₵{fmtN(Math.abs(parseFloat(totalCedis.toFixed(2))))}</span>
                          : <span className="text-gray-400">0</span>}
                      </td>
                      <td className="border-l-2 border-l-gray-600" />
                      <td className="border-l-2 border-l-gray-600" />
                    </tr>
                  )
                })()}
              </tbody>
            </table>
          </>
        )
      ) : computed!.length === 0 ? (
        <p className="text-[9px] text-gray-400 text-center py-3">No activity.</p>
      ) : showBreakdown ? (
        <table className="w-full table-fixed border-collapse text-[8px]">
          <colgroup>
            <col style={{width:'11%'}} />
            <col style={{width:'6%'}} />
            <col style={{width:'6%'}} />
            <col style={{width:'7%'}} />
            {breakdownNames.map(n => <col key={n} style={{width:`${breakdownColW}%`}} />)}
            <col style={{width:'7%'}} />
            <col style={{width:'6%'}} />
            <col style={{width:'6%'}} />
            <col style={{width:'7%'}} />
            <col style={{width:'5%'}} />
            <col style={{width:'5%'}} />
            <col style={{width:'5%'}} />
            <col style={{width:`${aliasW}%`}} />
          </colgroup>
          <thead>
            <tr className="bg-amber-400 text-gray-800 font-bold">
              <th className="py-0.5 border-b-2 border-gray-400 text-left pl-1">DATE</th>
              <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400" title="Physical count taken that day">CNT</th>
              <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400" title="Converted in from another item's GMC take">CNV</th>
              <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400 bg-black text-white"
                title="Available = previous stock + bills received + converted in">AVAIL</th>
              {breakdownNames.map(n => (
                <th key={n} title={n} className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400">
                  {shortSourceName(n)}
                </th>
              ))}
              <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400 bg-black text-white"
                title="Used = sold/consumed that day">USED</th>
              <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400" title="Expected = Available − Used">EXP</th>
              <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400" title="Count Loss = Expected − actual count (only on count days)">LOSS</th>
              <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400" title="Loss valued at selling price">₵</th>
              <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400" title="Direct GMC (internal use) on this item itself">GMC</th>
              <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400" title="Average direct sale price that day">SP</th>
              <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400" title="Direct bills/purchases received">BL</th>
              <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400">ALIAS</th>
            </tr>
          </thead>
          <tbody>
            {computed!.map((row, i) => {
              const lossVal = row.loss !== null ? row.loss * sp : null
              return (
                <tr key={i} className={`border-b border-gray-200 ${row.loss !== null && row.loss > 0.001 ? 'bg-red-50' : ''}`}>
                  <td className="pl-1 py-0.5 font-bold text-gray-500 whitespace-nowrap overflow-hidden">
                    {onDateClick ? (
                      <button onClick={() => onDateClick(row.date, item.item_name)} className="text-blue-600 hover:underline">
                        {fmtDate(row.date)}
                      </button>
                    ) : fmtDate(row.date)}
                  </td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-900 whitespace-nowrap">
                    <CntValue qty={row.qty_counted} countedBy={row.counted_by} history={row.count_history} />
                  </td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300 text-teal-600">{fmtQs(row.converted_in_qty)}</td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-400 bg-black text-white">{fmtN(row.available)}</td>
                  {breakdownNames.map(n => (
                    <td key={n} className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-600">
                      {fmtQ(row.wic_breakdown?.find(b => b.name === n)?.qty ?? 0)}
                    </td>
                  ))}
                  <td className="text-center py-0.5 font-bold border-l border-gray-400 bg-black text-white">{fmtQ(row.used)}</td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-400">{fmtN(row.expected_soh)}</td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300">
                    {row.loss === null ? <span className="text-gray-300">—</span>
                      : row.loss > 0.001 ? <span className="text-red-600">-{fmtN(row.loss)}</span>
                      : row.loss < -0.001 ? <span className="text-green-600">+{fmtN(Math.abs(row.loss))}</span>
                      : <span className="text-gray-400">0</span>}
                  </td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300">
                    {lossVal === null ? <span className="text-gray-300">—</span>
                      : lossVal > 0.01 ? <span className="text-red-600">-{fmtN(lossVal)}</span>
                      : lossVal < -0.01 ? <span className="text-green-600">+{fmtN(Math.abs(lossVal))}</span>
                      : <span className="text-gray-400">0</span>}
                  </td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-600">{fmtQs(row.gmc_qty)}</td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300 text-blue-500">{fmtQs(row.sell_price)}</td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300 text-blue-600">{fmtQs(row.bills_qty)}</td>
                  <td className="pl-1 py-0.5 border-l border-gray-300 text-purple-700 font-semibold overflow-hidden">
                    <span className="block truncate" title={row.aliases ?? ''}>{row.aliases ?? <span className="text-gray-300">—</span>}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold text-[8px]">
              <td className="pl-1 py-0.5 text-gray-500">Total</td>
              <td colSpan={5 + breakdownNames.length} />
              <td className={lgCls}>{totalLoss > 0.001 ? `-${fmtN(totalLoss)}` : totalLoss < -0.001 ? `+${fmtN(Math.abs(totalLoss))}` : '0'}</td>
              <td className={lgCls}>{totalCost > 0.01 ? `-₵${fmtN(totalCost)}` : totalCost < -0.01 ? `+₵${fmtN(Math.abs(totalCost))}` : '0'}</td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        </table>
      ) : (
        <table className="w-full table-fixed border-collapse text-[8px]">
          <colgroup>
            <col style={{width:'15%'}} />
            <col style={{width:'10%'}} />
            <col style={{width:'8%'}} />
            <col style={{width:'8%'}} />
            <col style={{width:'7%'}} />
            <col style={{width:'7%'}} />
            <col style={{width:'7%'}} />
            <col style={{width:'7%'}} />
            <col style={{width:'7%'}} />
            <col style={{width:'7%'}} />
            <col style={{width:'17%'}} />
          </colgroup>
          <thead>
            <tr className="bg-amber-400 text-gray-800 font-bold">
              <th className="py-0.5 border-b-2 border-gray-400 text-left pl-1">DATE</th>
              <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400">₵</th>
              <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400">L/G</th>
              <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400">CNT</th>
              <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400">WIC</th>
              <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400">GMC</th>
              <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400">SP</th>
              <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400">BL</th>
              <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400" title="Converted in from another item's GMC take">CNV</th>
              <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400">EXP</th>
              <th className="py-0.5 border-b-2 border-gray-400 text-center border-l border-gray-400">ALIAS</th>
            </tr>
          </thead>
          <tbody>
            {computed!.map((row, i) => {
              const lossVal = row.loss !== null ? row.loss * sp : null
              return (
                <tr key={i} className={`border-b border-gray-200 ${row.loss !== null && row.loss > 0.001 ? 'bg-red-50' : ''}`}>
                  <td className="pl-1 py-0.5 font-bold text-gray-500 whitespace-nowrap overflow-hidden">
                    {onDateClick ? (
                      <button onClick={() => onDateClick(row.date, item.item_name)} className="text-blue-600 hover:underline">
                        {fmtDate(row.date)}
                      </button>
                    ) : fmtDate(row.date)}
                  </td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300">
                    {lossVal === null ? <span className="text-gray-300">—</span>
                      : lossVal > 0.01 ? <span className="text-red-600">-{fmtN(lossVal)}</span>
                      : lossVal < -0.01 ? <span className="text-green-600">+{fmtN(Math.abs(lossVal))}</span>
                      : <span className="text-gray-400">0</span>}
                  </td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300">
                    {row.loss === null ? <span className="text-gray-300">—</span>
                      : row.loss > 0.001 ? <span className="text-red-600">-{fmtN(row.loss)}</span>
                      : row.loss < -0.001 ? <span className="text-green-600">+{fmtN(Math.abs(row.loss))}</span>
                      : <span className="text-gray-400">0</span>}
                  </td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-900 whitespace-nowrap">
                    <CntValue qty={row.qty_counted} countedBy={row.counted_by} history={row.count_history} />
                  </td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-600">{fmtQs(row.wic_qty)}</td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-600">{fmtQs(row.gmc_qty)}</td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300 text-blue-500">{fmtQs(row.sell_price)}</td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300 text-blue-600">{fmtQs(row.bills_qty)}</td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300 text-teal-600">{fmtQs(row.converted_in_qty)}</td>
                  <td className="text-center py-0.5 font-bold border-l border-gray-300 text-gray-400">{fmtN(row.expected_soh)}</td>
                  <td className="pl-1 py-0.5 border-l border-gray-300 text-purple-700 font-semibold overflow-hidden">
                    <span className="block truncate" title={row.aliases ?? ''}>{row.aliases ?? <span className="text-gray-300">—</span>}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold text-[8px]">
              <td className="pl-1 py-0.5 text-gray-500">Total</td>
              <td className={lgCls}>{totalCost > 0.01 ? `-₵${fmtN(totalCost)}` : totalCost < -0.01 ? `+₵${fmtN(Math.abs(totalCost))}` : '0'}</td>
              <td className={lgCls}>{totalLoss > 0.001 ? `-${fmtN(totalLoss)}` : totalLoss < -0.001 ? `+${fmtN(Math.abs(totalLoss))}` : '0'}</td>
              <td colSpan={8} />
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  )
}

/* ── main LossTab ── */
export default function LossTab({ onOpenItem: _onOpenItem, search = '', group = 'All', productType = 'all', jumpToItemId, onJumpDone, onDateClick, showPrices, lossOnly, gainOnly, onExpandedIdChange }: {
  onOpenItem: (itemId: number) => void
  search?: string
  group?: string | null
  productType?: 'all' | 'goods' | 'services'
  jumpToItemId?: number | null
  onJumpDone?: () => void
  onDateClick?: (date: string, itemName: string) => void
  showPrices?: boolean
  lossOnly?: boolean
  gainOnly?: boolean
  onExpandedIdChange?: (id: number | null) => void
}) {
  const [rows, setRows] = useState<SummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<{ col: SortCol; dir: SortDir }>({ col: 'lgAmt', dir: 'desc' })
  // Seeded from jumpToItemId (not null) so a restored ?item= from the URL
  // is already correct on the very first render -- otherwise this would
  // start closed, report that closed state up, and briefly strip ?item=
  // from the URL before the jump effect below has a chance to reopen it.
  const [expandedId, setExpandedId] = useState<number | null>(() => jumpToItemId ?? null)
  const [editTriggerId, setEditTriggerId] = useState<number | null>(null)
  const [aliasRecords, setAliasRecords] = useState<Record<number, AliasRecord[]>>({})
  const [matchRecords, setMatchRecords] = useState<Record<string, MatchRecord[]>>({})

  const { data: session } = useSession()
  const isOwnerLevelUser = isOwnerLevel(session?.user as any)

  function loadSummary() {
    return fetch('/api/losses/summary').then(r => r.json())
      .then(d => { setRows(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(() => { loadSummary() }, [])

  // Report the expanded row up so a refresh can restore it via the URL.
  useEffect(() => { onExpandedIdChange?.(expandedId) }, [expandedId, onExpandedIdChange])

  // Incoming jump from a sales receipt line: expand that item's row and
  // scroll it into view.
  useEffect(() => {
    if (!jumpToItemId || loading) return
    const row = rows.find(r => r.item_id === jumpToItemId)
    if (row) {
      setExpandedId(row.item_id)
      setTimeout(() => document.getElementById(`item-row-${row.item_id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    }
    onJumpDone?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpToItemId, loading])

  function reloadAfterMerge() {
    setExpandedId(null)
    loadSummary()
    loadAliases()
    loadMatches()
  }

  function loadMatches() {
    fetch('/api/good-service-matches').then(r => r.json())
      .then((d: { id: number; good_name: string; service_name: string }[]) => {
        if (!Array.isArray(d)) return
        // Bidirectional: a Good's key collects its Services, a Service's key collects its Goods
        const acc: Record<string, MatchRecord[]> = {}
        for (const { id, good_name, service_name } of d) {
          const gk = good_name.trim().toLowerCase()
          const sk = service_name.trim().toLowerCase()
          if (!acc[gk]) acc[gk] = []
          acc[gk].push({ id, name: service_name.trim() })
          if (!acc[sk]) acc[sk] = []
          acc[sk].push({ id, name: good_name.trim() })
        }
        setMatchRecords(acc)
      })
      .catch(() => {})
  }
  useEffect(() => { loadMatches() }, [])

  function loadAliases() {
    fetch('/api/aliases/wide').then(r => r.json())
      .then((d: any[]) => {
        if (!Array.isArray(d)) return
        const map: Record<number, AliasRecord[]> = {}
        for (const row of d) {
          const records = (row.aliases ?? []).map((a: any) => ({ id: a.id, name: a.name })).filter((a: AliasRecord) => a.name)
          if (records.length) map[row.item_id] = records
        }
        setAliasRecords(map)
      })
      .catch(() => {})
  }
  useEffect(() => { loadAliases() }, [])

  function handleSort(col: SortCol) {
    setSort(s => s.col === col
      ? { col, dir: s.dir === 'desc' ? 'asc' : 'desc' }
      : { col, dir: col === 'item_name' ? 'asc' : 'desc' }
    )
  }

  function patchRow(itemId: number, updates: Partial<SummaryRow>) {
    setRows(prev => prev.map(r => r.item_id === itemId ? { ...r, ...updates } : r))
  }

  const groupNames = useMemo(() =>
    Array.from(new Set(rows.map(r => r.cf_group ?? 'Ungrouped'))).sort()
  , [rows])

  const goodsPool = useMemo<CandidateItem[]>(() =>
    rows.filter(r => r.product_type !== 'service').map(r => ({ item_id: r.item_id, item_name: r.item_name, product_type: r.product_type }))
  , [rows])
  const servicesPool = useMemo<CandidateItem[]>(() =>
    rows.filter(r => r.product_type === 'service').map(r => ({ item_id: r.item_id, item_name: r.item_name, product_type: r.product_type }))
  , [rows])
  const allItemsList = useMemo(() =>
    rows.map(r => ({ item_id: r.item_id, item_name: r.item_name })).sort((a, b) => a.item_name.localeCompare(b.item_name))
  , [rows])

  const filtered = useMemo(() => {
    const q = (search ?? '').toLowerCase()
    const grp = group ?? 'All'
    const list = rows.filter(r => {
      if (q && !r.item_name.toLowerCase().includes(q) && !(r.cf_group ?? '').toLowerCase().includes(q)) return false
      if (grp !== 'All' && (r.cf_group ?? 'Ungrouped') !== grp) return false
      if (productType === 'services' && r.product_type !== 'service') return false
      if (productType === 'goods' && r.product_type === 'service') return false
      return true
    })
    const dir = sort.dir === 'desc' ? -1 : 1
    list.sort((a, b) => {
      const av = rowSortVal(a, sort.col), bv = rowSortVal(b, sort.col)
      return typeof av === 'string' ? dir * av.localeCompare(bv as string) : dir * ((av as number) - (bv as number))
    })
    return list
  }, [rows, search, group, productType, sort])

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  const thProps = { sort, onSort: handleSort }

  const colgroup = (
    <colgroup>
      <col style={{width:'104px'}} />
      <col style={{width:'30px'}} />
      <col style={{width:'26px'}} />
      <col style={{width:'26px'}} />
      <col style={{width:'26px'}} />
      <col style={{width:'26px'}} />
      <col style={{width:'22px'}} />
      <col style={{width:'26px'}} />
      <col style={{width:'30px'}} />
      <col style={{width:'26px'}} />
      <col style={{width:'56px'}} />
      <col style={{width:'50px'}} />
      <col style={{width:'18px'}} />
      <col style={{width:'220px'}} />
      <col style={{width:'220px'}} />
      <col style={{width:'50px'}} />
    </colgroup>
  )

  function renderRow(row: SummaryRow) {
    const lossAmt = row.lgAmt > 0, gainAmt = row.lgAmt < 0
    const lossQty = row.lgQty > 0, gainQty = row.lgQty < 0
    const soh = parseFloat(row.soh ?? '0') || 0
    const isOpen = expandedId === row.item_id
    return (
      <Fragment key={row.item_id}>
      <tr
        id={`item-row-${row.item_id}`}
        onClick={() => { setExpandedId(isOpen ? null : row.item_id); setEditTriggerId(null) }}
        className={`cursor-pointer transition
          ${isOpen ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
        <td className={`pl-1 pr-0 py-0.5 font-bold text-gray-900 whitespace-nowrap overflow-hidden sticky left-0 z-10 border border-black ${isOpen ? 'bg-blue-50' : 'bg-white'}`}
          title={row.item_name}>{row.item_name.slice(0, 20)}</td>
        <td className={`text-center py-0.5 font-bold tabular-nums border border-black ${lossAmt ? 'text-red-600' : gainAmt ? 'text-green-600' : 'text-gray-300'}`}>
          {fmtAmt(row.lgAmt)}
        </td>
        <td className={`text-center py-0.5 font-bold tabular-nums border border-black ${lossQty ? 'text-red-500' : gainQty ? 'text-green-600' : 'text-gray-300'}`}>
          {fmtLg(row.lgQty)}
        </td>
        <td className="text-center py-0.5 font-bold text-gray-700 tabular-nums border border-black">{fmtQ(row.cnt)}</td>
        <td className="text-center py-0.5 font-bold text-gray-700 tabular-nums border border-black">{fmtQ(row.wic)}</td>
        <td className="text-center py-0.5 font-bold text-gray-700 tabular-nums border border-black">{fmtQ(row.gmc)}</td>
        <td className="text-center py-0.5 font-bold text-blue-600 tabular-nums border border-black">{fmtQ(row.bl)}</td>
        <td className={`text-center py-0.5 font-bold tabular-nums border border-black ${soh <= 0 ? 'text-red-500' : 'text-gray-700'}`}>
          {soh % 1 === 0 ? soh : soh.toFixed(1)}
        </td>
        <td className="text-center py-0.5 font-bold text-blue-600 tabular-nums border border-black">{fmtCcy(row.sp)}</td>
        <td className="text-center py-0.5 font-bold text-green-600 tabular-nums border border-black">{fmtCcy(row.cp)}</td>
        <td className="text-center py-0.5 font-bold text-gray-500 truncate border border-black" title={row.cf_group ?? undefined}>{row.cf_group ?? '—'}</td>
        <td className={`text-center py-0.5 font-bold border border-black ${row.product_type === 'service' ? 'text-purple-500' : 'text-teal-600'}`}
          title={row.product_type === 'service' ? 'Service' : 'Good'}>
          {row.product_type === 'service' ? 'Service' : 'Good'}
        </td>
        <td className="text-center py-0.5 font-bold text-gray-400 border border-black">{isOpen ? '▾' : '▸'}</td>
        <td className="pl-1.5 py-0.5 font-bold text-gray-500 truncate overflow-hidden border border-black"
          title={(aliasRecords[row.item_id] ?? []).map(a => a.name).join(', ')}>
          {(aliasRecords[row.item_id] ?? []).map(a => a.name).join(', ') || '—'}
        </td>
        <td className="pl-1.5 py-0.5 font-bold text-gray-500 truncate overflow-hidden border border-black"
          title={(matchRecords[row.item_name.trim().toLowerCase()] ?? []).map(m => m.name).join(', ')}>
          {(matchRecords[row.item_name.trim().toLowerCase()] ?? []).map(m => m.name).join(', ') || '—'}
        </td>
        <td className="text-center py-0.5 border border-black">
          <button
            onClick={e => { e.stopPropagation(); setExpandedId(row.item_id); setEditTriggerId(row.item_id) }}
            className="text-[8px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
            Edit
          </button>
        </td>
      </tr>
      {isOpen && (
        <tr>
          {/* colSpan makes this cell as wide as the scrollable table, but the inner
              wrapper is sticky-pinned to the left edge and capped to the visible
              viewport width (like the frozen Item column above), so the detail
              table renders at phone width directly under the row that opened it.
              The cell itself has no background of its own, so whatever part of it
              sits past the sticky content just blends into the page instead of
              showing as a visible bar. */}
          <td colSpan={16} className="p-0 border border-black">
            {/* Was calc(100vw - 2rem) -- a leftover assumption of 2rem of
                horizontal page padding that doesn't actually exist anywhere
                in this layout (the scroll container above and the page
                wrapper in page.tsx both have zero horizontal padding), so it
                just reserved 32px of permanently blank space on every
                screen. Plain 100vw matches the real available width. */}
            <div className="sticky left-0 w-[100vw] max-w-[100vw] max-h-[50vh] overflow-auto bg-blue-50 px-0.5 pb-2 pt-0.5">
              <ItemDetail item={row} groups={groupNames} allItems={allItemsList}
                currentAliases={aliasRecords[row.item_id] ?? []}
                currentMatches={matchRecords[row.item_name.trim().toLowerCase()] ?? []}
                candidatePool={row.product_type === 'service' ? goodsPool : servicesPool}
                mergePool={[...goodsPool, ...servicesPool].filter(i => i.item_id !== row.item_id)}
                isOwnerLevelUser={isOwnerLevelUser}
                autoEdit={editTriggerId === row.item_id}
                onSaved={u => patchRow(row.item_id, u)}
                onRelationsSaved={(newAliases, newMatches) => {
                  setAliasRecords(prev => ({ ...prev, [row.item_id]: newAliases }))
                  setMatchRecords(prev => ({ ...prev, [row.item_name.trim().toLowerCase()]: newMatches }))
                  setEditTriggerId(null)
                }}
                onMerged={reloadAfterMerge}
                onDateClick={onDateClick}
                showPrices={showPrices}
                lossOnly={lossOnly}
                gainOnly={gainOnly} />
            </div>
          </td>
        </tr>
      )}
      </Fragment>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Table — all columns fit on screen; Item column compact */}
      <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-black bg-white">
        <table className="table-fixed border-collapse text-[8px]">
          {colgroup}
          <thead className="sticky top-0 z-20">
            <tr className="bg-gray-50">
              <SortTh label="Item" col="item_name" sort={sort} onSort={handleSort} cls="text-left pl-1 pr-0 sticky left-0 z-30 bg-gray-50 border-black" />
              <SortTh label="₵L/G" col="lgAmt" {...thProps} cls="text-center" />
              <SortTh label="L/G" col="lgQty" {...thProps} cls="text-center" />
              <SortTh label="CNT" col="cnt" {...thProps} cls="text-center" />
              <SortTh label="WIC" col="wic" {...thProps} cls="text-center" />
              <SortTh label="GMC" col="gmc" {...thProps} cls="text-center" />
              <SortTh label="BL" col="bl" {...thProps} cls="text-center" />
              <SortTh label="SOH" col="soh" {...thProps} cls="text-center" />
              <SortTh label="SP" col="sp" {...thProps} cls="text-center" />
              <SortTh label="CP" col="cp" {...thProps} cls="text-center" />
              <SortTh label="Group" col="cf_group" {...thProps} cls="text-center" />
              <SortTh label="Type" col="product_type" {...thProps} cls="text-center" />
              <th className={`${thBase} text-center text-gray-400`}>▸</th>
              <th className={`${thBase} text-left pl-1.5`}>Aliases</th>
              <th className={`${thBase} text-left pl-1.5`}>Matches</th>
              <th className={`${thBase} text-center`}>Edit</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={16} className="py-10 text-center text-gray-400 text-[9px]">No items</td></tr>
            )}
            {filtered.map(renderRow)}
          </tbody>
        </table>
      </div>
    </div>
  )
}
