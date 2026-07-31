'use client'
import { useState, useEffect, useRef, useMemo, Component, Suspense, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'

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
import NewShortcutButton, { type ShortcutKey } from './_components/NewShortcutButton'
import PaneHomeDaily from './_components/PaneHomeDaily'
import TasksView from './_components/TasksView'
import { COLUMNS, type ColKey } from './_components/lossTabColumns'
import { useColumnPrefs, ColumnsPickerButton } from './_components/columnPrefs'
import { MANAGE_LIST_ITEMS, useDynamicManageCategories, type ManageView } from './_components/manageViewData'
import { STAFF_PERSONAL_ITEMS, STAFF_TEAM_ITEMS, type StaffView } from './_components/staffViewData'
import type { ViolationView } from '../staff/StaffClient'
import SavedFlash from './_components/SavedFlash'
import { SidePaneContainer, SidePaneToggle, SidePaneButton, useSidePaneDisplayMode } from './_components/SidePane'
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
const LossByItemTab  = dynamic(() => import('./_components/LossByItemTab'),   { ssr: false, loading: () => loading('Loading…') })
const ProfitLossTab  = dynamic(() => import('./_components/ProfitLossTab'),   { ssr: false, loading: () => loading('Loading…') })
const DailySummaryTab = dynamic(() => import('./_components/DailySummaryTab'), { ssr: false, loading: () => loading('Loading…') })
const GronyManageContent = dynamic(() => import('./_components/GronyManageTab'), { ssr: false, loading: () => loading('Loading…') })
const VendorsPage    = dynamic(() => import('../vendors/page'),               { ssr: false, loading: () => loading('Loading…') })
const CustomersPage  = dynamic(() => import('../customers/page'),             { ssr: false, loading: () => loading('Loading…') })
const ReceiptsPage   = dynamic(() => import('../receipts/page'),              { ssr: false, loading: () => loading('Loading…') })
const PurchaseOrdersPage  = dynamic(() => import('../purchase-orders/page'),        { ssr: false, loading: () => loading('Loading…') })
const AliasWidePage       = dynamic(() => import('../aliases/wide/page'),           { ssr: false, loading: () => loading('Loading…') })
const ServiceMatchesPage  = dynamic(() => import('../matches/wide/page'),           { ssr: false, loading: () => loading('Loading…') })
const FixMislinkedSalesPage = dynamic(() => import('../debug/unlink-mismatch/page'), { ssr: false, loading: () => loading('Loading…') })
const Item360Tab = dynamic(() => import('./_components/Item360Tab'),          { ssr: false, loading: () => loading('Loading…') })
const StaffContent = dynamic(() => import('./_components/StaffPersonTab'),    { ssr: false, loading: () => loading('Loading…') })
const UKTab = dynamic(() => import('./_components/UKTab'), { ssr: false, loading: () => loading('Loading…') })
const CHTab = dynamic(() => import('./_components/CHTab'), { ssr: false, loading: () => loading('Loading…') })
// Same lazy hamburger-menu widget the old per-staff-page footer used -- it
// already self-gates to owner-level (Grony/Joe) and hides itself while
// already impersonating, so it's safe on the merged pane's shared footer
// unconditionally; it simply renders nothing for anyone else.
const ViewPortalAsButton = dynamic(() => import('@/components/ViewPortalAsButton'), { ssr: false })

// Every real staff member, including Grony -- the third top-level tab shows
// whichever one of these matches the logged-in username, and that person's
// own page is built from this same roster (see StaffClient.tsx's own STAFF/
// ALL_STAFF_NAMES constants, which this must stay in sync with).
const STAFF_ROSTER = ['Joe', 'Bino', 'James', 'Rawlings', 'Grony']

// 'uk' is Grony's own private top-level tab; 'ch' is Grony/Joe's -- both
// tabs' own components re-check the session themselves too, so this is
// just about not showing the tab button to anyone else, not the only thing
// guarding the page.
type OuterTab = 'today' | 'loss' | 'uk' | 'ch'

// Sales, Bills, Counts, Feed, Expenses, PO, P&L, CAB, Vendors, Customers,
// Receipts, Daily (Summary), Data, Grony Manage's own rows, and Staff's own
// rows all live as submenus inside the one merged Grony Cash tab (outerTab
// 'loss' -- kept as the internal key since it's referenced throughout; only
// the label changed, and it now covers what used to be three separate top
// menus). ManageView/StaffView are each still defined and maintained in
// their own file (manageViewData.ts/staffViewData.ts) -- this just unions
// them in so one `lossView` state can drive one merged pane + content area.
type LossView = 'home' | 'tasks' | 'items' | 'sales' | 'bills' | 'counts' | 'feed' | 'lossByItem' | 'lossByTarget' | 'expenses' | 'pl' | 'cab' | 'vendors' | 'customers' | 'receipts' | 'dailySummary'
  | 'purchaseOrders' | 'fixMislinkedSales' | 'item360'
  | ManageView | StaffView
// Alias Wide Table and Service Matches used to be their own lossViews --
// they're now reached from inside Items itself (see ItemsExtraView below),
// so an old '?view=aliasWide'/'serviceMatches' link still needs a home to
// land on instead of a blank pane.
type ItemsExtraView = 'none' | 'aliasWide' | 'serviceMatches'
const OLD_LOSSVIEW_TO_EXTRA: Partial<Record<string, ItemsExtraView>> = {
  aliasWide: 'aliasWide', serviceMatches: 'serviceMatches',
}

// Every row that used to belong to Grony Manage's or Staff's own separate
// left panes -- now just more entries in Grony Cash's one merged pane and
// `lossView`. Used below to keep the groups/search controls row hidden for
// all of them (same as the old report-style Cash views) and to gate which
// content component (Cash's own blocks vs GronyManageContent vs
// StaffContent) a given lossView renders.
const MANAGE_VIEW_KEYS = new Set<LossView>(MANAGE_LIST_ITEMS.map(i => i.key))
const STAFF_VIEW_KEYS = new Set<LossView>([
  ...STAFF_PERSONAL_ITEMS.map(i => i.key), 'staffProfile', ...STAFF_TEAM_ITEMS.map(i => i.key), 'users',
])

// Old top-level tabs that got folded into Grony Cash submenus -- old
// bookmarks/links using ?tab=pl etc. still land on the right submenu instead
// of silently falling back to Today. ?tab=data (the old standalone
// Analytics/"Data" tab, now redistributed as an Analytics toggle on each of
// Items/Sales/Bills/Expenses/Loss/Counts) lands on Items -- there's no
// single tab left to send it to. ?tab=manage and ?tab=staff (the old
// standalone Grony Manage/Staff top menus) now land here too, on each
// area's own former default view, since both folded into this same tab.
const OLD_TAB_TO_VIEW: Partial<Record<string, LossView>> = {
  pl: 'pl', expenses: 'expenses', cab: 'cab', dailySummary: 'dailySummary', data: 'items',
  manage: 'audio', staff: 'staffTimes',
}

// Self-contained submenus -- either their own dashboard, or a standalone
// page with its own internal search/filter/add UI -- so the shared
// groups/search/New controls row doesn't apply to them. Every former
// Manage/Staff view belongs here too -- none of them ever had a Cash-style
// groups/search bar of their own.
const REPORT_VIEWS = new Set<LossView>([
  'home', 'tasks', 'pl', 'cab', 'vendors', 'customers', 'receipts', 'dailySummary',
  'purchaseOrders', 'fixMislinkedSales', 'item360',
  ...MANAGE_VIEW_KEYS, ...STAFF_VIEW_KEYS,
])

// Grony Cash's own left pane, same shape as Grony Manage's -- Sales, Bills,
// and Daily Loss (Feed) come first, then Items is the tab's own default
// view. P&L only shows for owner/joe (see canSeePL below), Fix Mislinked
// Sales only for owner/joe (see isOwnerOrJoe below) -- both filtered where
// this list is used. The rest (Customers onward) used to live only in the
// account menu; they've since moved here instead (their hamburger entries
// were removed once this list covered them) so nothing Grony-Cash-related
// needs the hamburger menu any more.
//
// Loss by Date/Item/Target used to be one 'feed' entry with its own internal
// pill row (LossOverviewTab) switching between the three. They're now three
// separate left-pane entries instead -- 'feed' keeps its key (and the gains
// violation deep-link that already points at it) but is relabeled to "Loss
// by Date", with Loss by Item and Loss by Target following right after as
// their own lossViews.
//
// Tasks used to live on the bottom Role Bar (Joe's tab), bundled together
// with Grony Manage's own violations (the "former Bino bucket" -- staff
// times, adverts, jingle, equipment checks). That bar is gone now -- Tasks
// is a left-pane item for whichever section it actually belongs to instead,
// so Cash only ever shows Cash's own outstanding items (see
// cashTasksViolations below); Manage's own Tasks row (key 'manageTasks',
// see manageViewData.ts) gets the same treatment further down this same
// merged pane.
const CASH_ITEMS: { key: LossView; label: string; icon: string }[] = [
  { key: 'tasks',    label: 'Tasks',    icon: '✅' },
  { key: 'items',    label: 'Items',    icon: '📦' },
  { key: 'sales',    label: 'Sales',    icon: '🧾' },
  { key: 'bills',    label: 'Bills',    icon: '📃' },
  { key: 'feed',         label: 'Loss by Date',   icon: '📉' },
  { key: 'lossByItem',   label: 'Loss by Item',   icon: '📊' },
  { key: 'lossByTarget', label: 'Loss by Target', icon: '🎯' },
  { key: 'expenses', label: 'Expenses', icon: '💳' },
  { key: 'pl',       label: 'P&L',      icon: '📈' },
  { key: 'cab',      label: 'CAB',      icon: '🗂️' },
  { key: 'customers', label: 'Customers', icon: '👥' },
  { key: 'vendors',   label: 'Vendors',   icon: '🏭' },
  { key: 'receipts',  label: 'Receipts',  icon: '📑' },
  { key: 'counts',    label: 'Counts',    icon: '🔢' },
  { key: 'purchaseOrders',   label: 'Purchase Orders',   icon: '🛒' },
  { key: 'fixMislinkedSales', label: 'Fix Mislinked Sales', icon: '🩹' },
  { key: 'item360', label: 'Item 360', icon: '🔍' },
]

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
// shows which pills. no_advert/jingle_overdue/equipment_check_overdue aren't
// listed: they land on Grony Manage's Advert sub-tab. no_staff_times isn't
// listed either: it lands on the Staff tab's Team overview, which carries
// that checklist since it's about a missing day, not one person.
const VIOLATION_HOME: Partial<Record<string, LossView>> = {
  neg_soh: 'items', no_sp: 'items', no_cp: 'items', no_group: 'items',
  duplicates: 'items', unlinked_named: 'items', service_violation: 'items',
  alias_prezoho_sales: 'items', alias_prezoho_bills: 'items', alias_flagged: 'items', alias_ambiguous: 'items',
  daily: 'counts', '7day': 'counts', '15day': 'counts',
  gains: 'feed',
  no_cash: 'sales', missing_days: 'sales', cost_price: 'sales', dup_receipt: 'sales',
  unchecked_cab: 'cab',
}

// Which violation keys belong to each lossView -- scopes the info banner
// and filtered views (ItemsTab/SalesTab/CountsTab/LossFeedTab) reached via
// a "Fix now" deep link (see goFixRecords/goToViolation).
const LOSSVIEW_PILL_KEYS: Partial<Record<LossView, string[]>> = {
  items: [
    'neg_soh', 'no_sp', 'no_cp', 'no_group', 'duplicates', 'unlinked_named', 'service_violation',
    'alias_prezoho_sales', 'alias_prezoho_bills', 'alias_flagged', 'alias_ambiguous',
  ],
  counts: ['daily', '7day', '15day'],
  feed: ['gains'],
  sales: ['no_cash', 'missing_days', 'cost_price', 'dup_receipt'],
  cab: ['unchecked_cab'],
}

// The "former Bino bucket" -- everything in cashViolations that isn't
// actually a Cash concern. Used to split one merged Tasks list back into
// Cash's own Tasks and Manage's own Tasks now that each top-level tab has
// its own left-pane Tasks item instead of one shared Role Bar tab covering
// both. no_staff_times lands here too (not in its own Staff Tasks list --
// there isn't one) since Manage is the closest operational home for it, and
// clicking it still jumps to the Staff tab same as it always has.
const MANAGE_VIOLATION_TYPES = new Set(['no_staff_times', 'no_advert', 'jingle_overdue', 'equipment_check_overdue'])

const VALID_TABS: OuterTab[] = ['today', 'loss', 'uk', 'ch']

function ItemHubPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawInitialTab = searchParams.get('tab')
  const oldTabView = rawInitialTab ? OLD_TAB_TO_VIEW[rawInitialTab] : undefined
  // 'losses' (the old standalone Loss Feed tab) and the old pl/expenses/cab/
  // data/manage/staff top-level tabs (all folded into Grony Cash by now)
  // still land somewhere sensible instead of silently falling back to Today.
  const initialTab = (rawInitialTab === 'losses' || oldTabView ? 'loss' : rawInitialTab) as OuterTab | null
  const [outerTab, setOuterTab] = useState<OuterTab>(
    initialTab && VALID_TABS.includes(initialTab) ? initialTab : 'today'
  )
  const [group, setGroup]               = useState<string | null>(null)
  const [productType, setProductType]   = useState<'all' | 'goods' | 'services'>('all')
  const rawInitialView = searchParams.get('view')
  const initialExtraView = rawInitialView ? OLD_LOSSVIEW_TO_EXTRA[rawInitialView] : undefined
  const initialView = (initialExtraView ? 'items' : rawInitialView) as LossView | null
  const [lossView, setLossView]         = useState<LossView>(
    rawInitialTab === 'losses' ? 'feed' : (oldTabView ?? initialView ?? 'items')
  )
  const [itemsExtraView, setItemsExtraView] = useState<ItemsExtraView>(initialExtraView ?? 'none')
  // Alias Wide / Service Match only make sense while actually on Items --
  // leaving it (any other submenu, or another top-level tab) drops back to
  // the normal item list instead of stranding you in one of them.
  useEffect(() => {
    if (lossView !== 'items') setItemsExtraView('none')
  }, [lossView])
  const [search, setSearch]             = useState(searchParams.get('q') ?? '')
  const [violation, setViolation]       = useState<string | null>(searchParams.get('violation'))
  const [groupOpen, setGroupOpen]       = useState(false)
  const [searchOpen, setSearchOpen]     = useState(false)
  const [addForm, setAddForm]             = useState<'item' | 'sale' | 'bill' | 'expense' | null>(null)
  const [jumpToItemId, setJumpToItemId]   = useState<number | null>(null)
  // Seeded from ?jumpDate=/?jumpItem= -- Item 360's Detail table (and its
  // "click a date" links) lands here via /item?tab=loss&view=sales&jumpDate=
  // ...&jumpItem=..., which the URL-sync effect below strips off again on
  // its first run since only tab/view/q are ever written back to the URL.
  const [jumpToReceiptDate, setJumpToReceiptDate] = useState<string | null>(searchParams.get('jumpDate'))
  const [jumpToReceiptItemName, setJumpToReceiptItemName] = useState<string | null>(searchParams.get('jumpItem'))
  // Every "tap an item" spot in the app (Items list rows, Sales/Bills item
  // links, the old standalone /stock/[id] route's former callers) now lands
  // here instead -- ?jumpItemId= opens Item 360 straight to that item's
  // detail rather than its search box. Seeded (and re-seeded on later
  // same-page navigations) entirely by the searchParams effect below, since
  // a plain useState initializer only ever sees the URL a page starts on.
  const [item360JumpId, setItem360JumpId] = useState<number | null>(null)
  const groupRef     = useRef<HTMLDivElement>(null)
  const searchRef    = useRef<HTMLDivElement>(null)

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

  // Manage's user-added categories -- shared between the merged pane
  // (listing/adding/removing them) and GronyManageContent (rendering the
  // active one).
  const {
    dynamicCategories, activeDynamicId, setActiveDynamicId,
    showAddCategory, setShowAddCategory, newCategoryLabel, setNewCategoryLabel,
    savingCategory, justAddedCategory, addCategory, removeCategory,
  } = useDynamicManageCategories()

  // Staff's "Viewing" picker -- who the personal rows (Times/Payslips/etc.)
  // apply to. Only Joe/Grony ever change this away from their own name;
  // everyone else always views themself (see viewingName below).
  const [viewingNameOverride, setViewingNameOverride] = useState<string | undefined>(undefined)
  const [vtab, setVtab] = useState<ViolationView>('Disciplinary')
  const [teamVtab, setTeamVtab] = useState<ViolationView>('Disciplinary')

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
  // column) show, their order, and any custom labels -- lives here (next
  // to the New button) rather than inside LossTab, since that's where the
  // "Columns" picker lives. 'lossTab' as the storage key keeps reading the
  // same localStorage entries this used before the picker became shared
  // (see columnPrefs.tsx) across every other list page too.
  const itemsColPrefs = useColumnPrefs<ColKey>('lossTab', COLUMNS)

  // Toggles the Items/Sales/Bills/Expenses tabs over to their Analytics
  // view instead of the normal list -- these four (plus Loss and Counts,
  // which own the same toggle themselves, see LossByItemTab/CountsTab)
  // are where the removed "Data" tab's eight sections got redistributed to.
  const [showAnalytics, setShowAnalytics] = useState(false)

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

  // Backs Cash's and Manage's own Tasks, and Manage's Opener/Closer --
  // computed once regardless of which outer tab is showing.
  const {
    cashViolations, openerViolations, openerViolationCount,
    assignments, deadlines, assignedBy, assignedOn, vSettings,
  } = useViolations(violationCounts)
  const cashTasksViolations = cashViolations.filter(v => !MANAGE_VIOLATION_TYPES.has(v.type))
  const manageTasksViolations = cashViolations.filter(v => MANAGE_VIOLATION_TYPES.has(v.type))
  const cashTasksCount = cashTasksViolations.reduce((s, v) => s + v.count, 0)
  const manageTasksCount = manageTasksViolations.reduce((s, v) => s + v.count, 0)

  // The morning stock count is the opener's own job -- its badge (on
  // Manage's Opener left-pane item) combines "hasn't confirmed clock-in
  // yet" with the separate "items not yet counted today" violation count,
  // same formula the old Role Bar's Opener tab used.
  const [openerToday, setOpenerToday] = useState<{ opener: string | null; openerConfirmed: boolean | null }>({ opener: null, openerConfirmed: null })
  useEffect(() => {
    fetch('/api/staff-times/today')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setOpenerToday({ opener: d.opener ?? null, openerConfirmed: d.openerConfirmed ?? null }) })
      .catch(() => {})
  }, [])
  const openerBadgeCount = (openerToday.opener && !openerToday.openerConfirmed ? 1 : 0) + openerViolationCount

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
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function changeTab(t: OuterTab) {
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

  // The one navigation primitive every Cash/Manage/Staff row (and every
  // deep link into one) goes through -- unlike changeTab('loss') above,
  // this jumps straight to a specific row regardless of which outer tab is
  // currently showing, so callers don't need their own changeTab-then-
  // override two-step any more.
  function pickLossView(view: LossView) {
    setOuterTab('loss')
    setLossView(view)
    setActiveDynamicId(null)
    setViolation(null)
    setAddForm(null)
    setShowAnalytics(false)
  }

  // Joe/Grony's "Viewing" picker -- switches whose personal rows show.
  // Profile only ever means "my own login", so switching away from it while
  // it's showing has nowhere sensible to land -- falls back to Times
  // instead of leaving the content area blank.
  function pickViewing(name: string) {
    setViewingNameOverride(name)
    if (lossView === 'staffProfile' && name.toLowerCase() !== (myStaffName ?? '').toLowerCase()) {
      setLossView('staffTimes')
    }
  }

  // From the loss dialog: jump to the records that usually explain a "loss"
  // (Sales / Bills / Counts live as sub-views of the Grony Cash tab).
  function goFixRecords(view: 'sales' | 'bills' | 'counts') {
    pickLossView(view)
  }

  // RoleBar "+" shortcut menu -- jumps straight to a "create new" flow
  // wherever it already lives. Sales/Bills/Item/Expenses reuse the existing
  // addForm mechanism (pickLossView resets it, so set it after); the rest
  // reopen via a per-target signal since their forms are local component
  // state with no addForm equivalent.
  function handleShortcut(key: ShortcutKey) {
    switch (key) {
      case 'sale':       pickLossView('sales');     setAddForm('sale'); break
      case 'bill':       pickLossView('bills');     setAddForm('bill'); break
      case 'item':       pickLossView('items');     setAddForm('item'); break
      case 'expense':    pickLossView('expenses');  setAddForm('expense'); break
      case 'cabConfirm': pickLossView('cab');       setCabConfirmSignal(n => n + 1); break
      case 'customer':   pickLossView('customers'); setCustomerSignal(n => n + 1); break
      case 'vendor':     pickLossView('vendors');   setVendorSignal(n => n + 1); break
      case 'staffTime': {
        // The Staff section always opens straight to your own page now, and
        // Times is its first (shared) row -- nothing left to pick.
        pickLossView('staffTimes')
        setStaffTimeSignal(n => n + 1)
        break
      }
    }
  }

  // Tab/sub-view changes push a new history entry each -- real "pages" the
  // user expects the back button to step through one at a time, landing on
  // the exact one they were on (see the popstate sync effect below, which
  // pulls state back OUT of the URL when that happens). Search stays on
  // router.replace (below) since it shouldn't spam history per keystroke.
  // Skips the push entirely when the computed URL already matches the
  // current one, which is what happens right after that same popstate sync
  // applies a change that came FROM the URL in the first place -- without
  // this guard every back-press would immediately push a duplicate entry
  // back on top of the one just popped.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (outerTab !== 'today') params.set('tab', outerTab); else params.delete('tab')
    if (outerTab === 'loss' && lossView !== 'items') params.set('view', lossView); else params.delete('view')
    const qs = params.toString()
    const target = qs ? `/item?${qs}` : '/item'
    const current = window.location.pathname + window.location.search
    if (target === current) return
    router.push(target, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outerTab, lossView])

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

  // Pulls tab/sub-view state back OUT of the URL whenever it changes
  // without our own doing -- i.e. the user pressed back/forward. Harmless
  // no-op the rest of the time, since the state this derives already
  // matches what's live once our own push above has run.
  useEffect(() => {
    const urlTab = searchParams.get('tab')
    const nextTab: OuterTab = urlTab && VALID_TABS.includes(urlTab as OuterTab) ? (urlTab as OuterTab) : 'today'
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (nextTab !== outerTab) setOuterTab(nextTab)
    if (nextTab === 'loss') {
      const rawUrlView = searchParams.get('view')
      const urlExtraView = rawUrlView ? OLD_LOSSVIEW_TO_EXTRA[rawUrlView] : undefined
      const nextView: LossView = (urlExtraView ? 'items' : rawUrlView) as LossView ?? 'items'
      if (nextView !== lossView) setLossView(nextView)
      if (urlExtraView && urlExtraView !== itemsExtraView) setItemsExtraView(urlExtraView)
    }
    // Read (and re-read) on every searchParams change, not just first mount --
    // unlike outerTab/lossView above, a plain useState initializer would only
    // ever see this on a fresh page load, never on a same-page router.push
    // from one Grony Cash submenu to another (Sales/Bills/Counts/etc. tapping
    // an item all land here this way now that /stock/[id] is gone). Stripped
    // back out of the URL immediately after being read, or switching lossView
    // again later would keep re-triggering the same jump forever.
    const rawJumpItemId = searchParams.get('jumpItemId')
    if (rawJumpItemId) {
      const n = Number(rawJumpItemId)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!Number.isNaN(n)) setItem360JumpId(n)
      const params = new URLSearchParams(window.location.search)
      params.delete('jumpItemId')
      const qs = params.toString()
      router.replace(qs ? `/item?${qs}` : '/item', { scroll: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  function goToViolation(key: string) {
    // The loss-summary rows point at the Loss feed (a row of the merged
    // pane), not a violation pill.
    if (key === '__loss_feed') { pickLossView('feed'); return }
    // The Advert section's own checks (audio adverts, jingle, equipment)
    // now route straight to their exact row instead of just landing
    // somewhere in Manage's section generally.
    if (key === 'no_advert') { pickLossView('audio_status'); return }
    if (key === 'jingle_overdue') { pickLossView('jingle'); return }
    if (key === 'equipment_check_overdue') { pickLossView('equipment'); return }
    // No Staff Times is about a missing day, not one person, so it just
    // lands on Staff's Times row -- shared and unfiltered, it already shows
    // every staff member's clock records.
    if (key === 'no_staff_times') { pickLossView('staffTimes'); return }
    const targetView = VIOLATION_HOME[key]
    if (!targetView) return
    pickLossView(targetView)
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
  const pillKeys = LOSSVIEW_PILL_KEYS[lossView]

  const groupLabel = [
    group ?? 'All Groups',
    productType !== 'all' ? (productType === 'goods' ? 'Goods' : 'Services') : null,
  ].filter(Boolean).join(' · ')

  const showControls = outerTab === 'loss' && !REPORT_VIEWS.has(lossView)
  const [cashDisplayMode, changeCashDisplayMode] = useSidePaneDisplayMode()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role ?? 'staff'
  const username = (session?.user as any)?.username ?? session?.user?.name ?? ''
  const canSeePL = role === 'owner' || username === 'joe'
  const isOwnerOrJoe = role === 'owner' || username.toLowerCase() === 'joe'
  const isGrony = username.toLowerCase() === 'grony'
  // The one owner-level gate Manage's Add Category/Rota edit controls AND
  // the Staff section's admin extras (Viewing picker, Team, Users) both use
  // -- previously each was its own hand-rolled, slightly different check;
  // merging the three panes onto one is a good excuse to fold them into one.
  const canManage = isOwnerOrJoe || isGrony
  // Drives the merged pane's own-name section AND which staff page it
  // opens -- "just like the user profile icon", it's always your own name,
  // not a generic "Staff" label or a pick-a-person screen. Falls back to
  // undefined for a logged-in account with no matching staff page (there
  // shouldn't be one in practice, but the section still needs to degrade
  // gracefully instead of showing a stranger's personal records).
  const myStaffName = STAFF_ROSTER.find(n => n.toLowerCase() === username.toLowerCase())
  // Whose personal rows (Times/Payslips/etc.) currently show -- always your
  // own name unless you're Joe/Grony and have switched it via the pane's
  // Viewing picker.
  const viewingName = viewingNameOverride ?? myStaffName ?? ''

  // Every real submenu under Grony Cash, Grony Manage, and the account
  // (person icon) menu -- three separate, tagged lists rather than one
  // flat one, since both the global search's "Go to" section AND the
  // Tasks panel's blue bars (see RoleFlagsTable's allSubmenus prop) need
  // this same set. Keeping it in exactly one place is the point: add a
  // submenu here and it shows up in both places on its own, instead of
  // two separately-maintained lists drifting apart (which is what
  // happened to "Daily Loss" vs "Loss" before this).
  const cashSubmenus: { label: string; action: () => void }[] = [
    { label: 'Items', action: () => pickLossView('items') },
    { label: 'Sales', action: () => pickLossView('sales') },
    { label: 'Bills', action: () => pickLossView('bills') },
    { label: 'Loss by Date', action: () => pickLossView('feed') },
    { label: 'Loss by Item', action: () => pickLossView('lossByItem') },
    { label: 'Loss by Target', action: () => pickLossView('lossByTarget') },
    { label: 'Expenses', action: () => pickLossView('expenses') },
    ...(canSeePL ? [{ label: 'P&L', action: () => pickLossView('pl') }] : []),
    { label: 'CAB', action: () => pickLossView('cab') },
    { label: 'Vendors', action: () => pickLossView('vendors') },
    { label: 'Customers', action: () => pickLossView('customers') },
    { label: 'Receipts', action: () => pickLossView('receipts') },
    { label: 'Daily', action: () => pickLossView('dailySummary') },
    { label: 'Counts', action: () => pickLossView('counts') },
    { label: 'Purchase Orders', action: () => pickLossView('purchaseOrders') },
    { label: 'Alias Wide Table', action: () => { pickLossView('items'); setItemsExtraView('aliasWide') } },
    { label: 'Service Matches', action: () => { pickLossView('items'); setItemsExtraView('serviceMatches') } },
    ...(isOwnerOrJoe ? [{ label: 'Fix Mislinked Sales', action: () => pickLossView('fixMislinkedSales') }] : []),
    { label: 'Item 360', action: () => pickLossView('item360') },
  ]
  const manageSubmenus: { label: string; action: () => void }[] = [
    { label: 'Rota', action: () => pickLossView('rota') },
    { label: 'Audio', action: () => pickLossView('audio') },
    { label: 'Advert Status', action: () => pickLossView('audio_status') },
    { label: 'Jingle Log', action: () => pickLossView('jingle') },
    { label: 'Equipment Check', action: () => pickLossView('equipment') },
    { label: 'Photoshop', action: () => pickLossView('photoshop') },
    { label: 'WhatsApp', action: () => pickLossView('whatsapp') },
    { label: 'Cuttings', action: () => pickLossView('cuttings') },
    { label: 'Video', action: () => pickLossView('video') },
    { label: 'Advert Daily Log', action: () => pickLossView('advert_log') },
    { label: 'Dress Code', action: () => pickLossView('staff_dress') },
    { label: 'Arrangement', action: () => pickLossView('arrangement') },
    { label: 'Cleanliness', action: () => pickLossView('cleanliness') },
    { label: 'Future', action: () => pickLossView('future') },
    { label: 'Customer Display', action: () => pickLossView('customer_display') },
    { label: 'Staff Display', action: () => pickLossView('staff_display') },
    { label: 'Repair Works', action: () => pickLossView('repair_works') },
    { label: 'Quality Assurance', action: () => pickLossView('quality_assurance') },
    { label: 'Tutorial', action: () => pickLossView('tutorial') },
    { label: 'Company Laws', action: () => pickLossView('training_laws') },
    { label: 'Assessment', action: () => pickLossView('assessment') },
    { label: 'Logs', action: () => pickLossView('logs') },
  ]

  // Just the one destination now -- your own Staff page. Picking a
  // different staff member's individual records isn't a top-level
  // destination any more; Joe/Grony do that from the pane's own Viewing
  // picker / Team section instead (see StaffContent).
  const staffSubmenus: { label: string; action: () => void }[] = myStaffName
    ? [{ label: myStaffName, action: () => pickLossView('staffTimes') }]
    : []

  // Feeds the Tasks panel's blue bars (RolePanel -> RoleFlagsTable) -- one
  // bar per submenu here, tagged with which section it belongs to. These
  // three sections all live inside the one merged pane now, but the
  // grouping labels are still worth keeping -- they describe what each row
  // actually is, not which top-level tab it's on. The old account
  // (hamburger) menu used to feed its own 'Account' section here too --
  // Users, UK, View Portal As, Sign Out -- but every one of those now lives
  // somewhere with its own real navigation (Users/View Portal As/Sign Out
  // on the merged pane, UK as its own top-level tab), so there's nothing
  // left to bucket under 'Account' any more.
  const taskSubmenus: { label: string; section: string; action: () => void }[] = [
    ...cashSubmenus.map(s => ({ ...s, section: 'Grony Cash' })),
    ...manageSubmenus.map(s => ({ ...s, section: 'Grony Manage' })),
    ...staffSubmenus.map(s => ({ ...s, section: 'Staff' })),
  ]

  // Every tab/sub-tab/menu/page the global search can jump to directly --
  // matched and ranked ahead of the data categories below (Items/
  // Customers/etc.) so typing e.g. "sales" lands on the Sales tab itself
  // rather than making you scroll past item/customer/vendor name matches
  // first. Recomputed each render rather than memoized -- it's a small
  // array of cheap closures, not worth the dependency-list upkeep.
  const navDestinations: { label: string; action: () => void }[] = [
    { label: 'Home', action: () => changeTab('today') },
    { label: 'Grony Cash', action: () => pickLossView('items') },
    { label: 'Grony Manage', action: () => pickLossView('audio') },
    ...(myStaffName ? [{ label: myStaffName, action: () => pickLossView('staffTimes') }] : []),
    ...(isGrony ? [{ label: 'UK', action: () => changeTab('uk') }] : []),
    ...(isOwnerOrJoe ? [{ label: 'C&H', action: () => changeTab('ch') }] : []),
    ...cashSubmenus,
    ...manageSubmenus,
    { label: 'Cash Tasks', action: () => pickLossView('tasks') },
    { label: 'Manage Tasks', action: () => pickLossView('manageTasks') },
    { label: 'Opener', action: () => pickLossView('opener') },
    { label: 'Closer', action: () => pickLossView('closer') },
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

      {/* ── Body ── No separate header row any more -- Grony Cash/UK/C&H
          (formerly the top tab row) and global search now live inside the
          pane's own footer instead (see below), so the pane itself reaches
          the very top of the screen. The pane is no longer Cash-specific
          either: it renders regardless of outerTab, so Today/UK/C&H all get
          it alongside their own content instead of losing all navigation
          the moment you leave Grony Cash. */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <SidePaneContainer mode={cashDisplayMode}
            footer={<>
              <PaneHomeDaily mode={cashDisplayMode}
                onHome={() => { setLossView('home'); setUnreadAnnouncements(0) }}
                onDaily={() => setLossView('dailySummary')}
                homeActive={lossView === 'home'} dailyActive={lossView === 'dailySummary'}
                unreadAnnouncements={unreadAnnouncements} />
              {/* Formerly the top tab row -- Biz (Grony Cash) is just
                  another footer button now, paired side by side with
                  Search the same way Home/Daily are paired above. Biz only
                  shows for accounts that also reach UK and/or C&H below --
                  someone permitted to use only Grony Cash has nothing to
                  switch to, so the button would be a no-op; Search always
                  shows regardless, since it looks across the whole app
                  (items, customers, vendors, sales, bills, announcements),
                  unlike the per-view search bars already on most tabs
                  below, which only filter what's already on screen. */}
              <div className="border-t border-blue-900 flex items-stretch shrink-0">
                {(isGrony || isOwnerOrJoe) && (<>
                  <SidePaneButton icon="💰" label="Biz" mode={cashDisplayMode}
                    active={outerTab === 'loss'} onClick={() => changeTab('loss')} className="flex-1 min-w-0" />
                  <div className="w-px bg-blue-900 shrink-0" />
                </>)}
                <SidePaneButton icon="🔍" label="Search" mode={cashDisplayMode}
                  active={false} onClick={() => setGlobalSearchOpen(true)} className="flex-1 min-w-0" />
              </div>
              {/* UK/C&H stay private to Grony/owner-level the same as
                  before -- paired side by side when both show, otherwise
                  whichever one applies just takes the full row. */}
              {(isGrony || isOwnerOrJoe) && (
                <div className="border-t border-blue-900 flex items-stretch shrink-0">
                  {isGrony && (
                    <SidePaneButton icon="🇬🇧" label="UK" mode={cashDisplayMode}
                      active={outerTab === 'uk'} onClick={() => changeTab('uk')} className="flex-1 min-w-0" />
                  )}
                  {isGrony && isOwnerOrJoe && <div className="w-px bg-blue-900 shrink-0" />}
                  {isOwnerOrJoe && (
                    <SidePaneButton icon="🏢" label="C&H" mode={cashDisplayMode}
                      active={outerTab === 'ch'} onClick={() => changeTab('ch')} className="flex-1 min-w-0" />
                  )}
                </div>
              )}
            </>}>
            <SidePaneToggle mode={cashDisplayMode} onChange={changeCashDisplayMode} />

            {/* Cash/Manage/Staff's own rows only make sense while actually
                on that tab -- UK and C&H are separate areas with no
                relationship to any of these, so the list is just empty
                (toggle + View/Sign out only) while on either of them. */}
            {outerTab === 'loss' && (<>
            {CASH_ITEMS.filter(v => v.key !== 'pl' || canSeePL)
              .filter(v => v.key !== 'fixMislinkedSales' || isOwnerOrJoe).map(v => (
                <SidePaneButton key={v.key} icon={v.icon} label={v.label} mode={cashDisplayMode}
                  active={lossView === v.key} badge={v.key === 'tasks' ? cashTasksCount : undefined}
                  onClick={() => pickLossView(v.key)} />
              ))}

            <div className="mt-1 pt-1 border-t border-blue-900">
              {cashDisplayMode !== 'icon' && (
                <p className="px-2 pt-1 pb-0.5 text-[8px] font-bold text-blue-200 uppercase tracking-wide">Manage</p>
              )}
              {MANAGE_LIST_ITEMS.map(entry => {
                const badge = entry.key === 'manageTasks' ? manageTasksCount
                  : entry.key === 'opener' ? openerBadgeCount
                  : entry.key === 'closer' ? (globalFlags?.missingClosingReports?.length ?? 0)
                  : undefined
                return (
                  <SidePaneButton key={entry.key} icon={entry.icon} label={entry.label} mode={cashDisplayMode}
                    active={!activeDynamicId && lossView === entry.key} badge={badge}
                    onClick={() => pickLossView(entry.key)} />
                )
              })}

              {dynamicCategories.length > 0 && (
                <div className="mt-1 pt-1 border-t border-blue-900">
                  {cashDisplayMode !== 'icon' && (
                    <p className="px-2 pt-1 pb-0.5 text-[8px] font-bold text-blue-200 uppercase tracking-wide">Added by you</p>
                  )}
                  {dynamicCategories.map(c => (
                    <div key={c.id} className={`flex items-stretch ${activeDynamicId === c.id ? 'bg-white' : ''}`}>
                      <SidePaneButton icon="🗂️" label={c.label} mode={cashDisplayMode} className="flex-1 min-w-0"
                        active={activeDynamicId === c.id} onClick={() => setActiveDynamicId(c.id)} />
                      {canManage && (
                        <button onClick={() => removeCategory(c.id, c.label)} title="Delete category"
                          className={`shrink-0 px-1.5 pt-2 font-bold text-xs ${activeDynamicId === c.id ? 'text-gray-300 hover:text-red-500' : 'text-blue-200 hover:text-red-300'}`}>×</button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {canManage && (
                <div className="mt-1 pt-1 border-t border-blue-900 px-1.5 pb-2">
                  {showAddCategory ? (
                    <form onSubmit={addCategory} className="space-y-1 py-1">
                      <input autoFocus value={newCategoryLabel} onChange={e => setNewCategoryLabel(e.target.value)}
                        placeholder="Name *"
                        className="w-full text-[10px] bg-white border border-blue-300 rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-blue-400" />
                      <div className="flex items-center gap-1">
                        <button type="submit" disabled={savingCategory || !newCategoryLabel.trim()}
                          className="flex-1 text-[10px] font-semibold px-1.5 py-1 rounded bg-white text-blue-800 hover:bg-blue-50 disabled:opacity-40 transition">
                          {savingCategory ? '…' : 'Add'}
                        </button>
                        <button type="button" onClick={() => { setShowAddCategory(false); setNewCategoryLabel('') }}
                          className="text-[10px] font-semibold px-1.5 py-1 rounded bg-white/20 text-white hover:bg-white/30 transition">
                          ✕
                        </button>
                      </div>
                    </form>
                  ) : (
                    <SidePaneButton icon="➕" label="Add Category" mode={cashDisplayMode} active={false}
                      onClick={() => setShowAddCategory(true)} className="w-full text-white hover:bg-white/10 font-semibold" />
                  )}
                  {justAddedCategory && (
                    <p className="text-center pt-1"><SavedFlash show /></p>
                  )}
                </div>
              )}
            </div>

            {myStaffName && (
              <div className="mt-1 pt-1 border-t border-blue-900">
                {cashDisplayMode !== 'icon' && (
                  <p className="px-2 pt-1 pb-0.5 text-[8px] font-bold text-blue-200 uppercase tracking-wide">
                    {canManage ? 'Viewing' : 'My Staff'}
                  </p>
                )}
                {canManage && (<>
                  <SidePaneButton icon="🙋" label="Me" mode={cashDisplayMode} active={viewingName === myStaffName}
                    onClick={() => pickViewing(myStaffName)} />
                  {STAFF_ROSTER.filter(n => n.toLowerCase() !== myStaffName.toLowerCase()).map(name => (
                    <SidePaneButton key={name} icon="👤" label={name} mode={cashDisplayMode}
                      active={viewingName === name} onClick={() => pickViewing(name)} />
                  ))}
                </>)}

                {STAFF_PERSONAL_ITEMS.map(t => (
                  <SidePaneButton key={t.key} icon={t.icon} label={t.label} mode={cashDisplayMode}
                    active={lossView === t.key} onClick={() => pickLossView(t.key)} />
                ))}
                {viewingName.toLowerCase() === username.toLowerCase() && (
                  <SidePaneButton icon="👤" label="Profile" mode={cashDisplayMode} active={lossView === 'staffProfile'}
                    onClick={() => pickLossView('staffProfile')} />
                )}

                {canManage && (<>
                  <div className="mt-1 pt-1 border-t border-blue-900">
                    {cashDisplayMode !== 'icon' && <p className="px-2 pb-0.5 text-[9px] font-bold text-blue-200 uppercase tracking-wide">Team</p>}
                    {STAFF_TEAM_ITEMS.map(t => (
                      <SidePaneButton key={t.key} icon={t.icon} label={t.label} mode={cashDisplayMode}
                        active={lossView === t.key} onClick={() => pickLossView(t.key)} />
                    ))}
                  </div>
                  <div className="mt-1 pt-1 border-t border-blue-900">
                    <SidePaneButton icon="🔑" label="Users" mode={cashDisplayMode} active={lossView === 'users'}
                      onClick={() => pickLossView('users')} />
                  </div>
                </>)}
              </div>
            )}
            </>)}

            {/* View Portal As / Sign out -- part of the scrollable list now
                (were pinned to the footer before) so the footer stays just
                the paired shortcut rows above. */}
            <div className="mt-1 pt-1 border-t border-blue-900">
              <ViewPortalAsButton />
              <SidePaneButton icon="🚪" label="Sign out" mode={cashDisplayMode} active={false}
                onClick={() => signOut({ callbackUrl: '/login' })} />
            </div>
        </SidePaneContainer>

        <div className="relative flex-1 min-w-0 min-h-0 flex flex-col">
          {outerTab === 'loss' && (
            <div className="shrink-0 bg-green-800 border-b border-green-900">
              {/* Row 2: groups + violations + search — hidden on report-style submenus.
                  Groups/Search share their own line, and Columns/Analytics/New share a
                  second one below -- crammed onto one line together they were fighting
                  each other for width, squeezing Search down to nothing on a phone. */}
              {showControls && (
                <div className="flex flex-col gap-1.5 px-2 py-1.5">
                <div className="flex items-center gap-1.5">

                  {/* Groups dropdown */}
                  <div className="relative shrink-0" ref={groupRef}>
                    <button onClick={() => setGroupOpen(o => !o)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap flex items-center gap-1 transition
                        ${(group || productType !== 'all') ? 'bg-white text-green-800' : 'text-white hover:bg-white/10'}`}>
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
                      className="w-full text-xs bg-white border border-green-900 rounded-lg pl-2 pr-6 py-1 outline-none focus:ring-1 focus:ring-blue-400" />
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
                </div>

                {['items', 'sales', 'bills', 'expenses'].includes(lossView) && (
                  <div className="flex items-center gap-1.5">

                    {/* Columns picker -- Items submenu only, next to New since it's
                        the same kind of per-view control. Drives LossTab's column
                        visibility/order (lifted up here, see itemsColPrefs above)
                        rather than living inside LossTab itself. Alias Wide Table and
                        Service Matches used to be their own left-pane entries -- now
                        they're two more on/off switches in this same panel, since
                        they're just other ways of looking at the same item catalog. */}
                    {lossView === 'items' && (
                      <ColumnsPickerButton prefs={itemsColPrefs} dark extraToggles={[
                        { key: 'aliasWide', label: 'Alias Wide Table', active: itemsExtraView === 'aliasWide',
                          onToggle: () => setItemsExtraView(v => v === 'aliasWide' ? 'none' : 'aliasWide') },
                        { key: 'serviceMatches', label: 'Service Matches', active: itemsExtraView === 'serviceMatches',
                          onToggle: () => setItemsExtraView(v => v === 'serviceMatches' ? 'none' : 'serviceMatches') },
                      ]} />
                    )}

                    {/* Analytics toggle -- swaps this submenu's normal list for the
                        charts/trends that used to live under the removed "Data"
                        tab. Items also carries Violations' charts (no single tab of
                        its own to move those into); Loss and Counts get the same
                        toggle inside their own components instead of here. */}
                    <button onClick={() => { setShowAnalytics(a => !a); setAddForm(null); setViolation(null) }}
                      className={`shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition
                        ${showAnalytics ? 'bg-blue-600 text-white' : 'text-white hover:bg-white/10'}`}>
                      📊 {showAnalytics ? 'List' : 'Analytics'}
                    </button>

                    {/* New button — Items/Sales/Bills/Expenses/PO submenus only; report-style and Counts submenus have no add-form */}
                    {!showAnalytics && (() => {
                      const formKey = lossView === 'items' ? 'item' : lossView === 'sales' ? 'sale' : lossView === 'bills' ? 'bill' : 'expense'
                      return (
                        <button onClick={() => setAddForm(addForm === formKey ? null : formKey)}
                          className={`shrink-0 ml-auto text-xs font-semibold px-3 py-1 rounded-lg transition
                            ${addForm ? 'bg-blue-700 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                          {addForm ? '×' : 'New'}
                        </button>
                      )
                    })()}
                  </div>
                )}
              </div>
              )}
            </div>
          )}

          {/* ── Content ── */}
          <div className="relative flex-1 min-h-0 overflow-y-auto">
        {addForm === 'sale'    && outerTab === 'loss' && lossView === 'sales'    && <div className="px-4"><NewSaleForm    onSuccess={() => setAddForm(null)} /></div>}
        {addForm === 'bill'    && outerTab === 'loss' && lossView === 'bills'    && <div className="px-4"><NewBillForm    onSuccess={() => setAddForm(null)} /></div>}
        {addForm === 'expense' && outerTab === 'loss' && lossView === 'expenses' && <div className="px-4"><NewExpenseForm onSuccess={() => setAddForm(null)} /></div>}
        {addForm === 'item'    && outerTab === 'loss' && lossView === 'items'    && <div className="px-4"><NewItemForm    onSuccess={() => { setAddForm(null); loadItems() }} /></div>}
        {outerTab === 'loss' && lossView === 'tasks' && (
          <TabErrorBoundary>
            <TasksView
              violations={cashTasksViolations}
              allSubmenus={cashSubmenus.map(s => ({ ...s, section: 'Grony Cash' }))}
              assignments={assignments} deadlines={deadlines} assignedBy={assignedBy} assignedOn={assignedOn} vSettings={vSettings}
              isOwnTask={submenu => cashSubmenus.some(s => s.label === submenu)}
              items={items} onItemsChanged={setItems}
              showLossSummary onFixLossFeed={() => goToViolation('__loss_feed')}
            />
          </TabErrorBoundary>
        )}
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
        {outerTab === 'loss' && lossView === 'home' && (
          <TabErrorBoundary>
            <div className="px-4"><TodayContent /></div>
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'dailySummary' && (
          <TabErrorBoundary>
            <DailySummaryTab />
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'purchaseOrders' && (
          <TabErrorBoundary>
            <div className="px-4 pt-4"><PurchaseOrdersPage /></div>
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'fixMislinkedSales' && (
          <TabErrorBoundary>
            <div className="px-4"><FixMislinkedSalesPage /></div>
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'item360' && (
          <TabErrorBoundary>
            <Item360Tab items={items} jumpToItemId={item360JumpId} onJumpDone={() => setItem360JumpId(null)} />
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && (MANAGE_VIEW_KEYS.has(lossView) || activeDynamicId !== null) && (
          <TabErrorBoundary>
            <GronyManageContent view={lossView as ManageView}
              activeDynamic={dynamicCategories.find(c => c.id === activeDynamicId)}
              canManage={canManage}
              violations={manageTasksViolations} openerViolations={openerViolations}
              assignments={assignments} deadlines={deadlines} assignedBy={assignedBy} assignedOn={assignedOn} vSettings={vSettings}
              manageSubmenus={manageSubmenus} onGoToViolation={goToViolation} onPickView={pickLossView}
              missingClosingReportsCount={globalFlags?.missingClosingReports?.length ?? 0}
              onOpenStaff={() => pickLossView('staffTimes')} />
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && STAFF_VIEW_KEYS.has(lossView) && (
          <TabErrorBoundary>
            {myStaffName ? (
              // key forces a full remount whenever the logged-in identity
              // changes (e.g. an admin switching "View as" between staff
              // without leaving this tab) -- StaffContent's own vtab/
              // teamVtab state lives up here now, but a stale identity could
              // still otherwise leak into TimesTab/PayslipsTab's own local
              // state across accounts.
              <StaffContent key={myStaffName} view={lossView as StaffView}
                viewingName={viewingName} role={role} username={username} isBuilder={canManage}
                vtab={vtab} setVtab={setVtab} teamVtab={teamVtab} setTeamVtab={setTeamVtab}
                openAddSignal={staffTimeSignal} />
            ) : (
              <p className="py-10 text-center text-gray-400 text-sm px-4">No staff profile is set up for your account.</p>
            )}
          </TabErrorBoundary>
        )}
        {outerTab === 'uk' && (
          <TabErrorBoundary><UKTab /></TabErrorBoundary>
        )}
        {outerTab === 'ch' && (
          <TabErrorBoundary><CHTab /></TabErrorBoundary>
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
        {outerTab === 'loss' && lossView === 'items' && itemsExtraView === 'aliasWide' && (
          <TabErrorBoundary>
            <div className="px-4 pt-4"><AliasWidePage /></div>
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'items' && itemsExtraView === 'serviceMatches' && (
          <TabErrorBoundary>
            <div className="px-4 pt-4"><ServiceMatchesPage /></div>
          </TabErrorBoundary>
        )}
        {showAnalytics && outerTab === 'loss' && lossView === 'items' && itemsExtraView === 'none' && (
          <TabErrorBoundary>
            <div className="px-3 pt-3">
              <ItemsAnalyticsSection />
              <ViolationsAnalyticsSection />
            </div>
          </TabErrorBoundary>
        )}
        {!showAnalytics && addForm !== 'item' && outerTab === 'loss' && lossView === 'items' && itemsExtraView === 'none' && (
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
                visibleCols={itemsColPrefs.visibleCols} colOrder={itemsColPrefs.colOrder} columnLabels={itemsColPrefs.columnLabels} />
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
        {/* The gains pill (see LOSSVIEW_PILL_KEYS['feed']) always lands here
            via VIOLATION_HOME['gains'] = 'feed' -- it's a violation to fix,
            not a way of browsing losses, so this view shows the gain feed
            instead of the loss feed while it's active. */}
        {outerTab === 'loss' && lossView === 'feed' && (
          <TabErrorBoundary>
            <LossFeedTab search={search} kind={violation === 'gains' ? 'gain' : 'loss'} />
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'lossByItem' && (
          <TabErrorBoundary><LossByItemTab search={search} /></TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'lossByTarget' && (
          <TabErrorBoundary>
            <div className="py-20 text-center text-gray-400 text-xs">Coming soon.</div>
          </TabErrorBoundary>
        )}
          </div>
        </div>
      </div>

      {/* The bottom Role Bar (Joe/Opener/Closer tabs) is gone -- each moved
          into a left-pane item on whichever top-level tab it actually
          belongs to (Tasks lives on both Cash's and Manage's own pane now;
          Opener/Closer moved to Manage's). The "+" shortcut menu is the one
          thing in that bar worth keeping on its own, so it's now a floating
          button instead. Home and Daily used to float here too (as two
          circular buttons) but are now a fixed footer row inside Grony
          Cash's and Grony Manage's own left panes instead (see
          PaneHomeDaily) -- "+" is the only genuinely floating control left. */}
      <NewShortcutButton onShortcut={handleShortcut} />

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
                        <button key={i.id} onClick={() => { changeTab('loss'); setLossView('item360'); setItem360JumpId(i.id); closeGlobalSearch() }}
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
