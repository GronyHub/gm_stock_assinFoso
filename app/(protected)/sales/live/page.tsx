'use client'

import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import { useSession } from 'next-auth/react'
import { usePresenceReporter } from '@/lib/usePresenceReporter'
import { isOwnerLevel } from '@/lib/roles'
import { fmtTime } from '@/lib/fmtDate'
import { useLawsPanel } from '@/app/(protected)/item/_components/useLawsPanel'
import LawsToggleBar from '@/app/(protected)/item/_components/LawsToggleBar'
import PageLawsList from '@/app/(protected)/item/_components/PageLawsList'
import { LossDialog, PairingDialog, type LossExtra, type LossPrompt, type PairingPrompt } from '@/app/(protected)/item/_components/CountDialogs'
import { ItemEditForm, EMPTY_ITEM_EDIT_FORM } from '@/app/(protected)/item/_components/ItemEditForm'
import ItemDetailModal from '@/app/(protected)/item/_components/ItemDetailModal'
import HistoryPanel from '@/app/(protected)/item/_components/HistoryPanel'
import { TrainingGuideModal } from './_components/TrainingGuideModal'

const AliasWidePage = dynamic(() => import('../../aliases/wide/page'), { ssr: false })
const ServiceMatchesPage = dynamic(() => import('../../matches/wide/page'), { ssr: false })
const NewItemForm = dynamic(() => import('../../item/_components/NewItemForm'), { ssr: false })
// Sales/Bills/Loss by Date -- folded into Live Sale's own switcher (same
// treatment Count 2 and Log got) since none of them had anything left
// that justified a separate sidebar destination once the "New Sale" flow
// was dropped and the classic Sales list's own tap-a-sale case moved here.
const SalesTab = dynamic(() => import('../../item/_components/SalesTab'), { ssr: false })
const BillsTab = dynamic(() => import('../../item/_components/BillsTab'), { ssr: false })
const NewBillForm = dynamic(() => import('../../bills/new/page'), { ssr: false })
const SalesAnalyticsSection = dynamic(() => import('../../item/_components/SalesAnalyticsSection'), { ssr: false })
const BillsAnalyticsSection = dynamic(() => import('../../item/_components/BillsAnalyticsSection'), { ssr: false })
// Live/Log share one analytics view (same underlying tap data); Count
// Records (which folded in the old Loss by Date feed) gets its own, backed
// by the same reconciliation computeReconciliation() in lib/lossEvents.ts
// computes for every count.
const LiveSaleAnalyticsSection = dynamic(() => import('../../item/_components/LiveSaleAnalyticsSection'), { ssr: false })
const LossFeedAnalyticsSection = dynamic(() => import('../../item/_components/LossFeedAnalyticsSection'), { ssr: false })

type Item = { id: number; name: string; group: string | null; soh: number; selling_price: string | number; cost_price: string | number; product_type: string | null; count_interval?: string | null }
type Tap = { id: number; item_id: number; item_name: string; price: number | string; staff_name: string; tapped_at: string; undone: boolean; receipt_id?: number; quantity: number; soh?: number | null }
type FlagLaw = { key: string; label: string; description?: string; count: number; active?: boolean; onViewClick?: () => void }
type ViolationType = { key: string; label: string; description?: string }
// Sale mode's due-count queues -- same shape /api/stock/daily,
// /api/stock/gmc-weekly and /api/stock/overdue already return for CountsTab.
type DueItem = { item_id: number; item_name: string; cf_group: string | null; calculated_soh: number; last_count_date: string | null; days_overdue: number | null }
// The Log tab's Count view -- same shape /api/stock/counts already returns
// for CountsTab's own history table. expected/loss_qty/loss_amt/kind are the
// same reconciliation Loss by Date used to compute on its own -- folded in
// here (see reconciliationByCount in lib/lossEvents.ts) instead of keeping a
// second tab walking the same stock_counts rows separately.
type CountRecord = { id: number; item_id: number | null; item_name: string; count_date: string; quantity_counted: string; notes: string | null; counted_by: string | null; counted_at: string | null; source: string | null; cf_group: string | null; expected: number | null; loss_qty: number | null; loss_amt: number | null; kind: 'loss' | 'gain' | null }

function fmtN(v: number) { return v % 1 === 0 ? String(v) : v.toFixed(2) }

function formatPrice(num: number | string): string {
  const n = Number(num)
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)
}

// The Log tab's Gap column -- minutes between two clock times, shown as
// "12m" under an hour or "1h05" past it. Negative gaps (a clock-in/out
// entered wrong, or a tap logged before the shop's own opening time) show
// as "-12m" rather than being hidden, since that itself is worth noticing.
function formatGapMins(mins: number): string {
  const sign = mins < 0 ? '-' : ''
  const abs = Math.round(Math.abs(mins))
  if (abs < 60) return `${sign}${abs}m`
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${sign}${h}h${m ? String(m).padStart(2, '0') : ''}`
}

// lgAmt is the NET loss/gain in cedis (positive = net loss, negative = net
// gain -- same sign convention Item 360's own loss table uses); lossCount/
// gainCount are how many separate days came up short/over, each
// independent of the other and of lgAmt's net sign (a item can have both
// loss days and gain days that partly offset into one net figure).
function formatLoss(l: { lossCount: number; lgAmt: number; gainCount?: number } | undefined): { text: string; cls: string } {
  const count = l?.lossCount ?? 0
  const amt = l?.lgAmt ?? 0
  const gainCount = l?.gainCount ?? 0
  const fmtAmt = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2))
  const gainSuffix = gainCount > 0 ? ` · Gain ${gainCount}` : ''
  if (count === 0 && amt === 0 && gainCount === 0) return { text: 'No loss', cls: 'text-gray-400' }
  if (amt > 0) return { text: `Loss ${count} · -₵${fmtAmt(amt)}${gainSuffix}`, cls: 'text-red-500 font-semibold' }
  if (amt < 0) return { text: `Loss ${count} · +₵${fmtAmt(Math.abs(amt))}${gainSuffix}`, cls: 'text-green-600 font-semibold' }
  return { text: `Loss ${count}${gainSuffix}`, cls: 'text-gray-400' }
}

export default function LiveSalePage(props: any = {}) {
  console.log('LiveSalePage mounted with new item picker')
  usePresenceReporter('live-tapping a sale')
  const { data: session } = useSession()
  const canDeleteCounts = isOwnerLevel(session?.user as any)

  const {
    lawsPanel: incomingLawsPanel, hideTopControls = false,
    violationCounts = {}, violationTypes = [], serviceGroups = [], itemsWithViolations = {},
    // Sales'/Bills' own violation flag types -- same treatment as Items'
    // violationTypes above, just a separate array since each set only
    // makes sense (and only knows how to filter) its own embedded tab.
    salesViolationTypes = [], billsViolationTypes = [],
    // Seeded from an item's detail popup ("click a date" in its loss
    // table, opened in a new tab) -- lands on the Sales tab with that
    // receipt jumped to and highlighted.
    jumpToReceiptDate = null, jumpToReceiptItemName = null, onReceiptJumpDone,
    productTypeFilter: controlledProductTypeFilter, onProductTypeFilterChange,
    groupFilter: controlledGroupFilter, onGroupFilterChange,
    showHelpModal: controlledShowHelpModal, onHelpModalChange,
    expanded: controlledExpanded, setExpanded: onExpandedChange,
    hideFilterBar = false,
    searchSlotEl = null,
    // Portal target for the mode switcher -- kept separate from
    // searchSlotEl so the host page (Item page) can pin it to its own top
    // row instead of it sharing space with the search box/laws/help/expand
    // icons, where it used to wrap onto a second line.
    modeToggleSlotEl = null,
    // Portal target for the Sale-mode item filter (saleFilter below) -- same
    // reasoning as searchSlotEl: the host page merges its own type/group
    // select row, so this rides along in that same row instead of adding a
    // fourth line of its own underneath it.
    filterSlotEl = null,
    // Every "open Live Sale on a specific tab" deep link -- the "Sale Log"
    // search result (jumpToTab: 'log'), "Fix now: Sales/Bills" buttons, a
    // Sales/Bills violation pill (jumpToTab + jumpToTabViolation), and a
    // global-search Sales/Bills result (jumpToTab + jumpToTabSearch) all
    // land here. jumpToTabSeq is a plain incrementing counter, not a
    // boolean, so a second jump to the same tab still fires (a boolean/
    // string prop that repeats its value wouldn't re-trigger the effect
    // below).
    jumpToTabSeq = 0,
    jumpToTab = null,
    jumpToTabViolation = null,
    jumpToTabSearch = null,
  } = props
  const compactSearch = !!searchSlotEl

  const [allItems, setAllItems] = useState<Item[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [taps, setTaps] = useState<Tap[]>([])
  // Shop opening/last-sign-out clock times per date -- backs the Log tab's
  // Gap column for the first/last tap of each day (see dayBounds effect
  // below and /api/staff-times/day-bounds).
  const [dayBounds, setDayBounds] = useState<Record<string, { openTime: string | null; closeTime: string | null }>>({})
  const [saleType, setSaleType] = useState<'WIC' | 'GMC'>('WIC')
  const [error, setError] = useState('')
  // Tapping an item's name opens its full Item 360 detail (loss/gain
  // history, pack-chain, aliases, merge) as its own popup -- separate from
  // selectedItem/the sale-tap sheet, since the two can be open from
  // different rows at once with no relationship to each other.
  const [viewingItemId, setViewingItemId] = useState<number | null>(null)
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
  // Editing the selected item's own fields -- opened from an "Edit" button
  // inside the same sale-tap sheet instead of navigating to Item 360, so a
  // quick price/group/count-cadence fix doesn't require leaving the sheet
  // (or the item picked for a sale). Swaps the sheet's body to the edit
  // form in place; Cancel returns to the normal sale/count view without
  // closing the sheet.
  const [editingSelectedItem, setEditingSelectedItem] = useState(false)
  const [editForm, setEditForm] = useState(EMPTY_ITEM_EDIT_FORM)
  const [editCurrentCountInterval, setEditCurrentCountInterval] = useState<string | null>(null)
  const [editCurrentSoh, setEditCurrentSoh] = useState<number | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [internalShowHelpModal, setInternalShowHelpModal] = useState(false)
  const showHelpModal = controlledShowHelpModal ?? internalShowHelpModal
  const setShowHelpModal = onHelpModalChange ?? setInternalShowHelpModal
  // "Large screen" -- breaks the whole tab out of the host page's layout
  // (sidebar, content padding) into a fixed fullscreen overlay. The toggle
  // button itself lives in the host page's own merged bar (see item/page.tsx),
  // so it always comes in as a controlled prop there; the internal fallback
  // only matters when this page is visited directly at /sales/live.
  const [internalExpanded, setInternalExpanded] = useState(false)
  const expanded = controlledExpanded ?? internalExpanded
  const setExpanded = onExpandedChange ?? setInternalExpanded
  const rootClassName = `bg-white flex flex-col ${expanded ? 'fixed inset-0 z-50 overflow-y-auto' : 'h-full'}`
  const [currentView, setCurrentView] = useState<{ kind: 'violation' | 'serviceGroup' | 'lossByItem' | 'aliasWide' | 'serviceMatches' | 'newItem' | 'dailySummary'; key?: string; group?: string } | null>(null)
  const [violations, setViolations] = useState<Record<string, number>>({})
  // Sale mode's own item-grid filter -- Loss/Gain (from lossByItemId below)
  // and Low SOH (item.soh <= 0) are plain buckets; 'interval' reuses each
  // item's own count_interval string (the same Daily/Every Nd/Not counted
  // labels the Count tab's countIntervalFlags buckets by) so a cadence
  // bucket here can never drift out of sync with the Count tab's own.
  const [saleFilter, setSaleFilter] = useState<{ kind: 'loss' } | { kind: 'gain' } | { kind: 'soh' } | { kind: 'interval'; label: string } | null>(null)
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
  // Sales/Bills/Loss by Date/Loss by Target each kept their own laws/notes/
  // tasks under their own scopeKey (from back when each was its own page) --
  // still sitting in the database under those same scope keys, so each tab
  // gets its own laws icon here to reach them, same as Sale mode's own.
  const salesLaws = useLawsPanel('showSalesLaws')
  const billsLaws = useLawsPanel('showBillsLaws')
  const lossByTargetLaws = useLawsPanel('showLossByTargetLaws')

  // The standalone "Count" mode (its own due-count queues/badges/entry-form
  // as a second grid mode) was removed once Sale mode grew its own pinned
  // "COUNT NOW" block and inline count field for due items (below) -- those
  // don't depend on this mode existing, they're Sale-mode-native. 'log' is
  // the other original tab sharing this switcher -- what used to be a
  // separate showLog boolean, folded in as a tab rather than its own
  // sidebar destination since it's just history of Sale mode's own
  // actions. Count 2 (the full old standalone Counts page) was a third
  // tab here until its own History/Analytics/free-form counting no longer
  // had anything Sale mode's due-item treatment and Log tab didn't already
  // cover, and it was removed along with the Loss by Item page. 'sales'/
  // 'bills'/'lossByTarget' followed once the classic Sales Receipts list,
  // Bills, and Loss by Target lost anything that justified a separate
  // sidebar destination once "New Sale" was dropped. Loss by Date's own
  // 'feed' mode followed the same way once its data turned out to be a
  // filtered view of Count's own Count Records (see countRecordFilter) --
  // folded in as extra columns there instead of a fourth tab walking the
  // same stock_counts rows a second time.
  const [mode, setMode] = useState<'sale' | 'sales' | 'bills' | 'lossByTarget' | 'log' | 'count'>('sale')
  const [salesViolationFilter, setSalesViolationFilter] = useState<string | null>(null)
  const [billsViolationFilter, setBillsViolationFilter] = useState<string | null>(null)
  // Count tab's own local navigation -- Daily/Every Nd/Dormant/etc, Count
  // Records, and Count History used to only be reachable through the laws
  // panel (as currentView kinds); moved to their own tab with this simpler
  // local state instead of reusing currentView, since that's Sale mode's
  // own overlay mechanism and these views no longer belong there.
  // Defaults to Count Records -- that's the landing view for the Count tab,
  // since a raw list of "what's due" is less useful than seeing what's
  // actually been counted until you pick a specific category to drill into.
  const [countView, setCountView] = useState<{ kind: 'interval'; label: string } | { kind: 'records' } | { kind: 'history' } | null>({ kind: 'records' })
  const [embeddedSearch, setEmbeddedSearch] = useState('')
  useEffect(() => {
    if (!jumpToTabSeq || !jumpToTab) return
    setMode(jumpToTab)
    setSalesViolationFilter(jumpToTab === 'sales' ? jumpToTabViolation : null)
    setBillsViolationFilter(jumpToTab === 'bills' ? jumpToTabViolation : null)
    // The 'gains' violation pill is the one way the old Loss by Date's own
    // filter (not a violation key it understands) needs setting on arrival
    // -- every other loss-feed jump defaults back to the Losses side, into
    // Count Records rather than the interval buckets.
    if (jumpToTab === 'count') {
      setCountView({ kind: 'records' })
      setCountRecordFilter(jumpToTabViolation === 'gains' ? 'gain' : 'loss')
    }
    setEmbeddedSearch(jumpToTabSearch ?? '')
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
  const [editingCountId, setEditingCountId] = useState<number | null>(null)
  const [editCountQty, setEditCountQty] = useState('')
  const [editCountNotes, setEditCountNotes] = useState('')
  const [editCountSaving, setEditCountSaving] = useState(false)
  // Count Records' All/Losses/Gains filter -- the old Loss by Date tab's own
  // Losses/Gains toggle, now scoped down to a filter on the same table
  // instead of a second table walking the same rows.
  const [countRecordFilter, setCountRecordFilter] = useState<'all' | 'loss' | 'gain'>('all')
  // Bills has no internal "add new" of its own (unlike Sales, which this
  // is a tap-to-sell page already covers) -- it always relied on this
  // page rendering NewBillForm as a sibling, so that comes along with it.
  const [billsAddingNew, setBillsAddingNew] = useState(false)
  const [salesShowAnalytics, setSalesShowAnalytics] = useState(false)
  const [billsShowAnalytics, setBillsShowAnalytics] = useState(false)
  const [liveShowAnalytics, setLiveShowAnalytics] = useState(false)
  const [logShowAnalytics, setLogShowAnalytics] = useState(false)
  const [countShowAnalytics, setCountShowAnalytics] = useState(false)

  const groups = useMemo(() => {
    const uniqueGroups = new Set<string>()
    for (const item of allItems) {
      if (item.group) {
        uniqueGroups.add(item.group)
      }
    }
    return Array.from(uniqueGroups).sort()
  }, [allItems])

  // SalesTab/BillsTab expect items shaped {id, item_name, cf_group} -- this
  // page's own item list already uses {id, name, group} for everything
  // else, so this is just a field-name adapter, not a different data
  // source (same trick countsTabItems used to use for CountsTab).
  const salesBillsItems = useMemo(
    () => allItems.map(i => ({ id: i.id, item_name: i.name, cf_group: i.group })),
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

  // One view per distinct count-interval label actually in use (Daily,
  // Every 7d, Every 15d, Every 30d, Not counted, or any custom override
  // someone's set on an item's edit form -- the set isn't fixed to just
  // those, since count_cadence_days is a free-form number). Built from
  // allItems rather than catalogueItems so the counts don't shrink/shift
  // as other filters (product type, group, WIC/GMC) get applied.
  const countIntervalFlags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const it of allItems) {
      if (!it.count_interval) continue
      counts.set(it.count_interval, (counts.get(it.count_interval) ?? 0) + 1)
    }
    const sortKey = (label: string) => {
      if (label === 'Daily') return -1
      if (label === 'Not counted') return Infinity
      const m = label.match(/^Every (\d+)d$/)
      return m ? Number(m[1]) : 999998
    }
    return Array.from(counts.entries())
      .sort(([a], [b]) => sortKey(a) - sortKey(b))
      .map(([label, count]) => ({
        key: `count_interval_${label}`,
        label,
        count,
        active: countView?.kind === 'interval' && countView.label === label,
        onViewClick: () => {
          setCountView(countView?.kind === 'interval' && countView.label === label
            ? null
            : { kind: 'interval' as const, label })
        }
      }))
  }, [allItems, countView])

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
    // Sales'/Bills' own violation flags -- unlike the Items ones above,
    // clicking one switches the whole tab (there's no "filter the current
    // grid" option once you're on a different mode's data entirely), and
    // sets that tab's own violation filter instead of currentView.
    ...salesViolationTypes.map((v: ViolationType) => ({
      key: v.key,
      label: v.label,
      description: v.description,
      count: violationCounts[v.key] ?? 0,
      active: mode === 'sales' && salesViolationFilter === v.key,
      onViewClick: () => {
        if (mode === 'sales' && salesViolationFilter === v.key) { setSalesViolationFilter(null); return }
        setMode('sales')
        setSalesViolationFilter(v.key)
      }
    })),
    ...billsViolationTypes.map((v: ViolationType) => ({
      key: v.key,
      label: v.label,
      description: v.description,
      count: violationCounts[v.key] ?? 0,
      active: mode === 'bills' && billsViolationFilter === v.key,
      onViewClick: () => {
        if (mode === 'bills' && billsViolationFilter === v.key) { setBillsViolationFilter(null); return }
        setMode('bills')
        setBillsViolationFilter(v.key)
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
    },
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

  // Loss count/amount per item -- same numbers Item 360's own loss ranking
  // is built from (/api/losses/summary), shown inline next to price/cost/
  // stock/count-interval so a loss-prone item is visible without opening
  // its Item 360 detail. Fetched once, same as the GMC id set above.
  const [lossByItemId, setLossByItemId] = useState<Map<number, { lossCount: number; lgAmt: number; gainCount: number }>>(new Map())
  useEffect(() => {
    fetch('/api/losses/summary')
      .then(r => r.json())
      .then((d: { item_id: number; lossCount: number; lgAmt: number; gainCount: number }[]) => {
        setLossByItemId(new Map(Array.isArray(d) ? d.map(r => [r.item_id, { lossCount: r.lossCount, lgAmt: r.lgAmt, gainCount: r.gainCount }]) : []))
      })
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

  // Count Records -- fetched only once it's actually being looked at, via
  // Count tab's own "Count Records" view (see renderCountRecordsTable),
  // unlike the queues above (this is the full all-time history, not a
  // small due-today list). The Log tab dropped its own Count view since
  // it's the same table, reachable from the Count tab instead.
  const viewingCountRecords = countView?.kind === 'records'
  useEffect(() => {
    if (!viewingCountRecords) return
    fetch('/api/stock/counts')
      .then(r => r.json())
      .then(d => setCountRecords(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [viewingCountRecords])

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

  // Options for Sale mode's own item-grid filter (saleFilter above) -- Loss/
  // Gain/Low SOH plus one per count-interval label currently in use, same
  // buckets and sort order as the Count tab's countIntervalFlags so the two
  // read consistently even though they're built for different modes.
  const saleFilterFlags = useMemo(() => {
    const lossCount = allItems.filter(it => (lossByItemId.get(it.id)?.lossCount ?? 0) > 0).length
    const gainCount = allItems.filter(it => (lossByItemId.get(it.id)?.gainCount ?? 0) > 0).length
    const sohCount = allItems.filter(it => it.soh <= 0).length

    const intervalCounts = new Map<string, number>()
    for (const it of allItems) {
      if (!it.count_interval) continue
      intervalCounts.set(it.count_interval, (intervalCounts.get(it.count_interval) ?? 0) + 1)
    }
    const sortKey = (label: string) => {
      if (label === 'Daily') return -1
      if (label === 'Not counted') return Infinity
      const m = label.match(/^Every (\d+)d$/)
      return m ? Number(m[1]) : 999998
    }
    const intervalFlags = Array.from(intervalCounts.entries())
      .sort(([a], [b]) => sortKey(a) - sortKey(b))
      .map(([label, count]) => ({ key: `interval_${label}`, label, count }))

    return [
      { key: 'loss', label: '🔻 Loss', count: lossCount },
      { key: 'gain', label: '🔺 Gain', count: gainCount },
      { key: 'soh', label: 'Low SOH', count: sohCount },
      ...intervalFlags,
    ]
  }, [allItems, lossByItemId])

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

    // Apply Sale mode's own Loss/Gain/SOH/count-interval filter
    if (saleFilter?.kind === 'loss') {
      filtered = filtered.filter(item => (lossByItemId.get(item.id)?.lossCount ?? 0) > 0)
    } else if (saleFilter?.kind === 'gain') {
      filtered = filtered.filter(item => (lossByItemId.get(item.id)?.gainCount ?? 0) > 0)
    } else if (saleFilter?.kind === 'soh') {
      filtered = filtered.filter(item => item.soh <= 0)
    } else if (saleFilter?.kind === 'interval') {
      filtered = filtered.filter(item => item.count_interval === saleFilter.label)
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
  }, [allItems, salesCounts, currentView, productTypeFilter, groupFilter, pickedItemId, saleType, gmcItemIds, mode, saleFilter, lossByItemId])

  // Log tab's two histories, grouped by date -- computed unconditionally
  // (not inside the `if (mode === 'log')` branch below) since React
  // requires the same hooks to run on every render of this component;
  // Sale and Log both live in one mounted instance switched by `mode`, so
  // a useMemo that only ran while mode==='log' would change the hook
  // count the moment you switched tabs and crash the page.
  const tapsByDate = useMemo(() => {
    const groups = new Map<string, typeof taps>()
    for (const tap of taps) {
      const date = tap.tapped_at.slice(0, 10)
      if (!groups.has(date)) groups.set(date, [])
      groups.get(date)!.push(tap)
    }
    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a))
  }, [taps])

  // Shop open/close bounds for the Log tab's Gap column -- only fetched
  // while Log is actually being looked at (same "not until it's viewed"
  // treatment as Count Records below), and only for dates not already
  // fetched, so switching back to Log after the first time doesn't refetch
  // every date again.
  useEffect(() => {
    if (mode !== 'log') return
    const dates = tapsByDate.map(([date]) => date).filter(d => !(d in dayBounds))
    if (!dates.length) return
    fetch(`/api/staff-times/day-bounds?dates=${dates.join(',')}`)
      .then(r => r.json())
      .then((d: { date: string; openTime: string | null; closeTime: string | null }[]) => {
        if (!Array.isArray(d)) return
        setDayBounds(prev => {
          const next = { ...prev }
          for (const row of d) next[row.date] = { openTime: row.openTime, closeTime: row.closeTime }
          return next
        })
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, tapsByDate])

  const countsByDate = useMemo(() => {
    const q = embeddedSearch.trim().toLowerCase()
    const filtered = countRecords.filter(rec => {
      if (countRecordFilter === 'loss' && rec.kind !== 'loss') return false
      if (countRecordFilter === 'gain' && rec.kind !== 'gain') return false
      if (q && !rec.item_name.toLowerCase().includes(q)) return false
      return true
    })
    const groups = new Map<string, typeof countRecords>()
    for (const rec of filtered) {
      const date = rec.count_date.slice(0, 10)
      if (!groups.has(date)) groups.set(date, [])
      groups.get(date)!.push(rec)
    }
    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a))
  }, [countRecords, countRecordFilter, embeddedSearch])

  // All-Time/Yesterday/This Week/Month/Year loss totals -- same period
  // summary the old Loss by Date tab pinned above its own table, computed
  // from every record regardless of countRecordFilter/search so it always
  // reads as the whole picture, not whatever's currently filtered in view.
  const countLossSummary = useMemo(() => {
    const fmtLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const today0 = new Date(); today0.setHours(0, 0, 0, 0)
    const y = new Date(today0); y.setDate(y.getDate() - 1)
    const weekStart = new Date(today0); weekStart.setDate(weekStart.getDate() - ((today0.getDay() + 6) % 7))
    const monthStart = `${today0.getFullYear()}-${String(today0.getMonth() + 1).padStart(2, '0')}-01`
    const yearStart = `${today0.getFullYear()}-01-01`
    const yesterday = fmtLocal(y), ws = fmtLocal(weekStart)
    const losses = countRecords.filter(r => r.kind === 'loss')
    const agg = (pred: (d: string) => boolean) => {
      const list = losses.filter(r => pred(r.count_date.slice(0, 10)))
      return { n: list.length, amt: parseFloat(list.reduce((s, r) => s + (r.loss_amt ?? 0), 0).toFixed(2)) }
    }
    return [
      { label: 'All-Time', period: agg(() => true) },
      { label: 'Yesterday', period: agg(d => d === yesterday) },
      { label: 'This Week', period: agg(d => d >= ws) },
      { label: 'This Month', period: agg(d => d >= monthStart) },
      { label: 'This Year', period: agg(d => d >= yearStart) },
    ]
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

  // Groups/conversion-target list ItemEditForm needs, derived from the
  // catalogue Live Sale already has loaded rather than a separate fetch.
  const editGroups = useMemo(() =>
    Array.from(new Set(allItems.map(i => i.group).filter((g): g is string => !!g))).sort()
  , [allItems])
  const editAllItemsList = useMemo(() =>
    allItems.map(i => ({ item_id: i.id, item_name: i.name }))
  , [allItems])

  // The sale-tap sheet's own Item fields don't carry cf_group/units_per_pack/
  // unit_name/converts_to_item_id/count_excluded/count_cadence_days (not
  // needed for tapping a sale), so opening the edit form fetches the full
  // item record the same way LossTab's ItemEditForm does.
  async function startEditSelectedItem() {
    if (!selectedItem) return
    setEditingSelectedItem(true)
    setEditError('')
    setEditLoading(true)
    setEditCurrentCountInterval(null)
    setEditCurrentSoh(null)
    setCountQty('')
    setCountError('')
    try {
      const r = await fetch(`/api/items/${selectedItem.id}`)
      const d = await r.json()
      setEditForm({
        item_name: d?.canonical_name ?? selectedItem.name,
        cf_group: d?.cf_group ?? '',
        selling_rate: d?.selling_price != null ? String(d.selling_price) : '',
        purchase_rate: d?.purchase_rate != null ? String(d.purchase_rate) : '',
        units_per_pack: d?.units_per_pack != null ? String(d.units_per_pack) : '',
        unit_name: d?.unit_name ?? '',
        converts_to_item_id: d?.converts_to_item_id ? String(d.converts_to_item_id) : '',
        count_excluded: !!d?.count_excluded,
        count_cadence_days: d?.count_cadence_days != null ? String(d.count_cadence_days) : '',
        count_excluded_reason: d?.count_excluded_reason ?? '',
      })
      setEditCurrentCountInterval(d?.count_interval ?? null)
      setEditCurrentSoh(d?.calculated_soh != null ? parseFloat(d.calculated_soh) : null)
    } catch {
      setEditError('Could not load item details.')
    }
    setEditLoading(false)
  }

  async function saveEditSelectedItem() {
    if (!selectedItem) return
    setEditSaving(true)
    setEditError('')
    const res = await fetch(`/api/items/${selectedItem.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_name: editForm.item_name || undefined,
        cf_group: editForm.cf_group || null,
        selling_rate: editForm.selling_rate ? parseFloat(editForm.selling_rate) : null,
        purchase_rate: editForm.purchase_rate ? parseFloat(editForm.purchase_rate) : null,
        units_per_pack: editForm.units_per_pack ? parseFloat(editForm.units_per_pack) : null,
        unit_name: editForm.unit_name || null,
        converts_to_item_id: editForm.converts_to_item_id ? Number(editForm.converts_to_item_id) : null,
        count_excluded: editForm.count_excluded,
        count_cadence_days: editForm.count_cadence_days ? parseInt(editForm.count_cadence_days, 10) : null,
        count_excluded_reason: editForm.count_excluded_reason || null,
      }),
    })
    setEditSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => null)
      setEditError(d?.error ?? 'Could not save changes.')
      return
    }
    const updated = await res.json()
    const itemId = selectedItem.id
    setSelectedItem(prev => prev && prev.id === itemId ? {
      ...prev,
      name: updated.item_name ?? prev.name,
      selling_price: updated.selling_rate ?? prev.selling_price,
      cost_price: updated.purchase_rate ?? prev.cost_price,
    } : prev)
    // Refetch the full catalogue so this item's price/group/count-interval
    // label update everywhere else in Live Sale (grid, other views), not
    // just inside this sheet.
    fetch('/api/items/all').then(r => r.json()).then(d => setAllItems(Array.isArray(d) ? d : [])).catch(() => {})
    setEditingSelectedItem(false)
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

  // The tab switcher shared by every mode's own header, so jumping between
  // any two of them doesn't require detouring back through the grid first.
  function renderModeToggle(compact: boolean) {
    const btnCls = (active: boolean, color: string) =>
      `font-bold rounded-md transition whitespace-nowrap shrink-0 ${compact ? 'px-1.5 py-1 text-[10px]' : 'px-2 py-1 text-xs'} ${
        active ? `${color} text-white` : 'text-gray-500 hover:text-gray-700'
      }`
    // Always one line -- scrolls horizontally rather than wrapping onto a
    // second row when there isn't room for all six buttons.
    return (
      <div className="flex bg-gray-200 rounded-lg p-0.5 overflow-x-auto max-w-full">
        <button type="button" onClick={() => setMode('sale')} title="Live Sale" className={btnCls(mode === 'sale', 'bg-blue-600')}>Live</button>
        <button type="button" onClick={() => setMode('log')} title="Log" className={btnCls(mode === 'log', 'bg-gray-700')}>Log</button>
        <button type="button" onClick={() => setMode('sales')} title="Sales" className={btnCls(mode === 'sales', 'bg-emerald-600')}>Sales</button>
        <button type="button" onClick={() => setMode('bills')} title="Bills" className={btnCls(mode === 'bills', 'bg-orange-600')}>Bills</button>
        <button type="button" onClick={() => setMode('lossByTarget')} title="Loss by Target" className={btnCls(mode === 'lossByTarget', 'bg-pink-600')}>Loss by Tgt</button>
        <button type="button" onClick={() => setMode('count')} title="Count" className={btnCls(mode === 'count', 'bg-indigo-600')}>Count</button>
      </div>
    )
  }

  // The switcher's permanent home -- its own top row, above every tab's own
  // header/filter bar, identical on all six tabs. Portaled into
  // modeToggleSlotEl instead when the host page (Item page) supplies one,
  // so it can pin the switcher to its own top row in the merged bar. In
  // "Large screen" mode this page's own root goes `fixed inset-0`, covering
  // the host page entirely -- modeToggleSlotEl still lives in the (now
  // hidden-behind-the-overlay) host page, so the portal target is useless
  // then and this renders its own row instead, same as when there's no
  // slot at all.
  function renderModeToggleRow() {
    return (<>
      {(!modeToggleSlotEl || expanded) && (
        <div className="px-2 py-1.5 border-b border-gray-200 bg-gray-50 overflow-x-auto shrink-0">
          {renderModeToggle(false)}
        </div>
      )}
      {modeToggleSlotEl && !expanded && createPortal(renderModeToggle(true), modeToggleSlotEl)}
    </>)
  }

  // The count records table -- also doubles as the old Loss by Date feed
  // (see countRecordFilter/countLossSummary above), since that was always
  // just this same stock_counts history with the reconciliation columns
  // (Expected/Loss-Gain) added and filtered to the discrepancy rows.
  function renderCountRecordsTable() {
    const COUNT_RECORDS_GRID = 'grid-cols-[minmax(7rem,1.4fr)_5rem_3rem_4rem_4rem_4rem_5rem_4rem_minmax(6rem,1fr)_5.5rem]'
    return (
      <div className="flex-1 overflow-auto">
        {countsByDate.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            {countRecords.length === 0 ? 'No counts recorded' : 'No counts match the current filter/search'}
          </p>
        ) : (
          <div className="inline-block min-w-full">
            {/* Item is frozen (sticky left-0), matching every data row
                below, so it's still visible after scrolling right through
                the narrower compact columns. */}
            <div className={`grid ${COUNT_RECORDS_GRID} gap-0 bg-gray-50 border-b border-gray-200 sticky top-0 z-10`}>
              <div className="sticky left-0 z-10 bg-gray-50 px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase">Item</div>
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase">Group</div>
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase text-center">Qty</div>
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase text-center" title="What the records expected on this day">Exp</div>
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase text-center" title="Expected minus counted -- a loss when positive, a gain when negative">Loss/Gain</div>
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase text-center">Time</div>
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase">By</div>
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase">Source</div>
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase">Notes</div>
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase text-right">Actions</div>
            </div>
            {countsByDate.map(([date, dateRecs]) => (
              <div key={date}>
                <div className={`grid ${COUNT_RECORDS_GRID} gap-0 bg-amber-50 border-b border-amber-200 sticky top-[26px] z-9`}>
                  <div className="col-span-10 px-2 py-1 text-[10px] font-semibold text-amber-700">
                    {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {dateRecs.length} counted
                  </div>
                </div>
                {dateRecs.map(rec => (
                  <div key={rec.id}>
                    <div className={`group grid ${COUNT_RECORDS_GRID} gap-0 border-b border-gray-100 items-center hover:bg-gray-50 transition`}>
                      <div className="sticky left-0 z-[1] bg-white group-hover:bg-gray-50 px-2 py-1">
                        <p className="text-xs font-semibold text-gray-900 truncate">{rec.item_name}</p>
                      </div>
                      <div className="px-2 py-1">
                        <p className="text-xs text-gray-600 truncate">{rec.cf_group ?? '—'}</p>
                      </div>
                      <div className="px-2 py-1 text-center">
                        <p className="text-xs font-semibold text-gray-900">{Number(rec.quantity_counted)}</p>
                      </div>
                      <div className="px-2 py-1 text-center">
                        <p className="text-xs text-gray-500">{rec.expected != null ? fmtN(rec.expected) : '—'}</p>
                      </div>
                      <div className="px-2 py-1 text-center">
                        {rec.kind ? (
                          <p className={`text-xs font-bold ${rec.kind === 'loss' ? 'text-red-600' : 'text-amber-600'}`}>
                            {rec.kind === 'loss' ? '-' : '+'}{fmtN(Math.abs(rec.loss_qty ?? 0))}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-300">{rec.expected != null ? '0' : '—'}</p>
                        )}
                      </div>
                      <div className="px-2 py-1 text-center">
                        <p className="text-xs text-gray-500">{fmtTime(rec.counted_at) || '—'}</p>
                      </div>
                      <div className="px-2 py-1">
                        <p className="text-xs text-blue-600 font-medium truncate">{rec.counted_by ?? '—'}</p>
                      </div>
                      <div className="px-2 py-1">
                        <p className="text-xs text-gray-500 truncate">{rec.source ?? '—'}</p>
                      </div>
                      <div className="px-2 py-1">
                        <p className="text-xs text-gray-500 italic truncate">{rec.notes ?? '—'}</p>
                      </div>
                      <div className="px-2 py-1">
                        <div className="flex gap-1 justify-end whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => editingCountId === rec.id ? setEditingCountId(null) : startEditCount(rec)}
                            className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded-full hover:bg-blue-100 transition"
                          >
                            {editingCountId === rec.id ? 'Close' : 'Edit'}
                          </button>
                          {canDeleteCounts && (
                            <button
                              type="button"
                              onClick={() => deleteCountRecord(rec)}
                              className="text-[10px] text-red-600 font-semibold bg-red-50 px-1.5 py-0.5 rounded-full hover:bg-red-100 transition"
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
    )
  }

  // Log tab
  if (mode === 'log') {
    return (
      <>
      <div className={rootClassName}>
        {renderModeToggleRow()}
        <div className="flex justify-end px-1.5 py-1 border-b border-gray-100">
          <button
            type="button"
            onClick={() => setLogShowAnalytics(a => !a)}
            title="Analytics"
            className={`shrink-0 font-bold rounded-lg px-2 py-1 text-[10px] transition ${
              logShowAnalytics ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            📊
          </button>
        </div>
        {logShowAnalytics ? (
          <div className="px-3 pt-3 flex-1 overflow-auto"><LiveSaleAnalyticsSection /></div>
        ) : (
        <div className="flex-1 overflow-auto">
          {taps.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No sales recorded</p>
          ) : (
            <div>
              {/* Fixed, deliberately tiny column widths (not fr units) plus
                  zero padding between cells -- the point is fitting all 8
                  columns on screen at once with nothing to scroll. Item is
                  still frozen (sticky left-0) as a safety net for very
                  narrow screens or long item names. */}
              <div className="grid grid-cols-[minmax(3.5rem,1fr)_2.5rem_2.75rem_2rem_1.25rem_2.25rem_1.5rem_2.25rem_1.5rem] gap-0 h-[14px] bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                <div className="sticky left-0 z-10 flex items-center bg-gray-50 px-0.5 text-[8px] leading-none font-semibold text-gray-600 uppercase truncate">Item</div>
                <div className="flex items-center justify-end px-0.5 text-[8px] leading-none font-semibold text-gray-600 uppercase">Total</div>
                <div className="flex items-center justify-center px-0.5 text-[8px] leading-none font-semibold text-gray-600 uppercase">Time</div>
                <div className="flex items-center justify-end px-0.5 text-[8px] leading-none font-semibold text-gray-600 uppercase">SP</div>
                <div className="flex items-center justify-center px-0.5 text-[8px] leading-none font-semibold text-gray-600 uppercase">Qty</div>
                <div className="flex items-center px-0.5 text-[8px] leading-none font-semibold text-gray-600 uppercase truncate">Staff</div>
                <div className="flex items-center justify-center px-0.5 text-[8px] leading-none font-semibold text-gray-600 uppercase">SOH</div>
                <div className="flex items-center justify-end px-0.5 text-[8px] leading-none font-semibold text-gray-600 uppercase" title="Time since the previous tap -- since shop opening for the day's first, until the last staff signed out for the day's last">Gap</div>
                <div className="px-0.5 text-[8px] leading-none font-semibold text-gray-600 uppercase" />
              </div>

              {/* Table rows grouped by date */}
              {tapsByDate.map(([date, dateTaps]) => {
                const dateTotal = dateTaps.filter(t => !t.undone).reduce((s, t) => s + Number(t.price) * t.quantity, 0)
                return (
                  <div key={date}>
                    {/* Date header */}
                    <div className="grid grid-cols-[minmax(3.5rem,1fr)_2.5rem_2.75rem_2rem_1.25rem_2.25rem_1.5rem_2.25rem_1.5rem] gap-0 h-[14px] bg-green-50 border-b border-green-200 sticky top-[14px] z-9">
                      <div className="col-span-9 flex items-center px-0.5 text-[8px] leading-none font-semibold text-green-700 truncate">
                        {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · Total: ₵{formatPrice(dateTotal)}
                      </div>
                    </div>

                    {/* Date's taps -- `group` + an explicit bg on the sticky
                        first cell (not bg-inherit) so scrolled-under columns
                        don't show through it, same fix as Item 360's table. */}
                    {/* Row height is min- rather than fixed now -- the Item
                        cell wraps to 2 lines (line-clamp-2) past ~20
                        characters instead of truncating, so a long name
                        doesn't need the column stretched wide to read it;
                        every other cell stays single-line and centers
                        within whatever height that Item cell grows the row to. */}
                    {dateTaps.map((tap, i) => {
                      // Gap = time since the previous (chronologically
                      // earlier) tap -- dateTaps is newest-first, so that's
                      // index i+1. The day's oldest tap (i at the end of the
                      // array) has no earlier tap to diff against, so it
                      // uses the shop's opening time instead; the day's
                      // newest tap (i === 0) additionally gets a second
                      // reading against when the last staff signed out,
                      // shown instead of its since-previous-tap gap since
                      // that's the more useful number for the final sale of
                      // the day.
                      const bounds = dayBounds[date]
                      const isOldest = i === dateTaps.length - 1
                      const isNewest = i === 0
                      let gapMins: number | null = null
                      if (isNewest && bounds?.closeTime) {
                        gapMins = (new Date(bounds.closeTime).getTime() - new Date(tap.tapped_at).getTime()) / 60000
                      } else if (isOldest && bounds?.openTime) {
                        gapMins = (new Date(tap.tapped_at).getTime() - new Date(bounds.openTime).getTime()) / 60000
                      } else {
                        const prevTap = dateTaps[i + 1]
                        if (prevTap) gapMins = (new Date(tap.tapped_at).getTime() - new Date(prevTap.tapped_at).getTime()) / 60000
                      }
                      return (
                      <div
                        key={tap.id}
                        className={`group grid grid-cols-[minmax(3.5rem,1fr)_2.5rem_2.75rem_2rem_1.25rem_2.25rem_1.5rem_2.25rem_1.5rem] gap-0 min-h-[15px] hover:bg-gray-50 transition ${
                          tap.undone ? 'bg-gray-50 opacity-60' : ''
                        }`}
                      >
                        <div className={`sticky left-0 z-[1] flex items-center px-0.5 group-hover:bg-gray-50 ${tap.undone ? 'bg-gray-50' : 'bg-white'}`}>
                          <span className={`text-[9px] leading-[1.1] font-semibold line-clamp-2 break-words ${tap.undone ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                            {tap.item_name}
                          </span>
                        </div>
                        <div className="flex items-center justify-end px-0.5">
                          <span className={`text-[9px] leading-none font-semibold truncate ${tap.undone ? 'text-gray-400' : 'text-blue-600'}`}>
                            ₵{formatPrice(Number(tap.price) * tap.quantity)}
                          </span>
                        </div>
                        <div className="flex items-center justify-center px-0.5">
                          <span className="text-[8px] leading-none text-gray-500 truncate">{new Date(tap.tapped_at).toLocaleTimeString()}</span>
                        </div>
                        <div className="flex items-center justify-end px-0.5">
                          <span className={`text-[9px] leading-none font-semibold truncate ${tap.undone ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                            ₵{formatPrice(tap.price)}
                          </span>
                        </div>
                        <div className="flex items-center justify-center px-0.5">
                          <span className={`text-[9px] leading-none font-semibold ${tap.undone ? 'text-gray-400' : 'text-gray-900'}`}>
                            {tap.quantity}
                          </span>
                        </div>
                        <div className="flex items-center px-0.5">
                          <span className="text-[9px] leading-none text-gray-600 truncate">{tap.staff_name}</span>
                        </div>
                        <div className="flex items-center justify-center px-0.5">
                          <span className="text-[9px] leading-none text-gray-500 truncate">{tap.soh !== null && tap.soh !== undefined ? Math.ceil(tap.soh) : '-'}</span>
                        </div>
                        <div className="flex items-center justify-end px-0.5" title={isNewest ? 'Until last sign-out' : isOldest ? 'Since shop opening' : 'Since previous tap'}>
                          <span className="text-[9px] leading-none text-gray-500 truncate">{gapMins !== null ? formatGapMins(gapMins) : '-'}</span>
                        </div>
                        <div className="flex items-center justify-center px-0.5">
                          {!tap.undone && (
                            <button
                              onClick={() => undoTap(tap.id)}
                              title="Undo"
                              className="text-[10px] font-bold text-red-600 hover:bg-red-100 rounded leading-none p-0"
                            >
                              ↩
                            </button>
                          )}
                        </div>
                      </div>
                      )
                    })}
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

  // Sales tab -- the classic Sales Receipts list. Folded in here since it
  // had nothing left that justified its own sidebar destination once the
  // New Sale form was dropped and its own tap-a-sale case moved to Sale mode.
  if (mode === 'sales') {
    return (
      <>
      <div className={rootClassName}>
        {renderModeToggleRow()}
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-sm font-bold text-gray-900">Sales</h2>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={embeddedSearch}
              onChange={e => setEmbeddedSearch(e.target.value)}
              placeholder="Search…"
              className="text-xs px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 w-32"
            />
            <LawsToggleBar show={salesLaws.show} setShow={salesLaws.setShow}
              openForm={salesLaws.openForm} setOpenForm={salesLaws.setOpenForm}
              hideZeroFlags={salesLaws.hideZeroFlags} setHideZeroFlags={salesLaws.setHideZeroFlags}
              activeFilters={salesLaws.activeFilters} toggleFilter={salesLaws.toggleFilter} dark={false} />
            <button type="button" onClick={() => setSalesShowAnalytics(a => !a)}
              title="Analytics"
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${salesShowAnalytics ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              📊
            </button>
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
        {salesLaws.show && (
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 overflow-auto max-h-48">
            <PageLawsList
              scopeKey="Sales"
              isItemsLaws={true}
              onChange={salesLaws.bumpRefresh}
              flags={salesViolationTypes.map((v: ViolationType) => ({
                key: v.key, label: v.label, description: v.description,
                count: violationCounts[v.key] ?? 0,
                onViewClick: () => setSalesViolationFilter(f => f === v.key ? null : v.key),
              }))}
              openForm={salesLaws.openForm}
              setOpenForm={salesLaws.setOpenForm}
              hideZeroFlags={salesLaws.hideZeroFlags}
              setHideZeroFlags={salesLaws.setHideZeroFlags}
              activeFilters={salesLaws.activeFilters}
            />
          </div>
        )}
        {salesShowAnalytics ? (
          <div className="px-3 pt-3 flex-1 overflow-auto"><SalesAnalyticsSection /></div>
        ) : (
          <div className="flex-1 overflow-auto">
            <SalesTab items={salesBillsItems} groupFilter={groupFilter} search={embeddedSearch}
              violation={salesViolationFilter}
              jumpToDate={jumpToReceiptDate} jumpToItemName={jumpToReceiptItemName}
              onJumpDone={onReceiptJumpDone} />
          </div>
        )}
      </div>
      <TrainingGuideModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
      </>
    )
  }

  // Bills tab -- BillsTab itself has no "add new" flow of its own; it always
  // relied on a sibling NewBillForm rendered externally, which now lives
  // inside this tab's own header instead.
  if (mode === 'bills') {
    return (
      <>
      <div className={rootClassName}>
        {renderModeToggleRow()}
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-sm font-bold text-gray-900">Bills</h2>
          <div className="flex items-center gap-2">
            {!billsAddingNew && (
              <input
                type="text"
                value={embeddedSearch}
                onChange={e => setEmbeddedSearch(e.target.value)}
                placeholder="Search…"
                className="text-xs px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 w-32"
              />
            )}
            <button type="button" onClick={() => setBillsAddingNew(a => !a)}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${billsAddingNew ? 'bg-red-600 text-white' : 'bg-green-600 text-white hover:bg-green-500'}`}>
              {billsAddingNew ? 'Cancel' : '+ New Bill'}
            </button>
            {!billsAddingNew && (
              <LawsToggleBar show={billsLaws.show} setShow={billsLaws.setShow}
                openForm={billsLaws.openForm} setOpenForm={billsLaws.setOpenForm}
                hideZeroFlags={billsLaws.hideZeroFlags} setHideZeroFlags={billsLaws.setHideZeroFlags}
                activeFilters={billsLaws.activeFilters} toggleFilter={billsLaws.toggleFilter} dark={false} />
            )}
            {!billsAddingNew && (
              <button type="button" onClick={() => setBillsShowAnalytics(a => !a)}
                title="Analytics"
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${billsShowAnalytics ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                📊
              </button>
            )}
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
        {!billsAddingNew && billsLaws.show && (
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 overflow-auto max-h-48">
            <PageLawsList
              scopeKey="Bills"
              isItemsLaws={true}
              onChange={billsLaws.bumpRefresh}
              flags={billsViolationTypes.map((v: ViolationType) => ({
                key: v.key, label: v.label, description: v.description,
                count: violationCounts[v.key] ?? 0,
                onViewClick: () => setBillsViolationFilter(f => f === v.key ? null : v.key),
              }))}
              openForm={billsLaws.openForm}
              setOpenForm={billsLaws.setOpenForm}
              hideZeroFlags={billsLaws.hideZeroFlags}
              setHideZeroFlags={billsLaws.setHideZeroFlags}
              activeFilters={billsLaws.activeFilters}
            />
          </div>
        )}
        {billsAddingNew ? (
          <div className="px-4 flex-1 overflow-auto">
            <NewBillForm onSuccess={() => setBillsAddingNew(false)} />
          </div>
        ) : billsShowAnalytics ? (
          <div className="px-3 pt-3 flex-1 overflow-auto"><BillsAnalyticsSection /></div>
        ) : (
          <div className="flex-1 overflow-auto">
            <BillsTab items={salesBillsItems} groupFilter={groupFilter} search={embeddedSearch} violation={billsViolationFilter} />
          </div>
        )}
      </div>
      <TrainingGuideModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
      </>
    )
  }

  // Loss by Target tab -- still an unimplemented placeholder upstream; kept
  // here purely so its sidebar destination can be retired without losing
  // the (currently empty) spot for whenever it's built.
  if (mode === 'lossByTarget') {
    return (
      <>
      <div className={rootClassName}>
        {renderModeToggleRow()}
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-sm font-bold text-gray-900">Loss by Target</h2>
          <div className="flex items-center gap-2">
            <LawsToggleBar show={lossByTargetLaws.show} setShow={lossByTargetLaws.setShow}
              openForm={lossByTargetLaws.openForm} setOpenForm={lossByTargetLaws.setOpenForm}
              hideZeroFlags={lossByTargetLaws.hideZeroFlags} setHideZeroFlags={lossByTargetLaws.setHideZeroFlags}
              activeFilters={lossByTargetLaws.activeFilters} toggleFilter={lossByTargetLaws.toggleFilter} dark={false} />
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
        {lossByTargetLaws.show && (
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 overflow-auto max-h-48">
            <PageLawsList
              scopeKey="Loss by Target"
              isItemsLaws={true}
              onChange={lossByTargetLaws.bumpRefresh}
              openForm={lossByTargetLaws.openForm}
              setOpenForm={lossByTargetLaws.setOpenForm}
              hideZeroFlags={lossByTargetLaws.hideZeroFlags}
              setHideZeroFlags={lossByTargetLaws.setHideZeroFlags}
              activeFilters={lossByTargetLaws.activeFilters}
            />
          </div>
        )}
        <div className="py-20 text-center text-gray-400 text-xs">Coming soon.</div>
      </div>
      <TrainingGuideModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
      </>
    )
  }

  // Every count-related view that used to only be reachable through the
  // laws panel (⚖️) on Sale mode: Daily/Every Nd/Dormant/etc (countIntervalFlags),
  // Count Records (the full all-time history table), and Count History (the
  // audit log of who counted/edited/deleted what). Moved to its own tab
  // since they're audit/browse views, not part of actually tapping a sale.
  if (mode === 'count') {
    const intervalItems = countView?.kind === 'interval'
      ? allItems.filter(it => it.count_interval === countView.label)
      : []
    return (
      <>
      <div className={rootClassName}>
        {renderModeToggleRow()}
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-sm font-bold text-gray-900">Count</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Count Records doubles as the old Loss by Date feed -- these
                controls (search, the All/Losses/Gains filter, and Analytics)
                only make sense there, not on the interval buckets or the
                audit log. */}
            {countView?.kind === 'records' && (<>
              <input
                type="text"
                value={embeddedSearch}
                onChange={e => setEmbeddedSearch(e.target.value)}
                placeholder="Search…"
                className="text-xs px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 w-32"
              />
              <div className="inline-flex bg-gray-200 rounded-lg p-0.5">
                <button type="button" onClick={() => setCountRecordFilter('all')}
                  className={`px-2 py-1 text-[10px] font-bold rounded-md transition ${countRecordFilter === 'all' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
                  All
                </button>
                <button type="button" onClick={() => setCountRecordFilter('loss')}
                  className={`px-2 py-1 text-[10px] font-bold rounded-md transition ${countRecordFilter === 'loss' ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
                  Losses
                </button>
                <button type="button" onClick={() => setCountRecordFilter('gain')}
                  className={`px-2 py-1 text-[10px] font-bold rounded-md transition ${countRecordFilter === 'gain' ? 'bg-amber-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
                  🚩 Gains
                </button>
              </div>
              <button type="button" onClick={() => setCountShowAnalytics(a => !a)}
                title="Analytics"
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${countShowAnalytics ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                📊
              </button>
            </>)}
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
        <div className="px-4 py-2 border-b border-gray-200 bg-white flex items-center gap-1.5 flex-wrap">
          {countIntervalFlags.map(f => (
            <button key={f.key} type="button" onClick={f.onViewClick}
              className={`text-xs font-semibold px-2 py-1 rounded-full transition ${f.active ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {f.label} ({f.count})
            </button>
          ))}
          <button type="button" onClick={() => setCountView(countView?.kind === 'records' ? null : { kind: 'records' })}
            className={`text-xs font-semibold px-2 py-1 rounded-full transition ${countView?.kind === 'records' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Count Records
          </button>
          <button type="button" onClick={() => setCountView(countView?.kind === 'history' ? null : { kind: 'history' })}
            className={`text-xs font-semibold px-2 py-1 rounded-full transition ${countView?.kind === 'history' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Count History
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {!countView && (
            <p className="py-16 text-center text-gray-400 text-xs">Pick a category above to view its items.</p>
          )}
          {countView?.kind === 'interval' && (
            intervalItems.length === 0 ? (
              <p className="py-16 text-center text-gray-400 text-xs">No items in &quot;{countView.label}&quot;.</p>
            ) : (
              <table className="w-full text-[11px] border-collapse">
                <thead className="sticky top-0 bg-gray-100 z-10">
                  <tr>
                    <th className="text-left px-2 py-1 font-bold text-gray-600">Item</th>
                    <th className="text-left px-2 py-1 font-bold text-gray-600">Group</th>
                    <th className="text-right px-2 py-1 font-bold text-gray-600">SOH</th>
                    <th className="text-right px-2 py-1 font-bold text-gray-600">SP</th>
                    <th className="text-right px-2 py-1 font-bold text-gray-600">CP</th>
                  </tr>
                </thead>
                <tbody>
                  {intervalItems.map(it => (
                    <tr key={it.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-2 py-1 text-gray-900 font-medium">{it.name}</td>
                      <td className="px-2 py-1 text-gray-500">{it.group ?? '—'}</td>
                      <td className="px-2 py-1 text-right text-gray-700">{it.soh}</td>
                      <td className="px-2 py-1 text-right text-gray-700">{it.selling_price}</td>
                      <td className="px-2 py-1 text-right text-gray-700">{it.cost_price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
          {countView?.kind === 'records' && (
            countShowAnalytics ? (
              <div className="px-3 pt-3"><LossFeedAnalyticsSection /></div>
            ) : (<>
              <div className="grid grid-cols-5 gap-0.5 px-2 pt-1 shrink-0">
                {countLossSummary.map(r => (
                  <div key={r.label} className="bg-white border border-gray-200 rounded px-1 py-0.5 text-center">
                    <p className="text-[7px] text-gray-400 truncate">{r.label}</p>
                    <p className={`text-[8px] font-bold ${r.period.n > 0 ? 'text-red-600' : 'text-green-600'}`}>₵{fmtN(r.period.amt)}</p>
                  </div>
                ))}
              </div>
              {renderCountRecordsTable()}
            </>)
          )}
          {countView?.kind === 'history' && (
            <div className="flex-1 min-h-0 flex flex-col px-4 py-4">
              <HistoryPanel keywords={['stock', 'count']} />
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
    <div className={rootClassName}>
      {renderModeToggleRow()}

      {/* Filter Bar - Green bar at top - hidden when the host page (Item page)
          renders its own merged version of this bar via hideFilterBar,
          except in "Large screen" mode -- the host page's own version is
          behind this page's now-fixed-fullscreen overlay, so it needs its
          own copy here too rather than losing the type/group filters entirely. */}
      {(!hideFilterBar || expanded) && (
      <div className="bg-green-700 -mx-0 px-3 py-1.5 flex items-center justify-between gap-1.5 flex-wrap">
          <div className="flex gap-1.5 items-center flex-wrap">
            <select
              value={productTypeFilter}
              onChange={e => setProductTypeFilter(e.target.value as 'all' | 'goods' | 'services')}
              className="text-xs px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
            >
              <option value="all">All types</option>
              <option value="goods">Goods</option>
              <option value="services">Services</option>
            </select>
            <select
              value={groupFilter || ''}
              onChange={e => setGroupFilter(e.target.value || null)}
              className="text-xs px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
            >
              <option value="">All groups</option>
              {groups.map(group => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
            {/* Sale mode's own item-grid filter (Loss/Gain/Low SOH/count
                interval, see saleFilterFlags) -- rendered here inline only
                when there's no host-supplied filterSlotEl to portal into
                (standalone page, or "Large screen" mode); otherwise it rides
                along in the host's own merged row below instead of adding a
                line of its own. */}
            {!(filterSlotEl && !expanded) && (
              <select
                value={saleFilter ? saleFilter.kind === 'interval' ? `interval:${saleFilter.label}` : saleFilter.kind : ''}
                onChange={e => {
                  const v = e.target.value
                  if (!v) setSaleFilter(null)
                  else if (v.startsWith('interval:')) setSaleFilter({ kind: 'interval', label: v.slice('interval:'.length) })
                  else setSaleFilter({ kind: v as 'loss' | 'gain' | 'soh' })
                }}
                className="text-xs px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
              >
                <option value="">Filter: All items</option>
                {saleFilterFlags.map(f => (
                  <option key={f.key} value={f.key === 'loss' || f.key === 'gain' || f.key === 'soh' ? f.key : `interval:${f.label}`}>
                    {f.label} ({f.count})
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex gap-1.5 items-center">
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
              className="w-6 h-6 rounded-md bg-white text-gray-600 hover:bg-gray-100 font-semibold text-xs flex items-center justify-center transition"
              title="Help"
            >
              ?
            </button>
          </div>
      </div>
      )}

      {/* Portaled copy of the Sale-mode item filter for when the host page
          supplies a slot (see filterSlotEl above) -- same select as inline
          above, just rendered into the host's own merged row instead of a
          fourth line of this page's own. */}
      {filterSlotEl && !expanded && createPortal(
        <select
          value={saleFilter ? saleFilter.kind === 'interval' ? `interval:${saleFilter.label}` : saleFilter.kind : ''}
          onChange={e => {
            const v = e.target.value
            if (!v) setSaleFilter(null)
            else if (v.startsWith('interval:')) setSaleFilter({ kind: 'interval', label: v.slice('interval:'.length) })
            else setSaleFilter({ kind: v as 'loss' | 'gain' | 'soh' })
          }}
          className="text-xs px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
        >
          <option value="">Filter: All items</option>
          {saleFilterFlags.map(f => (
            <option key={f.key} value={f.key === 'loss' || f.key === 'gain' || f.key === 'soh' ? f.key : `interval:${f.label}`}>
              {f.label} ({f.count})
            </option>
          ))}
        </select>,
        filterSlotEl
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
                className={`border focus:outline-none focus:ring-1 ${
                  compactSearch ? 'text-xs px-2 py-1 w-20 rounded-md bg-white' : 'text-sm px-3 py-1.5 w-48 rounded-lg'
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
                className={`font-semibold bg-green-600 text-white hover:bg-green-700 transition ${
                  compactSearch ? 'px-1.5 py-1 text-[10px] rounded-md' : 'px-2 py-1.5 text-sm rounded-lg'
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
                className={`font-semibold transition ${compactSearch ? 'px-1.5 py-1 text-[10px] rounded-md' : 'px-4 py-1.5 text-sm rounded'} ${
                  saleType === 'GMC'
                    ? 'bg-purple-600 text-white'
                    : 'bg-blue-600 text-white'
                }`}
              >
                {saleType}
              </button>
            )}
            {mode === 'sale' && (
              <button
                type="button"
                onClick={() => setLiveShowAnalytics(a => !a)}
                title="Analytics"
                className={`shrink-0 font-bold transition ${compactSearch ? 'px-1.5 py-1 text-[10px] rounded-md' : 'px-2.5 py-1 text-xs rounded-lg'} ${
                  liveShowAnalytics ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                📊
              </button>
            )}
          </>
        )

        // Same reasoning as renderModeToggleRow above -- searchSlotEl lives
        // in the host page, which "Large screen" mode's fixed overlay
        // covers entirely, so the portal target is useless while expanded
        // and this renders its own row instead (with the search box,
        // WIC/GMC toggle, and Analytics button all included, not just
        // hidden behind the overlay).
        if (compactSearch && !expanded) {
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

      {liveShowAnalytics ? (
        <div className="px-3 pt-3 flex-1 overflow-auto"><LiveSaleAnalyticsSection /></div>
      ) : (<>

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
                        onClick={() => setViewingItemId(item.id)}
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
                        <span className="text-gray-400"> · </span>
                        <span className={formatLoss(lossByItemId.get(item.id)).cls}>{formatLoss(lossByItemId.get(item.id)).text}</span>
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
                      onClick={() => setViewingItemId(item.id)}
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
                      <span className="text-gray-400"> · </span>
                      <span className={formatLoss(lossByItemId.get(item.id)).cls}>{formatLoss(lossByItemId.get(item.id)).text}</span>
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
            <div className="px-4 py-4 border-b border-gray-200 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-gray-900 truncate">{selectedItem.name}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  <span>Selling: ₵{formatPrice(selectedItem.selling_price)}</span>
                  <span className="text-gray-400"> · </span>
                  <span>Cost: ₵{formatPrice(selectedItem.cost_price)}</span>
                  <span className="text-gray-400"> · </span>
                  <span>Stock: {Math.ceil(Number(selectedItem.soh))} pc</span>
                </p>
              </div>
              {!editingSelectedItem && (
                <button
                  type="button"
                  onClick={startEditSelectedItem}
                  className="shrink-0 px-5 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  Edit
                </button>
              )}
            </div>

            {/* Editing this item's own fields -- opened via the Edit button
                above. Replaces the sale/count body below rather than
                stacking alongside it, so there's no ambiguity about which
                form a tap on Save applies to. Cancel returns to the normal
                sheet, it doesn't close it. */}
            {editingSelectedItem ? (
              <div className="p-4">
                {editLoading ? (
                  <p className="text-xs text-gray-400 text-center py-6">Loading…</p>
                ) : (
                  <ItemEditForm
                    form={editForm}
                    onChange={setEditForm}
                    groups={editGroups}
                    itemId={selectedItem.id}
                    isService={selectedItem.product_type === 'service'}
                    allItems={editAllItemsList}
                    size="large"
                    currentCountInterval={editCurrentCountInterval}
                    currentSoh={editCurrentSoh}
                  />
                )}
                {editError && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600 font-medium">
                    {editError}
                  </div>
                )}

                {/* Manual count -- lets this item be counted from the edit
                    view even when it isn't currently due (the due block
                    below only shows up for items the count queues have
                    already flagged). Its own submit, going through the
                    same submitCount() the due block uses, so it hits the
                    same pack-pairing/loss-reason prompts. */}
                {!editLoading && selectedItem.product_type !== 'service' && (
                  <div className="mt-4 rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-3 py-1.5 text-xs font-extrabold text-white bg-gray-700">
                      MANUAL COUNT
                    </div>
                    <div className="p-3 space-y-2 bg-gray-50">
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
                          className="flex-1 text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-gray-400"
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
                          className={`shrink-0 px-3 py-2 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50 ${countShort ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-800'}`}
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

                <div className="flex gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSelectedItem(false)
                      setEditError('')
                      setCountQty('')
                      setCountError('')
                    }}
                    disabled={editSaving}
                    className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold rounded-lg transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveEditSelectedItem}
                    disabled={editSaving || editLoading || !editForm.item_name.trim()}
                    className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
                  >
                    {editSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
            <>
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
                    setEditingSelectedItem(false)
                    setEditError('')
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
            </>
            )}
          </div>
        </div>
        )
      })()}

      </>)}

      {/* Item detail popup -- opened by tapping an item's name, instead of
          navigating to the Loss by Item page (which no longer exists as
          its own destination). */}
      {viewingItemId != null && (
        <ItemDetailModal itemId={viewingItemId} onClose={() => setViewingItemId(null)} />
      )}

      {lossPrompt && <LossDialog prompt={lossPrompt} onClose={() => setLossPrompt(null)} />}
      {pairingPrompt && <PairingDialog prompt={pairingPrompt} onClose={() => setPairingPrompt(null)} />}

      <TrainingGuideModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
    </div>
    </>
  )
}
