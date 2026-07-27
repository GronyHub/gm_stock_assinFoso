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
import { useViolations } from './_components/useViolations'
import RoleBar, { type RoleKey, type ShortcutKey } from './_components/RoleBar'
import RolePanel from './_components/RolePanel'
import { COL_BY_KEY, ALL_COL_KEYS, type ColKey } from './_components/lossTabColumns'
import type { ManageView } from './_components/GronyManageTab'
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
const ItemsAnalyticsSection      = dynamic(() => import('./_components/ItemsAnalyticsSection'),      { ssr: false, loading: () => loading('Loading analytics…') })
const ViolationsAnalyticsSection = dynamic(() => import('./_components/ViolationsAnalyticsSection'), { ssr: false, loading: () => loading('Loading analytics…') })
const SalesAnalyticsSection      = dynamic(() => import('./_components/SalesAnalyticsSection'),      { ssr: false, loading: () => loading('Loading analytics…') })
const BillsAnalyticsSection      = dynamic(() => import('./_components/BillsAnalyticsSection'),      { ssr: false, loading: () => loading('Loading analytics…') })
const ExpensesAnalyticsSection   = dynamic(() => import('./_components/ExpensesAnalyticsSection'),   { ssr: false, loading: () => loading('Loading analytics…') })
const LossTab        = dynamic(() => import('./_components/LossTab'),         { ssr: false, loading: () => loading('Loading…') })
const LossFeedTab    = dynamic(() => import('./_components/LossFeedTab'),     { ssr: false, loading: () => loading('Loading…') })
const LossOverviewTab = dynamic(() => import('./_components/LossOverviewTab'), { ssr: false, loading: () => loading('Loading…') })
const ProfitLossTab  = dynamic(() => import('./_components/ProfitLossTab'),   { ssr: false, loading: () => loading('Loading…') })
const DailySummaryTab = dynamic(() => import('./_components/DailySummaryTab'), { ssr: false, loading: () => loading('Loading…') })
const GronyManageTab = dynamic(() => import('./_components/GronyManageTab'),  { ssr: false, loading: () => loading('Loading…') })
const VendorsPage    = dynamic(() => import('../vendors/page'),               { ssr: false, loading: () => loading('Loading…') })
const CustomersPage  = dynamic(() => import('../customers/page'),             { ssr: false, loading: () => loading('Loading…') })
const ReceiptsPage   = dynamic(() => import('../receipts/page'),              { ssr: false, loading: () => loading('Loading…') })
const ViewPortalAsButton = dynamic(() => import('@/components/ViewPortalAsButton'), { ssr: false })

type OuterTab = 'today' | 'loss' | 'manage'

// Sales, Bills, Counts, Feed, Expenses, PO, P&L, CAB, Vendors, Customers,
// Receipts, Daily (Summary), and Data all live as submenus inside the Grony
// Cash tab (outerTab 'loss' -- kept as the internal key since it's
// referenced throughout; only the label changed).
type LossView = 'items' | 'sales' | 'bills' | 'counts' | 'feed' | 'expenses' | 'pl' | 'cab' | 'vendors' | 'customers' | 'receipts' | 'dailySummary'

// Old top-level tabs that got folded into Grony Cash submenus -- old
// bookmarks/links using ?tab=pl etc. still land on the right submenu instead
// of silently falling back to Today. ?tab=data (the old standalone
// Analytics/"Data" tab, now redistributed as an Analytics toggle on each of
// Items/Sales/Bills/Expenses/Loss/Counts) lands on Items -- there's no
// single tab left to send it to.
const OLD_TAB_TO_VIEW: Partial<Record<string, LossView>> = {
  pl: 'pl', expenses: 'expenses', cab: 'cab', dailySummary: 'dailySummary', data: 'items',
}
// Old top-level tabs that moved to a DIFFERENT tab's submenus (not Grony
// Cash's) -- ?tab=staff now lands on Grony Manage instead of falling back to
// Today. Its exact submenu isn't deep-linked, just the right parent tab.
const OLD_TAB_TO_OUTER: Partial<Record<string, OuterTab>> = {
  staff: 'manage',
}

// Self-contained submenus -- either their own dashboard, or a standalone
// page with its own internal search/filter/add UI -- so the shared
// groups/search/New controls row doesn't apply to them.
const REPORT_VIEWS = new Set<LossView>(['pl', 'cab', 'vendors', 'customers', 'receipts', 'dailySummary'])

// Sales, Bills, and Daily Loss (Feed) are top-level sections of their own,
// sitting in the main Grony Cash row. Counts, Customers/Receipts/Vendors
// aren't in the main row either -- they're reachable from the account menu
// (person icon, bottom right) instead, as their own standalone pages.
// Counts still keeps its 'counts' lossView wired up internally (PARENT_OF
// entry + the CountsTab render further down) purely for cross-navigation --
// Joe's "Fix now" flags and the item Loss dialog's "Go to Counts" both land
// here, and that flow still needs somewhere to land even with no visible nav
// button pointing at it any more.
// Sub-views not listed here have no parent and no children.
const PARENT_OF: Partial<Record<LossView, LossView>> = {
  items: 'items', counts: 'items',
}
const CHILDREN_OF: Partial<Record<LossView, { key: LossView; label: string }[]>> = {}

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

// Every violation type in the app, in one place -- each one now surfaces as
// a pill directly on the Grony Cash submenu it actually belongs to (see
// LOSSVIEW_PILL_KEYS/VIOLATION_HOME below) rather than on a separate Errors
// screen, so this list is just shared label/description data now.
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
    key: 'alias_prezoho_sales', label: 'Pre-Zoho Sales', category: 'loss',
    description: "A pre-Zoho sales receipt used an item name that did not exactly match anything in the item list, so the system flagged it as unresolved instead of guessing. Confirm the correct match so it counts toward the right item's reports going forward.",
  },
  {
    key: 'alias_prezoho_bills', label: 'Pre-Zoho Bills', category: 'loss',
    description: "A pre-Zoho bill used an item name that did not exactly match anything in the item list, so the system flagged it as unresolved instead of guessing. Confirm the correct match so it counts toward the right item's reports going forward.",
  },
  {
    key: 'alias_flagged', label: 'Flagged', category: 'loss',
    description: 'An alias is currently resolving lines to an item whose name contradicts it (e.g. a singles name matched to a pack item). Review each one and reassign it to the correct item, or dismiss it if the match is actually fine.',
  },
  {
    key: 'alias_ambiguous', label: 'Ambiguous', category: 'loss',
    description: 'The same raw item name maps to more than one item in the alias table, so the automatic alias sweep skips it rather than guessing. Pick which item the name really means so future sales/bills resolve to it correctly.',
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

// Where each violation type actually lives now that there's no separate
// Errors screen -- drives both goToViolation (routing a flag-table click
// from Joe/Bino's Role Bar panel to the right place) and which submenu
// shows which pills. no_advert/jingle_overdue/equipment_check_overdue and
// no_staff_times aren't listed: they're handled as a plain changeTab('manage')
// in goToViolation, same as before -- Grony Manage's Staff submenu already
// has its own "Times" view for no_staff_times, and Advert for the others.
const VIOLATION_HOME: Partial<Record<string, LossView>> = {
  neg_soh: 'items', no_sp: 'items', no_cp: 'items', no_group: 'items',
  duplicates: 'items', unlinked_named: 'items', service_violation: 'items',
  alias_prezoho_sales: 'items', alias_prezoho_bills: 'items', alias_flagged: 'items', alias_ambiguous: 'items',
  daily: 'counts', '7day': 'counts', '15day': 'counts',
  gains: 'feed',
  no_cash: 'sales', missing_days: 'sales', cost_price: 'sales', dup_receipt: 'sales',
  unchecked_cab: 'cab',
}

// Only these lossViews get a filterable pill row -- CAB has just the one
// flag type and CABTab has no violation-filtered view to switch to (its
// normal view already covers it), so it gets a plain badge on the CAB
// button instead of a pill (see the submenu row below).
const LOSSVIEW_PILL_KEYS: Partial<Record<LossView, string[]>> = {
  items: [
    'neg_soh', 'no_sp', 'no_cp', 'no_group', 'duplicates', 'unlinked_named', 'service_violation',
    'alias_prezoho_sales', 'alias_prezoho_bills', 'alias_flagged', 'alias_ambiguous',
  ],
  counts: ['daily', '7day', '15day'],
  feed: ['gains'],
  sales: ['no_cash', 'missing_days', 'cost_price', 'dup_receipt'],
}

// Analysis dropped -- it's a strict subset of Grony Cash's Data submenu.
// Vendors/Customers/Receipts also live nested three deep under Items in
// Grony Cash (Items -> children row), so they're repeated here as one-tap
// shortcuts to their own standalone page. Logs moved into Grony Manage.
const HAMBURGER_LINKS = [
  { href: '/users',        label: 'Users'            },
  { href: '/profile',      label: 'Profile'          },
  { href: '/customers',    label: 'Customers'        },
  { href: '/receipts',     label: 'Receipts'         },
  { href: '/vendors',      label: 'Vendors'          },
  { href: '/counts',       label: 'Counts'           },
  { href: '/purchase-orders', label: 'Purchase Orders' },
  { href: '/aliases/wide', label: 'Alias Wide Table' },
  { href: '/matches/wide', label: 'Service Matches'  },
]

// Plain text, no icons -- keeps the top nav to a single line so it doesn't
// eat vertical space. flex-1 + wrapping (no shrink-0/whitespace-nowrap) so
// both always fit on screen -- "Grony Manage" wraps to two lines on narrow
// phones rather than forcing the row to scroll. The button itself stays a
// full-width tap target; only the label's own small pill gets the brand
// color when active, not the whole button-sized box.
function topTabCls() {
  return 'flex-1 min-w-0 flex items-center justify-center py-1'
}
function topTabLabelCls(active: boolean) {
  return `text-sm font-bold text-center px-3 py-1.5 rounded-xl leading-tight transition
    ${active ? 'bg-brand text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`
}

const VALID_TABS: OuterTab[] = ['today', 'loss', 'manage']

function ItemHubPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawInitialTab = searchParams.get('tab')
  const oldTabView = rawInitialTab ? OLD_TAB_TO_VIEW[rawInitialTab] : undefined
  const oldTabOuter = rawInitialTab ? OLD_TAB_TO_OUTER[rawInitialTab] : undefined
  // 'losses' (the old standalone Loss Feed tab), the old pl/expenses/cab/data
  // top-level tabs (folded into Grony Cash), and the old standalone staff tab
  // (folded into Grony Manage) all still land somewhere sensible instead of
  // silently falling back to Today.
  const initialTab = (rawInitialTab === 'losses' || oldTabView ? 'loss' : oldTabOuter ?? rawInitialTab) as OuterTab | null
  const [outerTab, setOuterTab] = useState<OuterTab>(
    initialTab && VALID_TABS.includes(initialTab) ? initialTab : 'today'
  )
  const [group, setGroup]               = useState<string | null>(null)
  const [productType, setProductType]   = useState<'all' | 'goods' | 'services'>('all')
  const initialView = searchParams.get('view') as LossView | null
  const [lossView, setLossView]         = useState<LossView>(
    rawInitialTab === 'losses' ? 'feed' : (oldTabView ?? initialView ?? 'items')
  )
  const [search, setSearch]             = useState(searchParams.get('q') ?? '')
  const [violation, setViolation]       = useState<string | null>(searchParams.get('violation'))
  const [groupOpen, setGroupOpen]       = useState(false)
  const [searchOpen, setSearchOpen]     = useState(false)
  const [hamburgerOpen, setHamburgerOpen] = useState(false)
  const [addForm, setAddForm]             = useState<'item' | 'sale' | 'bill' | 'expense' | null>(null)
  const [jumpToItemId, setJumpToItemId]   = useState<number | null>(null)
  // Seeded from ?jumpDate=/?jumpItem= -- Item 360's Detail table (and its
  // "click a date" links) lands here via /item?tab=loss&view=sales&jumpDate=
  // ...&jumpItem=..., which the URL-sync effect below strips off again on
  // its first run since only tab/view/q are ever written back to the URL.
  const [jumpToReceiptDate, setJumpToReceiptDate] = useState<string | null>(searchParams.get('jumpDate'))
  const [jumpToReceiptItemName, setJumpToReceiptItemName] = useState<string | null>(searchParams.get('jumpItem'))
  const groupRef     = useRef<HTMLDivElement>(null)
  const searchRef    = useRef<HTMLDivElement>(null)
  const hamburgerRef = useRef<HTMLDivElement>(null)
  const colMenuRef   = useRef<HTMLDivElement>(null)

  // Global search (top row, next to Grony Cash/Grony Manage) -- separate
  // from the per-view search bars already on most tabs, which only filter
  // whatever's already on screen. This looks across items/customers/
  // vendors/sales/bills/announcements by name/number and jumps straight to
  // the right one, for when you don't know which section something's in.
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const [globalSearchQuery, setGlobalSearchQuery] = useState('')
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false)
  const [globalSearchResults, setGlobalSearchResults] = useState<{
    items?: { id: number; name: string; cf_group: string | null }[]
    customers?: { id: number; display_name: string; company_name: string | null }[]
    vendors?: { id: number; display_name: string; company_name: string | null }[]
    sales?: { id: number; receipt_number: string | null; customer_name: string | null; receipt_date: string }[]
    bills?: { id: number; bill_number: string | null; vendor_name: string | null; bill_date: string }[]
    announcements?: { id: number; body: string; author: string; created_at: string }[]
  } | null>(null)
  // Fed into CustomersPage/VendorsPage as initialSearch when a result from
  // one of those categories is picked -- those pages own their own search
  // state (unlike Sales/Bills, which already read the shared `search` above).
  const [customerSearchText, setCustomerSearchText] = useState('')
  const [vendorSearchText, setVendorSearchText] = useState('')
  // Same idea, for jumping straight into a specific Grony Manage sub-tab
  // (GronyManageTab owns that sub-tab state itself, same as Customers/Vendors).
  const [manageInitialView, setManageInitialView] = useState<ManageView | undefined>(undefined)

  useEffect(() => {
    const q = globalSearchQuery.trim()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (q.length < 2) { setGlobalSearchResults(null); setGlobalSearchLoading(false); return }
    setGlobalSearchLoading(true)
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`).then(r => r.ok ? r.json() : null).then(d => {
        setGlobalSearchResults(d)
        setGlobalSearchLoading(false)
      }).catch(() => setGlobalSearchLoading(false))
    }, 250)
    return () => clearTimeout(t)
  }, [globalSearchQuery])

  function closeGlobalSearch() {
    setGlobalSearchOpen(false)
    setGlobalSearchQuery('')
    setGlobalSearchResults(null)
  }

  // Which Items-table columns (besides the always-visible sticky Item
  // column) show, and their order -- lives here (next to the New button)
  // rather than inside LossTab, since that's where the "Columns" picker
  // lives. Remembered across visits the same way the Item column's own
  // width already is (inside LossTab).
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(() => {
    if (typeof window === 'undefined') return new Set(ALL_COL_KEYS)
    try {
      const saved = JSON.parse(localStorage.getItem('lossTabVisibleCols') ?? 'null')
      if (Array.isArray(saved) && saved.length > 0) {
        const keep = saved.filter((k): k is ColKey => (ALL_COL_KEYS as string[]).includes(k))
        if (keep.length > 0) return new Set(keep)
      }
    } catch { /* ignore malformed storage */ }
    return new Set(ALL_COL_KEYS)
  })
  useEffect(() => {
    localStorage.setItem('lossTabVisibleCols', JSON.stringify(Array.from(visibleCols)))
  }, [visibleCols])
  function toggleCol(key: ColKey) {
    setVisibleCols(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }
  const [colOrder, setColOrder] = useState<ColKey[]>(() => {
    if (typeof window === 'undefined') return ALL_COL_KEYS
    try {
      const saved = JSON.parse(localStorage.getItem('lossTabColOrder') ?? 'null')
      if (Array.isArray(saved)) {
        const valid = saved.filter((k): k is ColKey => (ALL_COL_KEYS as string[]).includes(k))
        if (valid.length > 0) return [...valid, ...ALL_COL_KEYS.filter(k => !valid.includes(k))]
      }
    } catch { /* ignore malformed storage */ }
    return ALL_COL_KEYS
  })
  useEffect(() => {
    localStorage.setItem('lossTabColOrder', JSON.stringify(colOrder))
  }, [colOrder])
  function moveCol(key: ColKey, dir: -1 | 1) {
    setColOrder(prev => {
      const i = prev.indexOf(key)
      const j = i + dir
      if (i < 0 || j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }
  const [colMenuOpen, setColMenuOpen] = useState(false)

  // Toggles the Items/Sales/Bills/Expenses tabs over to their Analytics
  // view instead of the normal list -- these four (plus Loss and Counts,
  // which own the same toggle themselves, see LossByItemTab/CountsTab)
  // are where the removed "Data" tab's eight sections got redistributed to.
  const [showAnalytics, setShowAnalytics] = useState(false)

  // Custom display labels for the metric columns (e.g. renaming "BL" to
  // something the team actually calls it) -- purely cosmetic, keyed by the
  // same ColKey the column's real data/sort behavior still uses. Passed
  // down to LossTab so its headers show the override too.
  const [columnLabels, setColumnLabels] = useState<Partial<Record<ColKey, string>>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const saved = JSON.parse(localStorage.getItem('lossTabColumnLabels') ?? 'null')
      if (saved && typeof saved === 'object') return saved
    } catch { /* ignore malformed storage */ }
    return {}
  })
  useEffect(() => {
    localStorage.setItem('lossTabColumnLabels', JSON.stringify(columnLabels))
  }, [columnLabels])
  function renameColumn(key: ColKey, label: string) {
    const trimmed = label.trim()
    setColumnLabels(prev => {
      const next = { ...prev }
      if (trimmed) next[key] = trimmed; else delete next[key]
      return next
    })
  }
  const [renamingCol, setRenamingCol] = useState<ColKey | null>(null)
  const [renameColValue, setRenameColValue] = useState('')

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

  // Group filter options -- deliberately NOT derived from `items` above.
  // The Items table (LossTab) is built from item_stock_summary, which can
  // contain groups/items that never made it into (or have since drifted
  // from) the `items` table `/api/items` reads from -- a group could then
  // show up as a heading in the table without ever being selectable here.
  // /api/items/groups mirrors the table's own query exactly, so this list
  // can't miss anything the table actually shows.
  const [lossGroups, setLossGroups] = useState<(string | null)[]>([])
  function loadLossGroups() {
    fetch('/api/items/groups').then(r => r.ok ? r.json() : []).then(d => {
      setLossGroups(Array.isArray(d) ? d : [])
    }).catch(() => {})
  }
  useEffect(() => { loadLossGroups() }, [])
  usePolling(loadLossGroups, 20000)

  // Renaming a group from the Group dropdown itself, rather than one item
  // at a time -- applies everywhere via PUT /api/items/groups.
  const [renamingGroup, setRenamingGroup] = useState<string | null>(null)
  const [renameGroupValue, setRenameGroupValue] = useState('')
  const [renameGroupBusy, setRenameGroupBusy] = useState(false)
  async function submitGroupRename() {
    const oldName = renamingGroup
    const newName = renameGroupValue.trim()
    if (!oldName) return
    if (!newName || newName === oldName) { setRenamingGroup(null); return }
    setRenameGroupBusy(true)
    try {
      const res = await fetch('/api/items/groups', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: oldName, to: newName }),
      })
      if (res.ok) {
        setRenamingGroup(null)
        if (group === oldName) setGroup(newName)
        loadLossGroups()
        loadItems()
      } else {
        const d = await res.json().catch(() => ({}))
        alert(d.error || 'Could not rename group.')
      }
    } finally {
      setRenameGroupBusy(false)
    }
  }

  const [globalFlags, setGlobalFlags] = useState<any | null>(null)
  const [pendingCounts, setPendingCounts] = useState<{ daily: number; gmcWeekly: number; overdue: number }>({ daily: 0, gmcWeekly: 0, overdue: 0 })
  const [serviceViolationCount, setServiceViolationCount] = useState(0)
  const [prezohoSalesCount, setPrezohoSalesCount] = useState(0)
  const [prezohoBillsCount, setPrezohoBillsCount] = useState(0)
  const [aliasFlaggedCount, setAliasFlaggedCount] = useState(0)
  const [unreadAnnouncements, setUnreadAnnouncements] = useState(0)
  const [aliasAmbiguousCount, setAliasAmbiguousCount] = useState(0)
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
      fetch('/api/aliases/audit').then(r => r.json()).catch(() => []),
      fetch('/api/aliases/ambiguous').then(r => r.json()).catch(() => []),
    ]).then(([salesRows, billRows, auditRows, ambiguousRows]) => {
      const pending = (arr: any) => Array.isArray(arr) ? arr.filter((r: any) => !r.confirmed).length : 0
      setPrezohoSalesCount(pending(salesRows))
      setPrezohoBillsCount(pending(billRows))
      setAliasFlaggedCount(Array.isArray(auditRows) ? auditRows.length : 0)
      setAliasAmbiguousCount(Array.isArray(ambiguousRows) ? ambiguousRows.length : 0)
    }).catch(() => {})
    fetch('/api/announcements/unread-count').then(r => r.ok ? r.json() : null).then(d => {
      setUnreadAnnouncements(Number(d?.count) || 0)
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
      alias_prezoho_sales: prezohoSalesCount,
      alias_prezoho_bills: prezohoBillsCount,
      alias_flagged: aliasFlaggedCount,
      alias_ambiguous: aliasAmbiguousCount,
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
  }, [items, globalFlags, pendingCounts, serviceViolationCount, prezohoSalesCount, prezohoBillsCount, aliasFlaggedCount, aliasAmbiguousCount, gainsCount])

  // Backs the bottom RoleBar (Joe/Opener/Closer tabs) -- shared here so it's
  // computed once regardless of which outer tab is showing.
  const {
    cashViolations, openerViolations, cashCount, openerViolationCount,
    assignments, deadlines, assignedBy, assignedOn, vSettings,
  } = useViolations(violationCounts)
  const [openRole, setOpenRole] = useState<RoleKey | null>(null)
  // Bumped by the RoleBar "+" shortcut menu for flows that live inside an
  // already-mounted tab (CAB Confirm, Staff Time, Customer, Vendor) -- each
  // target component watches its own signal and reopens its "new" form.
  const [cabConfirmSignal, setCabConfirmSignal] = useState(0)
  const [staffTimeSignal, setStaffTimeSignal]   = useState(0)
  const [customerSignal, setCustomerSignal]     = useState(0)
  const [vendorSignal, setVendorSignal]         = useState(0)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (groupRef.current && !groupRef.current.contains(e.target as Node)) setGroupOpen(false)
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false)
      if (hamburgerRef.current && !hamburgerRef.current.contains(e.target as Node)) setHamburgerOpen(false)
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setColMenuOpen(false)
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

  // RoleBar "+" shortcut menu -- jumps straight to a "create new" flow
  // wherever it already lives. Sales/Bills/Item/Expenses reuse the existing
  // addForm mechanism (changeTab resets it, so set it after); the rest
  // reopen via a per-target signal since their forms are local component
  // state with no addForm equivalent.
  function handleShortcut(key: ShortcutKey) {
    switch (key) {
      case 'sale':       changeTab('loss'); setLossView('sales');     setAddForm('sale'); break
      case 'bill':       changeTab('loss'); setLossView('bills');     setAddForm('bill'); break
      case 'item':       changeTab('loss'); setLossView('items');     setAddForm('item'); break
      case 'expense':    changeTab('loss'); setLossView('expenses');  setAddForm('expense'); break
      case 'cabConfirm': changeTab('loss'); setLossView('cab');       setCabConfirmSignal(n => n + 1); break
      case 'customer':   changeTab('loss'); setLossView('customers'); setCustomerSignal(n => n + 1); break
      case 'vendor':     changeTab('loss'); setLossView('vendors');   setVendorSignal(n => n + 1); break
      case 'staffTime':  changeTab('manage'); setStaffTimeSignal(n => n + 1); break
    }
  }

  function changeTab(t: OuterTab) {
    // Switching to a top-level tab always wins over a Role Bar panel, so
    // either bar can hand off to the other with one tap -- not just
    // bottom-overrides-top.
    setOpenRole(null)
    setOuterTab(t)
    setViolation(null)
    setAddForm(null)
    setShowAnalytics(false)
    if (t !== 'loss') setProductType('all')
    if (t === 'loss') setLossView('items')
    // Optimistic -- TodayContent marks these read for real as soon as it
    // mounts, but that round-trip shouldn't leave the badge lingering.
    if (t === 'today') setUnreadAnnouncements(0)
  }

  // Tab/sub-view/Role Bar panel changes push a new history entry each --
  // real "pages" the user expects the back button to step through one at a
  // time, landing on the exact one they were on (see the popstate sync
  // effect below, which pulls state back OUT of the URL when that happens).
  // Search stays on router.replace (below) since it shouldn't spam history
  // per keystroke. Skips the push entirely when the computed URL already
  // matches the current one, which is what happens right after that same
  // popstate sync applies a change that came FROM the URL in the first
  // place -- without this guard every back-press would immediately push a
  // duplicate entry back on top of the one just popped.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (outerTab !== 'today') params.set('tab', outerTab); else params.delete('tab')
    if (outerTab === 'loss' && lossView !== 'items') params.set('view', lossView); else params.delete('view')
    if (openRole) params.set('role', openRole); else params.delete('role')
    const qs = params.toString()
    const target = qs ? `/item?${qs}` : '/item'
    const current = window.location.pathname + window.location.search
    if (target === current) return
    router.push(target, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outerTab, lossView, openRole])

  // A refresh should land back on the same search instead of resetting it --
  // replace (not push) since typing shouldn't create a history entry per
  // keystroke.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (search.trim()) params.set('q', search); else params.delete('q')
    const qs = params.toString()
    router.replace(qs ? `/item?${qs}` : '/item', { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  // Pulls tab/sub-view/Role Bar state back OUT of the URL whenever it
  // changes without our own doing -- i.e. the user pressed back/forward.
  // Harmless no-op the rest of the time, since the state this derives
  // already matches what's live once our own push above has run.
  useEffect(() => {
    const urlTab = searchParams.get('tab')
    const nextTab: OuterTab = urlTab && VALID_TABS.includes(urlTab as OuterTab) ? (urlTab as OuterTab) : 'today'
    const urlRole = searchParams.get('role')
    const nextRole: RoleKey | null = urlRole && ['joe', 'opener', 'closer'].includes(urlRole) ? (urlRole as RoleKey) : null
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (nextTab !== outerTab) setOuterTab(nextTab)
    if (nextRole !== openRole) setOpenRole(nextRole)
    if (nextTab === 'loss') {
      const urlView = searchParams.get('view') as LossView | null
      const nextView: LossView = urlView ?? 'items'
      if (nextView !== lossView) setLossView(nextView)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  function goToViolation(key: string) {
    // The loss-summary rows point at the Loss feed (a submenu of the Grony
    // Cash tab), not a violation pill.
    if (key === '__loss_feed') { changeTab('loss'); setLossView('feed'); return }
    // The Advert sub-tab's own checks (audio adverts, jingle, equipment),
    // and No Staff Times (which has its own "Times" view on the Staff
    // submenu already) just land on Grony Manage -- same shallow landing
    // as before, one more tap to the exact sub-view.
    if (['no_advert', 'jingle_overdue', 'equipment_check_overdue', 'no_staff_times'].includes(key)) { changeTab('manage'); return }
    const targetView = VIOLATION_HOME[key]
    if (!targetView) return
    changeTab('loss')
    setLossView(targetView)
    setViolation(key)
  }

  const groups = ['All Groups', ...Array.from(new Set(lossGroups.map(g => g ?? 'Ungrouped'))).sort()]
  // Clicking the search box (even before typing) shows a browsable dropdown
  // of item names -- typing narrows it. Picking one fills the box with that
  // item's name, which the tabs below already know how to search on.
  const searchMatches = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q ? items.filter(i => i.item_name.toLowerCase().includes(q)) : items
    return [...list].sort((a, b) => a.item_name.localeCompare(b.item_name)).slice(0, 25)
  }, [items, search])
  const activeLossParent = PARENT_OF[lossView]
  const lossChildren = activeLossParent ? CHILDREN_OF[activeLossParent] : undefined
  const pillKeys = LOSSVIEW_PILL_KEYS[lossView]

  const groupLabel = [
    group ?? 'All Groups',
    productType !== 'all' ? (productType === 'goods' ? 'Goods' : 'Services') : null,
  ].filter(Boolean).join(' · ')

  const showControls = outerTab !== 'today' && outerTab !== 'manage'
    && !(outerTab === 'loss' && REPORT_VIEWS.has(lossView))
  const { data: session } = useSession()
  const role = (session?.user as any)?.role ?? 'staff'
  const username = (session?.user as any)?.username ?? session?.user?.name ?? ''
  const canSeePL = role === 'owner' || username === 'joe'
  const isOwnerOrJoe = role === 'owner' || username.toLowerCase() === 'joe'
  const isGrony = username.toLowerCase() === 'grony'
  const hamburgerLinks = [
    ...HAMBURGER_LINKS,
    ...(isOwnerOrJoe ? [
      { href: '/debug/unlink-mismatch', label: 'Fix Mislinked Sales' },
    ] : []),
    // Private to Grony alone -- UKTab re-checks the session itself too, so
    // this hidden link is just about not showing it to anyone else, not the
    // only thing guarding the page.
    ...(isGrony ? [{ href: '/uk', label: 'UK' }] : []),
  ]

  // Every real submenu under Grony Cash, Grony Manage, and the account
  // (person icon) menu -- three separate, tagged lists rather than one
  // flat one, since both the global search's "Go to" section AND the
  // Tasks panel's blue bars (see RoleFlagsTable's allSubmenus prop) need
  // this same set. Keeping it in exactly one place is the point: add a
  // submenu here and it shows up in both places on its own, instead of
  // two separately-maintained lists drifting apart (which is what
  // happened to "Daily Loss" vs "Loss" before this).
  const cashSubmenus: { label: string; action: () => void }[] = [
    { label: 'Items', action: () => { changeTab('loss'); setLossView('items') } },
    { label: 'Sales', action: () => { changeTab('loss'); setLossView('sales') } },
    { label: 'Bills', action: () => { changeTab('loss'); setLossView('bills') } },
    { label: 'Loss', action: () => { changeTab('loss'); setLossView('feed') } },
    { label: 'Expenses', action: () => { changeTab('loss'); setLossView('expenses') } },
    ...(canSeePL ? [{ label: 'P&L', action: () => { changeTab('loss'); setLossView('pl') } }] : []),
    { label: 'CAB', action: () => { changeTab('loss'); setLossView('cab') } },
    { label: 'Vendors', action: () => { changeTab('loss'); setLossView('vendors') } },
    { label: 'Customers', action: () => { changeTab('loss'); setLossView('customers') } },
    { label: 'Receipts', action: () => { changeTab('loss'); setLossView('receipts') } },
    { label: 'Daily', action: () => { changeTab('loss'); setLossView('dailySummary') } },
  ]
  const manageSubmenus: { label: string; action: () => void }[] = [
    { label: 'Staff', action: () => { changeTab('manage'); setManageInitialView('staff_times') } },
    { label: 'Advert', action: () => { changeTab('manage'); setManageInitialView('advert') } },
    { label: 'Dress Code', action: () => { changeTab('manage'); setManageInitialView('staff_dress') } },
    { label: 'Arrangement', action: () => { changeTab('manage'); setManageInitialView('arrangement') } },
    { label: 'Cleanliness', action: () => { changeTab('manage'); setManageInitialView('cleanliness') } },
    { label: 'Future', action: () => { changeTab('manage'); setManageInitialView('future') } },
    { label: 'Customer Display', action: () => { changeTab('manage'); setManageInitialView('customer_display') } },
    { label: 'Staff Display', action: () => { changeTab('manage'); setManageInitialView('staff_display') } },
    { label: 'Repair Works', action: () => { changeTab('manage'); setManageInitialView('repair_works') } },
    { label: 'Quality Assurance', action: () => { changeTab('manage'); setManageInitialView('quality_assurance') } },
    { label: 'Training', action: () => { changeTab('manage'); setManageInitialView('training') } },
    { label: 'Logs', action: () => { changeTab('manage'); setManageInitialView('logs') } },
  ]
  const accountSubmenus = hamburgerLinks.map(l => ({ label: l.label, action: () => router.push(l.href) }))

  // Feeds the Tasks panel's blue bars (RolePanel -> RoleFlagsTable) -- one
  // bar per submenu here, tagged with which section it belongs to.
  const taskSubmenus: { label: string; section: string; action: () => void }[] = [
    ...cashSubmenus.map(s => ({ ...s, section: 'Grony Cash' })),
    ...manageSubmenus.map(s => ({ ...s, section: 'Grony Manage' })),
    ...accountSubmenus.map(s => ({ ...s, section: 'Account' })),
  ]

  // Every tab/sub-tab/menu/page the global search can jump to directly --
  // matched and ranked ahead of the data categories below (Items/
  // Customers/etc.) so typing e.g. "sales" lands on the Sales tab itself
  // rather than making you scroll past item/customer/vendor name matches
  // first. Recomputed each render rather than memoized -- it's a small
  // array of cheap closures, not worth the dependency-list upkeep.
  const navDestinations: { label: string; action: () => void }[] = [
    { label: 'Home', action: () => changeTab('today') },
    { label: 'Grony Cash', action: () => changeTab('loss') },
    { label: 'Grony Manage', action: () => changeTab('manage') },
    ...cashSubmenus,
    ...manageSubmenus,
    { label: 'Tasks', action: () => setOpenRole('joe') },
    { label: 'Opener', action: () => setOpenRole('opener') },
    { label: 'Closer', action: () => setOpenRole('closer') },
    ...accountSubmenus,
  ]
  const navQuery = globalSearchQuery.trim().toLowerCase()
  const navMatches = navQuery
    ? navDestinations
        .filter(d => d.label.toLowerCase().includes(navQuery))
        .sort((a, b) => {
          const rank = (d: typeof a) => {
            const l = d.label.toLowerCase()
            return l === navQuery ? 0 : l.startsWith(navQuery) ? 1 : 2
          }
          return rank(a) - rank(b) || a.label.localeCompare(b.label)
        })
        .slice(0, 6)
    : []

  return (
    <div className="-mx-4 -mt-4 -mb-6 flex flex-col h-[100dvh] md:h-[calc(100dvh-56px)]">

      {/* ── Header ── */}
      <div className="shrink-0 sticky top-0 z-30 bg-white border-b border-gray-200">

        {/* Row 1: raw-text tabs, no icons. Both always fit on one screen --
            no horizontal scroll -- via flex-1 + wrapping instead of a fixed
            width per tab. Divider line between them so they read as
            distinct menus, not one blob. Daily and Data are Grony Cash
            submenus now (see the children row below), not top-level tabs
            of their own. Home moved to its own floating icon (bottom-right)
            so it doesn't take up a slot in this row. */}
        <div className="flex items-stretch gap-1 px-2 py-2">
          <button onClick={() => changeTab('loss')} className={topTabCls()}>
            <span className={topTabLabelCls(outerTab === 'loss' && !openRole)}>Grony Cash</span>
          </button>
          <div className="w-px bg-gray-200 shrink-0" />
          <button onClick={() => changeTab('manage')} className={topTabCls()}>
            <span className={topTabLabelCls(outerTab === 'manage' && !openRole)}>Grony Manage</span>
          </button>
          <div className="w-px bg-gray-200 shrink-0" />
          {/* Global search -- looks across the whole app (items, customers,
              vendors, sales, bills, announcements), unlike the per-view
              search bars already on most tabs below, which only filter
              what's already on screen. Icon rather than a permanent text
              field so it doesn't compete with those for the same "search"
              affordance/space. */}
          <button onClick={() => setGlobalSearchOpen(true)} aria-label="Search everywhere" title="Search everywhere"
            className="shrink-0 flex items-center justify-center w-10 text-gray-500 hover:bg-gray-100 rounded-xl transition">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </div>

        {/* Everything below this point (submenus, search/New, violations)
            has nothing to do with the Role Bar's own panel, so none of it
            renders while one is open -- avoids two things reading as
            "selected" at once and keeps the panel free of unrelated chrome. */}
        {!openRole && (<>
        {/* Grony Cash top-level row: Sales, Bills, and Daily Loss (Feed)
            come first, then Items is the tab's own default view -- Items
            is still the home for Counts (see CHILDREN_OF), highlighted by
            PARENT_OF so it stays lit up while looking at that child
            sub-view. CAB has just one flag type (Unchecked CAB) and no
            filtered view to switch to, so it gets a plain count badge here
            instead of a pill row like Items/Counts get below. flex-1 +
            wrap (no shrink-0/whitespace-nowrap/overflow-x-auto) so all of
            them always fit on one screen without scrolling -- same fix as
            the top-level Home/Grony Cash/Grony Manage row. */}
        {outerTab === 'loss' && (
          <div className="flex items-stretch gap-1 px-2 py-0.5 bg-white border-t border-gray-100 flex-wrap">
            {([
              { key: 'items',    label: 'Items' },
              { key: 'sales',    label: 'Sales' },
              { key: 'bills',    label: 'Bills' },
              { key: 'feed',     label: 'Loss' },
              { key: 'expenses', label: 'Expenses' },
              ...(canSeePL ? [{ key: 'pl' as LossView, label: 'P&L' }] : []),
              { key: 'cab',        label: 'CAB' },
            ] as { key: LossView; label: string }[]).map(v => (
              <button key={v.key} onClick={() => { setLossView(v.key); setAddForm(null); setViolation(null); setShowAnalytics(false) }}
                className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 text-center text-[10px] font-semibold px-1 py-1 rounded-lg leading-tight transition
                  ${(activeLossParent ?? lossView) === v.key ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                <span>{v.label}</span>
                {v.key === 'cab' && violationCounts.unchecked_cab > 0 && (
                  <span className={`text-[9px] font-bold rounded-full px-1.5 leading-tight
                    ${(activeLossParent ?? lossView) === v.key ? 'bg-white/25 text-white' : 'bg-red-600 text-white'}`}>
                    {violationCounts.unchecked_cab > 99 ? '99+' : violationCounts.unchecked_cab}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Children row -- only for sections that have any, and only while
            that section (or one of its children) is the active view. */}
        {outerTab === 'loss' && lossChildren && lossChildren.length > 0 && (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-50 border-t border-gray-100 overflow-x-auto">
            {lossChildren.map(c => (
              <button key={c.key} onClick={() => { setLossView(c.key); setAddForm(null); setViolation(null) }}
                className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-lg whitespace-nowrap transition
                  ${lossView === c.key ? 'bg-blue-500 text-white' : 'text-gray-400 hover:bg-gray-100'}`}>
                {c.label}
              </button>
            ))}
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
                  {groups.map(g => renamingGroup === g ? (
                    <div key={g} className="flex items-center gap-1 px-2 py-1">
                      <input autoFocus value={renameGroupValue} onChange={e => setRenameGroupValue(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        onKeyDown={e => { if (e.key === 'Enter') submitGroupRename(); if (e.key === 'Escape') setRenamingGroup(null) }}
                        className="flex-1 min-w-0 text-xs border border-gray-300 rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-blue-400" />
                      <button onClick={e => { e.stopPropagation(); submitGroupRename() }} disabled={renameGroupBusy} title="Save"
                        className="shrink-0 text-green-600 hover:text-green-700 disabled:opacity-40 px-1 text-xs font-bold">✓</button>
                      <button onClick={e => { e.stopPropagation(); setRenamingGroup(null) }} title="Cancel"
                        className="shrink-0 text-gray-400 hover:text-gray-600 px-1 text-xs font-bold">×</button>
                    </div>
                  ) : (
                    <div key={g} className="flex items-center">
                      <button onClick={() => { setGroup(g === 'All Groups' ? null : g); setGroupOpen(false) }}
                        className={`flex-1 min-w-0 text-left px-3 py-1.5 text-xs hover:bg-blue-50 transition truncate
                          ${(g === 'All Groups' && !group) || g === group ? 'text-blue-600 font-semibold' : 'text-gray-700'}`}>
                        {g}
                      </button>
                      {g !== 'All Groups' && g !== 'Ungrouped' && (
                        <button onClick={e => { e.stopPropagation(); setRenamingGroup(g); setRenameGroupValue(g) }} title="Rename group"
                          className="shrink-0 px-2 text-gray-300 hover:text-gray-600">✎</button>
                      )}
                    </div>
                  ))}
                  {/* New groups only ever come from naming one on an item
                      (New Item's own "+ New group name…" option) -- a group
                      with no items has nowhere to live, so this jumps
                      straight to that flow instead of pretending an empty
                      group can be created here. */}
                  <button onClick={() => { changeTab('loss'); setAddForm('item'); setGroupOpen(false) }}
                    className="w-full text-left px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 border-t border-gray-100">
                    + New group…
                  </button>
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

            {/* Search */}
            <div className="relative min-w-0 flex-1" ref={searchRef}>
              <input value={search} onChange={e => setSearch(e.target.value)}
                onFocus={() => setSearchOpen(true)}
                placeholder="Search…" autoComplete="off"
                className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg pl-2 pr-6 py-1 outline-none focus:ring-1 focus:ring-blue-400" />
              {search && (
                <button onClick={() => { setSearch(''); setSearchOpen(false) }} title="Clear search"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm leading-none px-0.5">
                  ×
                </button>
              )}
              {searchOpen && searchMatches.length > 0 && (
                <div className="absolute z-30 left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {searchMatches.map(i => (
                    <button key={i.id} onClick={() => { setSearch(i.item_name); setSearchOpen(false) }}
                      className="w-full text-left px-3 py-1.5 text-xs text-gray-800 hover:bg-blue-50 border-b border-gray-100 last:border-0">
                      {i.item_name}
                      {i.cf_group && <span className="text-gray-400 ml-1.5">· {i.cf_group}</span>}
                    </button>
                  ))}
                </div>
              )}
              {searchOpen && search.trim() && searchMatches.length === 0 && (
                <div className="absolute z-30 left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-1.5 text-xs text-gray-400">
                  No matching items
                </div>
              )}
            </div>

            {/* Columns picker -- Items submenu only, next to New since it's
                the same kind of per-view control. Drives LossTab's column
                visibility/order (lifted up here, see visibleCols/colOrder
                above) rather than living inside LossTab itself. */}
            {outerTab === 'loss' && lossView === 'items' && (
              <div className="relative shrink-0" ref={colMenuRef}>
                <button onClick={() => setColMenuOpen(o => !o)} title="Columns"
                  className="flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <line x1="9" y1="4" x2="9" y2="20" />
                    <line x1="15" y1="4" x2="15" y2="20" />
                  </svg>
                </button>
                {colMenuOpen && (
                  <div className="absolute top-full right-0 mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg z-30 min-w-[200px] max-h-72 overflow-y-auto">
                    {colOrder.map((key, i) => {
                      const c = COL_BY_KEY.get(key)!
                      const label = columnLabels[key] ?? c.label
                      if (renamingCol === key) return (
                        <div key={key} className="flex items-center gap-1 px-2 py-1 border-b border-gray-100 last:border-0">
                          <input autoFocus value={renameColValue} onChange={e => setRenameColValue(e.target.value)}
                            placeholder={c.label}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { renameColumn(key, renameColValue); setRenamingCol(null) }
                              if (e.key === 'Escape') setRenamingCol(null)
                            }}
                            className="flex-1 min-w-0 text-xs border border-gray-300 rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-blue-400" />
                          <button onClick={() => { renameColumn(key, renameColValue); setRenamingCol(null) }} title="Save"
                            className="shrink-0 text-green-600 hover:text-green-700 px-1 text-xs font-bold">✓</button>
                          <button onClick={() => setRenamingCol(null)} title="Cancel"
                            className="shrink-0 text-gray-400 hover:text-gray-600 px-1 text-xs font-bold">×</button>
                        </div>
                      )
                      return (
                        <div key={key} className="flex items-center gap-1 px-2 py-1 border-b border-gray-100 last:border-0">
                          <label className="flex items-center gap-1.5 flex-1 min-w-0 text-xs text-gray-700 cursor-pointer select-none">
                            <input type="checkbox" checked={visibleCols.has(key)} onChange={() => toggleCol(key)}
                              className="w-3.5 h-3.5 accent-blue-600 shrink-0" />
                            <span className="truncate">{label}</span>
                          </label>
                          <button onClick={() => { setRenamingCol(key); setRenameColValue(label === c.label ? '' : label) }} title="Rename column"
                            className="shrink-0 text-gray-300 hover:text-gray-600 px-0.5 text-xs">✎</button>
                          <button onClick={() => moveCol(key, -1)} disabled={i === 0} title="Move up"
                            className="text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:hover:text-gray-400 px-1 text-xs leading-none">▲</button>
                          <button onClick={() => moveCol(key, 1)} disabled={i === colOrder.length - 1} title="Move down"
                            className="text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:hover:text-gray-400 px-1 text-xs leading-none">▼</button>
                        </div>
                      )
                    })}
                    {visibleCols.size > 0 && (
                      <button onClick={() => setVisibleCols(new Set())}
                        className="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50">
                        Clear all
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Analytics toggle -- swaps this submenu's normal list for the
                charts/trends that used to live under the removed "Data"
                tab. Items also carries Violations' charts (no single tab of
                its own to move those into); Loss and Counts get the same
                toggle inside their own components instead of here. */}
            {outerTab === 'loss' && ['items', 'sales', 'bills', 'expenses'].includes(lossView) && (
              <button onClick={() => { setShowAnalytics(a => !a); setAddForm(null); setViolation(null) }}
                className={`shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition
                  ${showAnalytics ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                📊 {showAnalytics ? 'List' : 'Analytics'}
              </button>
            )}

            {/* New button — Items/Sales/Bills/Expenses/PO submenus only; report-style and Counts submenus have no add-form */}
            {!showAnalytics && outerTab === 'loss' && ['items', 'sales', 'bills', 'expenses'].includes(lossView) && (() => {
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

        {/* Violation pills for whichever Grony Cash submenu is active --
            Counts/Feed only now (see LOSSVIEW_PILL_KEYS); tapping one swaps
            the submenu's normal content for its filtered fix view below.
            Tapping the active pill again clears it. Items' and Sales' own
            pills are hidden here -- every one of their violation types
            already surfaces as its own row on Joe's Role Bar panel (see
            cashViolations in useViolations.ts) and fixes inline there
            (RoleFlagsTable + ViolationFixPanel), so a pill row here would
            just be a duplicate, dead-end entry point. pillKeys itself stays
            wired for both (not removed from LOSSVIEW_PILL_KEYS) since the
            filtered-view logic below still keys off it if `violation` is
            ever set some other way (e.g. a stored URL param). */}
        {outerTab === 'loss' && pillKeys && lossView !== 'sales' && lossView !== 'items' && (
          <div className="flex items-center gap-1 px-2 py-1 bg-red-50 border-t border-red-100 overflow-x-auto">
            {ERROR_VIOLATIONS.filter(v => pillKeys.includes(v.key)).map(v => {
              const c = violationCounts[v.key] ?? 0
              return (
                <button key={v.key} onClick={() => setViolation(prev => prev === v.key ? null : v.key)}
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
        </>)}
      </div>

      {/* ── Content ── */}
      <div className="relative flex-1 min-h-0 overflow-y-auto">
        {/* Role Bar panel — replaces the tab content area (below the header,
            above the Role Bar) the same way switching a top-level tab does,
            instead of a modal that hides everything behind it. Mutually
            exclusive with the normal tab content below (not just visually
            stacked on top of it), so nothing from the underlying tab can
            bleed through and there's no wasted rendering/fetching while a
            Role Bar panel is open. */}
        {openRole ? (
          <RolePanel
            role={openRole}
            cashViolations={cashViolations} openerViolations={openerViolations}
            assignments={assignments} deadlines={deadlines} assignedBy={assignedBy} assignedOn={assignedOn} vSettings={vSettings}
            onGoToViolation={goToViolation}
            missingClosingReportsCount={globalFlags?.missingClosingReports?.length ?? 0}
            onOpenManage={() => changeTab('manage')}
            onClose={() => setOpenRole(null)}
            items={items}
            onItemsChanged={setItems}
            taskSubmenus={taskSubmenus}
          />
        ) : (<>
        {addForm === 'sale'    && outerTab === 'loss' && lossView === 'sales'    && <div className="px-4"><NewSaleForm    onSuccess={() => setAddForm(null)} /></div>}
        {addForm === 'bill'    && outerTab === 'loss' && lossView === 'bills'    && <div className="px-4"><NewBillForm    onSuccess={() => setAddForm(null)} /></div>}
        {addForm === 'expense' && outerTab === 'loss' && lossView === 'expenses' && <div className="px-4"><NewExpenseForm onSuccess={() => setAddForm(null)} /></div>}
        {addForm === 'item'    && outerTab === 'loss' && lossView === 'items'    && <div className="px-4"><NewItemForm    onSuccess={() => { setAddForm(null); loadItems() }} /></div>}
        {outerTab === 'loss' && lossView === 'pl' && (
          <TabErrorBoundary>
            <ProfitLossTab />
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'vendors' && (
          <TabErrorBoundary>
            <div className="px-4"><VendorsPage openAddSignal={vendorSignal} initialSearch={vendorSearchText} /></div>
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'customers' && (
          <TabErrorBoundary>
            <div className="px-4"><CustomersPage openAddSignal={customerSignal} initialSearch={customerSearchText} /></div>
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'receipts' && (
          <TabErrorBoundary>
            <div className="px-4"><ReceiptsPage /></div>
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'dailySummary' && (
          <TabErrorBoundary>
            <DailySummaryTab />
          </TabErrorBoundary>
        )}
        {outerTab === 'manage' && (
          <TabErrorBoundary>
            <GronyManageTab openStaffTimeSignal={staffTimeSignal} initialView={manageInitialView} />
          </TabErrorBoundary>
        )}
        {outerTab === 'today' && !(addForm === 'sale' || addForm === 'bill' || addForm === 'expense') && (
          <TabErrorBoundary>
            <div className="h-full overflow-y-auto px-4">
              <TodayContent />
            </div>
          </TabErrorBoundary>
        )}
        {!showAnalytics && addForm !== 'expense' && outerTab === 'loss' && lossView === 'expenses' && <ExpensesTab search={search} />}
        {showAnalytics && outerTab === 'loss' && lossView === 'expenses' && (
          <TabErrorBoundary><div className="px-3 pt-3"><ExpensesAnalyticsSection /></div></TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'cab' && <CABTab openConfirmSignal={cabConfirmSignal} />}
        {/* Items pill selected -> ItemsTab's filtered fix view; otherwise the
            submenu's normal content (LossTab). Same swap pattern for
            Sales/Counts/Feed below -- each of those already knows how to
            render its own filtered view when handed a matching violation
            key (SalesTab/CountsTab), or via the kind prop (LossFeedTab). */}
        {outerTab === 'loss' && violation && pillKeys?.includes(violation) && (
          <div className="mx-3 mt-2 mb-1 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex gap-2">
            <span className="text-sm shrink-0">ℹ️</span>
            <p className="text-[11px] text-blue-800 leading-snug">
              {ERROR_VIOLATIONS.find(v => v.key === violation)?.description}
            </p>
          </div>
        )}
        {showAnalytics && outerTab === 'loss' && lossView === 'items' && (
          <TabErrorBoundary>
            <div className="px-3 pt-3">
              <ItemsAnalyticsSection />
              <ViolationsAnalyticsSection />
            </div>
          </TabErrorBoundary>
        )}
        {!showAnalytics && addForm !== 'item' && outerTab === 'loss' && lossView === 'items' && (
          violation && pillKeys?.includes(violation) ? (
            itemsLoading
              ? <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>
              : (
                <TabErrorBoundary>
                  <ItemsTab
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
                </TabErrorBoundary>
              )
          ) : (
            <TabErrorBoundary>
              <LossTab onOpenItem={() => {}} search={search} group={group} productType={productType}
                visibleCols={visibleCols} colOrder={colOrder} columnLabels={columnLabels} />
            </TabErrorBoundary>
          )
        )}
        {showAnalytics && outerTab === 'loss' && lossView === 'sales' && (
          <TabErrorBoundary><div className="px-3 pt-3"><SalesAnalyticsSection /></div></TabErrorBoundary>
        )}
        {!showAnalytics && addForm !== 'sale' && outerTab === 'loss' && lossView === 'sales' && (
          <SalesTab items={items} groupFilter={group} search={search}
            violation={pillKeys?.includes(violation ?? '') ? violation : null}
            jumpToDate={jumpToReceiptDate} jumpToItemName={jumpToReceiptItemName}
            onJumpDone={() => { setJumpToReceiptDate(null); setJumpToReceiptItemName(null) }} />
        )}
        {showAnalytics && outerTab === 'loss' && lossView === 'bills' && (
          <TabErrorBoundary><div className="px-3 pt-3"><BillsAnalyticsSection /></div></TabErrorBoundary>
        )}
        {!showAnalytics && addForm !== 'bill' && outerTab === 'loss' && lossView === 'bills' && (
          <BillsTab items={items} groupFilter={group} search={search} />
        )}
        {outerTab === 'loss' && lossView === 'counts' && (
          <CountsTab items={items} groupFilter={group} search={search}
            violation={pillKeys?.includes(violation ?? '') ? violation : null} onFixRecords={goFixRecords} />
        )}
        {/* The gains pill (see LOSSVIEW_PILL_KEYS['feed']) bypasses the
            by-date/by-item/by-target sub-tabs entirely -- it's a violation
            to fix, not a way of browsing losses, so it stays on the
            original single-list view regardless of which sub-tab was last
            selected. */}
        {outerTab === 'loss' && lossView === 'feed' && (
          <TabErrorBoundary>
            {violation === 'gains'
              ? <LossFeedTab search={search} kind="gain" />
              : <LossOverviewTab search={search} />}
          </TabErrorBoundary>
        )}
        </>)}
      </div>

      {/* Role bar — Joe/Bino/Opener/Closer, always visible (never hidden by
          its own panel) so a skipped mandatory task (Opener's count
          confirmation, Closer's closing report) is always one tap away. The
          active tab gets the same blue highlight the top menu uses. The
          account menu (⋮) rides along on the right edge of the same bar. */}
      <RoleBar
        openRole={openRole}
        onSelectRole={key => setOpenRole(prev => prev === key ? null : key)}
        onShortcut={handleShortcut}
        cashCount={cashCount} dailyCount={openerViolationCount}
        missingClosingReportsCount={globalFlags?.missingClosingReports?.length ?? 0}
        trailing={
          <div className="relative shrink-0" ref={hamburgerRef}>
            {hamburgerOpen && (
              <div className="absolute bottom-full right-0 mb-1 bg-white border border-gray-200 rounded-xl shadow-xl min-w-[180px] overflow-hidden">
                <ViewPortalAsButton onDone={() => setHamburgerOpen(false)} />
                {hamburgerLinks.map(l => (
                  <Link key={l.href} href={l.href}
                    onClick={() => setHamburgerOpen(false)}
                    className="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 border-t border-gray-100 transition">
                    {l.label}
                  </Link>
                ))}
                <button onClick={() => signOut({ callbackUrl: '/login' })}
                  className="w-full text-left px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 border-t border-gray-100 transition">
                  Sign out
                </button>
              </div>
            )}
            {/* Doubles as the account menu trigger and an always-visible
                reminder of who's actually logged in -- a device left signed
                in as one person for hours/days is easy to miss (see the
                Joe/Bino misattribution case), and this sits right where the
                eye lands before tapping into any form. */}
            <button onClick={() => setHamburgerOpen(o => !o)} title="Logged in as"
              className="flex items-center justify-center px-4 py-4 text-gray-500 hover:bg-gray-50 transition text-[9px] font-semibold capitalize whitespace-nowrap">
              👤 {username || '—'}
            </button>
          </div>
        }
      />

      {/* Home -- floating above the Role Bar instead of taking a slot in the
          top tab row, since it's a single, always-in-the-same-place shortcut
          rather than a peer of Grony Cash/Grony Manage. */}
      <button onClick={() => changeTab('today')} aria-label="Home"
        className={`fixed bottom-20 right-4 z-40 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition
          ${outerTab === 'today' && !openRole ? 'bg-brand text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5 10v9a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h0a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-9" />
        </svg>
        {/* Unread announcements -- draws the eye back to Home instead of
            requiring a check-in tap to find out something new was posted. */}
        {unreadAnnouncements > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white
            text-[10px] font-bold leading-none flex items-center justify-center border-2 border-white">
            {unreadAnnouncements > 99 ? '99+' : unreadAnnouncements}
          </span>
        )}
      </button>

      {/* Daily -- same treatment as Home: floating above the Role Bar
          instead of taking a slot in the Grony Cash submenu row, since it's
          a single, always-in-the-same-place shortcut. Mirrored to the
          bottom-left so it doesn't collide with Home. */}
      <button onClick={() => { changeTab('loss'); setLossView('dailySummary') }} aria-label="Daily"
        className={`fixed bottom-20 left-4 z-40 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition
          ${outerTab === 'loss' && lossView === 'dailySummary' && !openRole ? 'bg-brand text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <line x1="16" y1="3" x2="16" y2="7" />
          <line x1="8" y1="3" x2="8" y2="7" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {/* Global search overlay -- click outside/× closes it; each result
          jumps straight to the right tab (and, for Sales/Bills/Customers/
          Vendors, pre-fills that tab's own search with the match) or
          straight to the item's 360 page. */}
      {globalSearchOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center pt-16 px-4" onClick={closeGlobalSearch}>
          <div onClick={e => e.stopPropagation()}
            className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[70vh] flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 p-3 border-b border-gray-100 shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 shrink-0">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input autoFocus value={globalSearchQuery} onChange={e => setGlobalSearchQuery(e.target.value)}
                placeholder="Search items, customers, vendors, sales, bills, announcements…"
                className="flex-1 min-w-0 text-sm outline-none" />
              <button onClick={closeGlobalSearch} className="shrink-0 text-gray-400 hover:text-gray-600 text-lg leading-none px-1">×</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {navMatches.length > 0 && (
                <div>
                  <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Go to</p>
                  {navMatches.map(d => (
                    <button key={d.label} onClick={() => { d.action(); closeGlobalSearch() }}
                      className="w-full text-left px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition truncate">
                      {d.label}
                    </button>
                  ))}
                </div>
              )}
              {globalSearchLoading && <p className="p-4 text-center text-xs text-gray-400">Searching…</p>}
              {!globalSearchLoading && navMatches.length === 0 && globalSearchQuery.trim().length > 0 && globalSearchQuery.trim().length < 2 && (
                <p className="p-4 text-center text-xs text-gray-400">Keep typing…</p>
              )}
              {!globalSearchLoading && globalSearchResults && (() => {
                const r = globalSearchResults
                const totalCount = (r.items?.length ?? 0) + (r.customers?.length ?? 0) + (r.vendors?.length ?? 0)
                  + (r.sales?.length ?? 0) + (r.bills?.length ?? 0) + (r.announcements?.length ?? 0)
                if (totalCount === 0 && navMatches.length === 0) return <p className="p-4 text-center text-xs text-gray-400">No matches</p>
                return (<>
                  {!!r.items?.length && (
                    <div>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Items</p>
                      {r.items.map(i => (
                        <button key={i.id} onClick={() => { router.push(`/stock/${i.id}`); closeGlobalSearch() }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition truncate">
                          {i.name}
                          {i.cf_group && <span className="text-gray-400 text-xs ml-1.5">· {i.cf_group}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {!!r.customers?.length && (
                    <div>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Customers</p>
                      {r.customers.map(c => (
                        <button key={c.id}
                          onClick={() => { changeTab('loss'); setLossView('customers'); setCustomerSearchText(c.display_name); closeGlobalSearch() }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition truncate">
                          {c.display_name}
                          {c.company_name && <span className="text-gray-400 text-xs ml-1.5">· {c.company_name}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {!!r.vendors?.length && (
                    <div>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Vendors</p>
                      {r.vendors.map(v => (
                        <button key={v.id}
                          onClick={() => { changeTab('loss'); setLossView('vendors'); setVendorSearchText(v.display_name); closeGlobalSearch() }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition truncate">
                          {v.display_name}
                          {v.company_name && <span className="text-gray-400 text-xs ml-1.5">· {v.company_name}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {!!r.sales?.length && (
                    <div>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Sales</p>
                      {r.sales.map(s => (
                        <button key={s.id}
                          onClick={() => { changeTab('loss'); setLossView('sales'); setSearch(s.receipt_number || s.customer_name || ''); closeGlobalSearch() }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition truncate">
                          {s.receipt_number || `Receipt #${s.id}`}
                          {s.customer_name && <span className="text-gray-400 text-xs ml-1.5">· {s.customer_name}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {!!r.bills?.length && (
                    <div>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Bills</p>
                      {r.bills.map(b => (
                        <button key={b.id}
                          onClick={() => { changeTab('loss'); setLossView('bills'); setSearch(b.bill_number || b.vendor_name || ''); closeGlobalSearch() }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition truncate">
                          {b.bill_number || `Bill #${b.id}`}
                          {b.vendor_name && <span className="text-gray-400 text-xs ml-1.5">· {b.vendor_name}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {!!r.announcements?.length && (
                    <div>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Announcements</p>
                      {r.announcements.map(a => (
                        <button key={a.id} onClick={() => { changeTab('today'); closeGlobalSearch() }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition truncate">
                          {a.body || '(no text)'}
                          <span className="text-gray-400 text-xs ml-1.5">· {a.author}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>)
              })()}
            </div>
          </div>
        </div>
      )}
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
