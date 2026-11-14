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
import { CntCell, CntValue, CnvValue, EMPTY_FORM, LossGainCell, LossLedgerEntry, Omission, PAPER_SELL_PRICE, SHORT_DAY, SHORT_MON, SingleServicePackChainTable, SortDir, SortTh, SummaryRow, VCP_JUMP_THRESHOLD_PCT, VcpCell, VcpJump, blankDash, computePackChainOmissions, computeVcpJumps, fmtAmt, fmtCcy, fmtN, fmtQ, fmtQs, initialOf, rowHasGain, rowHasLoss, rowLossCedis, rowSortVal, settleAgainstLedger, shortItemDate, shortSourceName, thBase, tradeOffText } from './lossTabParts'
import type { CountRecord } from './lossTabParts'
export type { SummaryRow } from './lossTabParts'

export type AliasRecord = { id: number; name: string }
type UnresolvedName = { name: string; cnt: number; confirmed: boolean }

export function AliasPicker({ itemId, current, onChange }: {
  itemId: number
  current: AliasRecord[]
  onChange: (next: AliasRecord[]) => void
}) {
  const [salesNames, setSalesNames] = useState<UnresolvedName[] | null>(null)
  const [billNames, setBillNames] = useState<UnresolvedName[] | null>(null)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const VISIBLE_COUNT = 2

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

  async function add(name: string, source: 'sales' | 'bills', force = false) {
    setBusy(true)
    const res = await fetch('/api/aliases/confirm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias_name: name, item_id: itemId, source, force }),
    })
    setBusy(false)
    if (res.ok) { onChange([...current, { id: -Date.now(), name }]); return } // optimistic id placeholder, refreshed on next load
    const d = await res.json().catch(() => null)
    if (res.status === 409 && d?.requires_confirmation) {
      if (confirm(`${d.warning}\n\nMatch anyway?`)) add(name, source, true)
    }
  }

  async function remove(alias: AliasRecord) {
    if (!confirm(`Remove alias "${alias.name}"?`)) return
    setBusy(true)
    await fetch(`/api/aliases/${alias.id}`, { method: 'DELETE' })
    setBusy(false)
    onChange(current.filter(a => a.id !== alias.id))
  }

  return (
    <div className="space-y-1">
      {current.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {(showAll ? current : current.slice(0, VISIBLE_COUNT)).map(a => (
            <span key={a.id} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[12px] font-semibold px-1.5 py-0.5 rounded-full">
              {a.name}
              <button onClick={() => remove(a)} disabled={busy} className="text-blue-400 hover:text-red-500 font-bold">×</button>
            </span>
          ))}
          {current.length > VISIBLE_COUNT && (
            <button
              onClick={() => setShowAll(v => !v)}
              className="text-[12px] font-semibold text-blue-600 hover:text-blue-800 underline whitespace-nowrap">
              {showAll ? 'Show less' : `+${current.length - VISIBLE_COUNT} more`}
            </button>
          )}
        </div>
      )}
      <input value={query} onChange={e => setQuery(e.target.value)}
        placeholder="Search unresolved names to attach…"
        className="w-full bg-gray-100 border border-gray-300 rounded px-1.5 py-1 text-[12px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400" />
      {query.trim() && (
        <div className="border border-gray-200 rounded bg-white max-h-28 overflow-y-auto">
          {candidates.length === 0 ? (
            <p className="text-[12px] text-gray-400 px-1.5 py-1">No matching unresolved names</p>
          ) : candidates.map(c => (
            <button key={`${c.source}-${c.name}`} onClick={() => add(c.name, c.source)} disabled={busy}
              className="w-full text-left px-1.5 py-1 text-[12px] text-gray-800 hover:bg-blue-50 border-b border-gray-100 last:border-0 flex items-center justify-between">
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
export type MatchRecord = { id: number; name: string }
export type CandidateItem = { item_id: number; item_name: string; product_type: string | null }

export function MatchPicker({ itemId, itemName, isService, current, candidatePool, onChange }: {
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
    if (!confirm(`Remove match "${match.name}"?`)) return
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
            <span key={m.id} className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 text-[12px] font-semibold px-1.5 py-0.5 rounded-full">
              {m.name}
              <button onClick={() => remove(m)} disabled={busy} className="text-purple-400 hover:text-red-500 font-bold">×</button>
            </span>
          ))}
        </div>
      )}
      <input value={query} onChange={e => setQuery(e.target.value)}
        placeholder={`Search ${isService ? 'goods' : 'services'} to attach…`}
        className="w-full bg-gray-100 border border-gray-300 rounded px-1.5 py-1 text-[12px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400" />
      {query.trim() && (
        <div className="border border-gray-200 rounded bg-white max-h-28 overflow-y-auto">
          {candidates.length === 0 ? (
            <p className="text-[12px] text-gray-400 px-1.5 py-1">No matching {isService ? 'goods' : 'services'}</p>
          ) : candidates.map(c => (
            <button key={c.item_id} onClick={() => add(c.item_name)} disabled={busy}
              className="w-full text-left px-1.5 py-1 text-[12px] text-gray-800 hover:bg-purple-50 border-b border-gray-100 last:border-0 truncate">
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
export function MergeItemPicker({ itemId, itemName, typeLabel, mergePool, onMerged }: {
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
          className="w-full bg-gray-100 border border-gray-300 rounded px-1.5 py-1 text-[12px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400" />
        {open && filtered.length > 0 && (
          <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-32 overflow-y-auto">
            {filtered.map(s => (
              <button key={s.item_id} onMouseDown={e => e.preventDefault()}
                onClick={() => { setTarget(s); setSearch(s.item_name); setOpen(false) }}
                className="w-full text-left px-1.5 py-1 text-[12px] text-gray-800 hover:bg-blue-50 border-b border-gray-100 last:border-0 truncate">
                {s.item_name}
                <span className={`ml-1 text-[12px] font-semibold ${s.product_type === 'service' ? 'text-purple-500' : 'text-teal-600'}`}>
                  ({s.product_type === 'service' ? 'service' : 'good'})
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {target && (
        <div className="space-y-1 bg-white border border-gray-200 rounded p-1.5">
          <p className="text-[12px] font-bold text-gray-500">Final name for the merged {typeLabel}:</p>
          <label className="flex items-center gap-1 text-[12px] text-gray-700">
            <input type="radio" checked={finalChoice === 'this'} onChange={() => setFinalChoice('this')} />
            <span className="truncate">{itemName}</span>
          </label>
          <label className="flex items-center gap-1 text-[12px] text-gray-700">
            <input type="radio" checked={finalChoice === 'other'} onChange={() => setFinalChoice('other')} />
            <span className="truncate">{target.item_name}</span>
          </label>
          <label className="flex items-center gap-1 text-[12px] text-gray-700">
            <input type="radio" checked={finalChoice === 'custom'} onChange={() => setFinalChoice('custom')} />
            <span>A different name…</span>
          </label>
          {finalChoice === 'custom' && (
            <input value={customName} onChange={e => setCustomName(e.target.value)}
              placeholder={`Type the final ${typeLabel} name`}
              className="w-full bg-gray-100 border border-gray-300 rounded px-1.5 py-1 text-[12px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400" />
          )}
          <button onClick={merge} disabled={merging || !finalName}
            className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-[12px] font-bold rounded py-1 transition">
            {merging ? 'Merging…' : `Merge — combined history becomes "${finalName || '…'}"`}
          </button>
        </div>
      )}
    </div>
  )
}

// Self-contained: has its own Edit button (below) that opens the
// editing/merge/alias UI, rather than relying on a caller to flip it open
// externally. Exported so ItemDetailPanel.tsx can also render it standalone
// on the Item 360 page, with its own equivalents of the pools/records this
// file builds from its own full-list fetch.
export function ItemDetail({ item, groups, allItems, currentAliases, currentMatches, candidatePool, mergePool, isOwnerLevelUser, onSaved, onRelationsSaved, onMerged, onDateClick, onBillClick, onReceiptClick, onCountClick, showPrices, lossOnly, gainOnly, maxRows, tradeOffRecords }: {
  item: SummaryRow; groups: string[]; allItems: { item_id: number; item_name: string }[]
  currentAliases: AliasRecord[]; currentMatches: MatchRecord[]
  candidatePool: CandidateItem[]
  mergePool: CandidateItem[]
  isOwnerLevelUser: boolean
  onSaved: (u: Partial<SummaryRow>) => void
  onRelationsSaved: (aliases: AliasRecord[], matches: MatchRecord[]) => void
  onMerged: () => void
  onDateClick?: (date: string, itemName: string) => void
  onBillClick?: (billId: number) => void
  // Precise WIC/GMC deep-link -- falls back to onDateClick (date+item-name
  // guess) when a row has no representative receipt id of its own.
  onReceiptClick?: (receiptId: number) => void
  // A tap (not long-press -- see CntCell) on a day that has a real count
  // record -- jumps to that exact row on the Counts page.
  onCountClick?: (countId: number) => void
  showPrices?: boolean
  gainOnly?: boolean
  lossOnly?: boolean
  maxRows?: number
  tradeOffRecords?: CountRecord[]
}) {
  const [dayRows, setDayRows] = useState<DayRow[] | null>(null)
  function loadDayRows() {
    fetch(`/api/losses/${item.item_id}`).then(r => r.json())
      .then(d => setDayRows(Array.isArray(d) ? d : []))
      .catch(() => setDayRows([]))
  }
  useEffect(() => {
    loadDayRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.item_id])

  // Pre-Zoho ledger day-cells with descriptive text instead of a bare
  // quantity (see prezoho_text_cells / /api/prezoho-notes) -- already
  // classified as not sales during the manual review pass, surfaced here
  // just so a reviewer can glance over them per item instead of only
  // existing as an export to cross-reference by hand.
  const [prezohoNotes, setPrezohoNotes] = useState<{ id: number; cell_date: string; raw_text: string; total: string | null; cp: string | null; category: string; reviewed: boolean }[]>([])
  const [prezohoNotesMarking, setPrezohoNotesMarking] = useState(false)
  useEffect(() => {
    fetch(`/api/prezoho-notes?itemId=${item.item_id}`).then(r => r.json())
      .then(d => setPrezohoNotes(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [item.item_id])
  const unreviewedPrezohoNotes = prezohoNotes.filter(n => !n.reviewed)
  async function markPrezohoNotesReviewed() {
    setPrezohoNotesMarking(true)
    const res = await fetch('/api/prezoho-notes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.item_id }),
    })
    setPrezohoNotesMarking(false)
    if (res.ok) setPrezohoNotes(prev => prev.map(n => ({ ...n, reviewed: true })))
  }

  // For the summary panel's Last Sold/Avg Monthly Sales stats -- a single
  // bulk, 2-hour-cached fetch (see /api/items/sale-history's own comment),
  // same shared cache every other Item 360 popup and item/page.tsx's own
  // liveSaleHistoryByItemId already hit, so opening this panel repeatedly
  // doesn't add new database load beyond the first call in that window.
  const [saleHistory, setSaleHistory] = useState<{ last_sale_date: string; avg_monthly_qty: number } | null>(null)
  const [saleHistoryLoaded, setSaleHistoryLoaded] = useState(false)
  useEffect(() => {
    fetch('/api/items/sale-history').then(r => r.json())
      .then((d: { item_id: number; last_sale_date: string; avg_monthly_qty: number }[]) => {
        if (!Array.isArray(d)) return
        setSaleHistory(d.find(r => r.item_id === item.item_id) ?? null)
        setSaleHistoryLoaded(true)
      })
      .catch(() => setSaleHistoryLoaded(true))
  }, [item.item_id])

  // Click-to-edit/delete for the CNT column -- see CntCell. Reuses the same
  // PUT/DELETE /api/stock/counts/[id] endpoint and loss-reason gate
  // CountsTab.tsx's own edit UI already goes through.
  const [countEditId, setCountEditId] = useState<number | null>(null)
  const [countEditQty, setCountEditQty] = useState('')
  const [countSaving, setCountSaving] = useState(false)
  const [countLossPrompt, setCountLossPrompt] = useState<LossPrompt | null>(null)

  async function saveCountEdit(id: number, qty: string, lossExtra?: LossExtra) {
    setCountSaving(true)
    const res = await fetch(`/api/stock/counts/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity_counted: Number(qty), ...(lossExtra ?? {}) }),
    })
    setCountSaving(false)
    if (res.ok) {
      setCountEditId(null)
      loadDayRows()
      return
    }
    const d = await res.json().catch(() => null)
    if (res.status === 409 && d?.requires_loss_reason) {
      setCountLossPrompt({ d, retry: extra => saveCountEdit(id, qty, extra) })
      return
    }
    alert(d?.error ?? 'Could not save count.')
  }

  async function deleteCountEdit(id: number, qtyLabel: string, dateLabel: string) {
    if (!confirm(`Delete the count of ${qtyLabel} on ${shortItemDate(dateLabel)}? This changes the loss/gain math from that day onward.`)) return
    const res = await fetch(`/api/stock/counts/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setCountEditId(null)
      loadDayRows()
    } else {
      alert((await res.json().catch(() => null))?.error ?? 'Could not delete count.')
    }
  }

  // Bill ids whose VCP jump was already confirmed as a genuine price change
  // (see /api/flags/dismiss-vcp-jump) -- fetched per item so computeVcpJumps
  // below can filter them straight out, same as costGteSell/etc. never
  // re-flagging something already reviewed.
  const [dismissedVcpJumpBillIds, setDismissedVcpJumpBillIds] = useState<Set<number>>(new Set())
  useEffect(() => {
    fetch(`/api/flags/dismiss-vcp-jump?itemId=${item.item_id}`).then(r => r.json())
      .then(d => setDismissedVcpJumpBillIds(new Set(Array.isArray(d) ? d : [])))
      .catch(() => {})
  }, [item.item_id])

  // Conversion history for GMC items (which pack converted to this item on each date)
  const [conversionHistory, setConversionHistory] = useState<Record<string, { date: string; targetItem: string; quantity: number; sourcePackName: string | null }[]> | null>(null)
  useEffect(() => {
    if (item.gmc_type !== 'gmc') { setConversionHistory(null); return }
    fetch('/api/gmc-conversions').then(r => r.json())
      .then((d: Record<string, any>) => {
        // Check if response is an error (API returns { error: "..." } on failure)
        if (d && 'error' in d) {
          console.error('GMC conversions API error:', d.error)
          setConversionHistory({})
          return
        }
        if (typeof d === 'object' && d !== null) {
          const itemConversions = d[String(item.item_id)] ?? []
          setConversionHistory(itemConversions.length > 0 ? { [String(item.item_id)]: itemConversions } : {})
        } else {
          setConversionHistory({})
        }
      })
      .catch((e) => {
        console.error('GMC conversions fetch error:', e)
        setConversionHistory({})
      })
  }, [item.item_id, item.gmc_type])

  // Resolve control for a "Needs Review" stub item (see /api/aliases/wide
  // and lib/activeItems.ts). Picking "Correct" is the only branch that
  // writes anything -- it clears the plain needs_review boolean (cf_group
  // is untouched; it already holds the item's real category, assigned when
  // the stub was created) so the item graduates out of the review queue.
  // Picking "Wrong" deliberately does nothing server-side: the fix is the
  // existing Merge picker further down this same panel, not a state flip
  // here.
  const [reviewSaving, setReviewSaving] = useState(false)
  const [reviewVerdict, setReviewVerdict] = useState<'correct' | 'wrong' | null>(null)
  async function confirmNeedsReviewCorrect() {
    setReviewSaving(true)
    const res = await fetch('/api/flags/confirm-needs-review', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.item_id }),
    })
    setReviewSaving(false)
    if (res.ok) {
      setReviewVerdict('correct')
      onSaved({ needs_review: false })
    } else {
      alert((await res.json().catch(() => null))?.error ?? 'Could not save.')
    }
  }

  async function confirmVcpJump(billId: number) {
    setDismissedVcpJumpBillIds(prev => new Set(prev).add(billId))
    await fetch('/api/flags/dismiss-vcp-jump', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.item_id, billId }),
    }).catch(() => {})
  }

  // Helper to look up source pack name for a given date
  function getSourcePackForDate(date: string): string | null {
    if (!conversionHistory) return null
    const conversions = conversionHistory[String(item.item_id)] ?? []
    // Normalize the date to YYYY-MM-DD format for comparison
    const normalizedDate = date.split('T')[0]
    const conv = conversions.find(c => {
      const convDate = c.date.split('T')[0]
      return convDate === normalizedDate
    })
    return conv?.sourcePackName ?? null
  }

  const isPackChain = item.product_type !== 'service' && item.converts_to_item_id != null
  // A "Pack here, I convert to a GMC" item's own Item 360 page should only
  // ever account for ITS OWN physical stock (count/loss/gain) -- the
  // singles it converts into is a separate, independent item with its own
  // full Item 360 record already (it has no converts_to_item_id of its
  // own, so isPackChain is never true when viewing IT). The dual pack/
  // singles table below (SingleServicePackChainTable and its multi-service
  // variant) was smearing the singles item's own conversion economics onto
  // the pack's page too -- hardcoded off here rather than removing that
  // code, since nothing else needs it deleted yet. Flip back to
  // `isPackChain` below to restore the old combined view.
  const showPackChainTable = false
  // CNV (converted-in from another item's GMC take) can only ever be
  // non-zero for the item a pack_to_gmc good actually converts into --
  // every other item's converted_in_qty is always null, so showing the
  // column there is a permanently-empty column, not real information.
  const isGmcItem = item.gmc_type === 'gmc'
  const [targetDayRows, setTargetDayRows] = useState<DayRow[] | null>(null)
  const [sheetPrice, setSheetPrice] = useState<number>(PAPER_SELL_PRICE)
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

  const computed = dayRows ? computeRows(dayRows) : null
  const vcpJumps = computed ? computeVcpJumps(computed) : new Map<string, VcpJump>()
  for (const [date, jump] of vcpJumps) {
    if (jump.billId != null && dismissedVcpJumpBillIds.has(jump.billId)) vcpJumps.delete(date)
  }
  const isService = item.product_type === 'service'
  const sp = parseFloat(item.sp ?? '0') || 0
  const totalLoss = computed ? parseFloat(computed.reduce((s, r) => s + (r.loss ?? 0), 0).toFixed(4)) : 0
  const totalCost = parseFloat((totalLoss * sp).toFixed(2))
  const displayedRows = maxRows && computed ? computed.slice(0, maxRows) : computed
  const hasMoreRows = maxRows && computed ? computed.length > maxRows : false
  const lgCls = `px-4 py-2.5 text-right ${totalLoss > 0 ? 'text-red-500' : totalLoss < 0 ? 'text-green-600' : 'text-gray-400'}`

  // When 2+ services independently draw on this item's stock, show each one as its own
  // column (instead of one combined "Used" number) so they can be told apart.
  const breakdownNames = computed
    ? Array.from(new Set(computed.flatMap(r => (r.wic_breakdown ?? []).map(b => b.name)))).sort()
    : []
  const showBreakdown = breakdownNames.length >= 2

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
  // Gains, unlike losses, don't wait for the cycle to close -- an open pack
  // already using more than it gave counts toward this total right away.
  const cycleGainTotal = parseFloat(packCycles.reduce((s, c) => s + Math.max(0, c.used - c.sheetsGiven), 0).toFixed(2))
  const packChainBreakdownNames = targetComputed
    ? Array.from(new Set(targetComputed.flatMap(r => (r.wic_breakdown ?? []).map(b => b.name)))).sort()
    : []
  const packChainColW = Math.max(4, Math.min(6, Math.floor(12 / Math.max(1, packChainBreakdownNames.length))))
  const unitsPerPack = numVal(item.units_per_pack)
  // Single-service chains (e.g. A4 Brown Envelope) get the fuller
  // SP/AMOUNT/CP/PROFIT economics layout below; multi-service chains (e.g.
  // 4x6, with Passport + Picture Printing) keep the per-service breakdown table.
  const singleServiceChain = packChainBreakdownNames.length <= 1

  const parentPackName = item.derived_from_item_id != null
    ? allItems.find(a => a.item_id === item.derived_from_item_id)?.item_name
    : null

  // Summary panel just above the day-by-day table -- the same "wholistic
  // view of everything at once" the Sales/Items/Counts tabs give across
  // every item, but for this ONE item specifically. Everything here is
  // either already on `item` (SummaryRow, from the one /api/losses/summary
  // fetch every caller of ItemDetail already makes), already computed
  // locally in this component (vcpJumps, dayRows' own sold_below_cost), or
  // the one extra saleHistory fetch above -- no per-item violations API,
  // so cross-item checks (duplicate items, unlinked sale names) aren't
  // included; those stay Items tab's own job.
  const itemAny = item as any
  const isGoodsItem = !isService
  const negativeSoh = isGoodsItem && parseFloat(item.soh ?? '0') < 0
  const noSp = !item.sp || parseFloat(item.sp) <= 0
  const noCp = isGoodsItem && (!item.cp || parseFloat(item.cp) <= 0)
  const noGroup = !item.cf_group
  const needsReview = item.needs_review
  // Same condition item/page.tsx's own serviceViolationIds uses -- a
  // service whose own count/GMC-take/bill activity is nonzero shouldn't
  // have any (services aren't physically counted or purchased).
  const serviceViolation = isService && ((itemAny.cnt ?? 0) !== 0 || (item.gmc ?? 0) !== 0 || (item.bl ?? 0) !== 0)
  const hasVcpJump = vcpJumps.size > 0
  const soldBelowCost = (dayRows ?? []).some(r => r.sold_below_cost)
  const lgAmt = item.lgAmt ?? 0
  const lgQty = item.lgQty ?? 0
  const isNetLoss = lgAmt > 0.005
  const isNetGain = lgAmt < -0.005
  const daysSinceLastSale = saleHistory?.last_sale_date
    ? Math.floor((Date.now() - new Date(saleHistory.last_sale_date + 'T00:00:00Z').getTime()) / 86400000)
    : null
  const neverSold = saleHistoryLoaded && !saleHistory && isGoodsItem
  // Thresholds are deliberately simple, plain-language cutoffs (under 1 a
  // month; unsold 2+ months) rather than a per-item-tuned statistical
  // measure -- good enough to flag "worth a look", which is this panel's
  // whole job, without pretending to more precision than the underlying
  // averages actually support.
  const isLowSales = isGoodsItem && !!saleHistory && saleHistory.avg_monthly_qty > 0 && saleHistory.avg_monthly_qty < 1
  const isLongUnsold = isGoodsItem && ((daysSinceLastSale != null && daysSinceLastSale > 60) || neverSold)

  const summaryFlags: { label: string; bg: string }[] = []
  if (negativeSoh) summaryFlags.push({ label: '📦 NEGATIVE SOH', bg: 'bg-red-600' })
  if (isNetLoss) summaryFlags.push({ label: `📉 NET LOSS -${fmtN(Math.abs(lgQty))} (₵${fmtN(Math.abs(lgAmt))})`, bg: 'bg-red-500' })
  if (isNetGain) summaryFlags.push({ label: `📈 NET GAIN +${fmtN(Math.abs(lgQty))} (₵${fmtN(Math.abs(lgAmt))})`, bg: 'bg-green-600' })
  if (soldBelowCost) summaryFlags.push({ label: '🟣 SOLD BELOW COST', bg: 'bg-purple-600' })
  if (hasVcpJump) summaryFlags.push({ label: '⚠ VCP JUMP', bg: 'bg-amber-600' })
  if (serviceViolation) summaryFlags.push({ label: '⚠ SERVICE VIOLATION', bg: 'bg-orange-600' })
  if (noSp) summaryFlags.push({ label: '💰 NO SELLING PRICE', bg: 'bg-gray-600' })
  if (noCp) summaryFlags.push({ label: '💵 NO COST PRICE', bg: 'bg-gray-600' })
  if (noGroup) summaryFlags.push({ label: '🏷 NO GROUP', bg: 'bg-gray-600' })
  // needs_review is a plain boolean, independent of cf_group -- a stub gets
  // a real category up front (see the categorization done when it was
  // created) so it can show NO GROUP too if that's genuinely missing,
  // instead of that being masked until the review itself is resolved.
  if (needsReview) summaryFlags.push({ label: '🔍 NEEDS REVIEW', bg: 'bg-fuchsia-700' })
  if (isLowSales) summaryFlags.push({ label: `🐌 LOW SALES (${saleHistory!.avg_monthly_qty}/mo)`, bg: 'bg-yellow-600' })
  if (isLongUnsold) summaryFlags.push({ label: neverSold ? '⏳ NEVER SOLD' : `⏳ UNSOLD ${daysSinceLastSale}D`, bg: 'bg-yellow-700' })

  return (
    // For the pack-chain view the wrapper grows to the table's full width
    // (w-max) instead of clipping it (overflow-hidden), so the detail panel
    // can scroll sideways while the frozen DATE column stays put.
    <div className={`bg-white border border-gray-200 rounded-lg mt-0 ${showPackChainTable ? 'w-max min-w-full' : 'overflow-hidden'}`}>
      {countLossPrompt && <LossDialog prompt={countLossPrompt} onClose={() => setCountLossPrompt(null)} />}
      {parentPackName && (
        <div className="px-3 py-1.5 border-b border-gray-200 bg-blue-50">
          <p className="text-[12px] font-semibold text-blue-700">
            <span className="text-gray-500">Derived from pack:</span> {parentPackName}
          </p>
        </div>
      )}

      {needsReview && reviewVerdict !== 'correct' && (
        <div className="px-3 py-2 border-b border-gray-200 bg-fuchsia-50 space-y-1.5">
          <p className="text-[12px] font-bold text-fuchsia-800">🔍 Created from an unidentified pre-Zoho ledger name -- please confirm this is a real, standalone item.</p>
          {item.description && (
            <p className="text-[12px] text-gray-600 whitespace-pre-wrap break-words">{item.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-3 text-[12px]">
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="radio" name={`needs-review-${item.item_id}`} className="cursor-pointer"
                checked={false} disabled={reviewSaving}
                onChange={() => confirmNeedsReviewCorrect()} />
              <span className="font-semibold text-gray-700">Correct -- it's its own item</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="radio" name={`needs-review-${item.item_id}`} className="cursor-pointer"
                checked={reviewVerdict === 'wrong'} disabled={reviewSaving}
                onChange={() => setReviewVerdict('wrong')} />
              <span className="font-semibold text-gray-700">Wrong -- I'll merge it myself</span>
            </label>
            {reviewVerdict === 'wrong' && (
              <span className="text-gray-500">Use the Merge tool (✎ Edit above) to fold it into the right item.</span>
            )}
          </div>
        </div>
      )}

      {unreviewedPrezohoNotes.length > 0 && (
        <div className="px-3 py-2 border-b border-gray-200 bg-teal-50 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] font-bold text-teal-800">📝 {unreviewedPrezohoNotes.length} pre-Zoho ledger note{unreviewedPrezohoNotes.length !== 1 ? 's' : ''} on this item -- already checked, none need backfilling, just worth a look.</p>
            <button onClick={markPrezohoNotesReviewed} disabled={prezohoNotesMarking}
              className="shrink-0 text-[12px] font-semibold px-2 py-0.5 rounded bg-teal-600 hover:bg-teal-700 text-white transition disabled:opacity-50">
              {prezohoNotesMarking ? '…' : '✓ Mark Reviewed'}
            </button>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {unreviewedPrezohoNotes.map(n => (
              <div key={n.id} className="text-[12px] text-gray-600 border-b border-teal-100 pb-1">
                <span className="font-semibold text-gray-700">{fmtDate(n.cell_date)}</span>
                <span className="ml-1 text-teal-700">[{n.category}]</span>
                <span className="ml-1 whitespace-pre-wrap break-words">{n.raw_text || '(blank)'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {dayRows && (
        <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 space-y-1.5">
          {summaryFlags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {summaryFlags.map((f, i) => (
                <span key={i} className={`inline-block px-2 py-0.5 rounded-full text-[12px] font-bold text-white whitespace-nowrap ${f.bg}`}>{f.label}</span>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-0.5 text-[12px]">
            <div><span className="text-gray-500">Net Loss/Gain:</span>{' '}
              <span className={isNetLoss ? 'text-red-600 font-semibold' : isNetGain ? 'text-green-600 font-semibold' : 'text-gray-700 font-semibold'}>
                {isNetLoss ? `-${fmtN(lgQty)}` : isNetGain ? `+${fmtN(Math.abs(lgQty))}` : '0'} (₵{fmtN(Math.abs(lgAmt))})
              </span>
            </div>
            <div><span className="text-gray-500">Loss / Gain days:</span> <span className="font-semibold text-gray-700">{item.lossCount ?? 0} / {itemAny.gainCount ?? 0}</span></div>
            {isGoodsItem && <div><span className="text-gray-500">WIC / GMC:</span> <span className="font-semibold text-gray-700">{fmtN(item.wic ?? 0)} / {fmtN(item.gmc ?? 0)}</span></div>}
            {isGoodsItem && <div><span className="text-gray-500">Bills / CNV:</span> <span className="font-semibold text-gray-700">{fmtN(item.bl ?? 0)} / {fmtN(item.cnv ?? 0)}</span></div>}
            <div><span className="text-gray-500">Last sold:</span>{' '}
              <span className="font-semibold text-gray-700">
                {!saleHistoryLoaded ? '…' : saleHistory?.last_sale_date ? `${fmtDate(saleHistory.last_sale_date)} (${daysSinceLastSale}d ago)` : 'Never'}
              </span>
            </div>
            <div><span className="text-gray-500">Avg monthly sales:</span> <span className="font-semibold text-gray-700">{!saleHistoryLoaded ? '…' : saleHistory ? saleHistory.avg_monthly_qty : '0'}</span></div>
          </div>
        </div>
      )}

      {/* detail table -- the Available/Used narrative format is only for items
          where 2+ services share stock (e.g. 4x6 singles); every other item
          keeps the original DATE/₵/L-G/WIC/GMC/SP/BL/CNV/EXP layout. */}
      {!dayRows || (showPackChainTable && !targetDayRows) ? (
        <p className="text-sm text-gray-400 text-center py-6">Loading…</p>
      ) : showPackChainTable ? (
        packChainRows.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No activity.</p>
        ) : singleServiceChain ? (
          <SingleServicePackChainTable
            item={item} targetName={targetName} packChainRows={packChainRows}
            packCyclesByStart={packCyclesByStart} closedCycles={closedCycles}
            packLossTotal={packLossTotal} packGainTotal={packGainTotal}
            cycleLossTotal={cycleLossTotal} cycleGainTotal={cycleGainTotal}
            unitsPerPack={unitsPerPack} sheetPrice={sheetPrice} sheetCP={sheetCP} sp={sp}
            onDateClick={onDateClick}
            packChainBreakdownNames={packChainBreakdownNames}
            showPrices={showPrices ?? false}
            lossOnly={lossOnly ?? false}
            gainOnly={gainOnly ?? false}
          />
        ) : (
          <>
            <p className="text-[12px] font-bold text-gray-500 px-1 py-0.5 bg-gray-50 border-b border-gray-200">
              Pack chain: → {targetName} → services
            </p>
            <table className="table-fixed border-collapse text-[12px]"
              style={{ width: `${48 + 2 * 40 + 10 * 28 + packChainBreakdownNames.length * 48 + 44 + 48 + 56 + 48 + 2 * 56}px` }}>
              {/* Pixel-widths: date frozen at its text width, numeric columns
                  as thin as their numbers. The table scrolls sideways inside
                  the detail panel; the date column stays frozen. */}
              <colgroup>
                <col style={{width:'48px'}} />
                <col style={{width:'40px'}} />
                <col style={{width:'28px'}} />
                <col style={{width:'28px'}} />
                <col style={{width:'28px'}} />
                <col style={{width:'28px'}} />
                <col style={{width:'28px'}} />
                <col style={{width:'28px'}} />
                <col style={{width:'28px'}} />
                <col style={{width:'48px'}} />
                <col style={{width:'56px'}} />
                <col style={{width:'48px'}} />
                {packChainBreakdownNames.map(n => <col key={n} style={{width:'48px'}} />)}
                <col style={{width:'40px'}} />
                <col style={{width:'28px'}} />
                <col style={{width:'28px'}} />
                <col style={{width:'28px'}} />
                <col style={{width:'44px'}} />
                <col style={{width:'56px'}} /><col style={{width:'56px'}} />
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="bg-amber-500 text-gray-800 font-bold">
                  <th rowSpan={2} className="py-0 border-b border-gray-400 text-left pl-0.5 align-bottom sticky left-0 z-20 bg-amber-500 text-[12px]">DATE</th>
                  <th colSpan={7} className="py-0 border-b border-gray-400 text-center border-l border-l-gray-600 text-[12px]">
                    Packs
                  </th>
                  <th colSpan={8 + packChainBreakdownNames.length} className="py-0 border-b border-gray-400 text-center border-l border-l-gray-600 text-[12px]">
                    {targetName}
                  </th>
                  <th rowSpan={2} className="py-0 border-b border-gray-400 text-center align-bottom border-l border-l-gray-600 text-[12px]"
                    title={`Losses valued in cedis at ₵${sheetPrice} per single. Pack losses count as packs × singles-per-pack × ₵${sheetPrice} — treated as singles that were used but never recorded, NOT at the pack's own selling price.`}>
                    LOSS ₵
                  </th>
                  <th rowSpan={2} className="py-0 border-b border-gray-400 text-center align-bottom border-l border-l-gray-600 text-[12px]"
                    title="Raw item name as recorded on the pack's own transaction that day, before canonicalization.">
                    PACK ALIAS
                  </th>
                  <th rowSpan={2} className="py-0 border-b border-gray-400 text-center align-bottom border-l border-gray-400 text-[12px]"
                    title="Raw item name as recorded on the singles/service transaction that day, before canonicalization.">
                    SINGLES ALIAS
                  </th>
                </tr>
                <tr className="bg-amber-400 text-gray-800 font-bold">
                  <th className="py-0 border-b border-gray-400 text-center border-l border-l-gray-600 text-[12px]" title="Physical count">CNT</th>
                  <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400 text-[12px]" title="Bought/received">BL</th>
                  <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400 text-[12px]" title="Taken for internal use (credits singles below)">GMC</th>
                  <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400 text-[12px]" title="Sold as whole packs to a real customer">WIC</th>
                  <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400" title="Running expected stock">EXP</th>
                  <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400"
                    title="Packs missing at count. Column total shown below the label.">
                    LOSS
                    <span className="block text-red-700">{packLossTotal > 0 ? `-${fmtQ(packLossTotal)}` : '0'}</span>
                  </th>
                  <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400"
                    title="Packs gained at count. Gains should ALWAYS be 0 — any gain means a record is missing (unrecorded bill, wrong GMC, or an earlier count error). Column total shown below the label.">
                    GAIN
                    <span className={`block ${packGainTotal > 0 ? 'bg-red-600 text-white rounded px-0.5' : 'text-green-800'}`}>
                      {packGainTotal > 0 ? `⚠+${fmtQ(packGainTotal)}` : '0'}
                    </span>
                  </th>
                  <th className="py-0 border-b border-gray-400 text-center border-l-2 border-l-gray-600" title="Credited in from pack GMC take">CONV</th>
                  <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400"
                    title="On rows where a GMC pack was taken: total sheets recorded as used (services + direct sales) from this pack until the NEXT pack was taken — the pack's full cycle, measured purely from records, independent of counts.">
                    USED/PACK
                  </th>
                  <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400"
                    title={`Singles a pack gave but never recorded as used before the next pack, valued at ₵${sheetPrice} each. Column total (closed packs) shown below the label.`}>
                    PACK LOSS
                    <span className="block text-red-700">{cycleLossTotal > 0 ? `-₵${fmtN(cycleLossTotal * sheetPrice)}` : '0'}</span>
                  </th>
                  <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400"
                    title="Sheets used BEYOND what the pack gave — should ALWAYS be 0; any value means leftover from a previous pack or an unrecorded GMC take. Column total shown below the label.">
                    PACK GAIN
                    <span className={`block ${cycleGainTotal > 0 ? 'bg-red-600 text-white rounded px-0.5' : 'text-green-800'}`}>
                      {cycleGainTotal > 0 ? `⚠+${fmtQ(cycleGainTotal)}` : '0'}
                    </span>
                  </th>
                  {packChainBreakdownNames.map(n => (
                    <th key={n} title={n} className="py-0 border-b border-gray-400 text-center border-l border-gray-400">
                      {shortSourceName(n)}
                    </th>
                  ))}
                  <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400" title="Physical count">CNT</th>
                  <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400" title="Total used across all services">USED</th>
                  <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400" title="Running expected stock">EXP</th>
                  <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400" title="Count loss/gain on singles">L/G</th>
                </tr>
              </thead>
              <tbody>
                {packChainRows.map((row) => {
                  const omissions = packChainOmissionsByDate.get(row.date) ?? []
                  return (
                  <tr key={row.date} className={`border-b border-gray-200 ${(row.singlesLoss ?? 0) > 0.001 || (row.packLoss ?? 0) > 0.001 ? 'bg-red-50' : omissions.length > 0 ? 'bg-orange-50' : 'bg-white'}`}>
                    <td className="pl-0.5 py-0 font-bold text-gray-500 whitespace-nowrap sticky left-0 bg-inherit">
                      {onDateClick ? (
                        <button onClick={() => onDateClick(row.date, item.item_name)} className="text-blue-600 hover:underline">
                          {shortItemDate(row.date)}
                        </button>
                      ) : shortItemDate(row.date)}
                    </td>
                    <td className="text-center py-0 leading-none font-bold border-l-2 border-l-gray-600 text-gray-900 whitespace-nowrap">
                      <CntValue qty={row.packCnt} countedBy={row.packCntBy} countedAt={row.packCntAt} history={row.packCntHistory} />
                    </td>
                    <td className="text-center py-0 font-bold border-l border-gray-300 text-blue-600">{fmtQs(row.packBl)}</td>
                    <td className="text-center py-0 leading-none font-bold border-l border-gray-300 text-gray-600">{fmtQs(row.packGmc)}</td>
                    <td className="text-center py-0 leading-none font-bold border-l border-gray-300 text-gray-600">{fmtQs(row.packWic)}</td>
                    <td className="text-center py-0 font-bold border-l border-gray-300 text-gray-400">{fmtN(row.packExp)}</td>
                    <td className="text-center py-0 font-bold border-l border-gray-300">
                      {row.packLoss === null ? <span className="text-gray-300">—</span>
                        : row.packLoss > 0.001 ? <span className="text-red-600">-{fmtN(row.packLoss)}</span>
                        : <span className="text-gray-400">0</span>}
                    </td>
                    <td className="text-center py-0 font-bold border-l border-gray-300">
                      {row.packLoss !== null && row.packLoss < -0.001
                        ? <span className="bg-red-600 text-white rounded px-0.5" title="A gain should never happen — a record is missing (unrecorded bill, wrong GMC, or an earlier count error). See OMISSIONS.">⚠+{fmtN(Math.abs(row.packLoss))}</span>
                        : row.packLoss === null ? <span className="text-gray-300">—</span>
                        : <span className="text-gray-400">0</span>}
                    </td>
                    <td className="text-center py-0 font-bold border-l-2 border-l-gray-600 text-teal-600">{fmtQs(row.singlesConvIn)}</td>
                    {(() => {
                      // Pack-cycle accounting on the day the pack was taken:
                      // sheets used from this GMC take until the next one.
                      const cyc = packCyclesByStart.get(row.date)
                      if (!cyc) return (
                        <>
                          <td className="text-center py-0 border-l border-gray-300"><span className="text-gray-300">—</span></td>
                          <td className="text-center py-0 border-l border-gray-300"><span className="text-gray-300">—</span></td>
                          <td className="text-center py-0 border-l border-gray-300"><span className="text-gray-300">—</span></td>
                        </>
                      )
                      const diff = parseFloat((cyc.sheetsGiven - cyc.used).toFixed(2))
                      const open = cyc.end === null
                      return (
                        <>
                          <td className="text-center py-0 font-bold border-l border-gray-300 whitespace-nowrap"
                            title={open ? 'This pack is still in use — no next GMC take yet' : `Sheets used from this take until the next pack on ${fmtDate(cyc.end!)}`}>
                            <span className="text-purple-700">{fmtQ(cyc.used)}</span>
                            <span className="text-gray-400"> / {fmtQ(cyc.sheetsGiven)}</span>
                            {open && (
                              diff < -0.001
                                ? <span className="block text-red-600 text-[12px] font-bold">in progress ⚠</span>
                                : <span className="block text-blue-600 text-[12px] font-semibold">in progress</span>
                            )}
                          </td>
                          <td className="text-center py-0 font-bold border-l border-gray-300 whitespace-nowrap">
                            {open ? <span className="text-gray-300">—</span>
                              : diff > 0.001 ? (
                                <span className="text-red-600">-₵{fmtN(diff * sheetPrice)}<span className="block text-[12px]">-{fmtQ(diff)} sheets</span></span>
                              ) : <span className="text-green-600">✓</span>}
                          </td>
                          <td className="text-center py-0 font-bold border-l border-gray-300 whitespace-nowrap">
                            {diff < -0.001 ? (
                              <span className="bg-red-600 text-white rounded px-0.5"
                                title={open ? 'Already using more than this pack gave, before the pack closes — flagged now, not once it closes.' : 'Sheets used beyond what this pack gave — should be 0. Either leftover from the previous pack, or a GMC take was not recorded.'}>
                                ⚠+{fmtQ(Math.abs(diff))}
                              </span>
                            ) : open ? <span className="text-gray-300">—</span> : <span className="text-gray-400">0</span>}
                          </td>
                        </>
                      )
                    })()}
                    {packChainBreakdownNames.map(n => {
                      const b = row.singlesBreakdown.find(x => x.name === n)
                      const qty = b?.qty ?? 0, amount = b?.amount ?? 0
                      return (
                        <td key={n} className="text-center py-0 font-bold border-l border-gray-300 text-gray-600 whitespace-nowrap overflow-hidden">
                          {qty === 0 ? '—' : <>{fmtQ(qty)}<span className="text-blue-500 text-[12px]"> (₵{fmtN(amount)})</span></>}
                        </td>
                      )
                    })}
                    <td className="text-center py-0 font-bold border-l border-gray-300 text-gray-900 whitespace-nowrap">
                      <CntValue qty={row.singlesCnt} countedBy={row.singlesCntBy} countedAt={row.singlesCntAt} history={row.singlesCntHistory} />
                    </td>
                    <td className="text-center py-0 leading-none font-bold border-l border-gray-300 text-gray-600">{fmtQ(row.singlesUsed)}</td>
                    <td className="text-center py-0 font-bold border-l border-gray-300 text-gray-400">{fmtN(row.singlesExp)}</td>
                    <td className="text-center py-0 font-bold border-l border-gray-300">
                      {row.singlesLoss === null ? <span className="text-gray-300">—</span>
                        : row.singlesLoss > 0.001 ? <span className="text-red-600">-{fmtN(row.singlesLoss)}</span>
                        : row.singlesLoss < -0.001 ? <span className="text-green-600">+{fmtN(Math.abs(row.singlesLoss))}</span>
                        : <span className="text-gray-400">0</span>}
                    </td>
                    <td className="text-center py-0 font-bold border-l-2 border-l-gray-600 whitespace-nowrap">
                      {(() => {
                        const cedis = rowLossCedis(row, numVal(item.units_per_pack), sheetPrice)
                        if (cedis === null) return <span className="text-gray-300">—</span>
                        if (cedis > 0.001) return <span className="text-red-600">-₵{fmtN(cedis)}</span>
                        if (cedis < -0.001) return <span className="text-green-600">+₵{fmtN(Math.abs(cedis))}</span>
                        return <span className="text-gray-400">0</span>
                      })()}
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
                {(() => {
                  const totalCedis = packChainRows.reduce((s, r) => s + (rowLossCedis(r, numVal(item.units_per_pack), sheetPrice) ?? 0), 0)
                  return (
                    <tr className="bg-gray-100 border-t-2 border-gray-400 font-bold">
                      <td colSpan={9} className="text-right pr-1 py-0 text-gray-600 text-[12px]">
                        {`over ${closedCycles.length} closed pack${closedCycles.length === 1 ? '' : 's'} →`}
                      </td>
                      <td className="border-l border-gray-300" />
                      <td className="text-center py-0 border-l border-gray-300 whitespace-nowrap"
                        title="Total sheets given but never recorded as used, over all closed pack cycles">
                        {cycleLossTotal > 0.001 ? <span className="text-red-600">-₵{fmtN(cycleLossTotal * sheetPrice)}</span>
                          : <span className="text-gray-400">0</span>}
                      </td>
                      <td className="text-center py-0 border-l border-gray-300 whitespace-nowrap"
                        title="Total sheets used beyond what packs gave — should be 0">
                        {cycleGainTotal > 0.001 ? <span className="bg-red-600 text-white rounded px-0.5">⚠+{fmtQ(cycleGainTotal)}</span>
                          : <span className="text-gray-400">0</span>}
                      </td>
                      <td colSpan={4 + packChainBreakdownNames.length} className="text-right pr-1 py-0 text-gray-600">
                        TOTAL (net of gains)
                      </td>
                      <td className="text-center py-0 border-l-2 border-l-gray-600 whitespace-nowrap">
                        {totalCedis > 0.001 ? <span className="text-red-600">-₵{fmtN(parseFloat(totalCedis.toFixed(2)))}</span>
                          : totalCedis < -0.001 ? <span className="text-green-600">+₵{fmtN(Math.abs(parseFloat(totalCedis.toFixed(2))))}</span>
                          : <span className="text-gray-400">0</span>}
                      </td>
                      <td className="border-l-2 border-l-gray-600" />
                      <td className="border-l border-gray-300" />
                    </tr>
                  )
                })()}
              </tbody>
            </table>
          </>
        )
      ) : computed!.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No activity.</p>
      ) : showBreakdown ? (
        <div>
          <div className={`overflow-x-auto rounded-b-lg ${maxRows ? 'overflow-y-auto max-h-96' : ''}`}>
          <table className="w-full border-collapse text-[12px] tabular-nums">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-[12px] font-bold uppercase tracking-tighter border-b border-gray-200">
              <th className="pl-1 pr-1 py-0 text-left whitespace-nowrap sticky left-0 z-10 bg-gray-50 border-r border-gray-200">Date</th>
              <th className="px-1 py-0 text-right" title="Converted in from another item's GMC take">CNV</th>
              <th className="px-1 py-0 text-right text-blue-500" title="Used = sold/consumed that day">Used</th>
              <th className="px-1 py-0 text-right" title={isGmcItem ? 'Stock On Hand -- current stock physically at the shop, running day to day' : 'Expected = Available − Used'}>{isGmcItem ? 'SOH' : 'Exp'}</th>
              <th className="px-1 py-0 text-right" title="Physical count taken that day">Cnt</th>
              <th className="px-1 py-0 text-right" title="Count Loss = Expected − actual count (only on count days)">Loss</th>
              <th className="px-1 py-0 text-right" title="Loss (red) or gain (green) valued at selling price">L/G ₵</th>
              {breakdownNames.map(n => (
                <th key={n} title={n} className="px-1 py-0 text-right">
                  {shortSourceName(n)}
                </th>
              ))}
              {!isGmcItem && <th className="px-1 py-0 text-right" title="Direct GMC (internal use) on this item itself">GMC</th>}
              <th className="px-1 py-0 text-right" title="Average direct sale price that day -- click to jump to that day's sales receipt">SP</th>
              <th className="px-1 py-0 text-right" title="Vendor Cost Price -- most recent real bill on or before this date. Click to jump to that bill">VCP</th>
              <th className="px-1 py-0 text-right text-purple-600" title="Adjusted Cost Price = VCP + that bill's apportioned Shared Expenses">ACP</th>
              {!isGmcItem && <th className="px-1 py-0 text-right" title="Direct bills/purchases received">BL</th>}
              {isGmcItem && <th className="px-1 py-0 text-left text-teal-600" title="Which pack was converted to create this CNV">Source Pack</th>}
              {!isGmcItem && <th className="px-1 py-0 text-left" title="Trade-off records for this date">Trade-Off</th>}
              <th className="px-1 py-0 text-left">Alias</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-[12px]">
            {displayedRows!.map((row) => {
              const lossVal = row.loss !== null ? row.loss * sp : null
              const matchingTradeOffs = tradeOffRecords?.filter(r => r.count_date === row.date) ?? []
              return (
                <tr key={row.date} title={row.sold_below_cost ? 'Sold at or under cost price this day' : undefined}
                  className={`group transition-colors ${row.sold_below_cost ? 'bg-purple-100 hover:bg-purple-200/70' : row.loss !== null && row.loss > 0.001 ? 'bg-red-50 hover:bg-red-100/70' : 'hover:bg-gray-50'}`}>
                  {/* Sticky cells need an explicit opaque background, not
                      bg-inherit -- a plain row has no background class of
                      its own (relies on the white card behind it), so
                      "inherit" resolved to transparent and let the
                      scrolled-under columns show through on scroll. */}
                  <td className={`pl-2 pr-2 py-0 text-gray-700 font-medium whitespace-nowrap sticky left-0 z-10 border-r border-gray-200 ${row.sold_below_cost ? 'bg-purple-100 group-hover:bg-purple-200/70' : row.loss !== null && row.loss > 0.001 ? 'bg-red-50 group-hover:bg-red-100/70' : 'bg-white group-hover:bg-gray-50'}`}>
                    {onDateClick ? (
                      <button onClick={() => onDateClick(row.date, item.item_name)} className="text-blue-600 hover:underline">
                        {shortItemDate(row.date)}
                      </button>
                    ) : shortItemDate(row.date)}
                  </td>
                  {!isService && <td className="px-1 py-0 text-right text-teal-600"><CnvValue qty={row.converted_in_qty} time={row.converted_in_time} used={row.cycle_used} closed={row.cycle_closed} /></td>}
                  {/* row.used (feeding the real Expected/Loss math below) no
                      longer folds in the per-service breakdown amounts --
                      that used to double-count them against the negative
                      bill line /api/sales/live-tap already records for the
                      same consumption (see lib/itemDayRows.ts). This
                      column stays a genuine total, display-only, by adding
                      the breakdown back on top of it here. */}
                  <td className="px-1 py-0 text-right font-semibold text-blue-700">
                    {fmtQ(row.used + (row.wic_breakdown ?? []).reduce((s, b) => s + b.qty, 0))}
                    {row.cnv_used_before != null && row.cnv_used_after != null && (
                      // A CNV was recorded this day -- un-blend the total
                      // around the exact tap moment: before still belongs
                      // to the OLD pack's cycle, after to the NEW one.
                      <span className="text-gray-400 font-normal">({fmtQ(row.cnv_used_before)}/{fmtQ(row.cnv_used_after)})</span>
                    )}
                  </td>
                  {!isService && <td className="px-1 py-0 text-right text-gray-400">{fmtN(isGmcItem ? (row.gmc_soh ?? null) : row.expected_soh)}</td>}
                  {!isService && <td className="px-1 py-0 text-right text-gray-900 whitespace-nowrap">
                    <CntCell row={row} isOwnerLevelUser={isOwnerLevelUser}
                      editing={row.count_id != null && countEditId === row.count_id}
                      editQty={countEditQty} saving={countSaving}
                      onStartEdit={() => { if (row.count_id != null) { setCountEditId(row.count_id); setCountEditQty(String(parseFloat(row.qty_counted ?? '0') || 0)) } }}
                      onQtyChange={setCountEditQty}
                      onSave={() => countEditId != null && saveCountEdit(countEditId, countEditQty)}
                      onCancel={() => setCountEditId(null)}
                      onDelete={() => countEditId != null && deleteCountEdit(countEditId, countEditQty, row.date)}
                      onNavigate={onCountClick} />
                  </td>}
                  {!isService && <td className="px-1 py-0 text-right font-semibold">
                    {row.loss === null ? <span className="text-gray-300">—</span>
                      : row.loss > 0.001 ? <span className="text-red-500">-{fmtN(row.loss)}</span>
                      : row.loss < -0.001 ? <span className="text-green-600">+{fmtN(Math.abs(row.loss))}</span>
                      : <span className="text-gray-400">0</span>}
                  </td>}
                  {!isService && <LossGainCell value={lossVal} />}
                  {breakdownNames.map(n => {
                    const b = row.wic_breakdown?.find(x => x.name === n)
                    const qty = b?.qty ?? 0
                    const amount = b?.amount ?? 0
                    const avgSp = qty > 0 ? amount / qty : 0
                    return (
                      <td key={n} className="px-1 py-0 text-right text-gray-600 whitespace-nowrap">
                        {qty === 0 ? <span className="text-gray-300">—</span> : (
                          <span className="text-[12px]" title={`Total ₵${fmtN(amount)} · avg. selling price ₵${fmtN(avgSp)} · ${fmtQ(qty)} used`}>
                            TT<span className="text-blue-600">({fmtN(amount)})</span>SP<span className="text-blue-600">({fmtN(avgSp)})</span>QTY<span className="text-blue-600">({fmtQ(qty)})</span>
                          </span>
                        )}
                      </td>
                    )
                  })}
                  {!isGmcItem && <td className="px-1 py-0 text-right text-gray-600">
                    {row.gmc_qty && (onReceiptClick || onDateClick) ? (
                      <button onClick={() => row.gmc_receipt_id != null && onReceiptClick ? onReceiptClick(row.gmc_receipt_id) : onDateClick!(row.date, item.item_name)}
                        className="hover:underline">{fmtQs(row.gmc_qty)}</button>
                    ) : fmtQs(row.gmc_qty)}
                  </td>}
                  <td className="px-1 py-0 text-right text-blue-500">
                    {row.sell_price && onDateClick ? (
                      <button onClick={() => onDateClick(row.date, item.item_name)} className="hover:underline">{fmtQs(row.sell_price)}</button>
                    ) : fmtQs(row.sell_price)}
                  </td>
                  {!isService && (
                    <td className="px-1 py-0 text-right text-gray-500">
                      <VcpCell vcp={row.vcp} billId={row.vcp_bill_id} onBillClick={onBillClick} jump={vcpJumps.get(row.date)} onConfirmJump={row.vcp_bill_id != null ? () => confirmVcpJump(row.vcp_bill_id!) : undefined} />
                    </td>
                  )}
                  {!isService && <td className="px-1 py-0 text-right text-purple-700">
                    {row.acp != null ? (
                      row.vcp_bill_id != null && onBillClick ? (
                        <button onClick={() => onBillClick(row.vcp_bill_id!)} className="hover:underline">{formatACP(row.acp)}</button>
                      ) : formatACP(row.acp)
                    ) : <span className="text-gray-300">—</span>}
                  </td>}
                  {!isGmcItem && <td className="px-1 py-0 text-right text-blue-600">
                    {row.bills_breakdown && row.bills_breakdown.length > 0 ? (
                      <div className="space-y-0.5">
                        {row.bills_breakdown.map((bill, idx) => (
                          <div key={idx} className="block">
                            {bill.bill_id != null && onBillClick ? (
                              <button onClick={() => onBillClick(bill.bill_id!)} className="hover:underline">{fmtQs(String(bill.qty))}</button>
                            ) : <span>{fmtQs(String(bill.qty))}</span>}
                            {bill.vendor_name && <span className="text-gray-600">({bill.vendor_name})</span>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      fmtQs(row.bills_qty)
                    )}
                  </td>}
                  {isGmcItem && (
                    <td className="px-1 py-0 text-left text-teal-700 font-medium whitespace-nowrap">
                      {(row.converted_in_qty && Number(row.converted_in_qty) > 0) ? (
                        <span>{getSourcePackForDate(row.date) || '—'}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  )}
                  {!isGmcItem && !isService && <td className="px-1 py-0 text-left text-gray-600 text-[12px]">
                    {matchingTradeOffs.length > 0 ? (
                      <div className="space-y-0.5">
                        {matchingTradeOffs.map(rec => {
                          const recAny = rec as any
                          const suggestion = recAny.tradeOffSuggestion
                          return (
                            <div key={rec.id} className="block" title={suggestion}>
                              {suggestion ? (
                                <span className="text-blue-600 hover:underline cursor-help">{suggestion}</span>
                              ) : (
                                <>
                                  {rec.kind && <span className={rec.kind === 'loss' ? 'text-red-600' : 'text-green-600'}>{rec.kind.toUpperCase()}</span>}
                                  {' '}{fmtQ(rec.quantity_counted)}
                                </>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : <span className="text-gray-300">—</span>}
                  </td>}
                  <td className="px-1 py-0 text-purple-700 font-medium">
                    <span className="block truncate max-w-[180px]" title={row.aliases ?? ''}>{row.aliases ?? <span className="text-gray-300">—</span>}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
              <td className="pl-1 pr-1 py-0 text-gray-600 sticky left-0 z-10 bg-gray-50 border-r border-gray-200">Total</td>
              <td colSpan={4} />
              <td className={lgCls}>{totalLoss > 0.001 ? `-${fmtN(totalLoss)}` : totalLoss < -0.001 ? `+${fmtN(Math.abs(totalLoss))}` : '0'}</td>
              <td className={lgCls}>{totalCost > 0.01 ? `-₵${fmtN(totalCost)}` : totalCost < -0.01 ? `+₵${fmtN(Math.abs(totalCost))}` : '0'}</td>
              <td colSpan={breakdownNames.length + (isGmcItem ? 5 : 7)} />
            </tr>
          </tfoot>
        </table>
          {hasMoreRows && (
            <div className="px-4 py-1.5 text-xs text-gray-400 bg-gray-50 border-t border-gray-100">
              ...and {computed!.length - maxRows!} more rows
            </div>
          )}
          </div>
        </div>
      ) : (
        <div>
          <div className={`overflow-x-auto rounded-b-lg ${maxRows ? 'overflow-y-auto max-h-96' : ''}`}>
          <table className="w-full border-collapse text-[12px] tabular-nums">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-[12px] font-bold uppercase tracking-tighter border-b border-gray-200">
                <th className="pl-1 pr-1 py-0 text-left whitespace-nowrap sticky left-0 z-10 bg-gray-50 border-r border-gray-200">Date</th>
              {!isService && <th className="px-1 py-0 text-right" title="Loss (red) or gain (green) valued at selling price">L/G ₵</th>}
              {!isService && <th className="px-1 py-0 text-right">L/G</th>}
              {!isService && <th className="px-1 py-0 text-right">Cnt</th>}
              <th className="px-1 py-0 text-right">WIC</th>
              {!isService && !isGmcItem && <th className="px-1 py-0 text-right">GMC</th>}
              <th className="px-1 py-0 text-right" title="Average direct sale price that day -- click to jump to that day's sales receipt">SP</th>
              {!isService && <th className="px-1 py-0 text-right" title="Vendor Cost Price -- most recent real bill on or before this date. Click to jump to that bill">VCP</th>}
              {!isService && <th className="px-1 py-0 text-right text-purple-600" title="Adjusted Cost Price = VCP + that bill's apportioned Shared Expenses">ACP</th>}
              {!isService && !isGmcItem && <th className="px-1 py-0 text-right">BL</th>}
              {!isService && isGmcItem && <th className="px-1 py-0 text-right" title="Converted in from another item's GMC take">CNV</th>}
              {!isService && <th className="px-1 py-0 text-right" title={isGmcItem ? 'Stock On Hand -- current stock physically at the shop, running day to day' : undefined}>{isGmcItem ? 'SOH' : 'Exp'}</th>}
              {!isGmcItem && !isService && <th className="px-1 py-0 text-left" title="Trade-off records for this date">Trade-Off</th>}
              <th className="px-1 py-0 text-left">Alias</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-[12px]">
            {displayedRows!.map((row) => {
              const lossVal = row.loss !== null ? row.loss * sp : null
              const matchingTradeOffs = tradeOffRecords?.filter(r => r.count_date === row.date) ?? []
              return (
                <tr key={row.date} title={row.sold_below_cost ? 'Sold at or under cost price this day' : undefined}
                  className={`group transition-colors ${row.sold_below_cost ? 'bg-purple-100 hover:bg-purple-200/70' : row.loss !== null && row.loss > 0.001 ? 'bg-red-50 hover:bg-red-100/70' : 'hover:bg-gray-50'}`}>
                  {/* Sticky cells need an explicit opaque background, not
                      bg-inherit -- a plain row has no background class of
                      its own (relies on the white card behind it), so
                      "inherit" resolved to transparent and let the
                      scrolled-under columns show through on scroll. */}
                  <td className={`pl-2 pr-2 py-0 text-gray-700 font-medium whitespace-nowrap sticky left-0 z-10 border-r border-gray-200 ${row.sold_below_cost ? 'bg-purple-100 group-hover:bg-purple-200/70' : row.loss !== null && row.loss > 0.001 ? 'bg-red-50 group-hover:bg-red-100/70' : 'bg-white group-hover:bg-gray-50'}`}>
                    {onDateClick ? (
                      <button onClick={() => onDateClick(row.date, item.item_name)} className="text-blue-600 hover:underline">
                        {shortItemDate(row.date)}
                      </button>
                    ) : shortItemDate(row.date)}
                  </td>
                  {!isService && <LossGainCell value={lossVal} />}
                  {!isService && <td className="px-1 py-0 text-right font-semibold">
                    {row.loss === null ? <span className="text-gray-300">—</span>
                      : row.loss > 0.001 ? <span className="text-red-500">-{fmtN(row.loss)}</span>
                      : row.loss < -0.001 ? <span className="text-green-600">+{fmtN(Math.abs(row.loss))}</span>
                      : <span className="text-gray-400">0</span>}
                  </td>}
                  {!isService && <td className="px-1 py-0 text-right text-gray-900 whitespace-nowrap">
                    <CntCell row={row} isOwnerLevelUser={isOwnerLevelUser}
                      editing={row.count_id != null && countEditId === row.count_id}
                      editQty={countEditQty} saving={countSaving}
                      onStartEdit={() => { if (row.count_id != null) { setCountEditId(row.count_id); setCountEditQty(String(parseFloat(row.qty_counted ?? '0') || 0)) } }}
                      onQtyChange={setCountEditQty}
                      onSave={() => countEditId != null && saveCountEdit(countEditId, countEditQty)}
                      onCancel={() => setCountEditId(null)}
                      onDelete={() => countEditId != null && deleteCountEdit(countEditId, countEditQty, row.date)}
                      onNavigate={onCountClick} />
                  </td>}
                  <td className="px-1 py-0 text-right text-gray-600">
                    {row.wic_qty && (onReceiptClick || onDateClick) ? (
                      <button onClick={() => row.wic_receipt_id != null && onReceiptClick ? onReceiptClick(row.wic_receipt_id) : onDateClick!(row.date, item.item_name)}
                        className="hover:underline">{fmtQs(row.wic_qty)}</button>
                    ) : fmtQs(row.wic_qty)}
                  </td>
                  {!isService && !isGmcItem && <td className="px-1 py-0 text-right text-gray-600">
                    {row.gmc_qty && (onReceiptClick || onDateClick) ? (
                      <button onClick={() => row.gmc_receipt_id != null && onReceiptClick ? onReceiptClick(row.gmc_receipt_id) : onDateClick!(row.date, item.item_name)}
                        className="hover:underline">{fmtQs(row.gmc_qty)}</button>
                    ) : fmtQs(row.gmc_qty)}
                  </td>}
                  <td className="px-1 py-0 text-right text-blue-500">
                    {row.sell_price && onDateClick ? (
                      <button onClick={() => onDateClick(row.date, item.item_name)} className="hover:underline">{fmtQs(row.sell_price)}</button>
                    ) : fmtQs(row.sell_price)}
                  </td>
                  {!isService && (
                    <td className="px-1 py-0 text-right text-gray-500">
                      <VcpCell vcp={row.vcp} billId={row.vcp_bill_id} onBillClick={onBillClick} jump={vcpJumps.get(row.date)} onConfirmJump={row.vcp_bill_id != null ? () => confirmVcpJump(row.vcp_bill_id!) : undefined} />
                    </td>
                  )}
                  {!isService && <td className="px-1 py-0 text-right text-purple-700">
                    {row.acp != null ? (
                      row.vcp_bill_id != null && onBillClick ? (
                        <button onClick={() => onBillClick(row.vcp_bill_id!)} className="hover:underline">{formatACP(row.acp)}</button>
                      ) : formatACP(row.acp)
                    ) : <span className="text-gray-300">—</span>}
                  </td>}
                  {!isService && !isGmcItem && <td className="px-1 py-0 text-right text-blue-600">
                    {row.bills_breakdown && row.bills_breakdown.length > 0 ? (
                      <div className="space-y-0.5">
                        {row.bills_breakdown.map((bill, idx) => (
                          <div key={idx} className="block">
                            {bill.bill_id != null && onBillClick ? (
                              <button onClick={() => onBillClick(bill.bill_id!)} className="hover:underline">{fmtQs(String(bill.qty))}</button>
                            ) : <span>{fmtQs(String(bill.qty))}</span>}
                            {bill.vendor_name && <span className="text-gray-600">({bill.vendor_name})</span>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      fmtQs(row.bills_qty)
                    )}
                  </td>}
                  {!isService && isGmcItem && <td className="px-1 py-0 text-right text-teal-600"><CnvValue qty={row.converted_in_qty} time={row.converted_in_time} used={row.cycle_used} closed={row.cycle_closed} usedBefore={row.cnv_used_before} usedAfter={row.cnv_used_after} /></td>}
                  {!isService && <td className="px-1 py-0 text-right text-gray-400">{fmtN(isGmcItem ? (row.gmc_soh ?? null) : row.expected_soh)}</td>}
                  {!isGmcItem && !isService && <td className="px-1 py-0 text-left text-gray-600 text-[12px]">
                    {matchingTradeOffs.length > 0 ? (
                      <div className="space-y-0.5">
                        {matchingTradeOffs.map(rec => {
                          const recAny = rec as any
                          const suggestion = recAny.tradeOffSuggestion
                          return (
                            <div key={rec.id} className="block" title={suggestion}>
                              {suggestion ? (
                                <span className="text-blue-600 hover:underline cursor-help">{suggestion}</span>
                              ) : (
                                <>
                                  {rec.kind && <span className={rec.kind === 'loss' ? 'text-red-600' : 'text-green-600'}>{rec.kind.toUpperCase()}</span>}
                                  {' '}{fmtQ(rec.quantity_counted)}
                                </>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : <span className="text-gray-300">—</span>}
                  </td>}
                  <td className="px-1 py-0 text-purple-700 font-medium">
                    <span className="block truncate max-w-[180px]" title={row.aliases ?? ''}>{row.aliases ?? <span className="text-gray-300">—</span>}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold text-[12px]">
              <td className="pl-1 pr-1 py-0 text-gray-600 sticky left-0 z-10 bg-gray-50 border-r border-gray-200">Total</td>
              {!isService && <td className={lgCls}>{totalCost > 0.01 ? `-₵${fmtN(totalCost)}` : totalCost < -0.01 ? `+₵${fmtN(Math.abs(totalCost))}` : '0'}</td>}
              {!isService && <td className={lgCls}>{totalLoss > 0.001 ? `-${fmtN(totalLoss)}` : totalLoss < -0.001 ? `+${fmtN(Math.abs(totalLoss))}` : '0'}</td>}
              <td colSpan={isService ? 3 : 7 + (isGmcItem ? 1 : 3)} />
            </tr>
          </tfoot>
        </table>
          {hasMoreRows && (
            <div className="px-2 py-1.5 text-xs text-gray-400 bg-gray-50 border-t border-gray-100">
              ...and {computed!.length - maxRows!} more rows
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  )
}

function renderCell(key: ColKey, row: SummaryRow) {
  switch (key) {
    case 'lgAmt': {
      const lossAmt = row.lgAmt > 0, gainAmt = row.lgAmt < 0
      return (
        <td key={key} className={`text-center py-0 font-semibold tabular-nums ${lossAmt ? 'text-red-500' : gainAmt ? 'text-green-600' : 'text-gray-300'}`}>
          {fmtAmt(row.lgAmt)}
        </td>
      )
    }
    case 'lossCount':
      return (
        <td key={key} className={`text-center py-0 font-semibold tabular-nums ${row.lossCount > 0 ? 'text-red-500' : 'text-gray-300'}`}>
          {row.lossCount}
        </td>
      )
    case 'gainAmt':
      return (
        <td key={key} className={`text-center py-0 font-semibold tabular-nums ${row.gainAmt > 0.001 ? 'text-green-600' : 'text-gray-300'}`}>
          {row.gainAmt > 0.001 ? `+${fmtN(row.gainAmt)}` : '—'}
        </td>
      )
    case 'wic':
      return <td key={key} className="text-center py-0 text-gray-600 tabular-nums">{fmtQ(row.wic)}</td>
    case 'gmc':
      return <td key={key} className="text-center py-0 text-gray-600 tabular-nums">{fmtQ(row.gmc)}</td>
    case 'bl':
      return <td key={key} className="text-center py-0 text-blue-600 tabular-nums">{fmtQ(row.bl)}</td>
    case 'soh': {
      const soh = parseFloat(row.soh ?? '0') || 0
      const sohNum = typeof soh === 'number' && !isNaN(soh) ? soh : 0
      return (
        <td key={key} className={`text-center py-0 font-semibold tabular-nums ${sohNum <= 0 ? 'text-red-500' : 'text-gray-700'}`}>
          {sohNum % 1 === 0 ? sohNum : sohNum.toFixed(1)}
        </td>
      )
    }
    case 'sp':
      return <td key={key} className="text-center py-0 text-blue-600 tabular-nums">{fmtCcy(row.sp)}</td>
    case 'cp':
      return <td key={key} className="text-center py-0 text-green-600 tabular-nums">{fmtCcy(row.cp)}</td>
    case 'cf_group':
      return <td key={key} className="text-center py-0 text-gray-500 truncate" title={row.cf_group ?? undefined}>{row.cf_group ?? '—'}</td>
    case 'product_type':
      return (
        <td key={key} className="text-center py-0">
          <span className={`inline-block px-1.5 py-0.5 rounded-full text-[12px] font-semibold ${
            row.product_type === 'service' ? 'bg-purple-50 text-purple-600' : 'bg-teal-50 text-teal-600'}`}>
            {row.product_type === 'service' ? 'Service' : 'Good'}
          </span>
        </td>
      )
    case 'count_interval':
      return (
        <td key={key} className="text-center py-0 text-gray-500 truncate" title={row.count_interval ?? undefined}>
          {row.count_interval ?? '—'}
        </td>
      )
  }
}

/* ── main LossTab ── */
function LossTab({ onOpenItem: _onOpenItem, search = '', group = 'All', productType = 'all', visibleCols, colOrder, columnLabels = {}, getWidth, resizeWidth, resetWidth }: {
  onOpenItem: (itemId: number) => void
  search?: string
  group?: string | null
  productType?: 'all' | 'goods' | 'services'
  // Which columns (besides the always-visible sticky Item column) show, and
  // their order -- lifted up to the parent page since the "Columns" picker
  // that drives these now lives there, next to the New button.
  visibleCols: Set<ColKey>
  colOrder: ColKey[]
  // Custom display labels from that same picker -- purely cosmetic, applied
  // over COLUMNS' default label below.
  columnLabels?: Partial<Record<ColKey, string>>
  // Column widths -- also lifted up, same colPrefs instance the picker uses.
  getWidth: (key: string, fallback: number) => number
  resizeWidth: (key: string, deltaPx: number, fallback: number) => void
  resetWidth: (key: string) => void
}) {
  const [rows, setRows] = useState<SummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<{ col: SortCol; dir: SortDir }>({ col: 'lgAmt', dir: 'desc' })
  const [viewingItemId, setViewingItemId] = useState<number | null>(null)

  // Remembers scroll position across a reload -- otherwise coming back to
  // this list drops you at the top instead of where you actually were.
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (loading || !scrollRef.current) return
    const saved = Number(sessionStorage.getItem('lossTabScrollTop') ?? '0')
    if (saved > 0) scrollRef.current.scrollTop = saved
  }, [loading])

  const shownColumns = colOrder.map(k => COL_BY_KEY.get(k)!).filter(c => visibleCols.has(c.key))
    .map(c => columnLabels[c.key] ? { ...c, label: columnLabels[c.key]! } : c)

  // Item column width -- user-resizable via the drag handle on its header,
  // remembered across visits since everyone's own item names run different
  // lengths. Lifted colPrefs (same instance the "Columns" picker uses).
  const itemColWidth = getWidth('item', 84)

  function loadSummary() {
    return fetch('/api/losses/summary').then(r => r.json())
      .then(d => { setRows(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(() => { loadSummary() }, [])

  function handleSort(col: SortCol) {
    setSort(s => s.col === col
      ? { col, dir: s.dir === 'desc' ? 'asc' : 'desc' }
      : { col, dir: col === 'item_name' ? 'asc' : 'desc' }
    )
  }

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

  // Grouped by cf_group -- items keep the sort order computed above within
  // their own group, groups themselves ordered alphabetically by name.
  const groupedRows = useMemo(() => {
    const map = new Map<string, SummaryRow[]>()
    for (const r of filtered) {
      const g = r.cf_group ?? 'Ungrouped'
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(r)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered])

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  const thProps = { sort, onSort: handleSort }

  const colgroup = (
    <colgroup>
      <col style={{width: itemColWidth}} />
      {shownColumns.map(c => <col key={c.key} style={{width: getWidth(c.key, c.width)}} />)}
    </colgroup>
  )

  function renderRow(row: SummaryRow, i: number) {
    // Alternating row tint (zebra striping) so a row is easy to track across
    // this many columns without losing your place -- the sticky Item cell
    // carries the same tint explicitly since it needs its own opaque
    // background to stay legible while the rest of the row scrolls under it.
    const stripe = i % 2 === 1 ? 'bg-gray-50' : 'bg-white'
    return (
      <tr key={row.item_id} onClick={() => setViewingItemId(row.item_id)}
        className={`cursor-pointer hover:bg-blue-50/60 transition ${stripe}`}>
        <td className={`pl-2 pr-2 py-0 font-bold truncate sticky left-0 z-10 ${stripe}`}
          style={{ width: itemColWidth, maxWidth: itemColWidth }} title={row.item_name}>
          <span className="text-blue-600">{row.item_name}</span>
        </td>
        {shownColumns.map(c => renderCell(c.key, row))}
      </tr>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Table — horizontally scrollable; Item column is kept short and
          truncates long names with an ellipsis instead of wrapping or
          growing to fit them. */}
      <div ref={scrollRef} onScroll={e => sessionStorage.setItem('lossTabScrollTop', String(e.currentTarget.scrollTop))}
        className="flex-1 min-h-0 overflow-auto rounded-xl border border-gray-200 bg-white">
        <table className="table-fixed border-collapse text-[12px]">
          {colgroup}
          <thead className="sticky top-0 z-20">
            <tr className="bg-gray-50">
              <SortTh label="Item" col="item_name" sort={sort} onSort={handleSort}
                cls="text-left pl-2 pr-2 sticky left-0 z-30 bg-gray-50"
                style={{ width: itemColWidth, maxWidth: itemColWidth }}
                onResize={d => resizeWidth('item', d, 84)} onResetWidth={() => resetWidth('item')} />
              {shownColumns.map((c, i) => (
                <SortTh key={c.key} label={c.label} col={c.key} {...thProps} cls="text-center"
                  noDivider={i === shownColumns.length - 1}
                  onResize={d => resizeWidth(c.key, d, c.width)} onResetWidth={() => resetWidth(c.key)} />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-[12px]">
            {filtered.length === 0 && (
              <tr><td colSpan={1 + shownColumns.length} className="py-10 text-center text-gray-400 text-xs">No items</td></tr>
            )}
            {groupedRows.map(([groupName, items]) => (
              <Fragment key={groupName}>
                <tr className="bg-gray-100">
                  {/* The sticky positioning goes on this inner, content-width
                      wrapper -- not the <td> itself, which spans every
                      column via colSpan and so is already as wide as the
                      whole scrollable table. A sticky element needs room to
                      slide within a wider container to actually stick;
                      applied straight to something that wide, it has none,
                      and the heading visibly drifts while scrolling instead
                      of staying put like the Item column does. */}
                  <td colSpan={1 + shownColumns.length} className="p-0">
                    <div className="sticky left-0 z-10 w-fit bg-gray-100 px-1 py-0.5 font-bold text-gray-700 text-[12px] uppercase tracking-wide">
                      {groupName} <span className="text-gray-400 font-normal normal-case">({items.length})</span>
                    </div>
                  </td>
                </tr>
                {items.map((row, i) => renderRow(row, i))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {viewingItemId != null && (
        <ItemDetailModal itemId={viewingItemId} onClose={() => setViewingItemId(null)} />
      )}
    </div>
  )
}

export default memo(LossTab)
