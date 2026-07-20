'use client'
import { useState, useEffect, useRef, useMemo, Component, Suspense, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'

class TabErrorBoundary extends Component<{ children: ReactNode }, { error: boolean; message: string }> {
  state = { error: false, message: '' }
  static getDerivedStateFromError(err: any) { return { error: true, message: err?.message || String(err) } }
  componentDidCatch(err: any, info: any) { console.error('TabErrorBoundary caught:', err, info) }
  render() {
    if (this.state.error) return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 px-4">
        <p className="text-sm">This tab failed to load.</p>
        {this.state.message && (
          <p className="text-xs text-red-500 font-mono break-all text-center max-w-sm">{this.state.message}</p>
        )}
        <button onClick={() => this.setState({ error: false, message: '' })}
          className="text-xs text-blue-600 underline">Retry</button>
      </div>
    )
    return this.props.children
  }
}
import { usePolling } from '@/lib/usePolling'
import dynamic from 'next/dynamic'
const loading = (h: string) => <div className={`py-10 text-center text-gray-400 text-sm`}>{h}</div>
const ItemsTab       = dynamic(() => import('./_components/ItemsTab'),        { ssr: false, loading: () => loading('Loading…') })
const SalesTab       = dynamic(() => import('./_components/SalesTab'),        { ssr: false, loading: () => loading('Loading…') })
const BillsTab       = dynamic(() => import('./_components/BillsTab'),        { ssr: false, loading: () => loading('Loading…') })
const CountsTab      = dynamic(() => import('./_components/CountsTab'),       { ssr: false, loading: () => loading('Loading…') })
const ExpensesTab    = dynamic(() => import('./_components/ExpensesTab'),     { ssr: false, loading: () => loading('Loading…') })
const CABTab         = dynamic(() => import('./_components/CABTab'),          { ssr: false, loading: () => loading('Loading…') })
const TodayContent   = dynamic(() => import('./_components/TodayContent'),    { ssr: false, loading: () => loading('Loading…') })
const NewSaleForm    = dynamic(() => import('../sales/new/page'),             { ssr: false, loading: () => loading('Loading…') })
const NewBillForm    = dynamic(() => import('../bills/new/page'),             { ssr: false, loading: () => loading('Loading…') })
const NewExpenseForm = dynamic(() => import('../expenses/new/page'),          { ssr: false, loading: () => loading('Loading…') })
const NewItemForm    = dynamic(() => import('./_components/NewItemForm'),     { ssr: false, loading: () => loading('Loading…') })
const AnalyticsPanel = dynamic(() => import('./_components/AnalyticsPanel'),  { ssr: false, loading: () => loading('Loading analytics…') })
const StaffClient    = dynamic(() => import('../staff/StaffClient'),          { ssr: false, loading: () => loading('Loading…') })
const NoStaffTimesList = dynamic(() => import('../staff/StaffClient').then(m => ({ default: m.NoStaffTimesList })), { ssr: false, loading: () => loading('Loading…') })
const LossTab        = dynamic(() => import('./_components/LossTab'),         { ssr: false, loading: () => loading('Loading…') })
const LossFeedTab    = dynamic(() => import('./_components/LossFeedTab'),     { ssr: false, loading: () => loading('Loading…') })
const ProfitLossTab  = dynamic(() => import('./_components/ProfitLossTab'),   { ssr: false, loading: () => loading('Loading…') })
const DailySummaryTab = dynamic(() => import('./_components/DailySummaryTab'), { ssr: false, loading: () => loading('Loading…') })
const GronyCashTab   = dynamic(() => import('./_components/GronyCashTab'),    { ssr: false, loading: () => loading('Loading…') })

type OuterTab = 'today' | 'loss' | 'errors' | 'staff' | 'dailySummary'

// Sales, Bills, Counts, Feed, Cash, Data, Expenses, P&L, and CAB all live as
// submenus inside the Grony Cash tab (outerTab 'loss' -- kept as the
// internal key since it's referenced throughout; only the label changed).
type LossView = 'items' | 'sales' | 'bills' | 'counts' | 'feed' | 'cash' | 'data' | 'expenses' | 'pl' | 'cab'

// Old top-level tabs that got folded into Grony Cash submenus -- old
// bookmarks/links using ?tab=pl etc. still land on the right submenu instead
// of silently falling back to Today.
const OLD_TAB_TO_VIEW: Partial<Record<string, LossView>> = {
  pl: 'pl', expenses: 'expenses', cab: 'cab', data: 'data',
}

// Report-style submenus (their own dashboards, not filterable lists) -- the
// groups/search/New controls row doesn't apply to them.
const REPORT_VIEWS = new Set<LossView>(['cash', 'data', 'pl', 'cab'])

type Item = {
  id: number
  item_name: string
  cf_group: string | null
  selling_rate: string | null
  purchase_rate: string | null
  units_per_pack: string | null
  unit_name: string | null
  product_type: string
  calculated_soh: number
}

type ErrorCategory = 'loss' | 'sales' | 'cab' | 'staff'

// Every violation type in the app, in one place -- the Errors tab is the
// single home for all of them, regardless of which tab/data they come from.
const ERROR_VIOLATIONS: { key: string; label: string; category: ErrorCategory; description: string }[] = [
  {
    key: 'neg_soh', label: 'Neg SOH', category: 'loss',
    description: "This item's stock on hand has gone below zero -- more was sold or removed than was ever recorded as received. That usually means a bill or restock was never entered, an item was miscounted, or a sale was logged against the wrong item. Check the item's recent counts, bills, and sales to find and correct the mismatch.",
  },
  {
    key: 'no_sp', label: 'No SP', category: 'loss',
    description: 'This item has no selling price set (or it is ₵0), so sales of it cannot be priced or tracked correctly. Open the item and enter its correct selling price.',
  },
  {
    key: 'no_cp', label: 'No CP', category: 'loss',
    description: 'This item has no cost/purchase price set (or it is ₵0), so profit and loss on it cannot be calculated. Open the item and enter what it actually costs to buy or produce.',
  },
  {
    key: 'no_group', label: 'No Group', category: 'loss',
    description: 'This item is not assigned to a group/category, so it will be missing or miscounted in group-based reports like Stock Value by Group. Open the item and assign it a group.',
  },
  {
    key: 'duplicates', label: 'Duplicates', category: 'loss',
    description: 'These look like the same product entered twice under slightly different names, which splits one item into two separate sales and stock records. Review each pair and merge or rename them into a single canonical item.',
  },
  {
    key: 'aliases', label: 'Aliases', category: 'loss',
    description: "A sale or bill used an item name that did not exactly match anything in the item list, so the system flagged it as unresolved instead of guessing. Confirm the correct match so it counts toward the right item's reports going forward.",
  },
  {
    key: 'unlinked_named', label: 'Unlinked', category: 'loss',
    description: "A sale's item name matches an item in inventory by text, but the sale line was never actually linked to it -- usually from hand-editing the name on an existing receipt line without re-picking the item. It looks resolved, but its quantity and revenue are silently missing from that item's activity. Tap Link to connect it.",
  },
  {
    key: 'service_violation', label: 'Service', category: 'loss',
    description: 'A service item shows GMC use, bill activity, or a stock count -- but services are not physical stock, so none of that should ever apply to them. Find where the entry was logged and correct it, since it was likely recorded against the wrong item.',
  },
  {
    key: 'daily', label: 'Daily Count', category: 'loss',
    description: "These items must be counted every single day (Large Format items are excluded since they cannot be counted this way) and have not been counted yet today. Count them now so today's stock figures are accurate.",
  },
  {
    key: '7day', label: '7-Day Count', category: 'loss',
    description: 'GMC items — goods the shop takes for its own use, like 4x6 packs, A4 sheets, and Brown Envelope packs — move fast and are easy to forget to record, so they must be counted every week. These have not been counted in over 7 days.',
  },
  {
    key: '15day', label: '15-Day Count', category: 'loss',
    description: 'These items have not been counted in over 15 days, so their recorded stock may no longer reflect what is actually on the shelf. Count them soon before a real shortage or loss goes unnoticed. Items counted at the same number three times in a row with no purchases relax to a 30-day cycle, and items counted at zero twice with no purchases drop off until a bill brings them back.',
  },
  {
    key: 'gains', label: 'Gains', category: 'loss',
    description: 'Counts that came in ABOVE what the records support. A gain should always be 0 — every one means a bill or GMC take was never recorded, or an earlier count was wrong. Fix the missing record (or correct the count) until this list is empty.',
  },
  {
    key: 'no_cash', label: 'No Cash', category: 'sales',
    description: 'A walk-in customer sale was recorded for this day, but no cash was ever counted against it, so there is no way to confirm the money actually came in. Count the cash for that day and enter it against the receipt.',
  },
  {
    key: 'missing_days', label: 'Missing Days', category: 'sales',
    description: 'No sales receipt exists at all for this date. Confirm whether the shop genuinely had no sales that day, or whether a receipt was simply never entered -- and add it if so.',
  },
  {
    key: 'cost_price', label: 'Cost Price', category: 'sales',
    description: 'This sale has a cost price equal to or higher than its selling price, so it shows as a loss or break-even on paper. Check whether the selling price, cost price, or quantity was entered incorrectly for this line.',
  },
  {
    key: 'dup_receipt', label: 'Dup Receipts', category: 'sales',
    description: 'More than one sales receipt exists for the same day and the same customer type (WIC or GMC). This usually means one was created by mistake -- review both and merge or delete the extra one.',
  },
  {
    key: 'unchecked_cab', label: 'Unchecked CAB', category: 'cab',
    description: 'A week has passed without anyone confirming the Cash at Bank entry, so nobody has verified that the bank balance matches what the shop expects. Review that week and confirm it.',
  },
  {
    key: 'no_staff_times', label: 'No Staff Times', category: 'staff',
    description: 'This day has sales recorded but no staff clock-in/out times were entered, so there is no record of who was actually working. Add the missing staff times for that day.',
  },
]

const VIOLATIONS: Record<OuterTab, { key: string; label: string; category?: ErrorCategory }[]> = {
  today: [],
  loss: [],
  errors: ERROR_VIOLATIONS,
  staff: [],
  dailySummary: [],
}

const COUNTS_VIOLATIONS = new Set(['daily', '7day', '15day'])

const HAMBURGER_LINKS = [
  { href: '/analysis', label: 'Analysis' },
  { href: '/vendors',   label: 'Vendors'   },
  { href: '/customers', label: 'Customers' },
  { href: '/receipts',  label: 'Receipts'  },
  { href: '/logs',      label: 'Logs'      },
  { href: '/users',    label: 'Users'    },
  { href: '/profile',  label: 'Profile'  },
]

// All tabs share the same solid color; the active one is marked with a bold
// dark ring + shadow instead, so it's unmistakable at a glance.
function tabCls(active: boolean) {
  return `relative flex-1 min-w-0 flex flex-col items-center justify-center gap-1 px-1 py-2.5 rounded-xl transition text-white
    bg-brand ${active ? 'ring-4 ring-gray-900 shadow-lg' : 'hover:brightness-110'}`
}

function TabIcon({ icon, label, active, onClick, count }: { icon: string; label: string; active: boolean; onClick: () => void; count?: number }) {
  return (
    <button onClick={onClick} className={tabCls(active)}
      title={count ? `${count} violation${count !== 1 ? 's' : ''} need attention` : undefined}>
      <span className="relative text-2xl leading-none">
        {icon}
        {!!count && (
          <span className="absolute -top-2 -right-3 min-w-[17px] h-[17px] px-[3px] rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center leading-none ring-2 ring-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </span>
      <span className="text-[10px] font-semibold leading-none truncate max-w-full">{label}</span>
    </button>
  )
}

const VALID_TABS: OuterTab[] = ['today', 'loss', 'errors', 'staff', 'dailySummary']

function ItemHubPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawInitialTab = searchParams.get('tab')
  const oldTabView = rawInitialTab ? OLD_TAB_TO_VIEW[rawInitialTab] : undefined
  // 'losses' (the old standalone Loss Feed tab) and the old pl/expenses/cab/
  // data top-level tabs all folded into Grony Cash submenus -- old
  // bookmarks/links using any of them still land somewhere sensible instead
  // of silently falling back to Today.
  const initialTab = (rawInitialTab === 'losses' || oldTabView ? 'loss' : rawInitialTab) as OuterTab | null
  const [outerTab, setOuterTab] = useState<OuterTab>(
    initialTab && VALID_TABS.includes(initialTab) ? initialTab : 'today'
  )
  const [group, setGroup]               = useState<string | null>(null)
  const [productType, setProductType]   = useState<'all' | 'goods' | 'services'>('all')
  const initialView = searchParams.get('view') as LossView | null
  const [lossView, setLossView]         = useState<LossView>(
    rawInitialTab === 'losses' ? 'feed' : (oldTabView ?? initialView ?? 'items')
  )
  // SP/AMOUNT/CP/PROFIT columns on the pack-chain detail table are collapsed
  // by default (they're only needed occasionally) -- toggled from the submenu.
  const [showPrices, setShowPrices]     = useState(false)
  // Filters the pack-chain detail table down to rows with an actual loss/gain.
  // Mutually exclusive -- turning one on turns the other off.
  const [lossOnly, setLossOnly]         = useState(false)
  const [gainOnly, setGainOnly]         = useState(false)
  const [search, setSearch]             = useState(searchParams.get('q') ?? '')
  // Which item row is expanded on the Grony Cash tab's Items view, if any -- only
  // used to keep the URL (and thus a refresh) pointed at the same row;
  // LossTab owns the actual expand/collapse state and reports changes here.
  const initialItemParam = searchParams.get('item')
  const [expandedItemId, setExpandedItemId] = useState<number | null>(
    initialItemParam ? Number(initialItemParam) || null : null
  )
  const [violation, setViolation]       = useState<string | null>(searchParams.get('violation'))
  const [violationOpen, setViolationOpen] = useState(!!searchParams.get('violation'))
  const [groupOpen, setGroupOpen]       = useState(false)
  const [hamburgerOpen, setHamburgerOpen] = useState(false)
  const [addForm, setAddForm]             = useState<'item' | 'sale' | 'bill' | 'expense' | null>(null)
  const [jumpToItemId, setJumpToItemId]   = useState<number | null>(null)
  // Seeded from ?item= on first load so a refreshed page re-expands (and
  // scrolls to) the same row via LossTab's existing jump-to-item effect.
  const [jumpToLossItemId, setJumpToLossItemId] = useState<number | null>(
    initialItemParam ? Number(initialItemParam) || null : null
  )
  const [jumpToReceiptDate, setJumpToReceiptDate] = useState<string | null>(null)
  const [jumpToReceiptItemName, setJumpToReceiptItemName] = useState<string | null>(null)
  const groupRef     = useRef<HTMLDivElement>(null)
  const hamburgerRef = useRef<HTMLDivElement>(null)

  const [items, setItems]           = useState<Item[]>([])
  const [itemsLoading, setItemsLoading] = useState(true)

  function loadItems() {
    fetch('/api/items').then(r => r.json()).then(d => {
      setItems(Array.isArray(d) ? d : [])
      setItemsLoading(false)
    })
  }

  useEffect(() => { loadItems() }, [])
  usePolling(loadItems, 5000)

  const [globalFlags, setGlobalFlags] = useState<any | null>(null)
  const [pendingCounts, setPendingCounts] = useState<{ daily: number; gmcWeekly: number; overdue: number }>({ daily: 0, gmcWeekly: 0, overdue: 0 })
  const [serviceViolationCount, setServiceViolationCount] = useState(0)
  const [aliasesPendingCount, setAliasesPendingCount] = useState(0)
  const [gainsCount, setGainsCount] = useState(0)

  function loadBadgeData() {
    fetch('/api/flags').then(r => r.ok ? r.json() : null).then(d => { if (d) setGlobalFlags(d) }).catch(() => {})
    Promise.all([
      fetch('/api/stock/daily').then(r => r.json()).catch(() => []),
      fetch('/api/stock/gmc-weekly').then(r => r.json()).catch(() => []),
      fetch('/api/stock/overdue').then(r => r.json()).catch(() => []),
    ]).then(([daily, gmcWeekly, overdue]) => {
      setPendingCounts({
        daily: Array.isArray(daily) ? daily.length : 0,
        gmcWeekly: Array.isArray(gmcWeekly) ? gmcWeekly.length : 0,
        overdue: Array.isArray(overdue) ? overdue.length : 0,
      })
    }).catch(() => {})
    fetch('/api/losses/events?kind=gain').then(r => r.ok ? r.json() : []).then(d => {
      setGainsCount(Array.isArray(d) ? d.length : 0)
    }).catch(() => {})
    fetch('/api/losses/summary').then(r => r.ok ? r.json() : []).then(d => {
      const list = Array.isArray(d) ? d : []
      setServiceViolationCount(list.filter((r: any) =>
        r.product_type === 'service' && (Number(r.cnt) !== 0 || Number(r.gmc) !== 0 || Number(r.bl) !== 0)
      ).length)
    }).catch(() => {})
    Promise.all([
      fetch('/api/aliases/unresolved').then(r => r.json()).catch(() => []),
      fetch('/api/aliases/unresolved-bills').then(r => r.json()).catch(() => []),
    ]).then(([salesRows, billRows]) => {
      const pending = (arr: any) => Array.isArray(arr) ? arr.filter((r: any) => !r.confirmed).length : 0
      setAliasesPendingCount(pending(salesRows) + pending(billRows))
    }).catch(() => {})
  }

  useEffect(() => { loadBadgeData() }, [])
  usePolling(loadBadgeData, 20000)

  const violationCounts: Record<string, number> = useMemo(() => {
    const negSoh = items.filter(i => Number(i.calculated_soh) < 0 && i.product_type !== 'service').length
    const noSp = items.filter(i => !i.selling_rate || parseFloat(i.selling_rate) === 0).length
    const noCp = items.filter(i => !i.purchase_rate || parseFloat(i.purchase_rate) === 0).length
    const f = globalFlags
    return {
      neg_soh: negSoh,
      no_sp: noSp,
      no_cp: noCp,
      no_group: f?.noGroup?.length ?? 0,
      duplicates: f?.duplicates?.length ?? 0,
      unlinked_named: f?.unlinkedNamed?.length ?? 0,
      aliases: aliasesPendingCount,
      no_cash: f?.noCash?.length ?? 0,
      missing_days: f?.missingDays?.length ?? 0,
      cost_price: f?.costGteSell?.length ?? 0,
      dup_receipt: f?.dupReceipts?.length ?? 0,
      daily: pendingCounts.daily,
      '7day': pendingCounts.gmcWeekly,
      '15day': pendingCounts.overdue,
      gains: gainsCount,
      service_violation: serviceViolationCount,
      unchecked_cab: f?.uncheckedCab?.length ?? 0,
      no_staff_times: f?.noStaffTimes?.length ?? 0,
    }
  }, [items, globalFlags, pendingCounts, serviceViolationCount, aliasesPendingCount, gainsCount])

  const badgeCounts: Partial<Record<OuterTab, number>> = useMemo(() => {
    const v = violationCounts
    return {
      errors: v.neg_soh + v.no_sp + v.no_cp + v.no_group + v.duplicates + v.unlinked_named + v.aliases + v.service_violation + v.daily + v['7day'] + v['15day'] + v.gains
        + v.no_cash + v.missing_days + v.cost_price + v.dup_receipt + v.unchecked_cab + v.no_staff_times,
    }
  }, [violationCounts])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (groupRef.current && !groupRef.current.contains(e.target as Node)) setGroupOpen(false)
      if (hamburgerRef.current && !hamburgerRef.current.contains(e.target as Node)) setHamburgerOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // From the loss dialog: jump to the records that usually explain a "loss"
  // (Sales / Bills / Counts live as sub-views of the Grony Cash tab). Must set the
  // sub-view AFTER changeTab, which resets it to 'items'.
  function goFixRecords(view: 'sales' | 'bills' | 'counts') {
    changeTab('loss')
    setLossView(view)
  }

  function changeTab(t: OuterTab) {
    setOuterTab(t)
    setViolation(t === 'errors' ? ERROR_VIOLATIONS[0].key : null)
    setViolationOpen(t === 'errors')
    setAddForm(null)
    if (t !== 'loss') setProductType('all')
    if (t === 'loss') setLossView('items')
  }

  // A refresh should land back on the same tab/sub-view/search/expanded row
  // instead of resetting to Today -- single writer for the URL so nothing
  // fights over it. expandedItemId is only ever non-null while actually on
  // the Items view (cleared below), so ?item= only appears there.
  useEffect(() => {
    if (!(outerTab === 'loss' && lossView === 'items') && expandedItemId !== null) {
      setExpandedItemId(null)
      return
    }
    const params = new URLSearchParams()
    if (outerTab !== 'today') params.set('tab', outerTab)
    if (outerTab === 'loss' && lossView !== 'items') params.set('view', lossView)
    if (search.trim()) params.set('q', search)
    if (outerTab === 'loss' && lossView === 'items' && expandedItemId !== null) {
      params.set('item', String(expandedItemId))
    }
    const qs = params.toString()
    router.replace(qs ? `/item?${qs}` : '/item', { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outerTab, lossView, search, expandedItemId])

  function goToViolation(key: string) {
    // The loss-summary rows point at the Loss feed (a submenu of the Grony
    // Cash tab), not an errors fix screen.
    if (key === '__loss_feed') { changeTab('loss'); setLossView('feed'); return }
    changeTab('errors')
    setViolation(key)
  }

  // Cross-navigation between an item's activity table and its sales receipts.
  // Reset the filters that could otherwise hide the jump target.
  function openItemFromSales(itemId: number) {
    setGroup(null); setProductType('all'); setSearch('')
    setLossView('items')
    setJumpToLossItemId(itemId)
  }
  function openReceiptFromItem(date: string, itemName: string) {
    setSearch('')
    setLossView('sales')
    setJumpToReceiptDate(date)
    setJumpToReceiptItemName(itemName)
  }

  const groups = ['All', ...Array.from(new Set(items.map(i => i.cf_group ?? 'Ungrouped'))).sort()]
  const currentViolations = VIOLATIONS[outerTab]
  const activeViolationLabel = currentViolations.find(v => v.key === violation)?.label ?? null

  const groupLabel = [
    group ?? 'All',
    productType !== 'all' ? (productType === 'goods' ? 'Goods' : 'Services') : null,
  ].filter(Boolean).join(' · ')

  const showControls = outerTab !== 'today' && outerTab !== 'staff' && outerTab !== 'dailySummary'
    && !(outerTab === 'loss' && REPORT_VIEWS.has(lossView))
  const { data: session } = useSession()
  const role = (session?.user as any)?.role ?? 'staff'
  const username = (session?.user as any)?.username ?? session?.user?.name ?? ''
  const canSeePL = role === 'owner' || username === 'joe'
  const isOwnerOrJoe = role === 'owner' || username.toLowerCase() === 'joe'
  const hamburgerLinks = [
    ...HAMBURGER_LINKS,
    ...(isOwnerOrJoe ? [
      { href: '/personal', label: 'Personal' },
      { href: '/debug/unlink-mismatch', label: 'Fix Mislinked Sales' },
    ] : []),
  ]

  return (
    <div className="-mx-4 -mt-4 flex flex-col h-[100dvh] md:h-[calc(100dvh-56px)]">

      {/* ── Header ── */}
      <div className="shrink-0 bg-white border-b border-gray-200">

        {/* Row 1: scrollable tabs + hamburger (hamburger outside scroll area to avoid clip) */}
        <div className="flex items-center pr-1.5">
          {/* Home — fixed, outside the scrollable flex area */}
          <button onClick={() => changeTab('today')}
            className={`shrink-0 flex flex-col items-center justify-center gap-1 px-2.5 pt-2 pb-1.5 rounded-xl transition text-white
              bg-brand ${outerTab === 'today' ? 'ring-4 ring-gray-900 shadow-lg' : 'hover:brightness-110'}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="Home" className="w-7 h-7" />
          </button>
          <div className="flex items-center gap-1 px-1 pt-1.5 pb-1 flex-1 min-w-0">
            <TabIcon icon="📉" label="Grony Cash" active={outerTab === 'loss'}     onClick={() => changeTab('loss')} />
            <TabIcon icon="👤" label="Staff"    active={outerTab === 'staff'}    onClick={() => changeTab('staff')} />
            <TabIcon icon="🗓️" label="Daily"    active={outerTab === 'dailySummary'} onClick={() => changeTab('dailySummary')} />
          </div>

          {/* Hamburger — outside the flex tabs row so dropdown isn't clipped */}
          <div className="relative shrink-0 pt-1.5 pb-1" ref={hamburgerRef}>
            <button onClick={() => setHamburgerOpen(o => !o)}
              className="w-6 h-6 flex items-center justify-center rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition font-bold text-sm leading-none">
              &#9776;
            </button>
            {hamburgerOpen && (
              <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-[100] min-w-[150px]">
                {hamburgerLinks.map(l => (
                  <Link key={l.href} href={l.href}
                    onClick={() => setHamburgerOpen(false)}
                    className="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 first:rounded-t-xl transition">
                    {l.label}
                  </Link>
                ))}
                <div className="border-t border-gray-100" />
                <button onClick={() => signOut({ callbackUrl: '/login' })}
                  className="w-full text-left px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 rounded-b-xl transition">
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Grony Cash sub-view row: Items is the tab's own default view */}
        {outerTab === 'loss' && (
          <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 border-t border-blue-100 overflow-x-auto">
            {([
              { key: 'cash',     label: '💰 Cash' },
              { key: 'sales',    label: '💵 Sales' },
              { key: 'bills',    label: '🧾 Bills' },
              { key: 'counts',   label: '📋 Counts' },
              { key: 'feed',     label: '🔻 Feed' },
              { key: 'data',     label: '🔢 Data' },
              { key: 'expenses', label: '💸 Expenses' },
              ...(canSeePL ? [{ key: 'pl' as LossView, label: '📈 P&L' }] : []),
              { key: 'cab',      label: '🏦 CAB' },
            ] as { key: LossView; label: string }[]).map(v => (
              <button key={v.key} onClick={() => { setLossView(v.key); setAddForm(null) }}
                className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap transition
                  ${lossView === v.key ? 'bg-blue-600 text-white' : 'bg-white border border-blue-200 text-blue-700 hover:bg-blue-100'}`}>
                {v.label}
              </button>
            ))}
            {lossView === 'items' && (
              <button onClick={() => setShowPrices(p => !p)}
                title="Show/hide the SP, AMOUNT, CP and PROFIT columns on the pack-chain detail table"
                className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap transition
                  ${showPrices ? 'bg-blue-600 text-white' : 'bg-white border border-blue-200 text-blue-700 hover:bg-blue-100'}`}>
                💲 Prices {showPrices ? '▾' : '▸'}
              </button>
            )}
            {lossView === 'items' && (
              <button onClick={() => setLossOnly(o => { const v = !o; if (v) setGainOnly(false); return v })}
                title="Show only rows with an actual loss on the pack-chain detail table"
                className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap transition
                  ${lossOnly ? 'bg-red-600 text-white' : 'bg-white border border-red-200 text-red-700 hover:bg-red-100'}`}>
                🔻 Loss Only
              </button>
            )}
            {lossView === 'items' && (
              <button onClick={() => setGainOnly(o => { const v = !o; if (v) setLossOnly(false); return v })}
                title="Show only rows with an actual gain on the pack-chain detail table"
                className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap transition
                  ${gainOnly ? 'bg-orange-500 text-white' : 'bg-white border border-orange-200 text-orange-700 hover:bg-orange-100'}`}>
                🔺 Gain Only
              </button>
            )}
          </div>
        )}

        {/* Row 2: groups + violations + search — hidden on Today tab */}
        {showControls && (
          <div className="flex items-center gap-1.5 px-2 py-1.5">

            {/* Groups dropdown */}
            <div className="relative shrink-0" ref={groupRef}>
              <button onClick={() => setGroupOpen(o => !o)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap flex items-center gap-1 transition
                  ${(group || productType !== 'all') ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {groupLabel} <span className="text-[10px]">▾</span>
              </button>
              {groupOpen && (
                <div className="absolute top-full left-0 mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg z-30 min-w-[140px] max-h-64 overflow-y-auto">
                  {groups.map(g => (
                    <button key={g} onClick={() => { setGroup(g === 'All' ? null : g); setGroupOpen(false) }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 transition
                        ${(g === 'All' && !group) || g === group ? 'text-blue-600 font-semibold' : 'text-gray-700'}`}>
                      {g}
                    </button>
                  ))}
                  <div className="border-t border-gray-100 mt-0.5 pt-0.5">
                    <p className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Type</p>
                    {(['all', 'goods', 'services'] as const).map(t => (
                      <button key={t} onClick={() => { setProductType(t); setGroupOpen(false) }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 transition capitalize
                          ${productType === t ? 'text-blue-600 font-semibold' : 'text-gray-700'}`}>
                        {t === 'all' ? 'All Types' : t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Violations toggle — Errors tab always shows the row below, no toggle needed */}
            {currentViolations.length > 0 && outerTab !== 'errors' && (
              <>
                <div className="w-px h-4 bg-gray-200 shrink-0" />
                <button onClick={() => {
                    const opening = !violationOpen
                    setViolationOpen(opening)
                    if (opening) setViolation(currentViolations[0].key)
                    else setViolation(null)
                  }}
                  className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap flex items-center gap-1 transition
                    ${violationOpen ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  Violations <span className="text-[10px]">{violationOpen ? '▴' : '▾'}</span>
                </button>
              </>
            )}

            {/* Search */}
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="min-w-0 w-24 flex-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400" />

            {/* New button — Items/Sales/Bills/Expenses submenus only; report-style and Counts submenus have no add-form */}
            {outerTab === 'loss' && ['items', 'sales', 'bills', 'expenses'].includes(lossView) && (() => {
              const formKey = lossView === 'items' ? 'item' : lossView === 'sales' ? 'sale' : lossView === 'bills' ? 'bill' : 'expense'
              return (
                <button onClick={() => setAddForm(addForm === formKey ? null : formKey)}
                  className={`shrink-0 text-xs font-semibold px-3 py-1 rounded-lg transition
                    ${addForm ? 'bg-blue-700 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                  {addForm ? '×' : 'New'}
                </button>
              )
            })()}
          </div>
        )}

        {/* Violations sub-tab row */}
        {(violationOpen || outerTab === 'errors') && currentViolations.length > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 bg-red-50 border-t border-red-100 overflow-x-auto">
            {currentViolations.map(v => {
              const c = violationCounts[v.key] ?? 0
              return (
                <button key={v.key} onClick={() => setViolation(v.key)}
                  className={`shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition whitespace-nowrap
                    ${violation === v.key ? 'bg-red-600 text-white' : 'bg-white border border-red-200 text-red-700 hover:bg-red-100'}`}>
                  {v.label}
                  {c > 0 && (
                    <span className={`text-[10px] font-bold rounded-full px-1.5 leading-tight
                      ${violation === v.key ? 'bg-white/25 text-white' : 'bg-red-600 text-white'}`}>
                      {c > 99 ? '99+' : c}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {addForm === 'sale'    && outerTab === 'loss' && lossView === 'sales'    && <div className="px-4"><NewSaleForm    onSuccess={() => setAddForm(null)} /></div>}
        {addForm === 'bill'    && outerTab === 'loss' && lossView === 'bills'    && <div className="px-4"><NewBillForm    onSuccess={() => setAddForm(null)} /></div>}
        {addForm === 'expense' && outerTab === 'loss' && lossView === 'expenses' && <div className="px-4"><NewExpenseForm onSuccess={() => setAddForm(null)} /></div>}
        {addForm === 'item'    && outerTab === 'loss' && lossView === 'items'    && <div className="px-4"><NewItemForm    onSuccess={() => { setAddForm(null); loadItems() }} /></div>}
        {outerTab === 'loss' && lossView === 'cash' && (
          <TabErrorBoundary>
            <GronyCashTab onGoToViolation={goToViolation} counts={violationCounts} />
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'data' && (
          <TabErrorBoundary>
            <AnalyticsPanel />
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'pl' && (
          <TabErrorBoundary>
            <ProfitLossTab />
          </TabErrorBoundary>
        )}
        {outerTab === 'dailySummary' && (
          <TabErrorBoundary>
            <DailySummaryTab />
          </TabErrorBoundary>
        )}
        {outerTab === 'today' && !(addForm === 'sale' || addForm === 'bill' || addForm === 'expense') && (
          <TabErrorBoundary>
            <div className="h-full overflow-y-auto px-4">
              <TodayContent onGoToViolation={goToViolation} counts={violationCounts} />
            </div>
          </TabErrorBoundary>
        )}
        {addForm !== 'expense' && outerTab === 'loss' && lossView === 'expenses' && <ExpensesTab search={search} />}
        {outerTab === 'loss' && lossView === 'cab' && <CABTab />}
        {outerTab === 'staff'    && (
          <TabErrorBoundary>
            <StaffClient role={role} username={username} embedded />
          </TabErrorBoundary>
        )}
        {addForm !== 'item' && outerTab === 'loss' && lossView === 'items' && (
          <TabErrorBoundary>
            <LossTab onOpenItem={() => {}} search={search} group={group} productType={productType}
              jumpToItemId={jumpToLossItemId} onJumpDone={() => setJumpToLossItemId(null)}
              onDateClick={openReceiptFromItem} showPrices={showPrices} lossOnly={lossOnly} gainOnly={gainOnly}
              onExpandedIdChange={setExpandedItemId} />
          </TabErrorBoundary>
        )}
        {addForm !== 'sale' && outerTab === 'loss' && lossView === 'sales' && (
          <SalesTab items={items} groupFilter={group} search={search} violation={null}
            jumpToDate={jumpToReceiptDate} jumpToItemName={jumpToReceiptItemName}
            onJumpDone={() => { setJumpToReceiptDate(null); setJumpToReceiptItemName(null) }}
            onItemClick={openItemFromSales} />
        )}
        {addForm !== 'bill' && outerTab === 'loss' && lossView === 'bills' && (
          <BillsTab items={items} groupFilter={group} search={search} />
        )}
        {outerTab === 'loss' && lossView === 'counts' && (
          <CountsTab items={items} groupFilter={group} search={search} violation={null} onFixRecords={goFixRecords} />
        )}
        {outerTab === 'loss' && lossView === 'feed' && (
          <TabErrorBoundary>
            <LossFeedTab search={search} />
          </TabErrorBoundary>
        )}
        {outerTab === 'errors' && violation && (
          <div className="mx-3 mt-2 mb-1 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex gap-2">
            <span className="text-sm shrink-0">ℹ️</span>
            <p className="text-[11px] text-blue-800 leading-snug">
              {ERROR_VIOLATIONS.find(v => v.key === violation)?.description}
            </p>
          </div>
        )}
        {outerTab === 'errors' && violation && (() => {
          const category = ERROR_VIOLATIONS.find(v => v.key === violation)?.category
          if (category === 'loss') {
            if (violation === 'gains') {
              return <LossFeedTab kind="gain" search={search} />
            }
            if (COUNTS_VIOLATIONS.has(violation)) {
              return <CountsTab items={items} groupFilter={group} search={search} violation={violation} onFixRecords={goFixRecords} />
            }
            return itemsLoading
              ? <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>
              : <ItemsTab
                  items={items}
                  group={group}
                  productType={productType}
                  search={search}
                  violation={violation}
                  onItemsChanged={setItems}
                  showAdd={false}
                  onCloseAdd={() => {}}
                  jumpToItemId={jumpToItemId}
                  onJumpDone={() => setJumpToItemId(null)}
                />
          }
          if (category === 'sales') {
            return <SalesTab items={items} groupFilter={group} search={search} violation={violation} />
          }
          if (category === 'cab') {
            return <CABTab />
          }
          if (category === 'staff') {
            return (
              <TabErrorBoundary>
                <div className="px-4 py-3">
                  <NoStaffTimesList
                    dates={(globalFlags?.noStaffTimes ?? []).map((r: any) => r.missing_date)}
                    role={role} username={username}
                    onFixed={() => loadBadgeData()}
                  />
                </div>
              </TabErrorBoundary>
            )
          }
          return null
        })()}
      </div>
    </div>
  )
}

export default function ItemHubPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-gray-400 text-xs">Loading…</div>}>
      <ItemHubPageInner />
    </Suspense>
  )
}
