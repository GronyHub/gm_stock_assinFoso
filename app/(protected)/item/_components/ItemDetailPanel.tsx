'use client'
import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { isOwnerLevel } from '@/lib/roles'
import { ItemDetail, AliasPicker, MatchPicker, MergeItemPicker, type SummaryRow, type AliasRecord, type MatchRecord, type CandidateItem } from './LossTab'

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
  // Same three filters the pack-chain table's submenu used to offer back
  // when it lived inline under a row on the Items list. Loss/Gain Only are
  // mutually exclusive -- turning one on turns the other off.
  const [showPrices, setShowPrices] = useState(true)
  const [lossOnly, setLossOnly] = useState(false)
  const [gainOnly, setGainOnly] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [dataFetched, setDataFetched] = useState(false)

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

  const showFilters = !collapsed || expanded
  const displayMode = collapsed && !expanded ? 'collapsed' : undefined
  const maxRows = displayMode === 'collapsed' ? 10 : undefined

  function handleExpand() {
    setExpanded(true)
    onExpand?.()
  }

  return (
    <div className="overflow-x-auto">
      {showFilters && (
        <div className="flex items-center gap-2 px-3 pb-3 flex-wrap">
          <button onClick={() => setShowPrices(p => !p)}
            title="Show/hide the SP, AMOUNT, CP and PROFIT columns on the pack-chain detail table"
            className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap transition
              ${showPrices ? 'bg-blue-600 text-white' : 'bg-white border border-blue-200 text-blue-700 hover:bg-blue-100'}`}>
            💲 Prices {showPrices ? '▾' : '▸'}
          </button>
          <button onClick={() => setLossOnly(o => { const v = !o; if (v) setGainOnly(false); return v })}
            title="Show only rows with an actual loss on the pack-chain detail table"
            className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap transition
              ${lossOnly ? 'bg-red-600 text-white' : 'bg-white border border-red-200 text-red-700 hover:bg-red-100'}`}>
            🔻 Loss Only
          </button>
          <button onClick={() => setGainOnly(o => { const v = !o; if (v) setLossOnly(false); return v })}
            title="Show only rows with an actual gain on the pack-chain detail table"
            className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap transition
              ${gainOnly ? 'bg-orange-500 text-white' : 'bg-white border border-orange-200 text-orange-700 hover:bg-orange-100'}`}>
            🔺 Gain Only
          </button>
        </div>
      )}
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
        // ...), and jumping the current tab to Sales would silently lose
        // whatever the user was doing there.
        onDateClick={(date, itemName) =>
          window.open(`/item?tab=loss&view=sales&jumpDate=${encodeURIComponent(date)}&jumpItem=${encodeURIComponent(itemName)}`, '_blank')}
        showPrices={showPrices}
        lossOnly={lossOnly}
        gainOnly={gainOnly}
        maxRows={maxRows} />
    </div>
  )
}
