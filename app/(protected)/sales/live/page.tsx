'use client'

import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { usePresenceReporter } from '@/lib/usePresenceReporter'
import { isOwnerLevel } from '@/lib/roles'
import { useLawsPanel } from '@/app/(protected)/item/_components/useLawsPanel'
import LawsToggleBar from '@/app/(protected)/item/_components/LawsToggleBar'
import PageLawsList from '@/app/(protected)/item/_components/PageLawsList'
import { LossDialog, PairingDialog, type LossExtra, type LossPrompt, type PairingPrompt } from '@/app/(protected)/item/_components/CountDialogs'
import { TrainingGuideModal } from './_components/TrainingGuideModal'

const AliasWidePage = dynamic(() => import('../../aliases/wide/page'), { ssr: false })
const ServiceMatchesPage = dynamic(() => import('../../matches/wide/page'), { ssr: false })
const NewItemForm = dynamic(() => import('../../item/_components/NewItemForm'), { ssr: false })
// "Count 2" tab -- the old standalone Counts page's own component,
// embedded wholesale rather than folded apart, kept around as a safety
// net for the pieces (History, Analytics, free-form any-item counting)
// Sale mode's due-item treatment doesn't cover.
const CountsTab = dynamic(() => import('../../item/_components/CountsTab'), { ssr: false })

type Item = { id: number; name: string; group: string | null; soh: number; selling_price: string | number; cost_price: string | number; product_type: string | null; count_interval?: string | null }
type Tap = { id: number; item_id: number; item_name: string; price: number | string; staff_name: string; tapped_at: string; undone: boolean; receipt_id?: number; quantity: number; soh?: number | null }
type FlagLaw = { key: string; label: string; description?: string; count: number; active?: boolean; onViewClick?: () => void }
type ViolationType = { key: string; label: string; description?: string }
// Sale mode's due-count queues -- same shape /api/stock/daily,
// /api/stock/gmc-weekly and /api/stock/overdue already return for CountsTab.
type DueItem = { item_id: number; item_name: string; cf_group: string | null; calculated_soh: number; last_count_date: string | null; days_overdue: number | null }
// The Log tab's Count view -- same shape /api/stock/counts already returns for CountsTab's own history table.
type CountRecord = { id: number; item_id: number | null; item_name: string; count_date: string; quantity_counted: string; notes: string | null; counted_by: string | null; source: string | null; cf_group: string | null }

function formatPrice(num: number | string): string {
  const n = Number(num)
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)
}

export default function LiveSalePage(props: any = {}) {
  console.log('LiveSalePage mounted with new item picker')
  usePresenceReporter('live-tapping a sale')
  const router = useRouter()
  const { data: session } = useSession()
  const canDeleteCounts = isOwnerLevel(session?.user as any)

  const {
    lawsPanel: incomingLawsPanel, hideTopControls = false,
    violationCounts = {}, violationTypes = [], serviceGroups = [], itemsWithViolations = {},
    productTypeFilter: controlledProductTypeFilter, onProductTypeFilterChange,
    groupFilter: controlledGroupFilter, onGroupFilterChange,
    showHelpModal: controlledShowHelpModal, onHelpModalChange,
    hideFilterBar = false,
    searchSlotEl = null,
    // Every "open Live Sale on a specific tab" deep link -- the "Sale Log"
    // search result (jumpToTab: 'log'), "Fix now: Counts" (jumpToTab:
    // 'count2'), and a Daily/7-Day/15-Day Counts violation pill
    // (jumpToTab: 'count2' + jumpToTabViolation: the key) -- all land
    // here. jumpToTabSeq is a plain incrementing counter, not a boolean,
    // so a second jump to the same tab/violation still fires (a
    // boolean/string prop that repeats its value wouldn't re-trigger the
    // effect below).
    jumpToTabSeq = 0,
    jumpToTab = null,
    jumpToTabViolation = null,
  } = props
  const compactSearch = !!searchSlotEl

  const [allItems, setAllItems] = useState<Item[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [taps, setTaps] = useState<Tap[]>([])
  const [saleType, setSaleType] = useState<'WIC' | 'GMC'>('WIC')
  const [error, setError] = useState('')
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  // Snapshot of whether selectedItem was due-for-count at the moment its
  // sheet opened -- countStatus itself updates the instant a count is
  // saved (the item drops out of the due queues), so comparing "was due
  // on open" against "still due now" is how the sheet tells "never was
  // due" apart from "just got counted", regardless of whether that count
  // went straight through or via the loss/pairing dialogs.
  const [dueWhenOpened, setDueWhenOpened] = useState(false)
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState('')
  const [saving, setSaving] = useState(false)
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

  // The standalone "Count" mode (its own due-count queues/badges/entry-form
  // as a second grid mode) was removed once Sale mode grew its own pinned
  // "COUNT NOW" block and inline count field for due items (below) -- those
  // don't depend on this mode existing, they're Sale-mode-native. 'count2'
  // and 'log' are the other two tabs sharing this switcher: 'count2' is the
  // full old standalone Counts page (History/Analytics/free-form counting
  // Sale mode's due-item treatment doesn't cover), kept as a safety net;
  // 'log' is what used to be a separate showLog boolean -- folded in as a
  // tab rather than its own sidebar destination since it's just history of
  // the other two.
  const [mode, setMode] = useState<'sale' | 'count2' | 'log'>('sale')
  const [count2Violation, setCount2Violation] = useState<string | null>(null)
  useEffect(() => {
    if (!jumpToTabSeq || !jumpToTab) return
    setMode(jumpToTab)
    setCount2Violation(jumpToTabViolation)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpToTabSeq])
  const [dailyItems, setDailyItems] = useState<DueItem[]>([])
  const [gmcWeeklyItems, setGmcWeeklyItems] = useState<DueItem[]>([])
  const [overdueItems, setOverdueItems] = useState<DueItem[]>([])
  const [countQty, setCountQty] = useState('')
  const [countSaving, setCountSaving] = useState(false)
  const [countError, setCountError] = useState('')
  const [lossPrompt, setLossPrompt] = useState<LossPrompt | null>(null)
  const [pairingPrompt, setPairingPrompt] = useState<PairingPrompt | null>(null)
  const [countRecords, setCountRecords] = useState<CountRecord[]>([])
  // Which history the Log tab shows -- independent of the Sale/Count 2 grid
  // mode above it (Log is its own tab, not a flag you toggle on top of
  // whichever grid mode happened to be active), so it gets its own small
  // Sale/Count sub-toggle in its own header instead.
  const [logKind, setLogKind] = useState<'sale' | 'count'>('sale')
  // Count 2's own filter text -- CountsTab expects its `search` prop from
  // a visible input the host page owns; the grid's own item-picker query
  // is a different, transient thing (it clears itself once an item's
  // picked) and isn't shown while this tab's open anyway.
  const [count2Search, setCount2Search] = useState('')
  const [editingCountId, setEditingCountId] = useState<number | null>(null)
  const [editCountQty, setEditCountQty] = useState('')
  const [editCountNotes, setEditCountNotes] = useState('')
  const [editCountSaving, setEditCountSaving] = useState(false)

  const groups = useMemo(() => {
    const uniqueGroups = new Set<string>()
    for (const item of allItems) {
      if (item.group) {
        uniqueGroups.add(item.group)
      }
    }
    return Array.from(uniqueGroups).sort()
  }, [allItems])

  // CountsTab (Count 2) expects items shaped {item_name, cf_group} -- this
  // page's own item list already uses {name, group} for everything else,
  // so this is just a field-name adapter, not a different data source.
  const countsTabItems = useMemo(
    () => allItems.map(i => ({ id: i.id, item_name: i.name, cf_group: i.group, product_type: i.product_type })),
    [allItems]
  )

  // Merges the 3 due-count queues into one per-item lookup for Count
  // mode's grid badges -- daily/7-day GMC items are "due", 15-day items
  // are "overdue" (a stronger color); an item in none of the 3 just isn't
  // due right now. The queues never overlap the same item in practice
  // (each excludes the others' item set server-side), so layering order
  // here only matters as a safety default, not a real precedence rule.
  const countStatus = useMemo(() => {
    const map = new Map<number, { level: 'due' | 'overdue'; label: string }>()
    for (const it of dailyItems) {
      map.set(it.item_id, { level: 'due', label: !it.days_overdue || it.days_overdue <= 0 ? 'Today' : `${it.days_overdue}d` })
    }
    for (const it of gmcWeeklyItems) {
      map.set(it.item_id, { level: 'due', label: !it.days_overdue || it.days_overdue <= 0 ? 'Due' : `${it.days_overdue}d` })
    }
    for (const it of overdueItems) {
      map.set(it.item_id, { level: 'overdue', label: `${it.days_overdue ?? '?'}d` })
    }
    return map
  }, [dailyItems, gmcWeeklyItems, overdueItems])

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

  // Sale mode's 3 due-count queues (COUNT NOW block + inline count field) --
  // same endpoints CountsTab's own flag pills read from. Fetched once up
  // front (cheap, and avoids a loading flash the first time a due item
  // would show up).
  useEffect(() => {
    Promise.all([
      fetch('/api/stock/daily').then(r => r.json()),
      fetch('/api/stock/gmc-weekly').then(r => r.json()),
      fetch('/api/stock/overdue').then(r => r.json()),
    ]).then(([daily, gmcWeekly, overdue]) => {
      setDailyItems(Array.isArray(daily) ? daily : [])
      setGmcWeeklyItems(Array.isArray(gmcWeekly) ? gmcWeekly : [])
      setOverdueItems(Array.isArray(overdue) ? overdue : [])
    }).catch(() => {})
  }, [])

  // Count Log -- fetched only once the Log tab's Count view is actually
  // opened, unlike the queues above (this is the full all-time history,
  // not a small due-today list).
  useEffect(() => {
    if (mode !== 'log' || logKind !== 'count') return
    fetch('/api/stock/counts')
      .then(r => r.json())
      .then(d => setCountRecords(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [mode, logKind])

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
    if (mode === 'sale' && saleType === 'GMC') {
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
  }, [allItems, salesCounts, currentView, productTypeFilter, groupFilter, pickedItemId, saleType, gmcItemIds, mode])

  // Log tab's two histories, grouped by date -- computed unconditionally
  // (not inside the `if (mode === 'log')` branch below) since React
  // requires the same hooks to run on every render of this component;
  // Sale/Count 2/Log now all live in one mounted instance switched by
  // `mode`, so a useMemo that only ran while mode==='log' would change the
  // hook count the moment you switched tabs and crash the page.
  const tapsByDate = useMemo(() => {
    const groups = new Map<string, typeof taps>()
    for (const tap of taps) {
      const date = tap.tapped_at.slice(0, 10)
      if (!groups.has(date)) groups.set(date, [])
      groups.get(date)!.push(tap)
    }
    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a))
  }, [taps])

  const countsByDate = useMemo(() => {
    const groups = new Map<string, typeof countRecords>()
    for (const rec of countRecords) {
      const date = rec.count_date.slice(0, 10)
      if (!groups.has(date)) groups.set(date, [])
      groups.get(date)!.push(rec)
    }
    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a))
  }, [countRecords])

  // Sale mode's own due-count callout -- staff mostly live in Sale mode, so
  // a due item needs to be visible right there instead of requiring a trip
  // to a separate count screen. Pinned as its own block at the very top
  // (not interleaved into the sales-frequency order below it), so the
  // normal most-sold-first list staff rely on for fast tapping never
  // reshuffles just because something unrelated went overdue.
  const [pinnedDueItems, restCatalogueItems] = useMemo(() => {
    if (mode !== 'sale') return [[], catalogueItems] as [Item[], Item[]]
    const due: Item[] = []
    const rest: Item[] = []
    for (const item of catalogueItems) {
      if (countStatus.has(item.id)) due.push(item)
      else rest.push(item)
    }
    const urgency = (item: Item) => {
      const d = countStatus.get(item.id)!
      const n = parseInt(d.label, 10)
      return (d.level === 'overdue' ? 1000 : 0) + (isNaN(n) ? 0 : n)
    }
    due.sort((a, b) => urgency(b) - urgency(a))
    return [due, rest] as [Item[], Item[]]
  }, [catalogueItems, countStatus, mode])

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

  // Same /api/stock/count contract CountsTab's own CountRow/ManualCountForm
  // already submit through -- a pack-pairing or loss-reason requirement
  // comes back as a 409 with a flag the caller re-submits against once the
  // prompt is answered, not a plain error, so this mirrors that retry shape
  // exactly rather than reinventing it. Used by the inline "Count today's
  // stock" field the Sale sheet grows for a due item (see the modal below).
  async function submitCount(item: Item, qty: number, lossExtra?: LossExtra) {
    setCountSaving(true)
    setCountError('')
    const res = await fetch('/api/stock/count', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.id, qty, notes: '', ...(lossExtra ?? {}) }),
    })
    setCountSaving(false)
    if (res.ok) {
      setDailyItems(prev => prev.filter(i => i.item_id !== item.id))
      setGmcWeeklyItems(prev => prev.filter(i => i.item_id !== item.id))
      setOverdueItems(prev => prev.filter(i => i.item_id !== item.id))
      setCountQty('')
      return
    }
    const d = await res.json().catch(() => null)
    if (res.status === 409 && d?.requires_pack_count) {
      setPairingPrompt({ itemName: item.name, packs: d.packs, retry: () => submitCount(item, qty, lossExtra) })
      return
    }
    if (res.status === 409 && d?.requires_loss_reason) {
      setLossPrompt({ d, retry: extra => submitCount(item, qty, extra) })
      return
    }
    setCountError(d?.error ?? 'Could not save count.')
  }

  // Same edit/delete pair Counts' own list already offers -- kept here so
  // fixing or removing a count record doesn't require leaving Live Sale
  // just because that page still also exists.
  function startEditCount(r: CountRecord) {
    setEditCountQty(String(r.quantity_counted))
    setEditCountNotes(r.notes ?? '')
    setEditingCountId(r.id)
  }

  async function saveEditCount(lossExtra?: LossExtra) {
    if (editingCountId == null) return
    setEditCountSaving(true)
    const res = await fetch(`/api/stock/counts/${editingCountId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity_counted: Number(editCountQty), notes: editCountNotes, ...(lossExtra ?? {}) }),
    })
    setEditCountSaving(false)
    if (res.ok) {
      const updated: CountRecord = await res.json()
      setCountRecords(prev => prev.map(r => r.id === editingCountId ? { ...r, ...updated } : r))
      setEditingCountId(null)
    } else {
      const d = await res.json().catch(() => null)
      if (res.status === 409 && d?.requires_loss_reason) {
        setLossPrompt({ d, retry: extra => saveEditCount(extra) })
        return
      }
      alert(d?.error ?? 'Could not save count.')
    }
  }

  async function deleteCountRecord(r: CountRecord) {
    const dateLabel = new Date(r.count_date.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    if (!confirm(`Delete the count of ${Number(r.quantity_counted)} for "${r.item_name}" on ${dateLabel}? This changes the loss/gain math from that day onward.`)) return
    const res = await fetch(`/api/stock/counts/${r.id}`, { method: 'DELETE' })
    if (res.ok) {
      setCountRecords(prev => prev.filter(x => x.id !== r.id))
      if (editingCountId === r.id) setEditingCountId(null)
    } else {
      alert((await res.json().catch(() => null))?.error ?? 'Could not delete count.')
    }
  }

  // The one 3-way switcher (Sale/Count 2/Log) shared by every tab's own
  // header, so jumping straight from Log to Count 2 (say) doesn't require
  // detouring back through the grid first.
  function renderModeToggle(compact: boolean) {
    const btnCls = (active: boolean, color: string) =>
      `font-bold rounded-md transition ${compact ? 'px-1.5 py-1 text-[10px]' : 'px-2.5 py-1 text-xs'} ${
        active ? `${color} text-white` : 'text-gray-500 hover:text-gray-700'
      }`
    return (
      <div className="inline-flex bg-gray-200 rounded-lg p-0.5">
        <button type="button" onClick={() => setMode('sale')} title="Sale mode" className={btnCls(mode === 'sale', 'bg-blue-600')}>Sale</button>
        <button type="button" onClick={() => setMode('count2')} title="Count 2 -- the full old Counts page" className={btnCls(mode === 'count2', 'bg-purple-600')}>Count 2</button>
        <button type="button" onClick={() => setMode('log')} title="Log" className={btnCls(mode === 'log', 'bg-gray-700')}>Log</button>
      </div>
    )
  }

  // Log tab
  if (mode === 'log') {
    return (
      <>
      <div className="h-full flex flex-col bg-white">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-sm font-bold text-gray-900">{logKind === 'count' ? 'Count Log' : 'Live Sale Log'}</h2>
          <div className="flex items-center gap-2">
            {renderModeToggle(false)}
            <div className="inline-flex bg-gray-200 rounded-lg p-0.5">
              <button type="button" onClick={() => setLogKind('sale')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${logKind === 'sale' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
                Sale
              </button>
              <button type="button" onClick={() => setLogKind('count')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${logKind === 'count' ? 'bg-amber-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
                Count
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className="w-8 h-8 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 font-semibold text-sm flex items-center justify-center transition"
              title="Help"
            >
              ?
            </button>
          </div>
        </div>

        {logKind === 'count' ? (
        <div className="flex-1 overflow-auto">
          {countRecords.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No counts recorded</p>
          ) : (
            <div className="inline-block min-w-full">
              <div className="grid grid-cols-[2fr_1fr_0.6fr_1fr_0.8fr_1.4fr_0.9fr] gap-0 bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                <div className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase">Item</div>
                <div className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase">Group</div>
                <div className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase text-center">Qty</div>
                <div className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase">By</div>
                <div className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase">Source</div>
                <div className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase">Notes</div>
                <div className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase text-right">Actions</div>
              </div>
              {countsByDate.map(([date, dateRecs]) => (
                <div key={date}>
                  <div className="grid grid-cols-[2fr_1fr_0.6fr_1fr_0.8fr_1.4fr_0.9fr] gap-0 bg-amber-50 border-b border-amber-200 sticky top-10 z-9">
                    <div className="col-span-7 px-4 py-2 text-xs font-semibold text-amber-700">
                      {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {dateRecs.length} counted
                    </div>
                  </div>
                  {dateRecs.map(rec => (
                    <div key={rec.id}>
                      <div className="grid grid-cols-[2fr_1fr_0.6fr_1fr_0.8fr_1.4fr_0.9fr] gap-0 border-b border-gray-100 items-center hover:bg-gray-50 transition">
                        <div className="px-4 py-3">
                          <p className="text-sm font-semibold text-gray-900">{rec.item_name}</p>
                        </div>
                        <div className="px-4 py-3">
                          <p className="text-sm text-gray-600">{rec.cf_group ?? '—'}</p>
                        </div>
                        <div className="px-4 py-3 text-center">
                          <p className="text-sm font-semibold text-gray-900">{Number(rec.quantity_counted)}</p>
                        </div>
                        <div className="px-4 py-3">
                          <p className="text-sm text-blue-600 font-medium">{rec.counted_by ?? '—'}</p>
                        </div>
                        <div className="px-4 py-3">
                          <p className="text-sm text-gray-500">{rec.source ?? '—'}</p>
                        </div>
                        <div className="px-4 py-3">
                          <p className="text-sm text-gray-500 italic truncate">{rec.notes ?? '—'}</p>
                        </div>
                        <div className="px-4 py-3">
                          <div className="flex gap-1 justify-end whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => editingCountId === rec.id ? setEditingCountId(null) : startEditCount(rec)}
                              className="text-xs text-blue-600 font-semibold bg-blue-50 px-2 py-1 rounded-full hover:bg-blue-100 transition"
                            >
                              {editingCountId === rec.id ? 'Close' : 'Edit'}
                            </button>
                            {canDeleteCounts && (
                              <button
                                type="button"
                                onClick={() => deleteCountRecord(rec)}
                                className="text-xs text-red-600 font-semibold bg-red-50 px-2 py-1 rounded-full hover:bg-red-100 transition"
                              >
                                Del
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      {editingCountId === rec.id && (
                        <div className="bg-blue-50/60 border-b border-gray-100 px-4 py-3 flex items-end gap-3 flex-wrap">
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Qty Counted</p>
                            <input
                              type="number" min="0" step="any"
                              value={editCountQty}
                              onChange={e => setEditCountQty(e.target.value)}
                              className="w-28 bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Notes</p>
                            <input
                              value={editCountNotes}
                              onChange={e => setEditCountNotes(e.target.value)}
                              placeholder="Optional"
                              className="w-48 bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => saveEditCount()}
                              disabled={editCountSaving}
                              className="bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-lg px-4 py-1.5 disabled:opacity-40 transition"
                            >
                              {editCountSaving ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCountId(null)}
                              className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-semibold rounded-lg transition"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
        ) : (
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
        )}
      </div>

      <TrainingGuideModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
      </>
    )
  }

  // Count 2 tab -- the full old standalone Counts page, embedded as-is.
  if (mode === 'count2') {
    return (
      <>
      <div className="h-full flex flex-col bg-white">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-sm font-bold text-gray-900">Count 2</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={count2Search}
              onChange={e => setCount2Search(e.target.value)}
              placeholder="Search…"
              className="text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400 w-32"
            />
            {renderModeToggle(false)}
            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className="w-8 h-8 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 font-semibold text-sm flex items-center justify-center transition"
              title="Help"
            >
              ?
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <CountsTab
            items={countsTabItems}
            groupFilter={groupFilter}
            search={count2Search}
            violation={count2Violation}
            onGoToViolation={key => setCount2Violation(key)}
          />
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
            {renderModeToggle(compactSearch)}
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
            {mode === 'sale' && (
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
            )}
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
      {mode === 'sale' && saleType === 'GMC' && (
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
            {pinnedDueItems.length > 0 && (
              <div className="col-span-2 px-2 py-1 bg-gray-800 text-[9px] font-bold text-white uppercase tracking-wide">
                {pinnedDueItems.length} item{pinnedDueItems.length !== 1 ? 's' : ''} need{pinnedDueItems.length === 1 ? 's' : ''} counting
              </div>
            )}
            {pinnedDueItems.map(item => {
              const count = salesCounts.get(item.id) ?? 0
              const due = countStatus.get(item.id)!
              const overdue = due.level === 'overdue'
              return (
                <div
                  key={item.id}
                  className={`flex flex-col border-r border-b group ${overdue ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}
                >
                  <div className={`px-2 py-0.5 text-[8px] font-extrabold text-white tracking-wide ${overdue ? 'bg-red-600' : 'bg-amber-500'}`}>
                    ⚠ COUNT NOW {overdue ? `· ${due.label} OVERDUE` : `· ${due.label}`}
                  </div>
                  <div className="p-2 flex items-start gap-1 hover:bg-black/5 transition">
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
                        <span className="text-slate-600 font-semibold">{Math.ceil(Number(item.soh))} pc</span>
                        {item.count_interval && (
                          <>
                            <span className="text-gray-400"> · </span>
                            <span className="text-gray-500">{item.count_interval}</span>
                          </>
                        )}
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
                          setDueWhenOpened(true)
                          setPrice('')
                          setQty('')
                          setError('')
                          setCountQty('')
                          setCountError('')
                        }}
                        className={`w-7 h-7 rounded-full text-white font-bold text-sm flex items-center justify-center transition ${overdue ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
            {pinnedDueItems.length > 0 && restCatalogueItems.length > 0 && (
              <div className="col-span-2 border-b border-gray-200" />
            )}
            {restCatalogueItems.map(item => {
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
                      <span className="text-slate-600 font-semibold">{Math.ceil(Number(item.soh))} pc</span>
                      {item.count_interval && (
                        <>
                          <span className="text-gray-400"> · </span>
                          <span className="text-gray-500">{item.count_interval}</span>
                        </>
                      )}
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
                        setDueWhenOpened(false)
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
      {selectedItem && (() => {
        const due = countStatus.get(selectedItem.id)
        const expected = Number(selectedItem.soh)
        const enteredCount = countQty === '' ? null : Number(countQty)
        const countShort = enteredCount !== null && !isNaN(enteredCount) && enteredCount < expected
        return (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="w-full bg-white rounded-t-2xl shadow-xl max-h-[92dvh] overflow-y-auto">
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

            {/* This item is due for a count -- surfaced right inside the
                sale sheet instead of requiring a separate mode-switch and
                a separate tap. Still its own field and its own submit,
                going to the count endpoint independently of the sale
                below, so entering one never gets mistaken for the other. */}
            {due && (
              <div className={`mx-4 mt-4 rounded-xl border overflow-hidden ${due.level === 'overdue' ? 'border-red-300' : 'border-amber-300'}`}>
                <div className={`px-3 py-1.5 text-xs font-extrabold text-white ${due.level === 'overdue' ? 'bg-red-600' : 'bg-amber-500'}`}>
                  ⚠ COUNT NOW — {due.level === 'overdue' ? `${due.label} overdue` : due.label}
                </div>
                <div className={`p-3 space-y-2 ${due.level === 'overdue' ? 'bg-red-50' : 'bg-amber-50'}`}>
                  <p className="text-xs text-gray-600">System expects <b>{expected}</b> on the shelf.</p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={countQty}
                      onChange={e => setCountQty(e.target.value)}
                      placeholder="Counted quantity"
                      className="flex-1 text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-amber-400"
                      disabled={countSaving}
                    />
                    <button
                      type="button"
                      onClick={() => setCountQty(String(expected))}
                      disabled={countSaving}
                      className="shrink-0 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
                    >
                      ={expected}
                    </button>
                    <button
                      type="button"
                      onClick={() => enteredCount !== null && submitCount(selectedItem, enteredCount)}
                      disabled={countQty === '' || countSaving}
                      className={`shrink-0 px-3 py-2 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50 ${countShort ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}
                    >
                      {countSaving ? '…' : countShort ? 'Save as loss' : 'Save Count'}
                    </button>
                  </div>
                  {enteredCount !== null && !isNaN(enteredCount) && (
                    <p className={`text-xs font-semibold ${countShort ? 'text-red-600' : 'text-emerald-600'}`}>
                      {countShort
                        ? `${(expected - enteredCount).toFixed(2).replace(/\.00$/, '')} short of expected — a reason will be requested`
                        : 'On target'}
                    </p>
                  )}
                  {countError && <p className="text-xs font-semibold text-red-600">{countError}</p>}
                </div>
              </div>
            )}
            {!due && dueWhenOpened && (
              <div className="mx-4 mt-4 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span className="text-sm font-semibold text-emerald-700">Stock counted for today.</span>
              </div>
            )}

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
                    setCountQty('')
                    setCountError('')
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
        )
      })()}

      {lossPrompt && <LossDialog prompt={lossPrompt} onClose={() => setLossPrompt(null)} />}
      {pairingPrompt && <PairingDialog prompt={pairingPrompt} onClose={() => setPairingPrompt(null)} />}

      <TrainingGuideModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
    </div>
    </>
  )
}
