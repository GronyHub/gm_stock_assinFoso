'use client'
import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { isOwnerLevel } from '@/lib/roles'
import { ItemDetail, type SummaryRow, type AliasRecord, type MatchRecord, type CandidateItem } from './LossTab'

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
}

export default function ItemDetailPanel({ itemId, collapsed, onExpand, onItemGone }: ItemDetailPanelProps) {
  const { data: session } = useSession()
  const isOwnerLevelUser = isOwnerLevel(session?.user as any)

  const [rows, setRows] = useState<SummaryRow[]>([])
  const [loading, setLoading] = useState(!collapsed)
  const [aliasRecords, setAliasRecords] = useState<Record<number, AliasRecord[]>>({})
  const [matchRecords, setMatchRecords] = useState<Record<string, MatchRecord[]>>({})
  // Same three filters the pack-chain table's submenu used to offer back
  // when it lived inline under a row on the Items list. Loss/Gain Only are
  // mutually exclusive -- turning one on turns the other off.
  const [showPrices, setShowPrices] = useState(true)
  const [lossOnly, setLossOnly] = useState(false)
  const [gainOnly, setGainOnly] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [dataFetched, setDataFetched] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [editNameValue, setEditNameValue] = useState('')

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
  }, [collapsed, expanded])

  useEffect(() => {
    if (collapsed && !expanded) return
    fetch('/api/good-service-matches').then(r => r.json())
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
  }, [collapsed, expanded])

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

  async function saveItemName() {
    if (!editNameValue.trim() || editNameValue === item?.item_name) {
      setEditingName(false)
      return
    }
    if (!item) return
    try {
      const res = await fetch(`/api/items/${item.item_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_name: editNameValue })
      })
      if (res.ok) {
        setRows(prev => prev.map(r => r.item_id === item.item_id ? { ...r, item_name: editNameValue } : r))
        setEditingName(false)
      }
    } catch (e) {
      console.error('Failed to save item name:', e)
    }
  }

  function startEditName() {
    if (!item) return
    setEditNameValue(item.item_name)
    setEditingName(true)
  }

  return (
    <div className="overflow-x-auto">
      <div className="px-3 py-3 bg-white border-b border-gray-200 flex items-center justify-between gap-4">
        {editingName ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              autoFocus
              type="text"
              value={editNameValue}
              onChange={e => setEditNameValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') saveItemName()
                if (e.key === 'Escape') setEditingName(false)
              }}
              className="flex-1 text-lg font-bold text-red-600 bg-white border border-red-400 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-red-400"
            />
            <button onClick={saveItemName} className="text-sm font-semibold text-green-600 hover:text-green-700">✓</button>
            <button onClick={() => setEditingName(false)} className="text-sm font-semibold text-gray-400 hover:text-gray-600">✕</button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <p className="text-lg font-bold text-red-600 truncate">{item.item_name}</p>
              <button
                onClick={startEditName}
                title="Tap to edit item name"
                className="text-2xl font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1 rounded transition"
              >
                ✎ EDIT
              </button>
            </div>
            {collapsed && !expanded && (
              <button onClick={handleExpand}
                className="text-xs font-semibold text-blue-600 hover:underline whitespace-nowrap ml-2">
                Expand ▼
              </button>
            )}
          </>
        )}
      </div>
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
