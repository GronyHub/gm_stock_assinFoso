'use client'

import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { usePresenceReporter } from '@/lib/usePresenceReporter'
import { useLawsPanel } from '@/app/(protected)/item/_components/useLawsPanel'
import LawsToggleBar from '@/app/(protected)/item/_components/LawsToggleBar'
import PageLawsList from '@/app/(protected)/item/_components/PageLawsList'
import { TrainingGuideModal } from './_components/TrainingGuideModal'

const AliasWidePage = dynamic(() => import('../../aliases/wide/page'), { ssr: false })
const ServiceMatchesPage = dynamic(() => import('../../matches/wide/page'), { ssr: false })
const NewItemForm = dynamic(() => import('../../item/_components/NewItemForm'), { ssr: false })

type Item = { id: number; name: string; group: string | null; soh: number; selling_price: string | number; cost_price: string | number; product_type: string | null }
type Tap = { id: number; item_id: number; item_name: string; price: number | string; staff_name: string; tapped_at: string; undone: boolean; receipt_id?: number; quantity: number; soh?: number | null }
type FlagLaw = { key: string; label: string; description?: string; count: number; active?: boolean; onViewClick?: () => void }
type ViolationType = { key: string; label: string; description?: string }

function formatPrice(num: number | string): string {
  const n = Number(num)
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)
}

export default function LiveSalePage(props: any = {}) {
  console.log('LiveSalePage mounted with new item picker')
  usePresenceReporter('live-tapping a sale')
  const router = useRouter()

  const {
    initialShowLog = false, lawsPanel: incomingLawsPanel, hideTopControls = false,
    violationCounts = {}, violationTypes = [], serviceGroups = [], itemsWithViolations = {},
    productTypeFilter: controlledProductTypeFilter, onProductTypeFilterChange,
    groupFilter: controlledGroupFilter, onGroupFilterChange,
    showHelpModal: controlledShowHelpModal, onHelpModalChange,
    hideFilterBar = false,
    searchSlotEl = null,
  } = props
  const compactSearch = !!searchSlotEl

  const [allItems, setAllItems] = useState<Item[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [taps, setTaps] = useState<Tap[]>([])
  const [saleType, setSaleType] = useState<'WIC' | 'GMC'>('WIC')
  const [error, setError] = useState('')
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const [showLog, setShowLog] = useState(initialShowLog)
  const [internalShowHelpModal, setInternalShowHelpModal] = useState(false)
  const showHelpModal = controlledShowHelpModal ?? internalShowHelpModal
  const setShowHelpModal = onHelpModalChange ?? setInternalShowHelpModal
  const [currentView, setCurrentView] = useState<{ kind: 'violation' | 'serviceGroup' | 'lossByItem' | 'aliasWide' | 'serviceMatches' | 'newItem' | 'dailySummary'; key?: string; group?: string } | null>(null)
  const [violations, setViolations] = useState<Record<string, number>>({})
  const [internalProductTypeFilter, setInternalProductTypeFilter] = useState<'all' | 'goods' | 'services'>('all')
  const productTypeFilter = controlledProductTypeFilter ?? internalProductTypeFilter
  const setProductTypeFilter = onProductTypeFilterChange ?? setInternalProductTypeFilter
  const [internalGroupFilter, setInternalGroupFilter] = useState<string | null>(null)
  const groupFilter = controlledGroupFilter !== undefined ? controlledGroupFilter : internalGroupFilter
  const setGroupFilter = onGroupFilterChange ?? setInternalGroupFilter
  const [itemPickerQuery, setItemPickerQuery] = useState('')
  const [itemPickerResults, setItemPickerResults] = useState<Item[]>([])
  const [showItemPicker, setShowItemPicker] = useState(false)
  const [pickedItemId, setPickedItemId] = useState<number | null>(null)
  const localLawsPanel = useLawsPanel('showLiveSaleLaws')
  const liveSaleLaws = incomingLawsPanel || localLawsPanel

  const groups = useMemo(() => {
    const uniqueGroups = new Set<string>()
    for (const item of allItems) {
      if (item.group) {
        uniqueGroups.add(item.group)
      }
    }
    return Array.from(uniqueGroups).sort()
  }, [allItems])

  // Build flags array with Live Sale callbacks
  const computedFlags = useMemo(() => [
    ...violationTypes.map((v: ViolationType) => ({
      key: v.key,
      label: v.label,
      description: v.description,
      count: violationCounts[v.key] ?? 0,
      onViewClick: () => {
        setCurrentView(currentView?.kind === 'violation' && currentView.key === v.key
          ? null
          : { kind: 'violation' as const, key: v.key })
      }
    })),
    {
      key: 'loss_by_item',
      label: 'Loss by Item',
      count: 0,
      onViewClick: () => {
        setCurrentView(currentView?.kind === 'lossByItem' ? null : { kind: 'lossByItem' as const })
      }
    },
    {
      key: 'alias_wide_table',
      label: 'Alias Wide Table',
      count: 0,
      onViewClick: () => {
        setCurrentView(currentView?.kind === 'aliasWide' ? null : { kind: 'aliasWide' as const })
      }
    },
    {
      key: 'service_matches',
      label: 'Service Matches',
      count: 0,
      onViewClick: () => {
        setCurrentView(currentView?.kind === 'serviceMatches' ? null : { kind: 'serviceMatches' as const })
      }
    },
    {
      key: 'new_item',
      label: '+ New Item',
      count: 0,
      onViewClick: () => {
        setCurrentView(currentView?.kind === 'newItem' ? null : { kind: 'newItem' as const })
      }
    },
    {
      key: 'daily_summary',
      label: 'Daily Summary',
      count: 0,
      onViewClick: () => {
        setCurrentView(currentView?.kind === 'dailySummary' ? null : { kind: 'dailySummary' as const })
      }
    }
  ], [violationCounts, violationTypes, serviceGroups, currentView])

  // Fetch items
  useEffect(() => {
    fetch('/api/items/all')
      .then(r => r.json())
      .then(d => { setAllItems(Array.isArray(d) ? d : []); setLoadingItems(false) })
      .catch(() => setLoadingItems(false))
  }, [])

  // Items with at least one past GMC (internal-use) sale on record -- the
  // only existing definition of "GMC items" anywhere in the app (see
  // /api/items/gmc-ids). Fetched once; when saleType flips to GMC the grid
  // narrows to this set so a walk-in item can't accidentally get tapped
  // under an internal-use receipt.
  const [gmcItemIds, setGmcItemIds] = useState<Set<number>>(new Set())
  useEffect(() => {
    fetch('/api/items/gmc-ids')
      .then(r => r.json())
      .then(d => setGmcItemIds(new Set(Array.isArray(d) ? d : [])))
      .catch(() => {})
  }, [])

  // Fetch taps
  useEffect(() => {
    fetch('/api/sales/live-taps')
      .then(r => r.json())
      .then(d => { setTaps(Array.isArray(d) ? d : []) })
      .catch(() => {})
  }, [])

  // Search items as user types
  useEffect(() => {
    if (!itemPickerQuery.trim()) {
      setItemPickerResults([])
      setShowItemPicker(false)
      return
    }
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/items/search?q=${encodeURIComponent(itemPickerQuery)}`)
        const results = await r.json()
        setItemPickerResults(Array.isArray(results) ? results : [])
        setShowItemPicker(true)
      } catch (e) {
        setItemPickerResults([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [itemPickerQuery])

  // Count sales by item (all historical taps)
  const today = new Date().toISOString().slice(0, 10)
  const salesCounts = useMemo(() => {
    const counts = new Map<number, number>()
    for (const tap of taps) {
      if (!tap.undone) {
        counts.set(tap.item_id, (counts.get(tap.item_id) ?? 0) + tap.quantity)
      }
    }
    return counts
  }, [taps])

  // Filter and sort items based on current view and product type
  const catalogueItems = useMemo(() => {
    if (allItems.length === 0) return []

    let filtered = [...allItems]

    // If an item is picked, show ONLY that item
    if (pickedItemId !== null) {
      filtered = filtered.filter(item => item.id === pickedItemId)
      return filtered
    }

    // Apply product type filter
    if (productTypeFilter === 'goods') {
      filtered = filtered.filter(item => item.product_type !== 'service')
    } else if (productTypeFilter === 'services') {
      filtered = filtered.filter(item => item.product_type === 'service')
    }

    // Apply group filter
    if (groupFilter !== null) {
      filtered = filtered.filter(item => item.group === groupFilter)
    }

    // GMC (internal use) only ever taps items with a GMC history -- keeps
    // the browse grid from offering a normal walk-in item under an
    // internal-use receipt. Doesn't apply to a deliberately searched-and-
    // picked item above, since that's how an item gets its first-ever GMC
    // record in the first place.
    if (saleType === 'GMC') {
      filtered = filtered.filter(item => gmcItemIds.has(item.id))
    }

    // Apply view filter
    if (currentView?.kind === 'serviceGroup' && currentView.group) {
      filtered = filtered.filter(item => item.group === currentView.group)
    } else if (currentView?.kind === 'violation' && currentView.key) {
      // Filter items by violation type using pre-computed violation data from Item page
      const violationItemIds = itemsWithViolations[currentView.key] as number[] | undefined
      if (violationItemIds) {
        filtered = filtered.filter(item => violationItemIds.includes(item.id))
      } else {
        filtered = []
      }
    } else if (currentView?.kind === 'lossByItem') {
      // Sort by loss amount when viewing loss by item
      return filtered.sort((a, b) => {
        const lossA = Math.abs(Number(a.selling_price || 0) - Number(a.cost_price || 0))
        const lossB = Math.abs(Number(b.selling_price || 0) - Number(b.cost_price || 0))
        return lossB - lossA
      })
    }

    // Sort by sales count (highest to lowest)
    return filtered.sort((a, b) => (salesCounts.get(b.id) ?? 0) - (salesCounts.get(a.id) ?? 0))
  }, [allItems, salesCounts, currentView, productTypeFilter, groupFilter, pickedItemId, saleType, gmcItemIds])

  async function recordTap() {
    if (!selectedItem || !qty) return
    setSaving(true)
    setError('')

    const qtyNum = Number(qty)
    const priceNum = price ? Number(price) : Number(selectedItem.selling_price)

    if (qtyNum <= 0) {
      setError('Quantity must be greater than 0')
      setSaving(false)
      return
    }

    if (priceNum <= 0) {
      setError('Price must be greater than 0')
      setSaving(false)
      return
    }

    try {
      const res = await fetch('/api/sales/live-tap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: selectedItem.id,
          quantity: qtyNum,
          customPrice: price ? priceNum : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not record tap')
        setSaving(false)
        return
      }
      setTaps(prev => [data.tap, ...prev])
      setSelectedItem(null)
      setQty('')
      setPrice('')
    } catch (e) {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  async function undoTap(tapId: number) {
    try {
      const res = await fetch(`/api/sales/live-taps/${tapId}?action=undo`, { method: 'POST' })
      if (res.ok) {
        setTaps(prev => prev.map(t => t.id === tapId ? { ...t, undone: true } : t))
      } else {
        setError('Could not undo tap')
      }
    } catch (e) {
      setError('Could not undo tap')
    }
  }

  // Log view
  if (showLog) {
    // Group taps by date
    const tapsByDate = useMemo(() => {
      const groups = new Map<string, typeof taps>()
      for (const tap of taps) {
        const date = tap.tapped_at.slice(0, 10)
        if (!groups.has(date)) groups.set(date, [])
        groups.get(date)!.push(tap)
      }
      return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a))
    }, [taps])

    return (
      <>
      <div className="h-full flex flex-col bg-white">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">Live Sale Log</h2>
          <button
            type="button"
            onClick={() => setShowHelpModal(true)}
            className="w-8 h-8 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 font-semibold text-sm flex items-center justify-center transition"
            title="Help"
          >
            ?
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {taps.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No sales recorded</p>
          ) : (
            <div className="inline-block min-w-full">
              {/* Table header */}
              <div className="grid grid-cols-[2fr_1fr_1fr_0.8fr_0.6fr_1fr_0.6fr_0.8fr] gap-0 bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                <div className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase">Item</div>
                <div className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase text-right">Total</div>
                <div className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase text-center">Time</div>
                <div className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase text-right">SP</div>
                <div className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase text-center">Qty</div>
                <div className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase">Staff</div>
                <div className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase text-center">SOH</div>
                <div className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase" />
              </div>

              {/* Table rows grouped by date */}
              {tapsByDate.map(([date, dateTaps]) => {
                const dateTotal = dateTaps.filter(t => !t.undone).reduce((s, t) => s + Number(t.price) * t.quantity, 0)
                return (
                  <div key={date}>
                    {/* Date header */}
                    <div className="grid grid-cols-[2fr_1fr_1fr_0.8fr_0.6fr_1fr_0.6fr_0.8fr] gap-0 bg-green-50 border-b border-green-200 sticky top-10 z-9">
                      <div className="col-span-8 px-4 py-2 text-xs font-semibold text-green-700">
                        {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · Total: ₵{formatPrice(dateTotal)}
                      </div>
                    </div>

                    {/* Date's taps */}
                    {dateTaps.map(tap => (
                      <div
                        key={tap.id}
                        className={`grid grid-cols-[2fr_1fr_1fr_0.8fr_0.6fr_1fr_0.6fr_0.8fr] gap-0 border-b border-gray-100 items-center hover:bg-gray-50 transition ${
                          tap.undone ? 'bg-gray-50 opacity-60' : ''
                        }`}
                      >
                        <div className="px-4 py-3">
                          <p className={`text-sm font-semibold ${tap.undone ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                            {tap.item_name}
                          </p>
                        </div>
                        <div className="px-4 py-3 text-right">
                          <p className={`text-sm font-semibold ${tap.undone ? 'text-gray-400' : 'text-blue-600'}`}>
                            ₵{formatPrice(Number(tap.price) * tap.quantity)}
                          </p>
                        </div>
                        <div className="px-4 py-3 text-center">
                          <p className="text-xs text-gray-500">{new Date(tap.tapped_at).toLocaleTimeString()}</p>
                        </div>
                        <div className="px-4 py-3 text-right">
                          <p className={`text-sm font-semibold ${tap.undone ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                            ₵{formatPrice(tap.price)}
                          </p>
                        </div>
                        <div className="px-4 py-3 text-center">
                          <p className={`text-sm font-semibold ${tap.undone ? 'text-gray-400' : 'text-gray-900'}`}>
                            {tap.quantity}
                          </p>
                        </div>
                        <div className="px-4 py-3">
                          <p className="text-sm text-gray-600">{tap.staff_name}</p>
                        </div>
                        <div className="px-4 py-3 text-center">
                          <p className="text-sm text-gray-500">{tap.soh !== null && tap.soh !== undefined ? Math.ceil(tap.soh) : '-'}</p>
                        </div>
                        <div className="px-4 py-3 text-right">
                          {!tap.undone && (
                            <button
                              onClick={() => undoTap(tap.id)}
                              className="px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 rounded transition"
                            >
                              Undo
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <TrainingGuideModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
      </>
    )
  }

  return (
    <>
    <div className="h-full flex flex-col bg-white">
      {/* Filter Bar - Green bar at top - hidden when the host page (Item page)
          renders its own merged version of this bar via hideFilterBar */}
      {!hideFilterBar && (
      <div className="bg-green-700 -mx-0 px-4 py-2 flex items-center justify-between">
          <div className="flex gap-2 items-center">
            <select
              value={productTypeFilter}
              onChange={e => setProductTypeFilter(e.target.value as 'all' | 'goods' | 'services')}
              className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
            >
              <option value="all">All types</option>
              <option value="goods">Goods</option>
              <option value="services">Services</option>
            </select>
            <select
              value={groupFilter || ''}
              onChange={e => setGroupFilter(e.target.value || null)}
              className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
            >
              <option value="">All groups</option>
              {groups.map(group => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 items-center">
            <div>
              <LawsToggleBar
                show={liveSaleLaws.show}
                setShow={liveSaleLaws.setShow}
                openForm={liveSaleLaws.openForm}
                setOpenForm={liveSaleLaws.setOpenForm}
                hideZeroFlags={liveSaleLaws.hideZeroFlags}
                setHideZeroFlags={liveSaleLaws.setHideZeroFlags}
                activeFilters={liveSaleLaws.activeFilters}
                toggleFilter={liveSaleLaws.toggleFilter}
                dark={true}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className="w-8 h-8 rounded bg-white text-gray-600 hover:bg-gray-100 font-semibold text-sm flex items-center justify-center transition"
              title="Help"
            >
              ?
            </button>
          </div>
      </div>
      )}

      {/* Search & Controls -- rendered inline normally, or portaled into a
          slot the host page (Item page) supplies so it can sit compactly
          beside the laws/help/expand icons in the merged green bar instead
          of its own full-size row. */}
      {(() => {
        const searchControlsNode = (
          <>
            <div className="relative">
              <input
                type="text"
                value={itemPickerQuery}
                onChange={e => setItemPickerQuery(e.target.value)}
                onFocus={() => itemPickerQuery.trim() && setShowItemPicker(true)}
                placeholder={compactSearch ? 'Search item…' : 'Search & pick item…'}
                className={`border rounded-lg focus:outline-none focus:ring-1 ${
                  compactSearch ? 'text-xs px-2 py-1 w-24 bg-white' : 'text-sm px-3 py-1.5 w-48'
                } ${
                  pickedItemId !== null
                    ? 'border-green-400 bg-green-50 focus:ring-green-400'
                    : 'border-gray-300 focus:ring-blue-400'
                }`}
              />
              {itemPickerQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setItemPickerQuery('')
                    setItemPickerResults([])
                    setShowItemPicker(false)
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
              {showItemPicker && itemPickerResults.length > 0 && (
                <div className={`absolute top-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto ${
                  compactSearch ? 'left-0 w-56' : 'left-0 right-0'
                }`}>
                  {itemPickerResults.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setPickedItemId(item.id)
                        setItemPickerQuery('')
                        setShowItemPicker(false)
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-green-50 border-b border-gray-100 last:border-b-0 text-sm text-gray-700"
                    >
                      <div className="font-semibold text-gray-900">{item.name}</div>
                      <div className="text-xs text-gray-500">₵{formatPrice(item.selling_price)} · Stock: {Math.ceil(Number(item.soh))}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {pickedItemId !== null && (
              <button
                type="button"
                onClick={() => {
                  setPickedItemId(null)
                  setItemPickerQuery('')
                }}
                className={`font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition ${
                  compactSearch ? 'px-1.5 py-1 text-xs' : 'px-2 py-1.5 text-sm'
                }`}
              >
                {compactSearch ? '✕ Item' : 'Clear Item'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setSaleType(t => t === 'WIC' ? 'GMC' : 'WIC')}
              title="Tap to switch between WIC and GMC"
              className={`font-semibold rounded transition ${compactSearch ? 'px-2 py-1 text-xs' : 'px-4 py-1.5 text-sm'} ${
                saleType === 'GMC'
                  ? 'bg-purple-600 text-white'
                  : 'bg-blue-600 text-white'
              }`}
            >
              {saleType}
            </button>
          </>
        )

        if (compactSearch) {
          return searchSlotEl ? createPortal(
            <div className="flex gap-1.5 items-center">{searchControlsNode}</div>,
            searchSlotEl
          ) : null
        }

        return (
          <div className="px-4 py-3 border-b border-gray-200 space-y-3">
            <div className="flex items-center justify-between gap-2">
              {!hideTopControls && <h2 className="text-sm font-bold text-gray-900">Live Sale — {today}</h2>}
              <div className="flex gap-2 items-center ml-auto">
                {searchControlsNode}
              </div>
            </div>
          </div>
        )
      })()}

      {/* GMC warning -- internal-use recording is easy to mis-tap and hard
          to catch afterward (it's excluded from revenue/margin and feeds
          the stock-gain reconciliation checks), so this stays loud and
          impossible to miss for as long as GMC is selected. */}
      {saleType === 'GMC' && (
        <div className="px-4 py-3 bg-red-600 border-b-4 border-red-800">
          <p className="text-white font-extrabold text-lg leading-tight">
            ⚠ GMC MODE — Internal Use, Not a Real Sale
          </p>
          <p className="text-red-50 text-xs font-semibold mt-1 leading-snug">
            GMC ("Grony Multimedia as Customer") records stock the shop takes for its own internal use —
            it is excluded from revenue and profit, and is used to explain stock changes that aren't
            walk-in sales. Only tap items actually taken for internal use here. Switch back to WIC for
            normal customer sales.
          </p>
        </div>
      )}

      {liveSaleLaws.show && (
        <div className={`px-4 py-3 border-b border-gray-200 bg-gray-50 overflow-auto max-h-48 ${hideTopControls ? 'border-t' : ''}`}>
          <PageLawsList
            scopeKey="Items"
            isItemsLaws={true}
            flags={computedFlags}
            onChange={liveSaleLaws.bumpRefresh}
            openForm={liveSaleLaws.openForm}
            setOpenForm={liveSaleLaws.setOpenForm}
            hideZeroFlags={liveSaleLaws.hideZeroFlags}
            setHideZeroFlags={liveSaleLaws.setHideZeroFlags}
            activeFilters={liveSaleLaws.activeFilters}
          />
        </div>
      )}

      {/* Current View Indicator */}
      {currentView && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-blue-700">
            {currentView.kind === 'violation' && `Viewing: Items with "${computedFlags.find(f => f.key === currentView.key)?.label}"`}
            {currentView.kind === 'lossByItem' && `Viewing: Loss by Item (${catalogueItems.length} items)`}
            {currentView.kind === 'aliasWide' && `Viewing: Alias Wide Table`}
            {currentView.kind === 'serviceMatches' && `Viewing: Service Matches`}
            {currentView.kind === 'newItem' && `Creating New Item`}
            {currentView.kind === 'dailySummary' && `Daily Sales Summary`}
          </span>
          <button
            type="button"
            onClick={() => setCurrentView(null)}
            className="text-xs font-semibold px-2 py-1 rounded bg-white text-blue-600 hover:bg-blue-100 transition"
          >
            ✕ Clear
          </button>
        </div>
      )}

      {/* Alias Wide Table View */}
      {currentView?.kind === 'aliasWide' && (
        <div className="flex-1 overflow-y-auto">
          <AliasWidePage />
        </div>
      )}

      {/* Service Matches View */}
      {currentView?.kind === 'serviceMatches' && (
        <div className="flex-1 overflow-y-auto">
          <ServiceMatchesPage />
        </div>
      )}

      {/* Daily Summary View */}
      {currentView?.kind === 'dailySummary' && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {(() => {
            try {
              const validTaps = taps.filter(t => !t.undone)
              const todayTaps = validTaps.filter(t => t.tapped_at.startsWith(today))
              const totalRevenue = todayTaps.reduce((sum, t) => sum + Number(t.price) * t.quantity, 0)
              const totalQuantity = todayTaps.reduce((sum, t) => sum + t.quantity, 0)
              const uniqueItems = new Set(todayTaps.map(t => t.item_id)).size

              const topItemsMap = new Map<number, number>()
              for (const tap of todayTaps) {
                topItemsMap.set(tap.item_id, (topItemsMap.get(tap.item_id) ?? 0) + tap.quantity)
              }
              const topItems = Array.from(topItemsMap.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)

              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-xs text-blue-600 font-semibold">Total Revenue</p>
                      <p className="text-2xl font-bold text-blue-900 mt-1">₵{formatPrice(totalRevenue)}</p>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-xs text-green-600 font-semibold">Total Quantity</p>
                      <p className="text-2xl font-bold text-green-900 mt-1">{totalQuantity}</p>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <p className="text-xs text-purple-600 font-semibold">Unique Items</p>
                      <p className="text-2xl font-bold text-purple-900 mt-1">{uniqueItems}</p>
                    </div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-xs font-semibold text-gray-600 mb-3">Top Items</p>
                    <div className="space-y-2">
                      {topItems.length === 0 ? (
                        <p className="text-xs text-gray-500">No sales today</p>
                      ) : (
                        topItems.map(([itemId, qty]) => {
                          const item = allItems.find(i => i.id === itemId)
                          return (
                            <div key={itemId} className="flex justify-between text-xs">
                              <span className="text-gray-700">{item?.name || '?'}</span>
                              <span className="font-semibold text-blue-600">{qty} units</span>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>
              )
            } catch (e) {
              console.error('Daily summary error:', e)
              return (
                <div className="text-center py-8">
                  <p className="text-sm text-red-600 font-medium">Could not load daily summary</p>
                </div>
              )
            }
          })()}
        </div>
      )}

      {/* New Item Form */}
      {currentView?.kind === 'newItem' && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <NewItemForm onSuccess={() => { setCurrentView(null); setAllItems([]) }} />
        </div>
      )}

      {/* Items Grid - 2 Columns */}
      {currentView?.kind !== 'aliasWide' && currentView?.kind !== 'serviceMatches' && currentView?.kind !== 'newItem' && currentView?.kind !== 'dailySummary' && (
      <div className="flex-1 overflow-y-auto">
        {loadingItems ? (
          <p className="text-xs text-gray-400 text-center py-8">Loading…</p>
        ) : catalogueItems.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">
            {currentView ? 'No items in this view' : 'No items found'}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-0 p-0">
            {catalogueItems.map(item => {
              const count = salesCounts.get(item.id) ?? 0
              return (
                <div
                  key={item.id}
                  className="p-2 flex items-start gap-1 hover:bg-gray-50 transition group border-r border-b border-gray-100"
                >
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => router.push(`/item?view=item360&jumpItemId=${item.id}`)}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 leading-tight truncate text-left hover:underline transition"
                    >
                      {item.name}
                    </button>
                    <p className="text-[9px] text-gray-600 leading-tight">
                      <span className="text-blue-600 font-semibold">₵{formatPrice(item.selling_price)}</span>
                      <span className="text-gray-400"> · </span>
                      <span className="text-green-600 font-semibold">CP ₵{formatPrice(item.cost_price)}</span>
                      <span className="text-gray-400"> · </span>
                      <span className="text-red-600 font-semibold">{Math.ceil(Number(item.soh))} pc</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {count > 0 && (
                      <span className="inline-flex items-center justify-center min-w-3 h-3 px-0.5 rounded-full bg-blue-600 text-white text-[8px] font-bold">
                        {count}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedItem(item)
                        setPrice('')
                        setQty('')
                        setError('')
                      }}
                      className="w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center transition"
                    >
                      +
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      )}

      {/* Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="w-full bg-white rounded-t-2xl shadow-xl">
            <div className="px-4 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">{selectedItem.name}</h3>
              <p className="text-xs text-gray-500 mt-1">
                <span>Selling: ₵{formatPrice(selectedItem.selling_price)}</span>
                <span className="text-gray-400"> · </span>
                <span>Cost: ₵{formatPrice(selectedItem.cost_price)}</span>
                <span className="text-gray-400"> · </span>
                <span>Stock: {Math.ceil(Number(selectedItem.soh))} pc</span>
              </p>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Quantity <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="1"
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                  placeholder="Enter quantity"
                  className="w-full text-lg font-semibold text-gray-900 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-blue-400"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Price (optional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">₵</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder={formatPrice(selectedItem.selling_price)}
                    className="w-full text-lg font-semibold text-gray-900 bg-gray-50 border border-gray-300 rounded-lg pl-7 pr-3 py-2 outline-none focus:ring-1 focus:ring-blue-400"
                    disabled={saving}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Defaults to ₵{formatPrice(selectedItem.selling_price)}
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600 font-medium">
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedItem(null)
                    setQty('')
                    setPrice('')
                    setError('')
                  }}
                  disabled={saving}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold rounded-lg transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={recordTap}
                  disabled={!qty || saving}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Tap'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <TrainingGuideModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
    </div>
    </>
  )
}
