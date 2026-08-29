'use client'
import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { isOwnerLevel } from '@/lib/roles'
import { ItemDetail, AliasPicker, MatchPicker, MergeItemPicker, type SummaryRow, type AliasRecord, type MatchRecord, type CandidateItem } from './LossTab'

interface CountRecord {
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

// Standalone home for the same pack-chain/edit/alias/merge detail view that
// used to open inline under a row on the Items list -- reused here on the
// Item 360 page so it's reachable without going through that list. Builds
// its own equivalents of the pools/records LossTab derives from its
// full-list fetch, scoped down to the one item this page is about.
interface ItemDetailPanelProps {
  itemId: number
  collapsed?: boolean
  onExpand?: () => void
  // Called once this item stops existing here (merged away or deleted) --
  // the caller decides what "gone" means for it (close the popup, go back
  // to a list, ...) instead of this component picking a page to navigate
  // to on its own, since it's now opened from many different pages, not
  // just its own standalone destination.
  onItemGone?: () => void
  // The Live Sale grid-edit sheet embeds this panel as its own "Details"
  // section but renders its own Aliases/Services/Merge editor up top
  // (backed by that sheet's own alias/match state, kept in sync with its
  // Save button) -- showing this panel's separate copy underneath as well
  // would just be two editors for the same data going in and out of sync.
  showRelationsEditor?: boolean
}

export default function ItemDetailPanel({ itemId, collapsed, onExpand, onItemGone, showRelationsEditor = true }: ItemDetailPanelProps) {
  const { data: session } = useSession()
  const isOwnerLevelUser = isOwnerLevel(session?.user as any)

  const [rows, setRows] = useState<SummaryRow[]>([])
  const [loading, setLoading] = useState(!collapsed)
  const [aliasRecords, setAliasRecords] = useState<Record<number, AliasRecord[]>>({})
  const [matchRecords, setMatchRecords] = useState<Record<string, MatchRecord[]>>({})
  const [editMode, setEditMode] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [dataFetched, setDataFetched] = useState(false)
  const [countRecords, setCountRecords] = useState<CountRecord[]>([])
  const [countRecordsLoading, setCountRecordsLoading] = useState(false)

  useEffect(() => {
    if (collapsed && !expanded) return
    if (dataFetched) return
    setLoading(true)
    setDataFetched(true)
    fetch('/api/losses/summary').then(r => r.json())
      .then(d => { setRows(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [collapsed, expanded, dataFetched])

  useEffect(() => {
    if (collapsed && !expanded) return
    // Scoped to this one item -- fetching the whole aliases-wide table
    // (an aggregate over every item+alias in the system) just to pick out
    // one item's row was why this popup could be slow to open as the
    // catalogue grew.
    fetch(`/api/aliases/wide?itemId=${itemId}`).then(r => r.json())
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
  }, [collapsed, expanded, itemId])

  useEffect(() => {
    if (collapsed && !expanded) return
    // Needs the item's own name (from the /api/losses/summary rows) before
    // it can scope the query -- runs again once that arrives.
    const itemName = rows.find(r => r.item_id === itemId)?.item_name
    if (!itemName) return
    fetch(`/api/good-service-matches?name=${encodeURIComponent(itemName)}`).then(r => r.json())
      .then((d: { id: number; good_name: string; service_name: string }[]) => {
        if (!Array.isArray(d)) return
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
  }, [collapsed, expanded, itemId, rows])

  useEffect(() => {
    if (collapsed && !expanded) return
    setCountRecordsLoading(true)
    fetch('/api/stock/counts').then(r => r.json())
      .then((d: any[]) => {
        if (!Array.isArray(d)) return
        const itemCounts = d.filter((r: any) => r.item_id === itemId).sort((a: any, b: any) =>
          new Date(b.count_date).getTime() - new Date(a.count_date).getTime()
        )
        setCountRecords(itemCounts)
      })
      .catch(() => {})
      .finally(() => setCountRecordsLoading(false))
  }, [collapsed, expanded, itemId])

  const item = rows.find(r => r.item_id === itemId)

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

  function patchItem(id: number, updates: Partial<SummaryRow>) {
    setRows(prev => prev.map(r => r.item_id === id ? { ...r, ...updates } : r))
  }

  if (loading) return <div className="py-10 text-center text-gray-400 text-xs">Loading…</div>
  if (!item) return null

  const displayMode = collapsed && !expanded ? 'collapsed' : undefined
  const maxRows = displayMode === 'collapsed' ? 10 : undefined

  function handleExpand() {
    setExpanded(true)
    onExpand?.()
  }

  return (
    <div className="overflow-x-auto">
      {showRelationsEditor && isOwnerLevelUser && (
        <div className="border-t border-b border-gray-200 bg-gray-50 px-3 py-2">
          {!editMode ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2 flex-1 items-center text-[9px]">
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-gray-600">Aliases:</span>
                  {aliasRecords[item.item_id]?.length === 0 ? (
                    <span className="text-gray-400">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {(aliasRecords[item.item_id] ?? []).map(a => (
                        <span key={a.id} className="inline-block bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full text-[8px] font-semibold">
                          {a.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-gray-600">Services used:</span>
                  {matchRecords[item.item_name.trim().toLowerCase()]?.length === 0 ? (
                    <span className="text-gray-400">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {(matchRecords[item.item_name.trim().toLowerCase()] ?? []).map(m => (
                        <span key={m.id} className="inline-block bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded-full text-[8px] font-semibold">
                          {m.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setEditMode(true)}
                className="shrink-0 text-[9px] font-semibold px-2 py-1 rounded bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 transition whitespace-nowrap">
                ✎ Edit
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-1.5">
                <div className="min-w-0">
                  <p className="text-[8px] font-bold text-gray-600 mb-1 uppercase truncate">Aliases</p>
                  <AliasPicker
                    itemId={item.item_id}
                    current={aliasRecords[item.item_id] ?? []}
                    onChange={(next) => setAliasRecords(prev => ({ ...prev, [item.item_id]: next }))} />
                </div>
                <div className="min-w-0">
                  <p className="text-[8px] font-bold text-gray-600 mb-1 uppercase truncate">Services Used</p>
                  <MatchPicker
                    itemId={item.item_id}
                    itemName={item.item_name}
                    isService={item.product_type === 'service'}
                    current={matchRecords[item.item_name.trim().toLowerCase()] ?? []}
                    candidatePool={item.product_type === 'service' ? goodsPool : servicesPool}
                    onChange={(next) => setMatchRecords(prev => ({ ...prev, [item.item_name.trim().toLowerCase()]: next }))} />
                </div>
                <div className="min-w-0">
                  <p className="text-[8px] font-bold text-gray-600 mb-1 uppercase truncate">Merge</p>
                  <MergeItemPicker
                    itemId={item.item_id}
                    itemName={item.item_name}
                    typeLabel={item.product_type === 'service' ? 'service' : 'good'}
                    mergePool={[...goodsPool, ...servicesPool].filter(i => i.item_id !== item.item_id)}
                    onMerged={() => { setEditMode(false); onItemGone?.() }} />
                </div>
              </div>
              <button
                onClick={() => setEditMode(false)}
                className="w-full text-[9px] font-semibold px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white transition">
                ✓ Done
              </button>
            </div>
          )}
        </div>
      )}
      {countRecords.length > 0 && (
        <div className="border-t border-gray-200 bg-amber-50 px-3 py-2">
          <p className="text-[9px] font-bold text-amber-900 mb-2 uppercase">Trade-Off Records</p>
          <div className="space-y-1">
            {countRecords.map((rec) => {
              const isLoss = (rec.loss_qty ?? 0) > 0
              const isGain = (rec.gain_qty ?? 0) > 0
              const qty = isLoss ? rec.loss_qty : isGain ? rec.gain_qty : rec.quantity_counted
              const kind = isLoss ? 'Loss' : isGain ? 'Gain' : 'OK'
              const kindColor = isLoss ? 'text-red-600' : isGain ? 'text-green-600' : 'text-gray-600'
              const kindBg = isLoss ? 'bg-red-50' : isGain ? 'bg-green-50' : 'bg-gray-50'
              return (
                <div key={rec.id} className={`flex items-center justify-between gap-2 ${kindBg} px-2 py-1 rounded text-[8px]`}>
                  <div className="flex-1">
                    <span className="font-semibold">{new Date(rec.count_date).toLocaleDateString()}</span>
                    <span className={`ml-2 font-bold ${kindColor}`}>{kind}</span>
                    <span className="ml-2 font-semibold">{qty !== null ? Math.abs(qty).toFixed(2) : '—'}</span>
                    {rec.notes && <span className="ml-2 text-gray-600 italic">"{rec.notes}"</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      <ItemDetail item={item} groups={groupNames} allItems={allItemsList}
        currentAliases={aliasRecords[item.item_id] ?? []}
        currentMatches={matchRecords[item.item_name.trim().toLowerCase()] ?? []}
        candidatePool={item.product_type === 'service' ? goodsPool : servicesPool}
        mergePool={[...goodsPool, ...servicesPool].filter(i => i.item_id !== item.item_id)}
        isOwnerLevelUser={isOwnerLevelUser}
        onSaved={u => patchItem(item.item_id, u)}
        onRelationsSaved={(newAliases, newMatches) => {
          setAliasRecords(prev => ({ ...prev, [item.item_id]: newAliases }))
          setMatchRecords(prev => ({ ...prev, [item.item_name.trim().toLowerCase()]: newMatches }))
        }}
        onMerged={() => onItemGone?.()}
        // Opened in a new tab rather than navigated to in place -- this
        // popup can be sitting on top of any page (Live Sale, Bills, a PO,
        // ...), and jumping the current tab to Sales/Bills would silently
        // lose whatever the user was doing there. &mode= is required (not
        // just &view=) since `view` only opens the Live Sale hub itself --
        // `mode` is the separate param that picks which of its six modes
        // (Sale/Log/Sales/Bills/Loss/Count) actually shows.
        onDateClick={(date, itemName) =>
          window.open(`/item?tab=loss&view=sales&mode=sales&jumpDate=${encodeURIComponent(date)}&jumpItem=${encodeURIComponent(itemName)}`, '_blank')}
        onBillClick={(billId) =>
          window.open(`/item?tab=loss&view=sales&mode=bills&jumpBillId=${billId}`, '_blank')}
        maxRows={maxRows} />
    </div>
  )
}
