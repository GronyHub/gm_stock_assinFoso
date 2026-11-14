'use client'
import { useState, useEffect, useMemo, useRef, Fragment, memo, type ReactNode, type CSSProperties } from 'react'
import { fmtDate, fmtTime } from '@/lib/fmtDate'
import { formatACP } from '@/lib/fmtNumber'
import type { ItemDayRow as DayRow, CountRevision } from '@/lib/itemDayRows'
import {
  numVal, computeRows, buildPackCycles, buildPackChainRows, packSideCedis, realizedCycleCedis,
  type PackCycle, type PackChainRow,
} from '@/lib/packChain'
import { COL_BY_KEY, type ColKey, type SortCol } from './lossTabColumns'
import { ColResizeHandle } from './columnPrefs'
import { ItemEditForm, EMPTY_ITEM_EDIT_FORM } from './ItemEditForm'
import ItemDetailModal from './ItemDetailModal'
import { LossDialog, type LossExtra, type LossPrompt } from './CountDialogs'

/* ── types ── */

export type SummaryRow = {
  item_id: number
  item_name: string
  cf_group: string | null
  product_type: string | null
  soh: string | null
  sp: string | null
  cp: string | null
  units_per_pack: string | null
  converts_to_item_id: number | null
  derived_from_item_id: number | null
  // The one place this table can confirm a "Count every N days" edit
  // actually saved -- see ItemEditForm's cadence field.
  count_interval: string | null
  gmc_type: string | null
  description: string | null
  needs_review: boolean
  lgAmt: number
  lgQty: number
  lossCount: number
  gainAmt: number
  wic: number
  gmc: number
  bl: number
  cnv: number
}

export type SortDir = 'asc' | 'desc'

export interface CountRecord {
  id: number
  item_id: number
  item_name: string
  count_date: string
  quantity_counted: number
  expected: number | null
  loss_qty: number | null
  gain_qty: number | null
  kind?: string
  notes: string | null
}

export const EMPTY_FORM = EMPTY_ITEM_EDIT_FORM

/* ── helpers ── */
export function fmtN(n: number | null) {
  if (n === null || typeof n !== 'number' || isNaN(n)) return '—'
  return n % 1 === 0 ? String(n) : n.toFixed(2)
}
export function fmtQs(v: string | null) {
  if (!v) return '—'
  const n = parseFloat(v)
  return isNaN(n) || n === 0 ? '—' : n % 1 === 0 ? String(n) : n.toFixed(2)
}
export function fmtQ(v: number) {
  if (typeof v !== 'number' || isNaN(v) || v === 0) return '—'
  return v % 1 === 0 ? String(v) : v.toFixed(2)
}
export function fmtCcy(v: string | null) {
  if (!v) return '—'
  const x = parseFloat(v)
  return isNaN(x) || x === 0 ? '—' : x.toFixed(0)
}
export function fmtAmt(v: number) {
  if (typeof v !== 'number' || isNaN(v) || v === 0) return '—'
  const absV = Math.abs(v)
  const s = absV >= 100 ? absV.toFixed(0) : absV.toFixed(1)
  return (v > 0 ? '+' : '-') + s
}
// Strips the "—" placeholder these fmt* helpers return for empty/zero
// values, for cells that should render fully blank instead.
export function blankDash(s: string) { return s === '—' ? '' : s }
// 3 letters -- these head a column that only ever holds a 1-2 digit
// number, so a long service name as the header just wastes width the
// data itself doesn't need.
export function shortSourceName(name: string) {
  return name.replace(/^service\s*-\s*/i, '').slice(0, 3)
}
export const SHORT_MON = ['Ja', 'Fe', 'Mr', 'Ap', 'My', 'Jn', 'Jl', 'Au', 'Se', 'Oc', 'No', 'De']
export const SHORT_DAY = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa']
// "26 Au '26-W" -- a tighter DATE column for these day-tables specifically
// (as many columns as possible need to fit on screen at once), separate
// from the shared fmtDate() used everywhere else in the app (tooltips,
// task notes, ...) where the fuller "26 Aug. '26-W" reads better.
export function shortItemDate(raw: string | null | undefined): string {
  if (!raw) return '—'
  const d = new Date(raw.length === 10 ? raw + 'T00:00:00' : raw)
  if (isNaN(d.getTime())) return String(raw)
  const yr = String(d.getFullYear()).slice(-2)
  return `${d.getDate()} ${SHORT_MON[d.getMonth()]} '${yr}-${SHORT_DAY[d.getDay()]}`
}
// Initial of the staff member who took the count, shown in brackets beside
// the CNT value (same style as the ₵ amounts on the service cells). James and
// Joe both start with J, so they get two letters: JM and JO.
export function initialOf(name: string | null | undefined): string | null {
  const t = (name ?? '').trim()
  if (!t) return null
  const lower = t.toLowerCase()
  if (lower.startsWith('james')) return 'JM'
  if (lower.startsWith('joe')) return 'JO'
  return t.charAt(0).toUpperCase()
}

// CNT cell content with its full history shown INLINE, stacked oldest first:
// a changed count keeps its old value struck through (value and counter's
// initial both crossed out); a deleted count keeps its value marked with a
// red ✗. In both cases the amber initial after it is the staff member who
// made the change/deletion. The current count (if any) sits below, untouched.
export function CntValue({ qty, countedBy, countedAt, history, blank }: { qty: string | null; countedBy: string | null; countedAt?: string | null; history: CountRevision[] | null | undefined; blank?: boolean }) {
  const text = fmtQs(qty)
  const hist = history ?? []
  const time = fmtTime(countedAt)
  if (text === '—' && hist.length === 0) return blank ? null : <span className="text-gray-300">—</span>
  return (
    <span className="inline-flex flex-col items-center leading-tight">
      {hist.map((h) => {
        const deleted = h.action === 'deleted'
        const oldText = fmtQs(h.old_qty == null ? null : String(h.old_qty))
        return (
          // Value, old-by initial, and changed-by initial each sit on their
          // own line -- same width-for-height trade as the current-value
          // block below, so multi-name cells don't force the column wide.
          <span key={`${h.changed_at}|${h.changed_by}`} className="flex flex-col items-center"
            title={`${deleted ? 'Deleted' : 'Changed'} by ${h.changed_by ?? 'unknown'} on ${fmtDate(h.changed_at)}`}>
            <span className={`whitespace-nowrap ${deleted ? 'text-red-600' : 'line-through text-gray-400'}`}>
              {deleted && <span className="text-red-600">✗</span>}
              {oldText}
            </span>
            {initialOf(h.old_by) && <span className="text-[12px] whitespace-nowrap">({initialOf(h.old_by)})</span>}
            {initialOf(h.changed_by) && (
              <span className="text-amber-600 text-[12px] font-bold whitespace-nowrap">{initialOf(h.changed_by)}</span>
            )}
          </span>
        )
      })}
      {text !== '—' && (
        // Value+staff-initial and the time sit on their own lines --
        // trades a bit of height for width, which is what this column
        // actually needs to give back to fit more columns on screen.
        <span className="flex flex-col items-center" title={time ? `Counted at ${time}` : undefined}>
          <span className="whitespace-nowrap">
            {text}
            {initialOf(countedBy) && <span className="text-blue-500 text-[12px]"> ({initialOf(countedBy)})</span>}
          </span>
          {time && <span className="text-gray-400 text-[12px] whitespace-nowrap">{time}</span>}
        </span>
      )}
    </span>
  )
}

// Wraps CntValue with press-and-hold-to-edit/delete when this day's count
// has a live stock_counts row (row.count_id) behind it -- reuses the exact
// same PUT/DELETE /api/stock/counts/[id] endpoint CountsTab.tsx already
// calls, so the edit history, gain/loss-reason gate, and audit trail all
// behave identically no matter which screen the edit came from. A day whose
// count was only ever deleted (count_id null, history still shown via
// CntValue) isn't editable -- there's nothing left to edit.
//
// Long-press starts editing (input + Save/Cancel/Del) instead of a plain
// click -- a click now taps through to onNavigate (jump to this count's own
// row on the Counts page) instead, so the two gestures cover "see it in
// context" vs. "fix it right here" without competing for the same tap. This
// also happens to fix a real bug the old click-to-edit version had: `editing`
// was computed elsewhere as `countEditId === row.count_id`, and since
// countEditId's own "nothing selected" sentinel is also null, that
// comparison was true for every single date with no count at all, not just
// whichever one was actually clicked -- every empty CNT cell rendered as if
// already mid-edit, all the time (see ItemDetail's two call sites, now
// guarded with `row.count_id != null &&`).
export function CntCell({ row, isOwnerLevelUser, editing, editQty, saving, onStartEdit, onQtyChange, onSave, onCancel, onDelete, onNavigate }: {
  row: DayRow
  isOwnerLevelUser: boolean
  editing: boolean
  editQty: string
  saving: boolean
  onStartEdit: () => void
  onQtyChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
  onDelete: () => void
  onNavigate?: (countId: number) => void
}) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFired = useRef(false)
  const LONG_PRESS_MS = 500
  function startPress() {
    longPressFired.current = false
    pressTimer.current = setTimeout(() => { longPressFired.current = true; onStartEdit() }, LONG_PRESS_MS)
  }
  function cancelPress() {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null }
  }
  function handleClick() {
    // The physical release after a fired long-press still dispatches a
    // click right after -- swallow exactly that one instead of also
    // navigating away from the edit UI it just opened.
    if (longPressFired.current) { longPressFired.current = false; return }
    if (row.count_id != null) onNavigate?.(row.count_id)
  }

  if (editing) {
    return (
      <span className="inline-flex flex-col items-end gap-0.5">
        <input type="number" min="0" step="any" autoFocus value={editQty} onChange={e => onQtyChange(e.target.value)}
          className="w-12 text-[12px] border border-gray-300 rounded px-1 py-0.5 text-right outline-none focus:ring-1 focus:ring-blue-400" />
        <span className="flex gap-0.5">
          <button type="button" onClick={onSave} disabled={saving}
            className="text-[12px] font-bold text-white bg-green-600 hover:bg-green-700 rounded px-1 disabled:opacity-50">
            {saving ? '…' : 'Save'}
          </button>
          <button type="button" onClick={onCancel}
            className="text-[12px] font-bold text-gray-600 bg-gray-200 hover:bg-gray-300 rounded px-1">
            Cancel
          </button>
          {isOwnerLevelUser && (
            <button type="button" onClick={onDelete}
              className="text-[12px] font-bold text-white bg-red-600 hover:bg-red-700 rounded px-1">
              Del
            </button>
          )}
        </span>
      </span>
    )
  }
  const content = <CntValue qty={row.qty_counted} countedBy={row.counted_by} countedAt={row.counted_at} history={row.count_history} />
  if (row.count_id == null) return content
  return (
    <button type="button"
      onPointerDown={startPress} onPointerUp={cancelPress} onPointerLeave={cancelPress} onPointerCancel={cancelPress}
      onContextMenu={e => e.preventDefault()}
      onClick={handleClick}
      title="Tap to view in Counts · Press and hold to edit or delete"
      className="hover:bg-blue-50 rounded px-0.5 -mx-0.5 transition select-none">
      {content}
    </button>
  )
}

// CNV column cell -- the converted-in quantity plus, when it came through a
// Live Sale tap (not every conversion did -- see daily_converted_in_time's
// own comment in lib/itemDayRows.ts), the clock time it was tapped in. When
// this pack's own self-contained usage tally exists (see cycle_used/
// cycle_closed in lib/itemDayRows.ts), shown as a "used/given" fraction
// instead of the bare quantity -- e.g. "24/50" -- so this cell alone
// answers how much of THIS pack has been used, independent of any other
// row. Still open (no next pack yet) is marked "open". Same red=loss,
// green=gain-or-breakeven convention as the rest of this table: using more
// than the pack gave is a gain (green), even before the cycle closes; a
// shortfall only counts as a real loss (red) once the cycle is closed --
// while still open it could still be made up before the next pack.
// usedBefore/usedAfter (see cnv_used_before/cnv_used_after in
// lib/itemDayRows.ts) is this SAME day's own before/after split around the
// exact tap moment -- only passed in by tables that don't already show it
// in a dedicated Used column (see the "2+ services" breakdown table below,
// which does).
export function CnvValue({ qty, time, used, closed, usedBefore, usedAfter }: {
  qty: string | null; time?: string | null
  used?: number | null; closed?: boolean | null
  usedBefore?: number | null; usedAfter?: number | null
}) {
  const text = fmtQs(qty)
  const t = fmtTime(time)
  if (text === '—') return <span className="text-gray-300">—</span>
  const given = parseFloat(qty!) || 0
  const diff = used != null ? parseFloat((given - used).toFixed(4)) : null // >0 loss, <0 gain, 0 breakeven
  const overGiven = diff != null && diff < -0.001
  const isLoss = diff != null && closed === true && diff > 0.001
  const isGain = diff != null && !isLoss && (overGiven || closed === true)
  return (
    <span className="flex flex-col items-center" title={t ? `Converted in at ${t}` : undefined}>
      <span className="whitespace-nowrap">
        {used != null ? (
          <>
            <span className={isLoss ? 'text-red-600 font-bold' : isGain ? 'text-green-600 font-bold' : ''}>{fmtQ(used)}</span>
            <span className="text-gray-400">/{text}</span>
          </>
        ) : text}
      </span>
      {closed === false && (
        overGiven
          ? <span className="text-green-600 text-[12px] font-bold whitespace-nowrap">open</span>
          : <span className="text-blue-600 text-[12px] font-semibold whitespace-nowrap">open</span>
      )}
      {usedBefore != null && usedAfter != null && (
        <span className="text-gray-400 text-[12px] whitespace-nowrap" title="Used before / after this pack was tapped open today">
          {fmtQ(usedBefore)}/{fmtQ(usedAfter)}
        </span>
      )}
      {t && <span className="text-gray-400 text-[12px] whitespace-nowrap">{t}</span>}
    </span>
  )
}

// A day's cedis-valued loss/gain in one column -- red = loss, green = gain
// or breakeven, same convention as every other loss/gain cell in this
// table (e.g. CnvValue, the LOSS quantity column).
export function LossGainCell({ value }: { value: number | null }) {
  return (
    <td className="px-1 py-0 text-right font-semibold">
      {value === null ? <span className="text-gray-300">—</span>
        : value > 0.01 ? <span className="text-red-500">-{fmtN(value)}</span>
        : value < -0.01 ? <span className="text-green-600">+{fmtN(Math.abs(value))}</span>
        : <span className="text-green-600">0</span>}
    </td>
  )
}

// A day where this bill's VCP took over from the previous bill's, more than
// VCP_JUMP_THRESHOLD_PCT away from it either direction -- catches both
// genuine cost swings worth double-checking and likely data-entry typos
// (an extra/missing digit on a bill's unit price).
export const VCP_JUMP_THRESHOLD_PCT = 20
export type VcpJump = { from: number; to: number; pct: number; billId: number | null }

// Walks an item's day rows (any order in, oldest-first internally) and
// flags each date where a NEW bill's VCP first takes effect and differs
// from the previous bill's VCP by more than the threshold -- everyday rows
// that just repeat the same still-current VCP are never flagged, only the
// actual transition day.
export function computeVcpJumps(rows: { date: string; vcp: string | null; vcp_bill_id: number | null }[]): Map<string, VcpJump> {
  const chrono = [...rows].sort((a, b) => a.date.localeCompare(b.date))
  const jumps = new Map<string, VcpJump>()
  let lastBillId: number | null = null
  let lastVcp: number | null = null
  for (const row of chrono) {
    if (row.vcp == null) continue
    const vcp = parseFloat(row.vcp)
    if (isNaN(vcp)) continue
    if (row.vcp_bill_id !== lastBillId) {
      if (lastVcp != null && lastVcp > 0) {
        const pct = ((vcp - lastVcp) / lastVcp) * 100
        if (Math.abs(pct) >= VCP_JUMP_THRESHOLD_PCT) {
          jumps.set(row.date, { from: lastVcp, to: vcp, pct, billId: row.vcp_bill_id })
        }
      }
      lastBillId = row.vcp_bill_id
      lastVcp = vcp
    }
  }
  return jumps
}

// VCP (Vendor Cost Price) as of this day, from lib/itemDayRows.ts's own
// per-day bill lookup -- clickable when a source bill exists (onBillClick
// jumps there), plain text otherwise (no bill yet, or no handler supplied).
// `jump` (see computeVcpJumps) adds a ⚠ badge when this is the day a big
// price swing from the previous bill took effect -- if the swing is a
// genuine price change rather than a typo, `onConfirmJump` lets it be
// marked reviewed (see /api/flags/dismiss-vcp-jump) so it stops flagging.
export function VcpCell({ vcp, billId, onBillClick, jump, onConfirmJump }: {
  vcp: string | null; billId: number | null
  onBillClick?: (billId: number) => void
  jump?: VcpJump
  onConfirmJump?: () => void
}) {
  if (vcp == null) return <span className="text-gray-300">—</span>
  const val = parseFloat(vcp)
  if (isNaN(val)) return <span className="text-gray-300">—</span>
  const value = billId != null && onBillClick
    ? <button onClick={() => onBillClick(billId)} className="hover:underline">{fmtN(val)}</button>
    : <>{fmtN(val)}</>
  if (!jump) return value
  return (
    <span className="inline-flex items-center gap-0.5">
      {value}
      <span className="text-amber-500" title={`VCP jumped ${jump.pct > 0 ? '+' : ''}${jump.pct.toFixed(0)}% from ₵${fmtN(jump.from)} to ₵${fmtN(jump.to)} on this bill`}>⚠</span>
      {onConfirmJump && (
        <button onClick={onConfirmJump} title="Confirm this price change is correct -- clears this flag"
          className="text-green-600 hover:text-green-700 font-bold leading-none">✓</button>
      )}
    </span>
  )
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
export type Omission = { issue: string; fix: string }
export type LossLedgerEntry = { date: string; original: number; remaining: number }

// Every lost 4x6 paper is valued as a missed passport print: ₵20 per single.
// Lost packs are converted to papers first (packs × papers-per-pack × ₵20) --
// never valued at the pack's own selling price, because a missing pack is
// treated as papers that were used for passport work but never recorded.
export const PAPER_SELL_PRICE = 20

// Net ₵ value of a row's losses/gains: packs are worth their papers.
// Positive = money lost, negative = gain. Null when the row has no L/G at all.
// sheetPrice is the chain's per-single price (₵20 for 4x6 photo paper, the
// singles item's own selling price for other chains, e.g. ₵2 envelopes).
export function rowLossCedis(row: PackChainRow, unitsPerPack: number, sheetPrice: number): number | null {
  if (row.packLoss === null && row.singlesLoss === null) return null
  const packPapers = (row.packLoss ?? 0) * (unitsPerPack > 0 ? unitsPerPack : 0)
  return parseFloat((((row.singlesLoss ?? 0) + packPapers) * sheetPrice).toFixed(2))
}

// Consume a gain from earlier unsettled losses, most recent first. Returns
// which losses it cancels against and how much of the gain found no match.
export function settleAgainstLedger(ledger: LossLedgerEntry[], gain: number) {
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

export function tradeOffText(matches: { date: string; original: number; taken: number; remainingAfter: number }[], unit: string) {
  return matches.map(m =>
    `${fmtN(m.taken)} of the -${fmtN(m.original)} ${unit} loss on ${fmtDate(m.date)}`
    + (m.remainingAfter > 0.001 ? ` (leaving -${fmtN(m.remainingAfter)} there)` : ' (clearing it fully)')
  ).join(' and ')
}

export function computePackChainOmissions(rowsDesc: PackChainRow[], unitsPerPack: number, packName: string): Map<string, Omission[]> {
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

// A row "has a loss" for the Loss Only filter (and the row highlighting) if
// either its own pack count came up short, or (for the row where a pack
// cycle closes) USED/PACK shows a shortfall.
export function rowHasLoss(row: PackChainRow, packCyclesByStart: Map<string, PackCycle>): boolean {
  if ((row.packLoss ?? 0) > 0.001) return true
  const cyc = packCyclesByStart.get(row.date)
  if (cyc && cyc.end !== null && (cyc.sheetsGiven - cyc.used) > 0.001) return true
  return false
}
// Mirror of rowHasLoss for the Gain Only filter -- a pack count came in
// above expected, or USED/PACK shows more used than the pack gave. Unlike
// rowHasLoss, this doesn't wait for the cycle to close: using more than the
// pack gave is already true the moment it happens, open or not.
export function rowHasGain(row: PackChainRow, packCyclesByStart: Map<string, PackCycle>): boolean {
  if (row.packLoss !== null && row.packLoss < -0.001) return true
  const cyc = packCyclesByStart.get(row.date)
  if (cyc && (cyc.sheetsGiven - cyc.used) < -0.001) return true
  return false
}

export function SingleServicePackChainTable({
  item, targetName, packChainRows, packCyclesByStart, closedCycles,
  packLossTotal, packGainTotal, cycleLossTotal, cycleGainTotal,
  unitsPerPack, sheetPrice, sheetCP, sp, onDateClick, packChainBreakdownNames, showPrices, lossOnly, gainOnly,
}: {
  item: SummaryRow; targetName: string; packChainRows: PackChainRow[]
  packCyclesByStart: Map<string, PackCycle>; closedCycles: PackCycle[]
  packLossTotal: number; packGainTotal: number; cycleLossTotal: number; cycleGainTotal: number
  unitsPerPack: number; sheetPrice: number; sheetCP: number; sp: number
  onDateClick?: (date: string, itemName: string) => void
  packChainBreakdownNames: string[]
  showPrices: boolean
  lossOnly: boolean
  gainOnly: boolean
}) {
  const packCpVal = parseFloat(item.cp ?? '0') || 0
  const svcName = packChainBreakdownNames[0]
  const packLossCedisTotal = packLossTotal * unitsPerPack * sheetPrice
  const packGainCedisTotal = packGainTotal * unitsPerPack * sheetPrice
  const grandTotalCedis = packChainRows.reduce((s, r) => s + (packSideCedis(r, unitsPerPack, sheetPrice) ?? 0), 0)
    + Array.from(packCyclesByStart.values()).reduce((s, c) => s + (realizedCycleCedis(c, sheetPrice) ?? 0), 0)
  // EXP COUNT / ACTUAL COUNT sit as trailing standalone columns after TOTAL,
  // so they're no longer part of the singles group span.
  // Gains should never happen on the pack side (any gain means a record is
  // missing) -- once there's genuinely nothing to show, the column is just
  // dead space, so it drops out entirely and reappears the moment a real
  // gain needs flagging.
  const showPackGain = packGainTotal > 0.001
  // The pack itself (e.g. an A4 Brown Env pack) is usually GMC'd internally
  // rather than sold directly, so its own SP is often genuinely unset --
  // showing SP/AMOUNT/CP/PROFIT as ₵0.00 in that case is just noise. That
  // price group only earns its columns once the pack actually has a real
  // selling price; the singles/service side isn't affected (sheetPrice
  // always has a non-zero fallback, so it never hits this case).
  const showPackPrices = showPrices && sp > 0
  const packColSpan = (showPackPrices ? 12 : 8) - (showPackGain ? 0 : 1)
  const singlesColSpan = showPrices ? 9 : 5
  const totalColSpan = 1 + packColSpan + singlesColSpan + 5 // date + pack + singles + total + 2 count cols + 2 alias cols

  const visibleRows = lossOnly ? packChainRows.filter(r => rowHasLoss(r, packCyclesByStart))
    : gainOnly ? packChainRows.filter(r => rowHasGain(r, packCyclesByStart))
    : packChainRows

  return (
    <>
      <p className="text-[12px] font-bold text-gray-500 px-1.5 py-1 bg-gray-50 border-b border-gray-200">
        Pack chain: → {targetName} → service
      </p>
      {/* width: max-content (not a manually-summed pixel value, and not left
          unset) -- table-layout: fixed with width:auto doesn't reliably
          expand to the full colgroup sum when the table sits inside a
          w-max-sized ancestor on mobile Chrome, which left a gap of blank
          space rather than showing the next column. max-content forces the
          table to size itself from its columns, and can't drift out of sync
          the way a hand-maintained pixel sum can. */}
      <table className="table-fixed border-collapse text-[12px]" style={{ width: 'max-content' }}>
        <colgroup>
          <col style={{width:'62px'}} />
          <col style={{width:'22px'}} /><col style={{width:'22px'}} />
          {showPackPrices && <><col style={{width:'40px'}} /><col style={{width:'48px'}} /><col style={{width:'36px'}} /><col style={{width:'40px'}} /></>}
          <col style={{width:'22px'}} /><col style={{width:'28px'}} /><col style={{width:'34px'}} />
          <col style={{width:'22px'}} />
          {showPackGain && <col style={{width:'24px'}} />}
          <col style={{width:'34px'}} />
          <col style={{width:'20px'}} />
          {showPrices && <><col style={{width:'40px'}} /><col style={{width:'48px'}} /><col style={{width:'36px'}} /><col style={{width:'40px'}} /></>}
          <col style={{width:'30px'}} /><col style={{width:'20px'}} /><col style={{width:'20px'}} />
          <col style={{width:'34px'}} />
          <col style={{width:'34px'}} />
          <col style={{width:'36px'}} /><col style={{width:'48px'}} />
          <col style={{width:'70px'}} /><col style={{width:'70px'}} />
        </colgroup>
        <thead className="sticky top-0 z-10">
          <tr className="text-gray-800 font-bold">
            <th rowSpan={2} className="py-0.5 border-b-2 border-gray-500 text-left pl-0.5 align-bottom sticky left-0 z-20 bg-slate-600 text-white">DATE</th>
            <th colSpan={packColSpan} className="py-0.5 border-b border-gray-400 text-center border-l-2 border-l-amber-600 bg-amber-500">Packs</th>
            <th colSpan={singlesColSpan} className="py-0.5 border-b border-gray-400 text-center border-l-2 border-l-indigo-600 bg-indigo-500 text-white">{targetName}</th>
            <th rowSpan={2} className="py-0.5 border-b-2 border-gray-500 text-center align-bottom border-l-2 border-l-gray-600 leading-tight bg-slate-600 text-white"
              title={`TOTAL LOSS/GAIN AMOUNT — combined ₵ for the row: pack side (packs × singles-per-pack × ₵${sheetPrice}) plus the singles side's own USED/PACK cycle ₵.`}>
              TOTAL<span className="block">₵</span>
            </th>
            <th rowSpan={2} className="py-0 border-b border-gray-400 text-center align-bottom border-l-2 border-l-gray-600 bg-gray-200 text-gray-500"
              title="Secondary cross-check only, from the daily count ledger -- not the primary loss measure.">
              EXP COUNT
            </th>
            <th rowSpan={2} className="py-0 border-b border-gray-400 text-center align-bottom border-l border-gray-400 bg-gray-200 text-gray-500"
              title="Secondary cross-check only -- physical count">
              ACTUAL COUNT
            </th>
            <th rowSpan={2} className="py-0.5 border-b-2 border-gray-500 text-center align-bottom border-l-2 border-l-gray-600 bg-slate-600 text-white"
              title="Raw item name as recorded on the pack's own transaction that day, before canonicalization.">
              PACK ALIAS
            </th>
            <th rowSpan={2} className="py-0.5 border-b-2 border-gray-500 text-center align-bottom border-l border-gray-400 bg-slate-600 text-white"
              title="Raw item name as recorded on the singles/service transaction that day, before canonicalization.">
              SINGLES ALIAS
            </th>
          </tr>
          <tr className="text-gray-800 font-bold">
            <th className="py-0.5 border-b-2 border-gray-500 text-center border-l-2 border-l-amber-600 bg-amber-400" title="Bought/received">BL</th>
            <th className="py-0.5 border-b-2 border-gray-500 text-center border-l border-amber-300 bg-amber-400" title="Whole packs sold directly to a walk-in customer">WIC</th>
            {showPackPrices && <>
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
            <tr><td colSpan={totalColSpan} className="text-center py-3 text-gray-400 text-[12px]">{lossOnly ? 'No loss rows.' : gainOnly ? 'No gain rows.' : 'No rows.'}</td></tr>
          ) : visibleRows.map((row, i) => {
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
            const cCedis = cyc ? realizedCycleCedis(cyc, sheetPrice) : null
            const totalCedisRow = pCedis === null && cCedis === null ? null : (pCedis ?? 0) + (cCedis ?? 0)
            return (
              <tr key={row.date} className={`border-b border-gray-200 ${rowHasLoss(row, packCyclesByStart) ? 'bg-red-50' : rowHasGain(row, packCyclesByStart) ? 'bg-orange-50' : 'bg-white'}`}>
                <td className="pl-0.5 py-0 leading-none font-bold text-gray-500 whitespace-nowrap sticky left-0 bg-inherit">
                  {onDateClick ? (
                    <button onClick={() => onDateClick(row.date, item.item_name)} className="text-blue-600 hover:underline">{shortItemDate(row.date)}</button>
                  ) : shortItemDate(row.date)}
                </td>
                <td className="text-center py-0 leading-none font-bold border-l-2 border-l-amber-600 text-blue-600">{blankDash(fmtQs(row.packBl))}</td>
                <td className="text-center py-0 leading-none font-bold border-l border-gray-300 text-gray-600">{blankDash(fmtQs(row.packWic))}</td>
                {showPackPrices && <>
                  <td className="text-center py-0 leading-none font-bold border-l border-gray-300 text-gray-600">{packWicQty > 0 ? `₵${fmtN(packSpVal)}` : null}</td>
                  <td className="text-center py-0 leading-none font-bold border-l border-gray-300 text-gray-600">{packWicQty > 0 ? `₵${fmtN(packAmount)}` : null}</td>
                  <td className="text-center py-0 font-bold border-l border-gray-300 text-gray-500">₵{fmtN(packCpVal)}</td>
                  <td className="text-center py-0 font-bold border-l border-gray-300 text-gray-500">₵{fmtN(packProfit)}</td>
                </>}
                <td className="text-center py-0 leading-none font-bold border-l border-gray-300 text-gray-600">{blankDash(fmtQs(row.packGmc))}</td>
                <td className="text-center py-0 font-bold border-l border-gray-300 text-gray-400">{blankDash(fmtN(row.packExp))}</td>
                <td className="text-center py-0 font-bold border-l border-gray-300 text-gray-900 whitespace-nowrap">
                  <CntValue qty={row.packCnt} countedBy={row.packCntBy} countedAt={row.packCntAt} history={row.packCntHistory} blank />
                </td>
                <td className="text-center py-0 font-bold border-l border-gray-300">
                  {row.packLoss === null ? null
                    : row.packLoss > 0.001 ? <span className="text-red-600">-{fmtN(row.packLoss)}</span>
                    : <span className="text-gray-400">0</span>}
                </td>
                {showPackGain && (
                  <td className="text-center py-0 font-bold border-l border-gray-300">
                    {row.packLoss !== null && row.packLoss < -0.001
                      ? <span title="A gain should never happen -- a record is missing.">+{fmtN(Math.abs(row.packLoss))}</span>
                      : row.packLoss === null ? null
                      : <span className="text-gray-400">0</span>}
                  </td>
                )}
                <td className="text-center py-0 font-bold border-l-2 border-l-gray-600 whitespace-nowrap">
                  {pCedis === null ? null
                    : pCedis > 0.001 ? <span className="text-red-600">-₵{fmtN(pCedis)}</span>
                    : pCedis < -0.001 ? <span className="text-green-600">+₵{fmtN(Math.abs(pCedis))}</span>
                    : <span className="text-gray-400">0</span>}
                </td>
                <td className="text-center py-0 font-bold border-l-2 border-l-indigo-600 text-gray-600">{singlesQty === 0 ? null : fmtQ(singlesQty)}</td>
                {showPrices && <>
                  <td className="text-center py-0 leading-none font-bold border-l border-gray-300 text-gray-600">{singlesQty > 0 ? `₵${fmtN(singlesSpVal)}` : null}</td>
                  <td className="text-center py-0 leading-none font-bold border-l border-gray-300 text-gray-600">{singlesQty > 0 ? `₵${fmtN(singlesAmount)}` : null}</td>
                  <td className="text-center py-0 font-bold border-l border-gray-300 text-gray-500">₵{fmtN(sheetCP)}</td>
                  <td className="text-center py-0 font-bold border-l border-gray-300 text-gray-500">₵{fmtN(singlesProfit)}</td>
                </>}
                {!cyc ? (
                  <>
                    <td className="text-center py-0 border-l-2 border-l-gray-600" />
                    <td className="text-center py-0 border-l border-gray-300" />
                    <td className="text-center py-0 border-l border-gray-300" />
                    <td className="text-center py-0 border-l border-gray-300" />
                  </>
                ) : (
                  <>
                    <td className="text-center py-0 font-bold border-l-2 border-l-gray-600 whitespace-nowrap leading-tight"
                      title={cycOpen ? 'This pack is still in use -- no next GMC take yet' : `Sheets used from this take until the next pack on ${fmtDate(cyc.end!)}`}>
                      <span className="block text-purple-700">{fmtQ(cyc.used)}</span>
                      <span className="block text-gray-400">/{fmtQ(cyc.sheetsGiven)}</span>
                      {cycOpen && (
                        (cycDiff as number) < -0.001
                          ? <span className="block text-red-600 text-[12px] font-bold">open ⚠</span>
                          : <span className="block text-blue-600 text-[12px] font-semibold">open</span>
                      )}
                    </td>
                    <td className="text-center py-0 font-bold border-l border-gray-300 whitespace-nowrap">
                      {cycOpen ? null
                        : (cycDiff as number) > 0.001 ? <span className="text-red-600">-{fmtQ(cycDiff as number)}</span>
                        : <span className="text-gray-400">0</span>}
                    </td>
                    <td className="text-center py-0 font-bold border-l border-gray-300 whitespace-nowrap">
                      {(cycDiff as number) < -0.001 ? (
                        <span title={cycOpen ? 'Already using more than this pack gave, before the pack closes -- flagged now, not once it closes.' : 'Sheets used beyond what this pack gave -- should be 0.'}>
                          +{fmtQ(Math.abs(cycDiff as number))}
                        </span>
                      ) : cycOpen ? null : <span className="text-gray-400">0</span>}
                    </td>
                    <td className="text-center py-0 font-bold border-l border-gray-300 whitespace-nowrap">
                      {(cycDiff as number) < -0.001 ? <span className="text-green-600">+₵{fmtN(Math.abs(cycDiff as number) * sheetPrice)}</span>
                        : cycOpen ? null
                        : (cycDiff as number) > 0.001 ? <span className="text-red-600">-₵{fmtN((cycDiff as number) * sheetPrice)}</span>
                        : <span className="text-gray-400">0</span>}
                    </td>
                  </>
                )}
                <td className="text-center py-0 font-bold border-l-2 border-l-gray-600 whitespace-nowrap">
                  {totalCedisRow === null ? null
                    : totalCedisRow > 0.001 ? <span className="text-red-600">-₵{fmtN(totalCedisRow)}</span>
                    : totalCedisRow < -0.001 ? <span className="text-green-600">+₵{fmtN(Math.abs(totalCedisRow))}</span>
                    : <span className="text-gray-400">0</span>}
                </td>
                <td className="text-center py-0 font-bold border-l-2 border-l-gray-600 text-gray-400">{blankDash(fmtN(row.singlesExp))}</td>
                <td className="text-center py-0 font-bold border-l border-gray-300 text-gray-400 whitespace-nowrap">
                  <CntValue qty={row.singlesCnt} countedBy={row.singlesCntBy} countedAt={row.singlesCntAt} history={row.singlesCntHistory} blank />
                </td>
                <td className="pl-1 py-0 border-l-2 border-l-gray-600 text-purple-700 font-semibold overflow-hidden whitespace-nowrap">
                  <span className="block truncate" title={row.packAliases ?? ''}>{row.packAliases ?? <span className="text-gray-300">—</span>}</span>
                </td>
                <td className="pl-1 py-0 border-l border-gray-300 text-purple-700 font-semibold overflow-hidden whitespace-nowrap">
                  <span className="block truncate" title={row.singlesAliases ?? ''}>{row.singlesAliases ?? <span className="text-gray-300">—</span>}</span>
                </td>
              </tr>
            )
          })}
          <tr className="bg-gray-100 border-t-2 border-gray-400 font-bold">
            <td colSpan={packColSpan} className="text-right pr-1 py-0 text-gray-600 text-[12px] border-l-2 border-l-amber-600">
              {`Pack side, net of gains: ${packLossCedisTotal > 0.001 ? `-₵${fmtN(packLossCedisTotal)}` : '0'}${packGainCedisTotal > 0.001 ? ` (⚠+₵${fmtN(packGainCedisTotal)} gained)` : ''}`}
            </td>
            <td colSpan={singlesColSpan} className="text-right pr-1 py-0 text-gray-600 text-[12px] border-l-2 border-l-indigo-600">
              {`over ${closedCycles.length} closed pack${closedCycles.length === 1 ? '' : 's'} → USED/PACK, net of gains: ${cycleLossTotal > 0.001 ? `-₵${fmtN(cycleLossTotal * sheetPrice)}` : '0'}${cycleGainTotal > 0.001 ? ` (⚠+₵${fmtN(cycleGainTotal * sheetPrice)} gained)` : ''}`}
            </td>
            <td className="text-center py-0 border-l-2 border-l-gray-600 whitespace-nowrap">
              {grandTotalCedis > 0.001 ? <span className="text-red-600">-₵{fmtN(parseFloat(grandTotalCedis.toFixed(2)))}</span>
                : grandTotalCedis < -0.001 ? <span className="text-green-600">+₵{fmtN(Math.abs(parseFloat(grandTotalCedis.toFixed(2))))}</span>
                : <span className="text-gray-400">0</span>}
            </td>
            <td className="border-l-2 border-l-gray-600" />
            <td className="border-l border-gray-400" />
            <td className="border-l-2 border-l-gray-600" />
            <td className="border-l border-gray-400" />
          </tr>
        </tbody>
      </table>
    </>
  )
}

export function rowSortVal(row: SummaryRow, col: SortCol): number | string {
  switch (col) {
    case 'item_name': return row.item_name.toLowerCase()
    case 'cf_group': return (row.cf_group ?? '').toLowerCase()
    case 'product_type': return (row.product_type ?? '').toLowerCase()
    case 'lgAmt': return row.lgAmt
    case 'lgQty': return row.lgQty
    case 'lossCount': return row.lossCount
    case 'gainAmt': return row.gainAmt
    case 'wic': return row.wic
    case 'gmc': return row.gmc
    case 'bl': return row.bl
    case 'soh': return parseFloat(row.soh ?? '0') || 0
    case 'sp': return parseFloat(row.sp ?? '0') || 0
    case 'cp': return parseFloat(row.cp ?? '0') || 0
    case 'count_interval': return (row.count_interval ?? '').toLowerCase()
  }
}

/* ── compact th with sort indicator ── */
export const thBase = 'px-2 py-0 leading-none font-bold cursor-pointer select-none whitespace-nowrap border-b border-gray-200 text-[12px] uppercase tracking-wide'
export function SortTh({ label, col, sort, onSort, cls = '', style, onResize, onResetWidth, noDivider = false }: {
  label: ReactNode; col: SortCol
  sort: { col: SortCol; dir: SortDir }
  onSort: (col: SortCol) => void
  cls?: string
  style?: CSSProperties
  onResize?: (deltaPx: number) => void
  onResetWidth?: () => void
  noDivider?: boolean
}) {
  const active = sort.col === col
  const arrow = active ? (sort.dir === 'desc' ? '↓' : '↑') : ''
  return (
    <th onClick={() => onSort(col)} style={style}
      className={`relative overflow-hidden ${thBase} ${noDivider ? '' : 'border-r'} ${cls} ${active ? 'text-blue-600' : 'text-gray-400 hover:text-gray-700'}`}>
      <span className="block truncate">{label}{arrow && <span className="ml-0.5 text-[12px]">{arrow}</span>}</span>
      {onResize && <ColResizeHandle onResize={onResize} onReset={onResetWidth} />}
    </th>
  )
}

/* ── edit form -- see ItemEditForm.tsx ── */

/* ── expanded item detail ── */
/* ── Alias picker: search unresolved raw names, attach/detach to this item ── */
