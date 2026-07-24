'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { isOwnerLevel } from '@/lib/roles'
import { ItemDetail, type SummaryRow, type AliasRecord, type MatchRecord, type CandidateItem } from './LossTab'

// Standalone home for the same pack-chain/edit/alias/merge detail view that
// used to open inline under a row on the Items list -- reused here on the
// Item 360 page so it's reachable without going through that list. Builds
// its own equivalents of the pools/records LossTab derives from its
// full-list fetch, scoped down to the one item this page is about.
export default function ItemDetailPanel({ itemId }: { itemId: number }) {
  const router = useRouter()
  const { data: session } = useSession()
  const isOwnerLevelUser = isOwnerLevel(session?.user as any)

  const [rows, setRows] = useState<SummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [aliasRecords, setAliasRecords] = useState<Record<number, AliasRecord[]>>({})
  const [matchRecords, setMatchRecords] = useState<Record<string, MatchRecord[]>>({})
  // Same three filters the pack-chain table's submenu used to offer back
  // when it lived inline under a row on the Items list. Loss/Gain Only are
  // mutually exclusive -- turning one on turns the other off.
  const [showPrices, setShowPrices] = useState(true)
  const [lossOnly, setLossOnly] = useState(false)
  const [gainOnly, setGainOnly] = useState(false)

  useEffect(() => {
    fetch('/api/losses/summary').then(r => r.json())
      .then(d => { setRows(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
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
  }, [])

  useEffect(() => {
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
  }, [])

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

  return (
    <div className="overflow-x-auto">
      <div className="flex items-center gap-1.5 pb-1.5 flex-wrap">
        <button onClick={() => setShowPrices(p => !p)}
          title="Show/hide the SP, AMOUNT, CP and PROFIT columns on the pack-chain detail table"
          className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap transition
            ${showPrices ? 'bg-blue-600 text-white' : 'bg-white border border-blue-200 text-blue-700 hover:bg-blue-100'}`}>
          💲 Prices {showPrices ? '▾' : '▸'}
        </button>
        <button onClick={() => setLossOnly(o => { const v = !o; if (v) setGainOnly(false); return v })}
          title="Show only rows with an actual loss on the pack-chain detail table"
          className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap transition
            ${lossOnly ? 'bg-red-600 text-white' : 'bg-white border border-red-200 text-red-700 hover:bg-red-100'}`}>
          🔻 Loss Only
        </button>
        <button onClick={() => setGainOnly(o => { const v = !o; if (v) setLossOnly(false); return v })}
          title="Show only rows with an actual gain on the pack-chain detail table"
          className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap transition
            ${gainOnly ? 'bg-orange-500 text-white' : 'bg-white border border-orange-200 text-orange-700 hover:bg-orange-100'}`}>
          🔺 Gain Only
        </button>
      </div>
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
        onMerged={() => router.push('/item')}
        onDateClick={(date, itemName) =>
          router.push(`/item?tab=loss&view=sales&jumpDate=${encodeURIComponent(date)}&jumpItem=${encodeURIComponent(itemName)}`)}
        showPrices={showPrices}
        lossOnly={lossOnly}
        gainOnly={gainOnly} />
    </div>
  )
}
