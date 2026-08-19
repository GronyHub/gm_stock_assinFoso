'use client'

import { useState, useEffect, useMemo } from 'react'
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
  usePresenceReporter('live-tapping a sale')
  const router = useRouter()

  const { initialShowLog = false, lawsPanel: incomingLawsPanel, hideTopControls = false, violationCounts = {}, violationTypes = [], serviceGroups = [], itemsWithViolations = {} } = props

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
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [currentView, setCurrentView] = useState<{ kind: 'violation' | 'serviceGroup' | 'lossByItem' | 'aliasWide' | 'serviceMatches' | 'newItem' | 'dailySummary'; key?: string; group?: string } | null>(null)
  const [violations, setViolations] = useState<Record<string, number>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [productTypeFilter, setProductTypeFilter] = useState<'all' | 'goods' | 'services'>('all')
  const localLawsPanel = useLawsPanel('showLiveSaleLaws')
  const liveSaleLaws = incomingLawsPanel || localLawsPanel

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
    ...serviceGroups.map((g: string) => ({
      key: `group_${g}`,
      label: g,
      count: 0,
      onViewClick: () => {
        setCurrentView(currentView?.kind === 'serviceGroup' && currentView.group === g
          ? null
          : { kind: 'serviceGroup' as const, group: g })
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

  // Fetch taps
  useEffect(() => {
    fetch('/api/sales/live-taps')
      .then(r => r.json())
      .then(d => { setTaps(Array.isArray(d) ? d : []) })
      .catch(() => {})
  }, [])

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

  // Filter and sort items based on current view, search, and product type
  const catalogueItems = useMemo(() => {
    let filtered = allItems

    // Apply product type filter
    if (productTypeFilter === 'goods') {
      filtered = filtered.filter(item => item.product_type !== 'service')
    } else if (productTypeFilter === 'services') {
      filtered = filtered.filter(item => item.product_type === 'service')
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(item => item.name.toLowerCase().includes(q))
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
  }, [allItems, salesCounts, currentView, searchQuery, productTypeFilter])

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
      {!hideTopControls && (
      <>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">Live Sale — {today}</h2>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search items…"
              className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <select
              value={productTypeFilter}
              onChange={e => setProductTypeFilter(e.target.value as 'all' | 'goods' | 'services')}
              className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="all">All groups</option>
              <option value="goods">Goods</option>
              <option value="services">Services</option>
            </select>
            <button
              type="button"
              onClick={() => router.push('/bills')}
              title="Bills"
              className="px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded transition"
            >
              📃
            </button>
            <button
              type="button"
              onClick={() => router.push('/expenses')}
              title="Expenses"
              className="px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded transition"
            >
              💳
            </button>
            <button
              type="button"
              onClick={() => router.push('/customers')}
              title="Customers"
              className="px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded transition"
            >
              👥
            </button>
            <button
              type="button"
              onClick={() => router.push('/vendors')}
              title="Vendors"
              className="px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded transition"
            >
              🏭
            </button>
            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className="w-8 h-8 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 font-semibold text-sm flex items-center justify-center transition"
              title="Help"
            >
              ?
            </button>
            <button
              type="button"
              onClick={() => setSaleType('WIC')}
              className={`px-4 py-1.5 text-sm font-semibold rounded transition ${
                saleType === 'WIC'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              WIC
            </button>
            <button
              type="button"
              onClick={() => setSaleType('GMC')}
              className={`px-4 py-1.5 text-sm font-semibold rounded transition ${
                saleType === 'GMC'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              GMC
            </button>
          </div>
        </div>
        {saleType === 'GMC' && (
          <p className="text-xs text-purple-600 font-semibold">Recorded as "Grony Multimedia as Customer"</p>
        )}
        <div className="bg-green-700 -mx-4 px-4 py-2">
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
      </div>
      </>
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
            {currentView.kind === 'serviceGroup' && `Viewing: ${currentView.group} (${catalogueItems.length} items)`}
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
          {useMemo(() => {
            const validTaps = taps.filter(t => !t.undone)
            const todayTaps = validTaps.filter(t => t.tapped_at.startsWith(today))
            const totalRevenue = todayTaps.reduce((sum, t) => sum + Number(t.price) * t.quantity, 0)
            const totalQuantity = todayTaps.reduce((sum, t) => sum + t.quantity, 0)
            const uniqueItems = new Set(todayTaps.map(t => t.item_id)).size

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
                    {Array.from(
                      todayTaps.reduce((acc, t) => {
                        const key = t.item_id
                        acc.set(key, (acc.get(key) || 0) + t.quantity)
                        return acc
                      }, new Map<number, number>())
                    )
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 5)
                      .map(([itemId, qty]) => {
                        const item = allItems.find(i => i.id === itemId)
                        return (
                          <div key={itemId} className="flex justify-between text-xs">
                            <span className="text-gray-700">{item?.name || '?'}</span>
                            <span className="font-semibold text-blue-600">{qty} units</span>
                          </div>
                        )
                      })
                    }
                  </div>
                </div>
              </div>
            )
          }, [taps, today, allItems])}
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
