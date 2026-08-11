'use client'
import { useState, useEffect, useRef, useMemo, Component, Suspense, Fragment, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { hasFeature, DEFAULT_ON_FEATURES, type FeatureKey, type RolePermissionsMap } from '@/lib/permissionsShared'
import PageLawsList, { type LawFormKind } from './_components/PageLawsList'

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
import PaneHomeDaily from './_components/PaneHomeDaily'
import AddShortcutButton, { type ShortcutKey } from './_components/AddShortcutButton'
import { MyAssignmentsSummary } from './_components/MyAssignmentsSummary'
import LawsToggleBar from './_components/LawsToggleBar'
import { useLawsPanel } from './_components/useLawsPanel'
import { COLUMNS, type ColKey } from './_components/lossTabColumns'
import { useColumnPrefs, ColumnsPickerButton } from './_components/columnPrefs'
import { MANAGE_LIST_ITEMS, MANAGE_GROUP_LABELS, useFixedCategoryIds, type ManageView } from './_components/manageViewData'
import { STAFF_PERSONAL_ITEMS, STAFF_TEAM_ITEMS, STAFF_ADMIN_TEAM_ITEMS, type StaffView } from './_components/staffViewData'
import { CH_ITEMS, CH_CHILD_PERSON, CH_PERSON_VIEW, type CHView } from './_components/chViewData'
import { useUKData, UK_PEOPLE } from './_components/ukViewData'
import { SidePaneContainer, SidePaneToggle, SidePaneButton, useSidePaneDisplayMode } from './_components/SidePane'
import SettingsPane from './_components/SettingsPane'
import UKSettingsPanel from './_components/UKSettingsPanel'
import { applyPaneOrder, buildPaneRuns, flattenPaneRuns, type PaneOrderMap } from './_components/paneOrder'
import ServicesGroupTable from './_components/ServicesGroupTable'
import NewCustomerForm from './_components/NewCustomerForm'
import ExpenseOrdersPanel from './_components/ExpenseOrdersPanel'
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
const LiveSaleForm   = dynamic(() => import('../sales/live/page'),            { ssr: false, loading: () => loading('Loading…') })
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
const ViewPortalAsButton  = dynamic(() => import('@/components/ViewPortalAsButton'), { ssr: false })
const Item360Tab = dynamic(() => import('./_components/Item360Tab'),          { ssr: false, loading: () => loading('Loading…') })
const StaffContent = dynamic(() => import('./_components/StaffPersonTab'),    { ssr: false, loading: () => loading('Loading…') })
const UKTab = dynamic(() => import('./_components/UKTab'), { ssr: false, loading: () => loading('Loading…') })
const CHTab = dynamic(() => import('./_components/CHTab'), { ssr: false, loading: () => loading('Loading…') })
const ReorderListsPanel = dynamic(() => import('./_components/ReorderListsPanel'), { ssr: false, loading: () => loading('Loading…') })

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
// CHView is unioned in too even though C&H is its own separate top-level
// tab, not part of the Grony Cash merge -- it just reuses this same shared
// state/pane machinery rather than needing its own parallel copy.
type LossView = 'home' | 'items' | 'sales' | 'bills' | 'counts' | 'feed' | 'lossByItem' | 'lossByTarget' | 'expenses' | 'pl' | 'cab' | 'vendors' | 'customers' | 'receipts' | 'dailySummary'
  | 'purchaseOrders' | 'item360' | 'services'
  // "New Customer" used to be a toggle-open form living inside the Customers
  // list page itself (CustomersPage's own showForm state) -- it's now this
  // own separate LossView/pane row instead, so it gets its own PageToolIcons
  // scope (Notes/Tasks/Laws/Flags all separate from the Customers list's
  // own) rather than sharing 'customers'.
  | 'newCustomer'
  // Same reasoning as 'newCustomer' above -- Expense Orders used to be a
  // showOrders toggle living inside ExpensesTab itself, invisible to
  // page.tsx, so the pane button could never actually know whether it was
  // the current view (hardcoded active={false} forever) and its own
  // Notes/Tasks/Laws scope had to be computed conditionally inside
  // ExpensesTab. Its own real LossView instead, rendered as its own
  // content block below, same as Expenses' own.
  | 'expenseOrders'
  // Settings' own non-navigation row (View Portal As) becomes a real content
  // destination too now that Settings is its own side-by-side pane instead
  // of a full-screen takeover -- see SettingsPane.tsx and the settingsOpen
  // block below.
  | 'viewPortalAs' | 'reorderLists'
  | ManageView | StaffView | CHView
// Alias Wide Table and Service Matches used to be their own lossViews --
// they're now reached from inside Items itself (see ItemsExtraView below),
// so an old '?view=aliasWide'/'serviceMatches' link still needs a home to
// land on instead of a blank pane.
type ItemsExtraView = 'none' | 'aliasWide' | 'serviceMatches'
// Doubles as the current itemsExtraView->?view= mapping (see the URL-sync
// effect below) and as backward-compat for old '?view=aliasWide' links.
// Name Conflicts used to live here too -- it's now its own flag pill (see
// ERROR_VIOLATIONS/alias_name_conflicts) instead of a menu item, so an old
// '?view=nameConflicts' link just falls through to the normal Items view.
const OLD_LOSSVIEW_TO_EXTRA: Partial<Record<string, ItemsExtraView>> = {
  aliasWide: 'aliasWide', serviceMatches: 'serviceMatches',
}

// Every row that used to belong to Grony Manage's or Staff's own separate
// left panes -- now just more entries in Grony Cash's one merged pane and
// `lossView`. Used below to keep the groups/search controls row hidden for
// all of them (same as the old report-style Cash views) and to gate which
// content component (Cash's own blocks vs GronyManageContent vs
// StaffContent) a given lossView renders.
// 'properties' is still routed through GronyManageContent (see
// GronyManageTab.tsx) even though it's no longer one of MANAGE_LIST_ITEMS'
// own pane rows -- its two pane entries now live under Expenses instead
// (see the Cash pane loop below), so it has to be added back in here by
// hand or this content-routing gate (and REPORT_VIEWS, which spreads this
// same set) would stop recognizing it.
const MANAGE_VIEW_KEYS = new Set<LossView>([...MANAGE_LIST_ITEMS.map(i => i.key), 'properties'])
const STAFF_VIEW_KEYS = new Set<LossView>([
  ...STAFF_PERSONAL_ITEMS.map(i => i.key), 'staffProfile', ...STAFF_TEAM_ITEMS.map(i => i.key),
  ...STAFF_ADMIN_TEAM_ITEMS.map(i => i.key), 'users', 'roles',
])
// C&H's own rows -- same purpose as the two sets above, but for the
// separate C&H tab's own pane content (see chViewData.ts).
const CH_VIEW_KEYS = new Set<LossView>(CH_ITEMS.map(i => i.key))

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
  manage: 'audio', staff: 'staffPayslips',
}

// Self-contained submenus -- either their own dashboard, or a standalone
// page with its own internal search/filter/add UI -- so the shared
// groups/search/New controls row doesn't apply to them. Every former
// Manage/Staff view belongs here too -- none of them ever had a Cash-style
// groups/search bar of their own.
const REPORT_VIEWS = new Set<LossView>([
  'home', 'pl', 'cab', 'vendors', 'customers', 'newCustomer', 'expenseOrders', 'receipts', 'dailySummary',
  'purchaseOrders', 'item360', 'viewPortalAs', 'reorderLists', 'services',
  ...MANAGE_VIEW_KEYS, ...STAFF_VIEW_KEYS, ...CH_VIEW_KEYS,
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
// times, adverts, jingle, equipment checks), then later got its own
// dedicated left-pane item per section (Cash's 'tasks', Manage's
// 'manageTasks'). Both are gone now too -- every flag type and custom task
// has its own page-level home (see e.g. ItemsTab/SalesTab's combined flags
// views, DynamicTasksSection usages throughout), so there's no longer a
// separate all-in-one Tasks list to maintain in parallel with those.
// `group` draws a shared sub-header above whichever rows carry the same
// tag -- same buildPaneRuns/flattenPaneRuns machinery Manage's own pane
// already used (see MANAGE_GROUP_LABELS in manageViewData.ts), just applied
// to Cash's rows too now. Unlike Manage's groups, a Cash row's `group` IS
// its own display text directly (no separate id->label map) -- see
// /api/pane-groups and ReorderListsPanel.tsx, where an owner-level account
// can move any row into any section (existing or freshly typed) or back
// out, and effectiveCashItems() below merges those overrides in at render
// time. Properties (nested under Expenses) and New Customer (nested under
// Customers) stay their own sub-rows, not separate CASH_ITEMS entries --
// they're already reachable right under their parent row, which is itself
// inside these same sections.
const CASH_ITEMS: { key: LossView; label: string; icon: string; group?: string }[] = [
  { key: 'items',    label: 'Items',    icon: '📦', group: 'Items' },
  { key: 'services', label: 'Services', icon: '🛠️', group: 'Services' },
  { key: 'sales',    label: 'Sales',    icon: '🧾', group: 'Sales' },
  { key: 'bills',    label: 'Bills',    icon: '📃' },
  { key: 'purchaseOrders',   label: 'Purchase Ord',   icon: '🛒' },
  { key: 'feed',         label: 'Loss by Date',   icon: '📉', group: 'Loss' },
  { key: 'lossByItem',   label: 'Loss by Item',   icon: '📊', group: 'Loss' },
  { key: 'lossByTarget', label: 'Loss by Tgt',    icon: '🎯', group: 'Loss' },
  { key: 'expenses', label: 'Expenses', icon: '💳', group: 'Expenses' },
  { key: 'vendors',   label: 'Vendors',   icon: '🏭', group: 'Expenses' },
  { key: 'pl',       label: 'P&L',      icon: '📈' },
  { key: 'cab',      label: 'CAB',      icon: '🗂️' },
  { key: 'customers', label: 'Customers', icon: '👥', group: 'Customers' },
  { key: 'receipts',  label: 'Cust. Receipts',  icon: '📑', group: 'Customers' },
  { key: 'counts',    label: 'Counts',    icon: '🔢' },
  { key: 'item360', label: 'Item 360', icon: '🔍' },
]
// flattenPaneRuns needs a group->label lookup to build each run's header
// text, but a Cash row's group already IS its own label (see CASH_ITEMS'
// own comment above) -- this just hands any group string straight back
// instead of needing a real map kept in sync with every possible section
// name (including ones an owner-level account types fresh in Settings).
const IDENTITY_GROUP_LABELS: Record<string, string> = new Proxy({}, { get: (_, prop: string) => prop })
// Used to bounce someone off a Cash view the moment their permissions load
// and turn out not to include it (see the canSeeCash effect below).
const CASH_VIEW_KEYS = new Set<LossView>(CASH_ITEMS.map(v => v.key))
// Feeds the green bar's search placeholder ("Search Items", "Search
// Sales", ...) so it reads as this page's own filter box, distinct from
// the unrelated global search (magnifying glass icon, bottom of the
// content area) that looks across Biz/UK/C&H by name/number.
const CASH_LABEL = new Map(CASH_ITEMS.map(v => [v.key, v.label]))

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

type ErrorCategory = 'loss' | 'sales' | 'bills' | 'cab' | 'team'

// Every violation type in the app, in one place -- each one now surfaces as
// a pill directly on the Grony Cash submenu it actually belongs to (see
// LOSSVIEW_PILL_KEYS/VIOLATION_HOME below) rather than on a separate Errors
// screen, so this list is just shared label/description data now.
export const ERROR_VIOLATIONS: { key: string; label: string; category: ErrorCategory; description: string }[] = [
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
    key: 'alias_prezoho_receipts', label: 'Pre-Zoho Receipts', category: 'loss',
    description: "A receipt (invoice) line used an item name that did not exactly match anything in the item list, so the system flagged it as unresolved instead of guessing. Confirm the correct match so it counts toward the right item's reports going forward.",
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
    key: 'alias_name_conflicts', label: 'Name Conflicts', category: 'loss',
    description: "An alias's text is identical to a different item's own canonical name -- sales/bills resolve correctly to whatever the alias points at, but a separate real item sitting under that exact name never gets matched by it. Review each one: the alias may simply be wrong, or the conflicting item may itself be a duplicate that needs merging elsewhere.",
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
    key: 'no_attachment', label: 'No Attachment', category: 'sales',
    description: 'A walk-in receipt for this day has no photo or scan of the written form attached. Attach it from that receipt\'s Edit Receipt form, or use Bulk Attach Forms to catch up a whole month at once.',
  },
  {
    key: 'high_wnw', label: 'High WNW', category: 'sales',
    description: 'This receipt\'s cash counted exceeds its recorded total by more than ₵200 -- an unusually large excess. Recount the cash, and check whether a sale was made but never itemized on the receipt.',
  },
  {
    key: 'no_vendor', label: 'No Vendor', category: 'bills',
    description: 'This bill has no vendor recorded, so it is unclear who it was purchased from. Open the bill and enter the vendor it was actually bought from.',
  },
  {
    key: 'no_items_bills', label: 'No Items', category: 'bills',
    description: "This bill has a total amount but no item list -- either no lines at all, or a placeholder line (like 'Goods from X = amount') that was never linked to a real item. Mostly historical pre-Zoho bills entered as a lump total with no breakdown. These are excluded from the Pre-Zoho Bills alias review, since there's no real item name here to match.",
  },
  {
    key: 'bill_total_mismatch', label: 'Total Mismatch', category: 'bills',
    description: "This bill's item lines don't add up to its recorded total -- a missing line, a wrong price or quantity, or a total that was typed wrong. Check the bill against the actual receipt and correct whichever side is wrong.",
  },
  {
    key: 'bill_no_attachment', label: 'No Attachment', category: 'bills',
    description: 'This bill has no receipt or scan attached, so there is nothing to check its entered details against later. Attach a photo or scan of the actual receipt.',
  },
  {
    key: 'unchecked_cab', label: 'Unchecked CAB', category: 'cab',
    description: 'A week has passed without anyone confirming the Cash at Bank entry, so nobody has verified that the bank balance matches what the shop expects. Review that week and confirm it.',
  },
  {
    key: 'no_staff_times', label: 'No Team Times', category: 'team',
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
  alias_prezoho_sales: 'items', alias_prezoho_bills: 'items', alias_prezoho_receipts: 'items', alias_flagged: 'items', alias_ambiguous: 'items',
  alias_name_conflicts: 'items',
  daily: 'counts', '7day': 'counts', '15day': 'counts',
  gains: 'feed',
  no_cash: 'sales', missing_days: 'sales', cost_price: 'sales', dup_receipt: 'sales', no_attachment: 'sales', high_wnw: 'sales',
  no_vendor: 'bills', no_items_bills: 'bills', bill_total_mismatch: 'bills', bill_no_attachment: 'bills',
  unchecked_cab: 'cab',
}

// Which violation keys belong to each lossView -- scopes the info banner
// and filtered views (ItemsTab/SalesTab/CountsTab/LossFeedTab) reached via
// a "Fix now" deep link (see goFixRecords/goToViolation).
const LOSSVIEW_PILL_KEYS: Partial<Record<LossView, string[]>> = {
  items: [
    'neg_soh', 'no_sp', 'no_cp', 'no_group', 'duplicates', 'unlinked_named', 'service_violation',
    'alias_prezoho_sales', 'alias_prezoho_bills', 'alias_prezoho_receipts', 'alias_flagged', 'alias_ambiguous', 'alias_name_conflicts',
  ],
  counts: ['daily', '7day', '15day'],
  feed: ['gains'],
  sales: ['no_cash', 'missing_days', 'cost_price', 'dup_receipt', 'no_attachment', 'high_wnw'],
  bills: ['no_vendor', 'no_items_bills', 'bill_total_mismatch', 'bill_no_attachment'],
  cab: ['unchecked_cab'],
}

// Sales' 6 flag categories, in the order shown on the green bar -- letter is
// the small identifier drawn beside the flag icon (see the sales button
// block below), label is its tooltip.
const SALES_FLAG_TYPES: { key: string; letter: string; label: string }[] = [
  { key: 'no_cash', letter: 'C', label: 'No Cash Counted' },
  { key: 'missing_days', letter: 'M', label: 'Missing Receipts' },
  { key: 'cost_price', letter: 'P', label: 'Cost ≥ Selling Price' },
  { key: 'dup_receipt', letter: 'D', label: 'Duplicate Receipts' },
  { key: 'no_attachment', letter: 'A', label: 'No Attachment' },
  { key: 'high_wnw', letter: 'H', label: 'WNW Over ₵200' },
]

// Items' 11 flag categories -- same treatment as Sales. `not_in_inventory`
// (a 12th type ItemsFlagsPanel used to show) has no dedicated fix view of
// its own to jump to, so it's left off this bar; it's still assignable via
// Joe/Bino's Role Bar panel like the rest of ASSIGNABLE_VIOLATIONS.
const ITEMS_FLAG_TYPES: { key: string; letter: string; label: string }[] = [
  { key: 'neg_soh', letter: 'N', label: 'Negative Stock Items' },
  { key: 'no_sp', letter: 'S', label: 'Missing Selling Prices' },
  { key: 'no_cp', letter: 'C', label: 'Missing Cost Prices' },
  { key: 'no_group', letter: 'G', label: 'Item Groups' },
  { key: 'duplicates', letter: 'D', label: 'Duplicate Items' },
  { key: 'unlinked_named', letter: 'U', label: 'Unlinked Sales' },
  { key: 'service_violation', letter: 'V', label: 'Service Violations' },
  { key: 'alias_prezoho_sales', letter: 'A', label: 'Pre-Zoho Sales Aliases' },
  { key: 'alias_prezoho_bills', letter: 'B', label: 'Pre-Zoho Bills Aliases' },
  { key: 'alias_prezoho_receipts', letter: 'R', label: 'Pre-Zoho Receipts Aliases' },
  { key: 'alias_flagged', letter: 'F', label: 'Flagged Aliases' },
  { key: 'alias_ambiguous', letter: 'M', label: 'Ambiguous Aliases' },
  { key: 'alias_name_conflicts', letter: 'X', label: 'Name Conflicts' },
]

// Bills' flag categories -- same treatment as Sales/Items.
const BILLS_FLAG_TYPES: { key: string; letter: string; label: string }[] = [
  { key: 'no_vendor', letter: 'V', label: 'No Vendor Recorded' },
  { key: 'no_items_bills', letter: 'I', label: 'No Item List' },
  { key: 'bill_total_mismatch', letter: 'T', label: 'Total Mismatch' },
  { key: 'bill_no_attachment', letter: 'A', label: 'No Attachment' },
]

const VALID_TABS: OuterTab[] = ['today', 'loss', 'uk', 'ch']
const VALID_ADD_FORMS = ['item', 'sale', 'live', 'liveLog', 'bill', 'expense'] as const

// Biz (Today + Grony Cash), UK, and C&H are three separate areas that should
// never visually blur into each other -- each gets its own deep, near-black
// shade for its button and left pane, matching how dark the existing Biz
// blue already is. Today counts as Biz (there's no fourth color) since it's
// just Biz's own home row, not a separate section.
const PANE_ACCENT: Record<OuterTab, string> = {
  today: '#00072d', loss: '#00072d', uk: '#450a0a', ch: '#052e16',
}

function ItemHubPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawInitialTab = searchParams.get('tab')
  const oldTabView = rawInitialTab ? OLD_TAB_TO_VIEW[rawInitialTab] : undefined
  // 'losses' (the old standalone Loss Feed tab) and the old pl/expenses/cab/
  // data/manage/staff top-level tabs (all folded into Grony Cash by now)
  // still land somewhere sensible instead of silently falling back to Today.
  const initialTab = (rawInitialTab === 'losses' || oldTabView ? 'loss' : rawInitialTab) as OuterTab | null
  // A fresh login lands on a bare /item with no ?tab= at all -- that used to
  // default to Today, whose own pane is intentionally empty (same treatment
  // as UK/C&H), so the very first thing anyone saw was a near-blank screen.
  // Defaulting to Grony Cash's Items view instead means the full pane is
  // there immediately. Today is still one tap away via the Home button.
  const [outerTab, setOuterTab] = useState<OuterTab>(
    initialTab && VALID_TABS.includes(initialTab) ? initialTab : 'loss'
  )
  const [group, setGroup]               = useState<string | null>(searchParams.get('group'))
  const rawInitialProductType = searchParams.get('type')
  const [productType, setProductType]   = useState<'all' | 'goods' | 'services'>(
    rawInitialProductType === 'goods' || rawInitialProductType === 'services' ? rawInitialProductType : 'all'
  )
  const rawInitialView = searchParams.get('view')
  const initialExtraView = rawInitialView ? OLD_LOSSVIEW_TO_EXTRA[rawInitialView] : undefined
  const initialView = (initialExtraView ? 'items' : rawInitialView) as LossView | null
  const [lossView, setLossView]         = useState<LossView>(
    rawInitialTab === 'losses' ? 'feed'
      : oldTabView ?? initialView ?? (outerTab === 'ch' ? CH_ITEMS[0].key : 'items')
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
  // The flag's explanation used to always show under its red title -- now
  // tucked behind its own ℹ️ tap target instead. Tracks WHICH violation
  // it's open for (rather than a plain boolean reset via an effect) so
  // switching to a different flag closes it for free -- the stored key
  // just stops matching the new `violation`, no extra state sync needed.
  const [infoOpenFor, setInfoOpenFor] = useState<string | null>(null)
  const [groupOpen, setGroupOpen]       = useState(false)
  const [searchOpen, setSearchOpen]     = useState(false)
  // Everything only Joe/Grony can do (Viewing, Team, Users, Add Category,
  // View Portal As) lives behind this one Settings screen now instead of
  // sitting inline in the pane -- see SettingsPanel.tsx.
  const [settingsOpen, setSettingsOpen] = useState(false)
  const rawInitialForm = searchParams.get('form')
  const [addForm, setAddForm]             = useState<'item' | 'sale' | 'live' | 'liveLog' | 'bill' | 'expense' | null>(
    (VALID_ADD_FORMS as readonly string[]).includes(rawInitialForm ?? '') ? (rawInitialForm as typeof VALID_ADD_FORMS[number]) : null
  )
  // Bumped by the "+" shortcut menu (see AddShortcutButton) for flows that
  // live inside an already-mounted tab (CAB Confirm, Staff Time, Customer,
  // Vendor) -- each target component watches its own signal and reopens its
  // "new" form.
  const [cabConfirmSignal, setCabConfirmSignal] = useState(0)
  const [staffTimeSignal, setStaffTimeSignal]   = useState(0)
  const [vendorSignal, setVendorSignal]         = useState(0)
  // Seeds PropertiesPage's own tab -- driven by the left pane's "Properties
  // at Shop"/"Properties not at Shop" rows under Expenses (see below).
  const [propertiesInitialTab, setPropertiesInitialTab] = useState<'available' | 'away' | null>(null)
  const [jumpToItemId, setJumpToItemId]   = useState<number | null>(null)
  // Seeded from ?jumpDate=/?jumpItem= -- Item 360's Detail table (and its
  // "click a date" links) lands here via /item?tab=loss&view=sales&jumpDate=
  // ...&jumpItem=..., which the URL-sync effect below strips off again on
  // its first run since only tab/view/q are ever written back to the URL.
  const [jumpToReceiptDate, setJumpToReceiptDate] = useState<string | null>(searchParams.get('jumpDate'))
  const [jumpToReceiptItemName, setJumpToReceiptItemName] = useState<string | null>(searchParams.get('jumpItem'))
  // Loss by Date's own Losses/Gains toggle -- used to only switch to the
  // gains feed via the (now-removed) Tasks page's 'gains' violation deep-
  // link, so this is now the only way to reach it.
  const [feedShowGains, setFeedShowGains] = useState(false)
  // Every "tap an item" spot in the app (Items list rows, Sales/Bills item
  // links, the old standalone /stock/[id] route's former callers) now lands
  // here instead -- ?jumpItemId= opens Item 360 straight to that item's
  // detail rather than its search box. Seeded (and re-seeded on later
  // same-page navigations) entirely by the searchParams effect below, since
  // a plain useState initializer only ever sees the URL a page starts on.
  const [item360JumpId, setItem360JumpId] = useState<number | null>(null)
  const [showItemsLaws, setShowItemsLaws] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('showItemsLaws') === 'true'
  })
  const [itemsLawsRefresh, setItemsLawsRefresh] = useState(0)
  const [itemsLawsOpenForm, setItemsLawsOpenForm] = useState<LawFormKind>(null)
  const [hideZeroFlags, setHideZeroFlags] = useState(false)
  // Sales/Bills laws -- same inline-panel treatment as Items above (see
  // showItemsLaws), one icon per view, no separate overlay-opening icon
  // anymore. scopeKey stays "Sales"/"Bills" (capitalized, matching
  // CASH_LABEL) so this reads the laws/flags/tasks that already existed
  // under the old PageToolIcons-opened CombinedToolsPanel for these views,
  // instead of starting a second, empty scope.
  const [showSalesLaws, setShowSalesLaws] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('showSalesLaws') === 'true'
  })
  const [salesLawsRefresh, setSalesLawsRefresh] = useState(0)
  const [salesLawsOpenForm, setSalesLawsOpenForm] = useState<LawFormKind>(null)
  const [salesHideZeroFlags, setSalesHideZeroFlags] = useState(false)
  const [showBillsLaws, setShowBillsLaws] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('showBillsLaws') === 'true'
  })
  const [billsLawsRefresh, setBillsLawsRefresh] = useState(0)
  const [billsLawsOpenForm, setBillsLawsOpenForm] = useState<LawFormKind>(null)
  const [billsHideZeroFlags, setBillsHideZeroFlags] = useState(false)
  // The rest of this page's many smaller panes (New Sale, P&L, Receipts,
  // Purchase Orders, Item 360, Loss by Date/Item/Target, ...) each get their
  // own inline law panel too, same as Items/Sales/Bills above -- one
  // useLawsPanel() per scope, rendered through the inlineLaws() helper
  // below instead of hand-rolling the toggle+panel JSX 16 more times.
  const newSaleLaws = useLawsPanel('showNewSaleLaws')
  const plLaws = useLawsPanel('showPLLaws')
  const newCustomerLaws = useLawsPanel('showNewCustomerLaws')
  const receiptsLaws = useLawsPanel('showReceiptsLaws')
  const homeLaws = useLawsPanel('showHomeLaws')
  const dailyLaws = useLawsPanel('showDailyLaws')
  const purchaseOrdersLaws = useLawsPanel('showPurchaseOrdersLaws')
  const item360Laws = useLawsPanel('showItem360Laws')
  const servicesLaws = useLawsPanel('showServicesLaws')
  const viewPortalAsLaws = useLawsPanel('showViewPortalAsLaws')
  const reorderListsLaws = useLawsPanel('showReorderListsLaws')
  const expenseOrdersLaws = useLawsPanel('showExpenseOrdersLaws')
  const aliasWideTableLaws = useLawsPanel('showAliasWideTableLaws')
  const serviceMatchesLaws = useLawsPanel('showServiceMatchesLaws')
  const lossByDateLaws = useLawsPanel('showLossByDateLaws')
  const lossByItemLaws = useLawsPanel('showLossByItemLaws')
  const lossByTargetLaws = useLawsPanel('showLossByTargetLaws')

  function inlineLaws(scopeKey: string, panel: ReturnType<typeof useLawsPanel>) {
    return (<>
      <LawsToggleBar show={panel.show} setShow={panel.setShow}
        openForm={panel.openForm} setOpenForm={panel.setOpenForm}
        hideZeroFlags={panel.hideZeroFlags} setHideZeroFlags={panel.setHideZeroFlags} dark={false} />
      {panel.show && (
        <div className="border border-gray-200 rounded-xl bg-white overflow-hidden mt-2">
          <PageLawsList scopeKey={scopeKey} isItemsLaws={true} onChange={panel.bumpRefresh}
            openForm={panel.openForm} setOpenForm={panel.setOpenForm}
            hideZeroFlags={panel.hideZeroFlags} setHideZeroFlags={panel.setHideZeroFlags} />
        </div>
      )}
    </>)
  }
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
    // Only ever populated for accounts with UK/C&H access -- the API route
    // itself decides that server-side (same Roles & Permissions features
    // gating the Biz/UK/C&H icons), not just this UI hiding them.
    ukSubmenus?: { id: number; person: string; name: string }[]
    ukEntries?: { row_id: number; submenu_id: number; person: string; submenu_name: string; column_name: string; value: string }[]
    chLogs?: { id: number; category: string; category_label: string; notes: string; log_date: string; logged_by: string }[]
  } | null>(null)
  // Fed into CustomersPage/VendorsPage as initialSearch when a result from
  // one of those categories is picked -- those pages own their own search
  // state (unlike Sales/Bills, which already read the shared `search` above).
  const [customerSearchText, setCustomerSearchText] = useState('')
  const [vendorSearchText, setVendorSearchText] = useState('')

  // Resolves the real numeric id behind each of the four ex-"Added by you"
  // categories (now fixed rows split across Manage/Team) -- shared between
  // GronyManageContent and StaffContent, whichever renders one via
  // DynamicCategoryPage. See FIXED_CATEGORY_LABELS in manageViewData.ts.
  const fixedCategoryIds = useFixedCategoryIds()

  // Staff's "Viewing" picker -- who the personal rows (Times/Payslips/etc.)
  // apply to. Only Joe/Grony ever change this away from their own name;
  // everyone else always views themself (see viewingName below).
  const [viewingNameOverride, setViewingNameOverride] = useState<string | undefined>(undefined)

  // UK's people + per-person submenus + selected submenu's columns/rows --
  // shared between the merged pane (a flat "every person's every submenu"
  // list, see below) and UKTab (rendering the selected submenu's columns +
  // row data). The pane's own list is fetched independently of `uk.submenus`
  // (which only ever holds whichever one person's submenus were most
  // recently picked) so every person shows at once without needing `uk`'s
  // own person state to cycle through all three first.
  const uk = useUKData()
  const [ukAllSubmenus, setUkAllSubmenus] = useState<{ id: number; person: string; name: string }[]>([])
  // General Section -- items with no person of their own (e.g. "198
  // Casewick"), listed separately from the per-person flat list below
  // rather than mixed into it. Uses person = 'General' under the hood
  // (just another string value in the same uk_submenus.person column, not
  // a real UKPerson), so it's fetched on its own rather than via UK_PEOPLE.
  const [ukGeneralSubmenus, setUkGeneralSubmenus] = useState<{ id: number; name: string }[]>([])
  const [ukPaneRefresh, setUkPaneRefresh] = useState(0)
  useEffect(() => {
    if (outerTab !== 'uk') return
    Promise.all(UK_PEOPLE.map(p =>
      fetch(`/api/uk/submenus?person=${encodeURIComponent(p)}`).then(r => r.ok ? r.json() : [])
    )).then(lists => {
      setUkAllSubmenus(lists.flatMap((list: { id: number; name: string }[], i: number) =>
        list.map(s => ({ id: s.id, person: UK_PEOPLE[i], name: s.name }))
      ))
    }).catch(() => {})
    fetch('/api/uk/submenus?person=General').then(r => r.ok ? r.json() : [])
      .then(d => setUkGeneralSubmenus(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [outerTab, ukPaneRefresh])
  // A second, independent instance for C&H's own Fiifi/Kuukua/Ebo/Odoye
  // pages (moved here from UK, see chViewData.ts's CH_CHILD_PERSON) -- kept
  // separate from `uk` above so switching tabs never lets one tab's person
  // selection leak into the other's pane. Driven by pickCHView below
  // instead of a picker of its own, since these four are already fixed
  // rows in CH_ITEMS.
  const ch = useUKData()

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
  const [showAnalytics, setShowAnalytics] = useState(searchParams.get('analytics') === '1')
  // Sales' own combined 🚩 flags view -- lifted up here (like itemsExtraView
  // above) so its trigger can sit on the green bar next to New, matching
  // Items' flag icon + count instead of a separate button inside Sales'
  // own gray toolbar row.

  const [items, setItems]           = useState<Item[]>([])
  const [itemsLoading, setItemsLoading] = useState(true)
  // Services' left-pane rows -- one button per distinct cf_group already in
  // use across the item catalog (goods and services alike; "Services" here
  // is just this section's name, not a product_type filter), derived
  // straight from `items` rather than a separate fetch. Clicking one opens
  // a direct list of that group's items, same shape as UK's flat submenus.
  const serviceGroups = useMemo(() =>
    Array.from(new Set(items.map(i => i.cf_group).filter((g): g is string => !!g && g.trim() !== ''))).sort()
  , [items])
  const [selectedServiceGroup, setSelectedServiceGroup] = useState<string | null>(null)

  function loadItems() {
    fetch('/api/items').then(r => r.json()).then(d => {
      setItems(Array.isArray(d) ? d : [])
      setItemsLoading(false)
    })
  }

  useEffect(() => { loadItems() }, [])
  usePolling(loadItems, 20000)

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
  const [prezohoReceiptsCount, setPrezohoReceiptsCount] = useState(0)
  const [aliasFlaggedCount, setAliasFlaggedCount] = useState(0)
  const [unreadAnnouncements, setUnreadAnnouncements] = useState(0)
  const [aliasAmbiguousCount, setAliasAmbiguousCount] = useState(0)
  const [nameConflictsCount, setNameConflictsCount] = useState(0)
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
      fetch('/api/aliases/unresolved-receipts').then(r => r.json()).catch(() => []),
      fetch('/api/aliases/audit').then(r => r.json()).catch(() => []),
      fetch('/api/aliases/ambiguous').then(r => r.json()).catch(() => []),
    ]).then(([salesRows, billRows, receiptRows, auditRows, ambiguousRows]) => {
      const pending = (arr: any) => Array.isArray(arr) ? arr.filter((r: any) => !r.confirmed).length : 0
      setPrezohoSalesCount(pending(salesRows))
      setPrezohoBillsCount(pending(billRows))
      setPrezohoReceiptsCount(pending(receiptRows))
      setAliasFlaggedCount(Array.isArray(auditRows) ? auditRows.length : 0)
      setAliasAmbiguousCount(Array.isArray(ambiguousRows) ? ambiguousRows.length : 0)
    }).catch(() => {})
    fetch('/api/announcements/unread-count').then(r => r.ok ? r.json() : null).then(d => {
      setUnreadAnnouncements(Number(d?.count) || 0)
    }).catch(() => {})
    fetch('/api/aliases/leaks').then(r => r.ok ? r.json() : []).then(d => {
      setNameConflictsCount(Array.isArray(d) ? d.length : 0)
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
      alias_prezoho_receipts: prezohoReceiptsCount,
      alias_flagged: aliasFlaggedCount,
      alias_ambiguous: aliasAmbiguousCount,
      alias_name_conflicts: nameConflictsCount,
      no_cash: f?.noCash?.length ?? 0,
      missing_days: f?.missingDays?.length ?? 0,
      cost_price: f?.costGteSell?.length ?? 0,
      dup_receipt: f?.dupReceipts?.length ?? 0,
      no_attachment: f?.noAttachment?.length ?? 0,
      high_wnw: f?.highWnw?.length ?? 0,
      no_vendor: f?.noVendorBills?.length ?? 0,
      no_items_bills: f?.noItemsBills?.length ?? 0,
      bill_total_mismatch: f?.billTotalMismatch?.length ?? 0,
      bill_no_attachment: f?.billNoAttachment?.length ?? 0,
      daily: pendingCounts.daily,
      '7day': pendingCounts.gmcWeekly,
      '15day': pendingCounts.overdue,
      gains: gainsCount,
      service_violation: serviceViolationCount,
      unchecked_cab: f?.uncheckedCab?.length ?? 0,
      no_staff_times: f?.noStaffTimes?.length ?? 0,
    }
  }, [items, globalFlags, pendingCounts, serviceViolationCount, prezohoSalesCount, prezohoBillsCount, prezohoReceiptsCount, aliasFlaggedCount, aliasAmbiguousCount, nameConflictsCount, gainsCount])

  // Backs every page's own combined flags view, and Manage's Opener/Closer --
  // computed once regardless of which outer tab is showing.
  const {
    cashViolations, openerViolations, openerViolationCount,
    assignments, deadlines, assignedBy, assignedOn, vSettings,
  } = useViolations(violationCounts)
  // Per-page flag badges (red count on the pane row itself) -- matches
  // exactly what each page's own combined 🚩 flags view covers, so the
  // number on the button is never out of step with what you'd see there.
  const violationCountByType = (types: string[]) =>
    cashViolations.filter(v => types.includes(v.type)).reduce((s, v) => s + v.count, 0)
  const salesFlagsCount = violationCountByType(['no_cash', 'missing_days', 'cost_gte_sell', 'dup_receipts', 'no_attachment', 'high_wnw'])
  const itemsFlagsCount = violationCountByType([
    'no_group', 'duplicates', 'not_in_inventory', 'neg_soh', 'no_sp', 'no_cp', 'unlinked_named', 'service_violation',
    'alias_prezoho_sales', 'alias_prezoho_bills', 'alias_prezoho_receipts', 'alias_flagged', 'alias_ambiguous',
  ]) + nameConflictsCount
  const billsFlagsCount = violationCountByType(['no_vendor', 'no_items_bills', 'bill_total_mismatch', 'bill_no_attachment'])
  const cabFlagsCount = violationCountByType(['unchecked_cab'])
  const staffTimesFlagsCount = violationCountByType(['no_staff_times'])
  const dressFlagsCount = violationCountByType(['shirt_not_worn', 'shirt_overdue'])
  const countsFlagsCount = violationCountByType(['daily', '7day', '15day'])
  const lossByDateFlagsCount = violationCountByType(['gains'])
  const jingleFlagsCount = violationCountByType(['jingle_overdue'])
  const equipmentFlagsCount = violationCountByType(['equipment_check_overdue'])
  const advertStatusFlagsCount = violationCountByType(['no_advert'])
  // These three pages' own flags (Expenses' similar-account/bundled-
  // description/no-vendor, Customers' and Vendors' missing-contact-info)
  // never went through the centralized violations system above -- they're
  // local to each page's own component, reported up here via
  // onFlagCountChange so the pane row can badge them too instead of always
  // reading 0.
  const [expensesFlagsCount, setExpensesFlagsCount] = useState(0)
  const [customersFlagsCount, setCustomersFlagsCount] = useState(0)
  const [vendorsFlagsCount, setVendorsFlagsCount] = useState(0)

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

  // Per-page green task-count badges (opposite corner from the red flags
  // badge above) -- one fetch of every custom_tasks row, grouped by its own
  // `submenu` column (the same scopeKey each page's own PageToolIcons/
  // DynamicTasksSection instance already uses), instead of every pane row
  // running its own fetch the way PageToolIcons does for its single page.
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({})
  useEffect(() => {
    let cancelled = false
    function load() {
      fetch('/api/tasks').then(r => r.ok ? r.json() : []).then((all: unknown) => {
        if (cancelled) return
        const list = Array.isArray(all) ? all as { submenu?: string | null; done?: boolean }[] : []
        const counts: Record<string, number> = {}
        for (const t of list) {
          if (t.done || !t.submenu) continue
          counts[t.submenu] = (counts[t.submenu] ?? 0) + 1
        }
        setTaskCounts(counts)
      }).catch(() => {})
    }
    load()
    const id = setInterval(load, 20000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])
  const taskCountFor = (scopeKey: string) => taskCounts[scopeKey] ?? 0
  // A few pane rows' PageToolIcons scopeKey differs from their own pane
  // label (either because the label was later shortened for the pane -- see
  // 'Loss by Tgt'/'Purchase Ord' -- or because the content page hardcodes
  // its own scopeKey independent of CASH_LABEL) -- see each page's own
  // <PageToolIcons scopeKey=.../> call for the authoritative string.
  const CASH_TASK_SCOPE_OVERRIDES: Partial<Record<LossView, string>> = {
    purchaseOrders: 'Purchase Orders',
    lossByTarget: 'Loss by Target',
  }
  const cashTaskScopeKey = (key: LossView) => CASH_TASK_SCOPE_OVERRIDES[key] ?? CASH_LABEL.get(key) ?? key
  // Every remaining Manage row's scopeKey already equals its own label
  // (ManageLogPanel is called with scopeKey={label} directly) -- Daily Log
  // used to be the one exception (its content page hardcoded "Advert Daily
  // Log" instead), but that row's been removed from the pane entirely.

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (groupRef.current && !groupRef.current.contains(e.target as Node)) setGroupOpen(false)
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    localStorage.setItem('showItemsLaws', showItemsLaws.toString())
  }, [showItemsLaws])

  useEffect(() => {
    localStorage.setItem('showSalesLaws', showSalesLaws.toString())
  }, [showSalesLaws])

  useEffect(() => {
    localStorage.setItem('showBillsLaws', showBillsLaws.toString())
  }, [showBillsLaws])

  function changeTab(t: OuterTab) {
    setOuterTab(t)
    setViolation(null)
    setAddForm(null)
    setShowAnalytics(false)
    setSettingsOpen(false)
    if (t !== 'loss') setProductType('all')
    if (t === 'loss') setLossView('items')
    if (t === 'ch') setLossView(CH_ITEMS[0].key)
    // Optimistic -- TodayContent marks these read for real as soon as it
    // mounts, but that round-trip shouldn't leave the badge lingering.
    if (t === 'today') setUnreadAnnouncements(0)
  }

  // The one navigation primitive every Cash/Manage/Staff row (and every
  // deep link into one) goes through -- unlike changeTab('loss') above,
  // this jumps straight to a specific row regardless of which outer tab is
  // currently showing, so callers don't need their own changeTab-then-
  // override two-step any more.
  function pickLossView(view: LossView, opts?: { keepSettingsOpen?: boolean }) {
    setOuterTab('loss')
    setLossView(view)
    setViolation(null)
    setAddForm(null)
    setShowAnalytics(false)
    // Settings destinations (Team/Users/Manage Categories/View Portal As,
    // reached through SettingsPane) pass keepSettingsOpen so browsing among
    // them doesn't keep closing the pane you're browsing from -- everything
    // else calling this is a main-pane row, which should always drop
    // Settings the moment you jump away from it.
    if (!opts?.keepSettingsOpen) setSettingsOpen(false)
  }

  // C&H's own rows used to route through pickLossView above, which
  // unconditionally forces outerTab to 'loss' -- built for Cash/Manage/Staff
  // rows only, so reusing it here was flipping the pane back to Biz's blue
  // (and its rows) the instant you tapped any C&H row, instead of staying on
  // C&H's own green. CHTab's content is driven entirely by lossView (see
  // `outerTab === 'ch'` below), so outerTab never needs to move here.
  function pickCHView(view: CHView) {
    setLossView(view)
    // Fiifi/Kuukua/Ebo/Odoye each need `ch` (see above) pointed at their own
    // name before CHTab/the pane can show their submenus -- every other C&H
    // row leaves `ch` alone since they don't use it at all.
    const childPerson = CH_CHILD_PERSON[view]
    if (childPerson) ch.pickPerson(childPerson)
    setViolation(null)
    setAddForm(null)
    setShowAnalytics(false)
    setSettingsOpen(false)
  }

  // Global search's UK-submenu/UK-entry results (see below) come back
  // tagged with a plain `person` string from the shared uk_submenus/
  // uk_rows tables -- Fiifi/Kuukua/Ebo/Odoye's now open on C&H instead of
  // UK (see CH_PERSON_VIEW), everyone else still opens on UK as before.
  function openPersonSubmenu(person: string, submenuId: number) {
    const chView = CH_PERSON_VIEW[person as keyof typeof CH_PERSON_VIEW]
    if (chView) {
      changeTab('ch')
      pickCHView(chView)
      ch.pickSubmenu(submenuId)
    } else {
      changeTab('uk')
      uk.pickPerson(person as typeof uk.person)
      uk.pickSubmenu(submenuId)
    }
  }

  // Joe/Grony's "Viewing" picker -- switches whose personal rows show.
  // Profile only ever means "my own login", and Payslips no longer
  // redirects at all (see viewingSelf above) -- so switching away from
  // yourself while on either of those has nowhere sensible to land (Personal
  // is just Payslips/Profile now, both self-only) and falls back to
  // Payslips, which still renders the newly-viewed person's own payslip
  // history even though its own pane row is hidden while viewing someone
  // else.
  function pickViewing(name: string) {
    setViewingNameOverride(name)
    const staysOnSelfOnly = lossView === 'staffProfile' || lossView === 'staffPayslips'
    if (staysOnSelfOnly && name.toLowerCase() !== (myStaffName ?? '').toLowerCase()) {
      setLossView('staffPayslips')
    }
  }

  // From the loss dialog: jump to the records that usually explain a "loss"
  // (Sales / Bills / Counts live as sub-views of the Grony Cash tab).
  function goFixRecords(view: 'sales' | 'bills' | 'counts') {
    pickLossView(view)
  }

  // The "+" shortcut menu (see AddShortcutButton) -- jumps straight to a
  // "create new" flow wherever it already lives. Sales/Bills/Item/Expenses
  // reuse the existing addForm mechanism (pickLossView resets it, so set it
  // after); the rest reopen via a per-target signal since their forms are
  // local component state with no addForm equivalent. Staff Time lands on
  // Team Times, not a per-person page -- Personal has no Times row of its
  // own anymore (see Team Times' own history), but TimesTab's admin "add
  // entry" form works the same regardless of whose page it's opened from.
  function handleShortcut(key: ShortcutKey) {
    switch (key) {
      case 'sale':       pickLossView('sales');     setAddForm('sale'); break
      case 'bill':       pickLossView('bills');     setAddForm('bill'); break
      case 'item':       pickLossView('items');     setAddForm('item'); break
      case 'expense':    pickLossView('expenses');  setAddForm('expense'); break
      case 'cabConfirm': pickLossView('cab');       setCabConfirmSignal(n => n + 1); break
      case 'customer':   pickLossView('newCustomer'); break
      case 'vendor':     pickLossView('vendors');   setVendorSignal(n => n + 1); break
      case 'staffTime': {
        pickLossView('teamTimes')
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
    // 'loss' is the default now (see outerTab's initial state above), so
    // it's the one that gets to omit ?tab= for a clean URL -- Today needs
    // to stay explicit, or a bare /item on refresh would land back on Loss
    // instead of wherever Today's own state actually was.
    if (outerTab !== 'loss') params.set('tab', outerTab); else params.delete('tab')
    if (outerTab === 'loss' && lossView !== 'items') params.set('view', lossView)
    // Alias Wide Table/Service Matches/Name Conflicts are sub-views of
    // Items itself (lossView stays 'items') -- they still need their own
    // ?view= entry, or leaving/refreshing on one of them silently drops
    // you back on the plain item list instead of where you actually were.
    else if (outerTab === 'loss' && lossView === 'items' && itemsExtraView !== 'none') params.set('view', itemsExtraView)
    // C&H's own rows are picked via pickCHView, which -- unlike pickLossView
    // -- never touches outerTab, so this needs its own branch to still land
    // the selected row (e.g. 'ch_kuukua') in the URL for refresh/back.
    else if (outerTab === 'ch') params.set('view', lossView)
    else params.delete('view')
    // Settings is a full-screen overlay, not a tab -- still gets its own
    // history entry the same way, so the back button closes it instead of
    // leaving the app (see the popstate sync effect below).
    if (settingsOpen) params.set('settings', '1'); else params.delete('settings')
    // Filters/toggles that change what's actually on screen without
    // changing which tab/sub-view you're on -- same "real screen, own
    // history entry" treatment as tab/view above, so back/refresh land you
    // on the exact filtered state you were looking at instead of it quietly
    // resetting to the unfiltered default.
    if (group) params.set('group', group); else params.delete('group')
    if (productType !== 'all') params.set('type', productType); else params.delete('type')
    if (violation) params.set('violation', violation); else params.delete('violation')
    if (showAnalytics) params.set('analytics', '1'); else params.delete('analytics')
    if (addForm) params.set('form', addForm); else params.delete('form')
    const qs = params.toString()
    const target = qs ? `/item?${qs}` : '/item'
    const current = window.location.pathname + window.location.search
    if (target === current) return
    router.push(target, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outerTab, lossView, settingsOpen, itemsExtraView, group, productType, violation, showAnalytics, addForm])

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
    const nextTab: OuterTab = urlTab && VALID_TABS.includes(urlTab as OuterTab) ? (urlTab as OuterTab) : 'loss'
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (nextTab !== outerTab) setOuterTab(nextTab)
    if (nextTab === 'loss') {
      const rawUrlView = searchParams.get('view')
      const urlExtraView = rawUrlView ? OLD_LOSSVIEW_TO_EXTRA[rawUrlView] : undefined
      const nextView: LossView = (urlExtraView ? 'items' : rawUrlView) as LossView ?? 'items'
      if (nextView !== lossView) setLossView(nextView)
      if (urlExtraView && urlExtraView !== itemsExtraView) setItemsExtraView(urlExtraView)
      // Backing out of an extra view (e.g. Alias Wide Table) without also
      // changing lossView -- the [lossView] effect that normally resets
      // itemsExtraView never fires here since lossView stays 'items' the
      // whole time, so it has to be cleared explicitly instead.
      else if (!urlExtraView && itemsExtraView !== 'none') setItemsExtraView('none')
    } else if (nextTab === 'ch') {
      const rawUrlView = searchParams.get('view')
      const nextView: LossView = (rawUrlView && CH_VIEW_KEYS.has(rawUrlView as LossView) ? rawUrlView : CH_ITEMS[0].key) as LossView
      if (nextView !== lossView) setLossView(nextView)
      // Landing on a child's page any way other than clicking it in the pane
      // (refresh, back/forward, a bookmarked/shared link) skips pickCHView,
      // so `ch` -- a fresh useUKData() instance defaulting to person 'Grony'
      // -- never gets pointed at the right child. Left unguarded this leaked
      // Grony's own UK submenus under whichever child's page was open. Kept
      // separate from the `nextView !== lossView` check above since `ch`
      // needs re-syncing here even when lossView was already correct (e.g.
      // a fresh mount where `ch` itself is what's stale, not lossView).
      const childPerson = CH_CHILD_PERSON[nextView as CHView]
      if (childPerson && ch.person !== childPerson) ch.pickPerson(childPerson)
    }
    const urlSettingsOpen = searchParams.get('settings') === '1'
    if (urlSettingsOpen !== settingsOpen) setSettingsOpen(urlSettingsOpen)

    const urlGroup = searchParams.get('group')
    if (urlGroup !== group) setGroup(urlGroup)
    const rawUrlType = searchParams.get('type')
    const urlType: 'all' | 'goods' | 'services' = rawUrlType === 'goods' || rawUrlType === 'services' ? rawUrlType : 'all'
    if (urlType !== productType) setProductType(urlType)
    const urlViolation = searchParams.get('violation')
    if (urlViolation !== violation) setViolation(urlViolation)
    const urlAnalytics = searchParams.get('analytics') === '1'
    if (urlAnalytics !== showAnalytics) setShowAnalytics(urlAnalytics)
    const rawUrlForm = searchParams.get('form')
    const urlForm = (VALID_ADD_FORMS as readonly string[]).includes(rawUrlForm ?? '')
      ? (rawUrlForm as typeof VALID_ADD_FORMS[number]) : null
    if (urlForm !== addForm) setAddForm(urlForm)
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
    // lands on Team Times -- shared and unfiltered, it already shows every
    // staff member's clock records.
    if (key === 'no_staff_times') { pickLossView('teamTimes'); return }
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
  // Left-pane section headers that don't open a page of their own (Loss,
  // Properties, Manage, Team, Personal, a UK/C&H person's "Submenus", ...)
  // toggle their own sub-rows open/shut when tapped instead of just sitting
  // there as decoration -- self-titled headers (Sales/Expenses/Customers/
  // Services, whose own row IS the header and already navigates somewhere)
  // are left alone, since they already do something useful on tap.
  const [collapsedPaneGroups, setCollapsedPaneGroups] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const raw = localStorage.getItem('collapsedPaneGroups')
      return raw ? new Set(JSON.parse(raw)) : new Set()
    } catch { return new Set() }
  })
  useEffect(() => {
    localStorage.setItem('collapsedPaneGroups', JSON.stringify([...collapsedPaneGroups]))
  }, [collapsedPaneGroups])
  function togglePaneGroup(key: string) {
    setCollapsedPaneGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }
  function renderPaneHeader(key: string, label: string) {
    const collapsed = collapsedPaneGroups.has(key)
    return (
      <p className="pt-2 pb-0.5">
        <button type="button" onClick={() => togglePaneGroup(key)}
          className="flex items-center justify-between gap-1 w-full text-[8px] font-extrabold text-red-700 bg-yellow-400 uppercase tracking-wide px-2 py-1 truncate">
          <span className="truncate">{label}</span>
          <span className="shrink-0">{collapsed ? '▸' : '▾'}</span>
        </button>
      </p>
    )
  }
  const { data: session } = useSession()
  const role = (session?.user as any)?.role ?? 'staff'
  const username = (session?.user as any)?.username ?? session?.user?.name ?? ''
  const isOwnerOrJoe = role === 'owner' || username.toLowerCase() === 'joe'
  const isGrony = username.toLowerCase() === 'grony'
  // The one owner-level gate managing roles/permissions themselves (and
  // previously everything else below) uses -- kept separate from the
  // granular per-feature grants in rolePermissions so a role can never grant
  // itself more power than whoever configures Roles & Permissions intends.
  const canManage = isOwnerOrJoe || isGrony
  // Additive, DB-editable feature grants (Roles & Permissions screen) on
  // top of owner-level -- see lib/permissions.ts. Fetched once; changes
  // there take effect on this user's next load, same as any other role
  // change would.
  const [rolePermissions, setRolePermissions] = useState<RolePermissionsMap>({})
  const [permsLoaded, setPermsLoaded] = useState(false)
  useEffect(() => {
    fetch('/api/user-permissions').then(r => r.ok ? r.json() : {}).then(d => { setRolePermissions(d); setPermsLoaded(true) }).catch(() => setPermsLoaded(true))
  }, [])
  // Custom Cash/Manage row order (Settings > Reorder Lists) -- shared with
  // ReorderListsPanel via props so a move there is reflected in this same
  // pane immediately, not just after a refresh.
  const [paneOrder, setPaneOrder] = useState<PaneOrderMap>({})
  useEffect(() => {
    fetch('/api/pane-order').then(r => r.ok ? r.json() : {}).then(setPaneOrder).catch(() => {})
  }, [])
  // Same shared-with-everyone pattern as paneOrder above, but for display
  // labels instead of row order -- see ReorderListsPanel.tsx and
  // /api/pane-labels. Purely cosmetic: a row's `key` (used for routing,
  // PageToolIcons scopeKey, and every task/notes/laws/flag lookup) never
  // changes, so this can't orphan any of that data.
  const [paneLabels, setPaneLabels] = useState<Record<string, string>>({})
  useEffect(() => {
    fetch('/api/pane-labels').then(r => r.ok ? r.json() : {}).then(setPaneLabels).catch(() => {})
  }, [])
  const paneLabel = (key: string, fallback: string) => paneLabels[key] ?? fallback
  // Same shared-with-everyone pattern again, but for which section a Cash
  // row sits in -- see /api/pane-groups and ReorderListsPanel.tsx. A row
  // with no entry here just keeps CASH_ITEMS' own default `group`.
  // `standalone` (independent of `group_name`) makes a row its own
  // one-row section named after its own (possibly renamed) label,
  // border-styled rather than filled so it reads as a manually-marked
  // indicator rather than a "real" multi-row group like Sales/Expenses/
  // Customers/Services -- see the Cash pane loop below for how
  // isSelfTitled/chipLabel/chipBorder end up applied per row.
  const [paneGroups, setPaneGroups] = useState<Record<string, { group_name: string | null; standalone: boolean }>>({})
  useEffect(() => {
    fetch('/api/pane-groups').then(r => r.ok ? r.json() : {}).then(setPaneGroups).catch(() => {})
  }, [])
  const effectiveCashItems = CASH_ITEMS.map(item => {
    const override = paneGroups[item.key]
    if (!override) return { ...item, standaloneOverride: false }
    if (override.standalone) return { ...item, group: paneLabel(item.key, item.label), standaloneOverride: true }
    return { ...item, group: override.group_name ?? undefined, standaloneOverride: false }
  })
  // Groups with a self-titled member (Expenses the section vs. Expenses
  // the row) never need the separate floating header -- that member's own
  // chip already serves as the heading. Computed as a set of group names,
  // not per-row, so it holds regardless of which row within the group
  // happens to sort first (see isSelfTitled below): otherwise a plain
  // sibling row reordered ahead of the self-titled one would "steal"
  // flattenPaneRuns' one-header-per-run slot, showing the header floating
  // above that unrelated row while the real self-titled row's own chip
  // renders again further down -- the same name appearing to double up.
  const selfTitledGroups = new Set(
    effectiveCashItems.filter(i => i.group && i.group === paneLabel(i.key, i.label)).map(i => i.group as string)
  )
  // Cash/Manage default to granted for almost everyone (see
  // DEFAULT_ON_FEATURES) -- until the real map has loaded, assume that
  // rather than briefly hiding the whole Grony Cash/Manage pane for every
  // single staff member on every page load while the fetch is in flight.
  const perm = (feature: FeatureKey) =>
    !permsLoaded && DEFAULT_ON_FEATURES.has(feature) ? true : hasFeature({ role, username }, feature, rolePermissions)
  const canSeeCash = perm('cash')
  const canSeeManage = perm('manage')
  // Hiding the Cash/Manage rows in the pane (below) doesn't retract a view
  // someone's already sitting on -- a default landing on 'items', or a
  // direct ?view= link, would otherwise keep showing Cash content forever
  // with no button left to navigate away from it. Bounces to whichever of
  // Manage/Staff Payslips/Home is still available the moment permissions
  // finish loading and turn out not to include the tab currently showing.
  useEffect(() => {
    if (!permsLoaded || outerTab !== 'loss') return
    if (!canSeeCash && CASH_VIEW_KEYS.has(lossView)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      pickLossView(canSeeManage ? MANAGE_LIST_ITEMS[0].key : (myStaffName ? 'staffPayslips' : 'home'))
    } else if (!canSeeManage && MANAGE_VIEW_KEYS.has(lossView)) {
      pickLossView(canSeeCash ? 'items' : (myStaffName ? 'staffPayslips' : 'home'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permsLoaded, canSeeCash, canSeeManage, lossView, outerTab])
  const canSeePL = perm('pl')
  const canSeeTeam = perm('team')
  const canSeeUsers = perm('users')
  const canViewPortalAs = perm('view_portal_as')
  const canSeeUK = isGrony || perm('uk')
  const canSeeCH = isOwnerOrJoe || perm('ch')
  // Settings is worth opening if there's anything at all inside it --
  // Roles & Permissions itself stays canManage-only regardless (root config
  // shouldn't be grantable through the system it configures). Team no
  // longer counts here -- it moved out into its own main-pane section (see
  // below), so canSeeTeam alone no longer needs a reason to open Settings.
  const canOpenSettings = canManage || canSeeUsers || canViewPortalAs
  // UK's own Settings is gated to isGrony, not canOpenSettings -- see the
  // Settings-panel-swap render below.
  const canOpenThisSettings = outerTab === 'uk' ? isGrony : canOpenSettings
  // Drives the merged pane's own-name section AND which staff page it
  // opens -- "just like the user profile icon", it's always your own name,
  // not a generic "Staff" label or a pick-a-person screen. Falls back to
  // undefined for a logged-in account with no matching staff page (there
  // shouldn't be one in practice, but the section still needs to degrade
  // gracefully instead of showing a stranger's personal records).
  const myStaffName = STAFF_ROSTER.find(n => n.toLowerCase() === username.toLowerCase())
  // Whose personal rows (Times/Ana) currently show -- always your own name
  // unless you're Joe/Grony and have switched it via the pane's Viewing
  // picker. Payslips/Violations/Profile don't redirect with it any more --
  // Payslips and Violations already have their own per-staff picker inside
  // Team Payslips/Team Violations, and Profile only ever meant "my own
  // login" to begin with -- so viewingSelf below hides those rows entirely
  // instead of showing them stuck on your own data while the header claims
  // you're viewing someone else.
  const viewingName = viewingNameOverride ?? myStaffName ?? ''
  const viewingSelf = viewingName.toLowerCase() === (myStaffName ?? '').toLowerCase()

  // Pages a Team Meeting note's "discuss on another page" widget can route
  // a follow-up to (see StaffMeetingPanel) -- same permission gates as
  // navDestinations below, since routing to a page you can't otherwise see
  // would just create a task nobody can find.
  const routablePages: string[] = [
    ...(canSeeCash ? CASH_ITEMS.map(v => v.label) : []),
    ...(canSeeManage ? MANAGE_LIST_ITEMS.map(v => v.label) : []),
    ...(myStaffName ? ['Payslips', 'Violations', 'Analytics'] : []),
    ...(canSeeTeam ? STAFF_TEAM_ITEMS.filter(t => t.key !== 'staff_meeting').map(t => t.label) : []),
    ...(canSeeUK ? ['UK'] : []),
    ...(canSeeCH ? CH_ITEMS.map(v => v.label) : []),
  ]

  // Every tab/sub-tab/menu/page the global search can jump to directly --
  // matched and ranked ahead of the data categories below (Items/
  // Customers/etc.) so typing e.g. "sales" lands on the Sales tab itself
  // rather than making you scroll past item/customer/vendor name matches
  // first. Recomputed each render rather than memoized -- it's a small
  // array of cheap closures, not worth the dependency-list upkeep.
  //
  // Built directly off the same canonical lists (CASH_ITEMS/
  // MANAGE_LIST_ITEMS/STAFF_PERSONAL_ITEMS/STAFF_TEAM_ITEMS/CH_ITEMS) and
  // the same permission gates that decide what actually shows in the pane
  // -- this used to be three separately hand-typed label/action lists that
  // drifted out of sync with the real pane contents (new Manage categories
  // like Team Meeting, all of Team's rows, every C&H category, and the
  // Settings-only pages were never added here), which is exactly why most
  // pages weren't turning up in search. Deriving from the source arrays
  // means anything added there is searchable with zero extra upkeep here.
  const navDestinations: { label: string; action: () => void }[] = [
    { label: 'Home', action: () => changeTab('today') },
    ...(canSeeCash ? [
      ...CASH_ITEMS.filter(v => v.key !== 'pl' || canSeePL).map(v => ({ label: v.label, action: () => pickLossView(v.key) })),
      { label: 'Daily', action: () => pickLossView('dailySummary') },
      { label: 'Alias Wide Table', action: () => { pickLossView('items'); setItemsExtraView('aliasWide') } },
      { label: 'Service Matches', action: () => { pickLossView('items'); setItemsExtraView('serviceMatches') } },
      // The one-tap sub-rows nested under a CASH_ITEMS row (New Sale/Live
      // Sale/Log under Sales, New Customer under Customers, ...) aren't
      // their own CASH_ITEMS entries, so the map above never picks them up
      // -- listed by hand here instead, same as every other page search
      // already jumps straight to.
      { label: 'New Sale', action: () => { pickLossView('sales'); setAddForm('sale') } },
      { label: 'Live Sale', action: () => { pickLossView('sales'); setAddForm('live') } },
      { label: 'Sale Log', action: () => { pickLossView('sales'); setAddForm('liveLog') } },
      { label: 'New Customer', action: () => pickLossView('newCustomer') },
      { label: 'A4 sheet sng audit', action: () => { pickLossView('item360'); setItem360JumpId(375) } },
      { label: 'Expense Orders', action: () => pickLossView('expenseOrders') },
      { label: 'Properties at Shop', action: () => { pickLossView('properties'); setPropertiesInitialTab('available') } },
      { label: 'Properties not at Shop', action: () => { pickLossView('properties'); setPropertiesInitialTab('away') } },
      ...serviceGroups.map(g => ({ label: `Services — ${g}`, action: () => { pickLossView('services'); setSelectedServiceGroup(g) } })),
    ] : []),
    ...(canSeeManage ? MANAGE_LIST_ITEMS.map(v => ({ label: v.label, action: () => pickLossView(v.key) })) : []),
    ...(myStaffName ? [
      ...STAFF_PERSONAL_ITEMS.filter(t => viewingSelf || t.key !== 'staffPayslips')
        .map(t => ({ label: t.label, action: () => pickLossView(t.key) })),
      { label: 'Profile', action: () => pickLossView('staffProfile') },
    ] : []),
    ...(canSeeTeam ? STAFF_TEAM_ITEMS.map(t => ({ label: t.label, action: () => pickLossView(t.key) })) : []),
    ...(canManage ? STAFF_ADMIN_TEAM_ITEMS.map(t => ({ label: t.label, action: () => pickLossView(t.key) })) : []),
    ...(canSeeUsers || canManage ? [{ label: 'Users & Roles', action: () => pickLossView('users') }] : []),
    ...(canViewPortalAs ? [{ label: 'View Portal As', action: () => pickLossView('viewPortalAs') }] : []),
    ...(canManage ? [{ label: 'Reorder Lists', action: () => pickLossView('reorderLists') }] : []),
    ...(canSeeUK ? [{ label: 'UK', action: () => changeTab('uk') }] : []),
    ...(canSeeCH ? [
      { label: 'C&H', action: () => changeTab('ch') },
      ...CH_ITEMS.map(item => ({ label: item.label, action: () => { changeTab('ch'); setLossView(item.key as LossView) } })),
    ] : []),
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

  // While the Settings pane is open, the main pane defers to it visually --
  // only the Settings row itself should read as selected, not whatever
  // content view happens to still be showing underneath (e.g. Rota, Biz).
  // Wraps every main-pane `active` check below instead of just hiding
  // Settings' own highlight (the previous fix), which left OTHER rows lit
  // up at the same time as Settings -- still two things selected at once,
  // just the wrong two.
  const paneActive = (cond: boolean) => cond && !settingsOpen
  const paneAccent = PANE_ACCENT[outerTab]

  // New Sale / Live Sale / Log take over the whole content area with their
  // own thing to do (build a cart, tap items, review a log) -- the
  // Analytics toggle and flag badges above them belong to the Sales list
  // view they're not showing, so they're just clutter here.
  const salesFormOpen = lossView === 'sales' && (addForm === 'sale' || addForm === 'live' || addForm === 'liveLog')

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
        <SidePaneContainer mode={cashDisplayMode} accent={paneAccent}
            footer={<>
              <PaneHomeDaily mode={cashDisplayMode}
                onHome={() => { setLossView('home'); setUnreadAnnouncements(0); setSettingsOpen(false) }}
                onDaily={() => { setLossView('dailySummary'); setSettingsOpen(false) }}
                homeActive={paneActive(lossView === 'home')} dailyActive={paneActive(lossView === 'dailySummary')}
                unreadAnnouncements={unreadAnnouncements} />
              {/* Biz/UK/C&H/Search all moved out of this footer -- they now
                  live as small icons at the bottom of the content area (the
                  right side) instead, see below. */}
            </>}>
            <SidePaneToggle mode={cashDisplayMode} onChange={changeCashDisplayMode} label={session?.user?.name ?? username} />

            {/* Cash/Manage/Staff's own rows only make sense while actually
                on that tab -- UK and C&H are separate areas with no
                relationship to any of these, so the list is just empty
                (toggle + View/Sign out only) while on either of them. */}
            {outerTab === 'loss' && (<>
            {canSeeCash && (
            <div>
              {(() => {
                // A header that isn't self-titled (see below) can be
                // collapsed -- carried across map iterations since only the
                // run's first item gets a non-null `header` from
                // flattenPaneRuns; every row until the next header belongs
                // to that same run's collapsed/expanded state. Icon mode
                // shows no headers at all, so it ignores collapse entirely
                // rather than stranding a group with no way to reopen it.
                let groupCollapsed = false
                return flattenPaneRuns(buildPaneRuns(applyPaneOrder(effectiveCashItems, paneOrder.cash).filter(v => v.key !== 'pl' || canSeePL)), IDENTITY_GROUP_LABELS).map(({ item: v, header, divider }) => {
                // A section whose own name is also one of its rows' names
                // (Sales the section vs. Sales the row, same for Expenses/
                // Customers/Services -- or any row an owner-level account
                // has marked "standalone" via Settings) doesn't need a
                // separate, identical-looking header above that row -- the
                // row's own label becomes the section heading instead (see
                // chipLabel/chipBorder on SidePaneButton), still fully
                // clickable. chipBorder (not filled) marks a manually
                // standalone-toggled row specifically, so it reads as
                // distinct from a "real" multi-row group's own self-titled
                // lead row.
                // Checked per-item (not "is this the group's first/header-
                // bearing row") so a self-titled row (Expenses, Sales, ...)
                // keeps its own chip styling even if some other row gets
                // moved into the same section ahead of it in pane order --
                // that other row would otherwise "steal" flattenPaneRuns'
                // one-header-per-run slot, leaving the real self-titled row
                // looking like a plain button.
                const isSelfTitled = !!v.group && v.group === paneLabel(v.key, v.label)
                if (header) groupCollapsed = !selfTitledGroups.has(header) && collapsedPaneGroups.has(header)
                const show = cashDisplayMode === 'icon' || !groupCollapsed
                return (
              <Fragment key={v.key}>
                {header && cashDisplayMode !== 'icon' && !selfTitledGroups.has(header) && renderPaneHeader(header, header)}
                {show && (<>
                <SidePaneButton icon={v.icon} label={paneLabel(v.key, v.label)} mode={cashDisplayMode}
                  chipLabel={isSelfTitled && !v.standaloneOverride}
                  chipBorder={isSelfTitled && v.standaloneOverride}
                  active={paneActive(lossView === v.key)} divider={divider}
                  badge={v.key === 'sales' ? salesFlagsCount
                    : v.key === 'items' ? itemsFlagsCount
                    : v.key === 'bills' ? billsFlagsCount
                    : v.key === 'cab' ? cabFlagsCount
                    : v.key === 'counts' ? countsFlagsCount
                    : v.key === 'feed' ? lossByDateFlagsCount
                    : v.key === 'expenses' ? expensesFlagsCount
                    : v.key === 'customers' ? customersFlagsCount
                    : v.key === 'vendors' ? vendorsFlagsCount
                    : undefined}
                  taskBadge={taskCountFor(cashTaskScopeKey(v.key))}
                  onClick={() => pickLossView(v.key)} />
                {/* Sales' two add-forms get their own one-tap rows right under
                    Sales -- staff opening a sale (especially Live Sale, built
                    for speed under pressure) shouldn't have to land on the
                    Sales list first and then hunt for the New/Live buttons in
                    the toolbar above the table. */}
                {v.key === 'sales' && (
                  <div>
                    <SidePaneButton icon="🧾" label="New Sale" mode={cashDisplayMode}
                      active={paneActive(lossView === 'sales' && addForm === 'sale')}
                      taskBadge={taskCountFor('New Sale')}
                      onClick={() => { pickLossView('sales'); setAddForm('sale') }} />
                    <SidePaneButton icon="⚡" label="Live Sale" mode={cashDisplayMode} divider
                      active={paneActive(lossView === 'sales' && addForm === 'live')}
                      taskBadge={taskCountFor('Live Sale')}
                      onClick={() => { pickLossView('sales'); setAddForm('live') }} />
                    <div>
                      <SidePaneButton icon="📋" label="Log" mode={cashDisplayMode}
                        active={paneActive(lossView === 'sales' && addForm === 'liveLog')}
                        taskBadge={taskCountFor('Sale Log')}
                        onClick={() => { pickLossView('sales'); setAddForm('liveLog') }} />
                    </div>
                  </div>
                )}
                {/* New Customer is its own separate page/pane row now (see
                    the 'newCustomer' LossView above) -- not a signal that
                    reopens a form embedded in the Customers list page, so
                    Notes/Tasks/Laws/Flags stay fully separate between the
                    two instead of sharing the Customers list's own. */}
                {v.key === 'customers' && (
                  <div>
                    <SidePaneButton icon="👤" label="New Customer" mode={cashDisplayMode}
                      active={paneActive(lossView === 'newCustomer')}
                      taskBadge={taskCountFor('New Customer')}
                      onClick={() => pickLossView('newCustomer')} />
                  </div>
                )}
                {/* One-tap jump straight to a specific item's own Item 360
                    page -- id 375 is "A4 Sheet Singles" (see canonical_name
                    in the items table), a high-traffic item worth a
                    permanent shortcut instead of searching for it inside
                    Item 360 every time. Reuses the same item360JumpId state
                    the global search's item results and Items tab's
                    Duplicates flag already drive. */}
                {v.key === 'item360' && (
                  <div>
                    <SidePaneButton icon="🔍" label="A4 sheet sng audit" mode={cashDisplayMode}
                      active={paneActive(lossView === 'item360' && item360JumpId === 375)}
                      taskBadge={taskCountFor('Item 360')}
                      onClick={() => { pickLossView('item360'); setItem360JumpId(375) }} />
                  </div>
                )}
                </>)}
              </Fragment>
                )
              })
              })()}
              {/* Expense Orders and Properties used to be nested sub-rows
                  under Expenses' own pane row -- pulled out to their own
                  standalone rows here instead (per direct feedback: "remove
                  the expense orders button from expenses to maintain its
                  standalone" / "make properties a section on its own"), so
                  neither one's chip styling reads as tucked inside the
                  Expenses section anymore. Expense Orders is also now its
                  own real LossView (see 'expenseOrders' above) rather than
                  a signal that reopens a toggle buried inside ExpensesTab --
                  active correctly reflects whether it's actually the
                  current page now, instead of being hardcoded false. */}
              <SidePaneButton icon="🧾" label="Expense Orders" mode={cashDisplayMode} divider chipLabel
                active={paneActive(lossView === 'expenseOrders')}
                taskBadge={taskCountFor('Expense Orders')}
                onClick={() => pickLossView('expenseOrders')} />
              {cashDisplayMode !== 'icon' && renderPaneHeader('Properties', 'Properties')}
              {(cashDisplayMode === 'icon' || !collapsedPaneGroups.has('Properties')) && (<>
              <SidePaneButton icon="🏷️" label="Properties at Shop" mode={cashDisplayMode} active={false}
                taskBadge={taskCountFor('Properties')}
                onClick={() => { pickLossView('properties'); setPropertiesInitialTab('available') }} />
              <SidePaneButton icon="📦" label="Properties not at Shop" mode={cashDisplayMode} divider active={false}
                taskBadge={taskCountFor('Properties')}
                onClick={() => { pickLossView('properties'); setPropertiesInitialTab('away') }} />
              </>)}
            </div>
            )}

            {canSeeManage && (
            <div className="mt-1 pt-1 border-t border-white/30">
              {cashDisplayMode !== 'icon' && renderPaneHeader('Manage', 'Manage')}
              {(cashDisplayMode === 'icon' || !collapsedPaneGroups.has('Manage')) && (() => {
                let groupCollapsed = false
                return flattenPaneRuns(buildPaneRuns(applyPaneOrder(MANAGE_LIST_ITEMS, paneOrder.manage)), MANAGE_GROUP_LABELS).map(({ item: entry, header, divider }) => {
                const badge = entry.key === 'opener' ? openerBadgeCount
                  : entry.key === 'closer' ? (globalFlags?.missingClosingReports?.length ?? 0)
                  : entry.key === 'jingle' ? jingleFlagsCount
                  : entry.key === 'equipment' ? equipmentFlagsCount
                  : entry.key === 'audio_status' ? advertStatusFlagsCount
                  : undefined
                if (header) groupCollapsed = collapsedPaneGroups.has(header)
                const show = cashDisplayMode === 'icon' || !groupCollapsed
                return (
                  <Fragment key={entry.key}>
                    {header && cashDisplayMode !== 'icon' && renderPaneHeader(header, header)}
                    {show && (
                      <SidePaneButton icon={entry.icon} label={paneLabel(entry.key, entry.label)} mode={cashDisplayMode} divider={divider}
                        active={paneActive(lossView === entry.key)} badge={badge}
                        taskBadge={taskCountFor(entry.label)}
                        onClick={() => pickLossView(entry.key)} />
                    )}
                  </Fragment>
                )
                })
              })()}
            </div>
            )}

            {/* Team -- everyone's records, as opposed to Personal's just-
                your-own. Used to live tucked inside Settings' "Viewing"
                section; pulled out into its own labeled block here so the
                four kinds of thing in this pane (Cash/Manage/Team/Personal)
                read as four distinct sections instead of two of them being
                hidden behind a gear icon. */}
            {canSeeTeam && (
              <div className="mt-1 pt-1 border-t border-white/30">
                {cashDisplayMode !== 'icon' && renderPaneHeader('Team', 'Team')}
                {(cashDisplayMode === 'icon' || !collapsedPaneGroups.has('Team')) && STAFF_TEAM_ITEMS.map((t, i) => (
                  <SidePaneButton key={t.key} icon={t.icon} label={paneLabel(t.key, t.label)} mode={cashDisplayMode} divider={i > 0}
                    active={paneActive(lossView === t.key)}
                    badge={t.key === 'staff_dress' ? dressFlagsCount : t.key === 'teamTimes' ? staffTimesFlagsCount : undefined}
                    taskBadge={taskCountFor(t.label)}
                    onClick={() => pickLossView(t.key)} />
                ))}
              </div>
            )}

            {myStaffName && (
              <div className="mt-1 pt-1 border-t border-white/30">
                {cashDisplayMode !== 'icon' && renderPaneHeader('Personal', viewingSelf ? 'Personal' : `Personal · Viewing: ${viewingName}`)}
                {/* Payslips drops out of this list while viewing someone
                    else -- it no longer redirects with Viewing (see
                    viewingSelf's comment above), so showing it here would
                    either silently keep displaying your own data under
                    someone else's name, or need its own separate "actually
                    not viewing that person" explanation. Team Payslips
                    already has its own per-staff picker for exactly this
                    case. */}
                {(cashDisplayMode === 'icon' || !collapsedPaneGroups.has('Personal')) && (() => {
                  const personalItems = STAFF_PERSONAL_ITEMS.filter(t => viewingSelf || t.key !== 'staffPayslips')
                  return (<>
                    {personalItems.map((t, i) => (
                      <SidePaneButton key={t.key} icon={t.icon} label={t.label} mode={cashDisplayMode} divider={i > 0}
                        active={paneActive(lossView === t.key)}
                        onClick={() => pickLossView(t.key)} />
                    ))}
                    {viewingName.toLowerCase() === username.toLowerCase() && (
                      <SidePaneButton icon="👤" label="Profile" mode={cashDisplayMode} active={paneActive(lossView === 'staffProfile')}
                        divider={personalItems.length > 0}
                        onClick={() => pickLossView('staffProfile')} />
                    )}
                  </>)
                })()}
              </div>
            )}
            </>)}

            {/* C&H's own rows -- a separate area with no relationship to
                Cash/Manage/Staff, so it gets its own (much shorter) list
                here instead of any of theirs. Fiifi/Kuukua/Ebo/Odoye (moved
                here from UK) get a nested "X's Submenus" list underneath
                once selected, exactly like UK's own person rows below --
                driven by the `ch` useUKData() instance instead of `uk`. */}
            {outerTab === 'ch' && (<>
              {CH_ITEMS.map((item, i) => (
                <div key={item.key}>
                  <SidePaneButton icon={item.icon} label={item.label} mode={cashDisplayMode} divider={i > 0}
                    active={paneActive(lossView === item.key)} onClick={() => pickCHView(item.key)} />
                  {CH_CHILD_PERSON[item.key] && lossView === item.key && (
                    <div className="mt-1 pt-1 border-t border-white/30">
                      {cashDisplayMode !== 'icon' && renderPaneHeader(`ch_${item.key}`, `${item.label}'s Submenus`)}
                      {(cashDisplayMode === 'icon' || !collapsedPaneGroups.has(`ch_${item.key}`)) && ch.submenus.map((s, j) => (
                        <SidePaneButton key={s.id} icon="📋" label={s.name} mode={cashDisplayMode} divider={j > 0}
                          active={paneActive(ch.selectedSubmenuId === s.id)} onClick={() => ch.pickSubmenu(s.id)} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>)}

            {/* UK's own rows -- every person's every submenu, flat, in one
                list (e.g. "Grony NVQ Level 3", "Grony Urgent", "Mina Level
                3") instead of a People list you click through to reveal a
                nested Submenus list. Each click still opens just that one
                submenu's own page on the right (via uk.pickPerson +
                uk.pickSubmenu, exactly as the old two-click version did) --
                only the pane's own navigation got flattened, not the
                content area. Submenu names/columns are still fixed from
                the UI's side (no self-service add/rename/delete). */}
            {outerTab === 'uk' && (<>
              {cashDisplayMode !== 'icon' && renderPaneHeader('uk_menus', 'Menus & Submenus')}
              {(cashDisplayMode === 'icon' || !collapsedPaneGroups.has('uk_menus')) && ukAllSubmenus.map((s, i) => (
                <SidePaneButton key={s.id} icon="📋" label={`${s.person} ${s.name}`} mode={cashDisplayMode} divider={i > 0}
                  active={paneActive(uk.selectedSubmenuId === s.id)}
                  taskBadge={taskCountFor(`${s.person} ${s.name}`)}
                  onClick={() => { uk.pickPerson(s.person as typeof uk.person); uk.pickSubmenu(s.id); setSettingsOpen(false) }} />
              ))}

              {ukGeneralSubmenus.length > 0 && (
                <div className="mt-1 pt-1 border-t border-white/30">
                  {cashDisplayMode !== 'icon' && renderPaneHeader('uk_general', 'General Section')}
                  {(cashDisplayMode === 'icon' || !collapsedPaneGroups.has('uk_general')) && ukGeneralSubmenus.map((s, i) => (
                    <SidePaneButton key={s.id} icon="📁" label={s.name} mode={cashDisplayMode} divider={i > 0}
                      active={paneActive(uk.selectedSubmenuId === s.id)}
                      taskBadge={taskCountFor(`General ${s.name}`)}
                      onClick={() => { uk.pickPerson('General' as typeof uk.person); uk.pickSubmenu(s.id); setSettingsOpen(false) }} />
                  ))}
                </div>
              )}
            </>)}

            {/* Settings (Viewing/Team/Users/Add Category/View Portal As) now
                opens as a second pane alongside this one instead of taking
                over the whole screen -- see SettingsPane.tsx below. Sign out
                stays here, part of the scrollable list (pinned to the footer
                before) so the footer stays just the paired shortcut rows
                above. Not marked `active` even while open -- the settings
                pane appearing right next to this one already shows that;
                highlighting this row too just reads as two things selected
                at once (this row AND whatever lossView is still showing,
                e.g. Times), since "settings is open" and "this content is
                showing" are independent, not mutually exclusive states. */}
            <div className="mt-1 pt-1 border-t border-white/30">
              {canOpenThisSettings && (
                <SidePaneButton icon="⚙️" label="Settings" mode={cashDisplayMode} active={settingsOpen}
                  onClick={() => setSettingsOpen(v => !v)} />
              )}
              <SidePaneButton icon="🚪" label="Sign out" mode={cashDisplayMode} active={false} divider={canOpenThisSettings}
                onClick={() => { if (confirm('Sign out?')) signOut({ callbackUrl: '/login' }) }} />
            </div>
        </SidePaneContainer>

        {/* UK's own Settings (add a menu / add a column) is a completely
            separate panel from Biz's SettingsPane (Viewing/Team/Users/
            Portal-As) -- gated to isGrony specifically, matching UKTab's
            own data gate, rather than canOpenSettings' broader Biz-role
            checks (which say nothing about who's allowed to see or edit UK
            data at all). */}
        {settingsOpen && outerTab === 'uk' && isGrony && (
          <UKSettingsPanel onChanged={() => setUkPaneRefresh(k => k + 1)} />
        )}
        {settingsOpen && outerTab !== 'uk' && canOpenSettings && (
          <SettingsPane mode={cashDisplayMode} activeView={lossView}
            viewingName={viewingName} myStaffName={myStaffName} staffRoster={STAFF_ROSTER}
            pickViewing={pickViewing} pickLossView={pickLossView}
            canSeeUsers={canSeeUsers}
            canViewPortalAs={canViewPortalAs} canManageRoles={canManage} canManage={canManage}
          />
        )}

        <div className="relative flex-1 min-w-0 min-h-0 flex flex-col">
          {outerTab === 'loss' && (
            <div className="shrink-0 bg-green-800 border-b border-green-900">
              {/* Row 2: groups + violations + search — hidden on report-style submenus.
                  Groups/Search share their own line, and Columns/Analytics/New share a
                  second one below -- crammed onto one line together they were fighting
                  each other for width, squeezing Search down to nothing on a phone. */}
              {showControls && (
                <div className="flex flex-col gap-1.5 px-2 py-1.5">
                {/* Top row: this page's Law/Notes/Tasks icons + its own
                    individual flag pills, both above Groups/Search now
                    instead of the pills sitting below Columns/Analytics/New
                    and Law/Notes/Tasks not being reachable from this list at
                    all. Pills are sorted by count descending each render --
                    whichever violation is worst right now leads, instead of
                    a fixed N/S/C/G/... order that doesn't reflect what
                    actually needs attention. Kept to one line -- scrolls
                    horizontally instead of wrapping once there are more
                    pills than fit, so this row never pushes Groups/Search
                    further down the screen. */}
                {(lossView === 'items' || lossView === 'sales' || lossView === 'bills') && !salesFormOpen && (
                  <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto">
                    {lossView === 'items' && (
                      <>
                        <button onClick={() => setShowItemsLaws(o => !o)} title="Show laws on this page"
                          className={`shrink-0 text-sm leading-none px-1.5 py-1 rounded-lg transition ${showItemsLaws ? 'bg-white text-green-800' : 'text-white hover:bg-white/10'}`}>
                          ⚖️
                        </button>
                        {showItemsLaws && (
                          <>
                            <button onClick={() => setItemsLawsOpenForm(f => f === 'law' ? null : 'law')} title="Create new law"
                              className={`shrink-0 text-xs font-semibold leading-none px-2 py-1 rounded-lg transition ${itemsLawsOpenForm === 'law' ? 'bg-white text-green-800' : 'text-white hover:bg-white/10'}`}>
                              + Law
                            </button>
                            <button onClick={() => setItemsLawsOpenForm(f => f === 'task' ? null : 'task')} title="Create global task"
                              className={`shrink-0 text-xs font-semibold leading-none px-2 py-1 rounded-lg transition ${itemsLawsOpenForm === 'task' ? 'bg-white text-green-800' : 'text-white hover:bg-white/10'}`}>
                              + Task
                            </button>
                            <button onClick={() => setItemsLawsOpenForm(f => f === 'note' ? null : 'note')} title="Create global note"
                              className={`shrink-0 text-xs font-semibold leading-none px-2 py-1 rounded-lg transition ${itemsLawsOpenForm === 'note' ? 'bg-white text-green-800' : 'text-white hover:bg-white/10'}`}>
                              + Note
                            </button>
                            <label className="shrink-0 flex items-center gap-1 text-white hover:bg-white/10 px-2 py-1 rounded-lg cursor-pointer transition">
                              <input type="checkbox" checked={hideZeroFlags} onChange={e => setHideZeroFlags(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300" />
                              <span className="text-xs font-semibold leading-none">Hide 0</span>
                            </label>
                          </>
                        )}
                      </>
                    )}
                    {lossView === 'sales' && (
                      <>
                        <button onClick={() => setShowSalesLaws(o => !o)} title="Show laws on this page"
                          className={`shrink-0 text-sm leading-none px-1.5 py-1 rounded-lg transition ${showSalesLaws ? 'bg-white text-green-800' : 'text-white hover:bg-white/10'}`}>
                          ⚖️
                        </button>
                        {showSalesLaws && (
                          <>
                            <button onClick={() => setSalesLawsOpenForm(f => f === 'law' ? null : 'law')} title="Create new law"
                              className={`shrink-0 text-xs font-semibold leading-none px-2 py-1 rounded-lg transition ${salesLawsOpenForm === 'law' ? 'bg-white text-green-800' : 'text-white hover:bg-white/10'}`}>
                              + Law
                            </button>
                            <button onClick={() => setSalesLawsOpenForm(f => f === 'task' ? null : 'task')} title="Create global task"
                              className={`shrink-0 text-xs font-semibold leading-none px-2 py-1 rounded-lg transition ${salesLawsOpenForm === 'task' ? 'bg-white text-green-800' : 'text-white hover:bg-white/10'}`}>
                              + Task
                            </button>
                            <button onClick={() => setSalesLawsOpenForm(f => f === 'note' ? null : 'note')} title="Create global note"
                              className={`shrink-0 text-xs font-semibold leading-none px-2 py-1 rounded-lg transition ${salesLawsOpenForm === 'note' ? 'bg-white text-green-800' : 'text-white hover:bg-white/10'}`}>
                              + Note
                            </button>
                            <label className="shrink-0 flex items-center gap-1 text-white hover:bg-white/10 px-2 py-1 rounded-lg cursor-pointer transition">
                              <input type="checkbox" checked={salesHideZeroFlags} onChange={e => setSalesHideZeroFlags(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300" />
                              <span className="text-xs font-semibold leading-none">Hide 0</span>
                            </label>
                          </>
                        )}
                      </>
                    )}
                    {lossView === 'bills' && (
                      <>
                        <button onClick={() => setShowBillsLaws(o => !o)} title="Show laws on this page"
                          className={`shrink-0 text-sm leading-none px-1.5 py-1 rounded-lg transition ${showBillsLaws ? 'bg-white text-green-800' : 'text-white hover:bg-white/10'}`}>
                          ⚖️
                        </button>
                        {showBillsLaws && (
                          <>
                            <button onClick={() => setBillsLawsOpenForm(f => f === 'law' ? null : 'law')} title="Create new law"
                              className={`shrink-0 text-xs font-semibold leading-none px-2 py-1 rounded-lg transition ${billsLawsOpenForm === 'law' ? 'bg-white text-green-800' : 'text-white hover:bg-white/10'}`}>
                              + Law
                            </button>
                            <button onClick={() => setBillsLawsOpenForm(f => f === 'task' ? null : 'task')} title="Create global task"
                              className={`shrink-0 text-xs font-semibold leading-none px-2 py-1 rounded-lg transition ${billsLawsOpenForm === 'task' ? 'bg-white text-green-800' : 'text-white hover:bg-white/10'}`}>
                              + Task
                            </button>
                            <button onClick={() => setBillsLawsOpenForm(f => f === 'note' ? null : 'note')} title="Create global note"
                              className={`shrink-0 text-xs font-semibold leading-none px-2 py-1 rounded-lg transition ${billsLawsOpenForm === 'note' ? 'bg-white text-green-800' : 'text-white hover:bg-white/10'}`}>
                              + Note
                            </button>
                            <label className="shrink-0 flex items-center gap-1 text-white hover:bg-white/10 px-2 py-1 rounded-lg cursor-pointer transition">
                              <input type="checkbox" checked={billsHideZeroFlags} onChange={e => setBillsHideZeroFlags(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300" />
                              <span className="text-xs font-semibold leading-none">Hide 0</span>
                            </label>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
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
                      placeholder={`Search ${CASH_LABEL.get(lossView) ?? ''}`} autoComplete="off"
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

                {['items', 'sales', 'bills', 'expenses'].includes(lossView) && !salesFormOpen && (
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
                      📊 {showAnalytics ? 'List' : 'Ana'}
                    </button>

                    {/* New button — Items/Bills/Expenses/PO submenus only; Sales' New/Live/Log
                        moved to their own rows under Sales in the left pane, and report-style
                        and Counts submenus have no add-form, so neither shows a button here. */}
                    {!showAnalytics && lossView !== 'sales' && (() => {
                      const formKey = lossView === 'items' ? 'item' : lossView === 'bills' ? 'bill' : 'expense'
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
        {addForm === 'sale'    && outerTab === 'loss' && lossView === 'sales'    && (
          <div className="px-4">
            <div className="flex items-center justify-between">
              <LawsToggleBar show={newSaleLaws.show} setShow={newSaleLaws.setShow}
                openForm={newSaleLaws.openForm} setOpenForm={newSaleLaws.setOpenForm}
                hideZeroFlags={newSaleLaws.hideZeroFlags} setHideZeroFlags={newSaleLaws.setHideZeroFlags} dark={false} />
              <button onClick={() => setAddForm(null)}
                className="text-xs font-semibold px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 border border-gray-300">×</button>
            </div>
            {newSaleLaws.show && (
              <div className="border border-gray-200 rounded-xl bg-white overflow-hidden mb-2">
                <PageLawsList scopeKey="New Sale" isItemsLaws={true} onChange={newSaleLaws.bumpRefresh}
                  openForm={newSaleLaws.openForm} setOpenForm={newSaleLaws.setOpenForm}
                  hideZeroFlags={newSaleLaws.hideZeroFlags} setHideZeroFlags={newSaleLaws.setHideZeroFlags} />
              </div>
            )}
            <NewSaleForm onSuccess={() => setAddForm(null)} groupFilter={group} />
          </div>
        )}
        {(addForm === 'live' || addForm === 'liveLog') && outerTab === 'loss' && lossView === 'sales' &&
          <LiveSaleForm key={addForm} onClose={() => setAddForm(null)} initialShowLog={addForm === 'liveLog'} search={search} groupFilter={group} />}
        {addForm === 'bill'    && outerTab === 'loss' && lossView === 'bills'    && <div className="px-4"><NewBillForm    onSuccess={() => setAddForm(null)} /></div>}
        {addForm === 'expense' && outerTab === 'loss' && lossView === 'expenses' && <div className="px-4"><NewExpenseForm onSuccess={() => setAddForm(null)} /></div>}
        {addForm === 'item'    && outerTab === 'loss' && lossView === 'items'    && <div className="px-4"><NewItemForm    onSuccess={() => { setAddForm(null); loadItems() }} /></div>}
        {outerTab === 'loss' && lossView === 'pl' && (
          <TabErrorBoundary>
            <div className="px-4 pt-2">{inlineLaws('P&L', plLaws)}</div>
            <ProfitLossTab />
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'vendors' && (
          <TabErrorBoundary>
            <div className="px-4 pt-2 space-y-2"><VendorsPage openAddSignal={vendorSignal} initialSearch={vendorSearchText} onFlagCountChange={setVendorsFlagsCount} /></div>
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'customers' && (
          <TabErrorBoundary>
            <div className="px-4 pt-2 space-y-2"><CustomersPage initialSearch={customerSearchText} onFlagCountChange={setCustomersFlagsCount} /></div>
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'newCustomer' && (
          <TabErrorBoundary>
            <div className="px-4 pt-2">
              {inlineLaws('New Customer', newCustomerLaws)}
              <div className="mt-2">
                <NewCustomerForm
                  onCreated={() => pickLossView('customers')}
                  onCancel={() => pickLossView('customers')} />
              </div>
            </div>
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'receipts' && (
          <TabErrorBoundary>
            <div className="px-4 pt-2 space-y-2">{inlineLaws('Receipts', receiptsLaws)}<ReceiptsPage /></div>
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'home' && (
          <TabErrorBoundary>
            <div className="px-4 pt-2">{inlineLaws('Home', homeLaws)}</div>
            <div className="px-4"><TodayContent /></div>
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'dailySummary' && (
          <TabErrorBoundary>
            <div className="px-4 pt-2">{inlineLaws('Daily', dailyLaws)}</div>
            <DailySummaryTab />
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'purchaseOrders' && (
          <TabErrorBoundary>
            <div className="px-4 pt-4 space-y-2">{inlineLaws('Purchase Orders', purchaseOrdersLaws)}<PurchaseOrdersPage /></div>
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'item360' && (
          <TabErrorBoundary>
            <div className="px-4 pt-2">{inlineLaws('Item 360', item360Laws)}</div>
            <Item360Tab items={items} jumpToItemId={item360JumpId} onJumpDone={() => setItem360JumpId(null)} />
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'services' && (
          <TabErrorBoundary>
            <div className="px-4 pt-2 pb-10">
              {inlineLaws(selectedServiceGroup ? `Services — ${selectedServiceGroup}` : 'Services', servicesLaws)}
              {!selectedServiceGroup ? (
                <p className="py-20 text-center text-gray-400 text-xs">Pick a group from Items&apos; ⚖️ Law panel to see its items.</p>
              ) : (() => {
                const groupItems = items.filter(i => i.cf_group === selectedServiceGroup)
                return (
                  <div className="mt-2 space-y-2">
                    <p className="text-sm font-bold text-gray-900">{selectedServiceGroup}</p>
                    <p className="text-[11px] text-gray-400">
                      {groupItems.length} item{groupItems.length !== 1 ? 's' : ''}
                    </p>
                    {groupItems.length === 0 ? (
                      <p className="py-10 text-center text-gray-400 text-xs">No items in this group.</p>
                    ) : (
                      <ServicesGroupTable items={groupItems} />
                    )}
                  </div>
                )
              })()}
            </div>
          </TabErrorBoundary>
        )}
        {/* Settings' own non-navigation row (see SettingsPane.tsx) -- now a
            real content destination like everything else in Settings,
            rather than an inline widget crammed into the narrow pane itself. */}
        {outerTab === 'loss' && lossView === 'viewPortalAs' && (
          <TabErrorBoundary>
            <div className="px-4 pt-4 max-w-sm space-y-3">
              {inlineLaws('View Portal As', viewPortalAsLaws)}
              <h1 className="text-lg font-bold text-gray-900">View Portal As</h1>
              <ViewPortalAsButton extraAllowed={canViewPortalAs} />
            </div>
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'reorderLists' && (
          <TabErrorBoundary>
            <div className="px-4 pt-4 max-w-sm space-y-2">
              {inlineLaws('Reorder Lists', reorderListsLaws)}
              <ReorderListsPanel cashItems={effectiveCashItems} manageItems={MANAGE_LIST_ITEMS} staffItems={STAFF_TEAM_ITEMS}
                paneOrder={paneOrder} setPaneOrder={setPaneOrder} paneLabels={paneLabels} setPaneLabels={setPaneLabels}
                paneGroups={paneGroups} setPaneGroups={setPaneGroups} />
            </div>
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && MANAGE_VIEW_KEYS.has(lossView) && (
          <TabErrorBoundary>
            <GronyManageContent view={lossView as ManageView}
              canManage={canManage} categoryIds={fixedCategoryIds}
              openerViolations={openerViolations}
              assignments={assignments} deadlines={deadlines} assignedBy={assignedBy} assignedOn={assignedOn} vSettings={vSettings}
              onGoToViolation={goToViolation}
              missingClosingReportsCount={globalFlags?.missingClosingReports?.length ?? 0}
              onOpenStaff={() => pickLossView('teamTimes')}
              propertiesInitialTab={propertiesInitialTab} />
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && STAFF_VIEW_KEYS.has(lossView) && (
          <TabErrorBoundary>
            {myStaffName ? (
              // key forces a full remount whenever the logged-in identity
              // changes (e.g. an admin switching "View as" between staff
              // without leaving this tab) -- a stale identity could
              // otherwise leak into TimesTab/PayslipsTab's own local
              // state across accounts.
              <>
                <StaffContent key={myStaffName} view={lossView as StaffView}
                  viewingName={viewingName} role={role} username={username}
                  canSeeTeam={canSeeTeam} canSeeUsers={canSeeUsers} canSeeRoles={canManage} canManage={canManage}
                  staffRoster={STAFF_ROSTER} routablePages={routablePages} categoryIds={fixedCategoryIds}
                  openAddSignal={staffTimeSignal} />
              </>
            ) : (
              <p className="py-10 text-center text-gray-400 text-sm px-4">No staff profile is set up for your account.</p>
            )}
          </TabErrorBoundary>
        )}
        {outerTab === 'uk' && (
          <TabErrorBoundary><UKTab uk={uk} /></TabErrorBoundary>
        )}
        {outerTab === 'ch' && (
          <TabErrorBoundary><CHTab view={lossView as CHView} childData={ch} /></TabErrorBoundary>
        )}
        {outerTab === 'today' && !(addForm === 'sale' || addForm === 'bill' || addForm === 'expense') && (
          <TabErrorBoundary>
            <div className="h-full overflow-y-auto px-4 space-y-2 pt-2">
              <MyAssignmentsSummary assignments={assignments} deadlines={deadlines} />
              <TodayContent />
            </div>
          </TabErrorBoundary>
        )}
        {!showAnalytics && addForm !== 'expense' && outerTab === 'loss' && lossView === 'expenses' && (
          <ExpensesTab search={search} onFlagCountChange={setExpensesFlagsCount} />
        )}
        {showAnalytics && outerTab === 'loss' && lossView === 'expenses' && (
          <TabErrorBoundary><div className="px-3 pt-3"><ExpensesAnalyticsSection /></div></TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'expenseOrders' && (
          <TabErrorBoundary>
            <div className="px-3 pt-2">{inlineLaws('Expense Orders', expenseOrdersLaws)}</div>
            <div className="flex-1 overflow-y-auto min-h-0"><ExpenseOrdersPanel /></div>
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'cab' && <CABTab openConfirmSignal={cabConfirmSignal} />}
        {/* Items pill selected -> ItemsTab's filtered fix view; otherwise the
            submenu's normal content (LossTab). Same swap pattern for
            Sales/Counts/Feed below -- each of those already knows how to
            render its own filtered view when handed a matching violation
            key (SalesTab/CountsTab), or via the kind prop (LossFeedTab). */}
        {outerTab === 'loss' && lossView === 'items' && itemsExtraView === 'aliasWide' && (
          <TabErrorBoundary>
            <div className="px-4 pt-4 space-y-2">{inlineLaws('Alias Wide Table', aliasWideTableLaws)}<AliasWidePage /></div>
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'items' && itemsExtraView === 'serviceMatches' && (
          <TabErrorBoundary>
            <div className="px-4 pt-4 space-y-2">{inlineLaws('Service Matches', serviceMatchesLaws)}<ServiceMatchesPage /></div>
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
          <>
            {showItemsLaws && (
              <div className="border-b border-gray-200 bg-white px-3 py-2 shadow-md">
                <TabErrorBoundary key={itemsLawsRefresh}>
                  <PageLawsList
                    scopeKey="Items"
                    isItemsLaws={true}
                    onChange={() => setItemsLawsRefresh(r => r + 1)}
                    flags={[
                      ...ITEMS_FLAG_TYPES.map(({ key, label }) => ({
                        key,
                        label,
                        count: violationCounts[key] ?? 0,
                        description: ERROR_VIOLATIONS.find(v => v.key === key)?.description,
                        onViewClick: () => goToViolation(key)
                      })),
                      // One shortcut per real item group -- replaces the old
                      // tall "Services" sidebar list of the same groups
                      // (Batteries, Cables, ...), which existed only as a
                      // manual way to visit each group and eyeball it. No
                      // count (not a violation, just a jump-to-view), so it
                      // renders 🏳️/gray like every other zero flag -- "Hide
                      // 0" hides these along with genuine zero-violation
                      // flags if toggled on. Reuses the existing Services
                      // group-table view (lossView='services' +
                      // selectedServiceGroup) rather than a new one -- that
                      // view already filters `items` by cf_group regardless
                      // of product_type, "Services" is just its name.
                      ...serviceGroups.map(g => ({
                        key: `group_${g}`,
                        label: g,
                        count: 0,
                        onViewClick: () => { pickLossView('services'); setSelectedServiceGroup(g) },
                      })),
                    ]}
                    openForm={itemsLawsOpenForm}
                    setOpenForm={setItemsLawsOpenForm}
                    hideZeroFlags={hideZeroFlags}
                    setHideZeroFlags={setHideZeroFlags}
                  />
                </TabErrorBoundary>
              </div>
            )}
            {violation && pillKeys?.includes(violation) ? (
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
                      violationLabel={ERROR_VIOLATIONS.find(v => v.key === violation)?.label}
                      onItemsChanged={setItems}
                      showAdd={false}
                      onCloseAdd={() => {}}
                      jumpToItemId={jumpToItemId}
                      onJumpDone={() => setJumpToItemId(null)}
                      onOpenItem360={id => { pickLossView('item360'); setItem360JumpId(id) }}
                    />
                  </TabErrorBoundary>
                )
            ) : (
              <TabErrorBoundary>
                <LossTab onOpenItem={() => {}} search={search} group={group} productType={productType}
                  visibleCols={itemsColPrefs.visibleCols} colOrder={itemsColPrefs.colOrder} columnLabels={itemsColPrefs.columnLabels}
                  getWidth={itemsColPrefs.getWidth} resizeWidth={itemsColPrefs.resizeWidth} resetWidth={itemsColPrefs.resetWidth} />
              </TabErrorBoundary>
            )}
          </>
        )}
        {showAnalytics && outerTab === 'loss' && lossView === 'sales' && (
          <TabErrorBoundary><div className="px-3 pt-3"><SalesAnalyticsSection /></div></TabErrorBoundary>
        )}
        {!showAnalytics && addForm !== 'sale' && addForm !== 'live' && addForm !== 'liveLog' && outerTab === 'loss' && lossView === 'sales' && (<>
          {showSalesLaws && (
            <div className="border-b border-gray-200 bg-white px-3 py-2 shadow-md">
              <TabErrorBoundary key={salesLawsRefresh}>
                <PageLawsList
                  scopeKey="Sales"
                  isItemsLaws={true}
                  onChange={() => setSalesLawsRefresh(r => r + 1)}
                  flags={SALES_FLAG_TYPES.map(({ key, label }) => ({
                    key, label, count: violationCounts[key] ?? 0,
                    description: ERROR_VIOLATIONS.find(v => v.key === key)?.description,
                    onViewClick: () => goToViolation(key),
                  }))}
                  openForm={salesLawsOpenForm}
                  setOpenForm={setSalesLawsOpenForm}
                  hideZeroFlags={salesHideZeroFlags}
                  setHideZeroFlags={setSalesHideZeroFlags}
                />
              </TabErrorBoundary>
            </div>
          )}
          <SalesTab items={items} groupFilter={group} search={search}
            violation={pillKeys?.includes(violation ?? '') ? violation : null}
            jumpToDate={jumpToReceiptDate} jumpToItemName={jumpToReceiptItemName}
            onJumpDone={() => { setJumpToReceiptDate(null); setJumpToReceiptItemName(null) }} />
        </>)}
        {showAnalytics && outerTab === 'loss' && lossView === 'bills' && (
          <TabErrorBoundary><div className="px-3 pt-3"><BillsAnalyticsSection /></div></TabErrorBoundary>
        )}
        {!showAnalytics && addForm !== 'bill' && outerTab === 'loss' && lossView === 'bills' && (<>
          {showBillsLaws && (
            <div className="border-b border-gray-200 bg-white px-3 py-2 shadow-md">
              <TabErrorBoundary key={billsLawsRefresh}>
                <PageLawsList
                  scopeKey="Bills"
                  isItemsLaws={true}
                  onChange={() => setBillsLawsRefresh(r => r + 1)}
                  flags={BILLS_FLAG_TYPES.map(({ key, label }) => ({
                    key, label, count: violationCounts[key] ?? 0,
                    description: ERROR_VIOLATIONS.find(v => v.key === key)?.description,
                    onViewClick: () => goToViolation(key),
                  }))}
                  openForm={billsLawsOpenForm}
                  setOpenForm={setBillsLawsOpenForm}
                  hideZeroFlags={billsHideZeroFlags}
                  setHideZeroFlags={setBillsHideZeroFlags}
                />
              </TabErrorBoundary>
            </div>
          )}
          <BillsTab items={items} groupFilter={group} search={search}
            violation={pillKeys?.includes(violation ?? '') ? violation : null} />
        </>)}
        {outerTab === 'loss' && lossView === 'counts' && (<>
          <CountsTab items={items} groupFilter={group} search={search}
            violation={pillKeys?.includes(violation ?? '') ? violation : null} onFixRecords={goFixRecords}
            onGoToViolation={goToViolation} />
        </>)}
        {/* The gains pill (see LOSSVIEW_PILL_KEYS['feed']) always lands here
            via VIOLATION_HOME['gains'] = 'feed' -- it's a violation to fix,
            not a way of browsing losses, so this view shows the gain feed
            instead of the loss feed while it's active. The Losses/Gains
            toggle below covers reaching the gain feed on its own too, now
            that the 'gains' violation deep-link's only source (Tasks) is gone. */}
        {outerTab === 'loss' && lossView === 'feed' && (
          <TabErrorBoundary>
            {!violation && <div className="px-3 pt-2">{inlineLaws('Loss by Date', lossByDateLaws)}</div>}
            {!violation && (
              <div className="flex justify-end gap-1 px-3 pt-2">
                <button onClick={() => setFeedShowGains(false)}
                  className={`text-[9px] font-semibold px-2 py-1 rounded transition ${!feedShowGains ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  Losses
                </button>
                <button onClick={() => setFeedShowGains(true)}
                  className={`text-[9px] font-semibold px-2 py-1 rounded transition ${feedShowGains ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  🚩 Gains
                </button>
              </div>
            )}
            <LossFeedTab search={search} kind={(violation === 'gains' || feedShowGains) ? 'gain' : 'loss'} />
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'lossByItem' && (
          <TabErrorBoundary>
            <div className="px-3 pt-2">{inlineLaws('Loss by Item', lossByItemLaws)}</div>
            <LossByItemTab search={search} />
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'lossByTarget' && (
          <TabErrorBoundary>
            <div className="px-3 pt-2">{inlineLaws('Loss by Target', lossByTargetLaws)}</div>
            <div className="py-20 text-center text-gray-400 text-xs">Coming soon.</div>
          </TabErrorBoundary>
        )}
          </div>
          {/* Biz/UK/C&H/Search now live here instead of the left pane's
              footer -- small icons, spaced far apart, pinned outside the
              scrollable area so they're always reachable without hunting
              through the narrow left column. Search always shows (it looks
              across the whole app -- items, customers, vendors, sales,
              bills, announcements -- unlike the per-view search bars
              already on most tabs, which only filter what's on screen).
              Biz/UK/C&H keep the old rule: someone permitted to see only
              Grony Cash has nothing to switch to, so those three only show
              once UK and/or C&H access exists. The "+" shortcut menu (see
              AddShortcutButton/handleShortcut) rejoins this row too --
              always shown, same as when it was its own floating button. */}
          <div className="shrink-0 flex items-center justify-evenly py-2 bg-white border-t border-gray-200">
            {(canSeeUK || canSeeCH) && (
              <button onClick={() => changeTab('loss')} title="Biz"
                style={{ color: PANE_ACCENT.loss }}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-lg border-2 transition
                  ${outerTab === 'loss' ? 'border-current' : 'border-transparent opacity-40 hover:opacity-70'}`}>
                💰
              </button>
            )}
            {canSeeUK && (
              <button onClick={() => changeTab('uk')} title="UK"
                style={{ color: PANE_ACCENT.uk }}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-lg border-2 transition
                  ${outerTab === 'uk' ? 'border-current' : 'border-transparent opacity-40 hover:opacity-70'}`}>
                🇬🇧
              </button>
            )}
            {canSeeCH && (
              <button onClick={() => changeTab('ch')} title="C&H"
                style={{ color: PANE_ACCENT.ch }}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-lg border-2 transition
                  ${outerTab === 'ch' ? 'border-current' : 'border-transparent opacity-40 hover:opacity-70'}`}>
                🏢
              </button>
            )}
            <button onClick={() => setGlobalSearchOpen(true)} title="Search"
              className="w-9 h-9 rounded-full flex items-center justify-center text-lg border-2 border-transparent text-gray-500 opacity-70 hover:opacity-100 transition">
              🔍
            </button>
            <AddShortcutButton onShortcut={handleShortcut} />
          </div>
        </div>
      </div>

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
                  + (r.ukSubmenus?.length ?? 0) + (r.ukEntries?.length ?? 0) + (r.chLogs?.length ?? 0)
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
                  {/* UK/C&H only ever arrive here for accounts the API route
                      itself decided can see them -- see /api/search's
                      canSeeUK/canSeeCH gating. Fiifi/Kuukua/Ebo/Odoye's own
                      rows come back tagged with the same plain `person`
                      string as everyone else's (they're the same
                      uk_submenus/uk_rows tables, see chViewData.ts's
                      CH_PERSON_VIEW) -- split out here so they list (and
                      open) under C&H instead of UK, matching where they
                      actually live now. */}
                  {!!r.ukSubmenus?.filter(s => !(s.person in CH_PERSON_VIEW)).length && (
                    <div>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide">UK</p>
                      {r.ukSubmenus.filter(s => !(s.person in CH_PERSON_VIEW)).map(s => (
                        <button key={s.id}
                          onClick={() => { openPersonSubmenu(s.person, s.id); closeGlobalSearch() }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition truncate">
                          {s.name}
                          <span className="text-gray-400 text-xs ml-1.5">· {s.person}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {!!r.ukEntries?.filter(e => !(e.person in CH_PERSON_VIEW)).length && (
                    <div>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide">UK entries</p>
                      {r.ukEntries.filter(e => !(e.person in CH_PERSON_VIEW)).map(e => (
                        <button key={`${e.row_id}-${e.column_name}`}
                          onClick={() => { openPersonSubmenu(e.person, e.submenu_id); closeGlobalSearch() }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition truncate">
                          {e.value}
                          <span className="text-gray-400 text-xs ml-1.5">· {e.submenu_name} · {e.column_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {!!r.ukSubmenus?.filter(s => s.person in CH_PERSON_VIEW).length && (
                    <div>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide">C&amp;H</p>
                      {r.ukSubmenus.filter(s => s.person in CH_PERSON_VIEW).map(s => (
                        <button key={s.id}
                          onClick={() => { openPersonSubmenu(s.person, s.id); closeGlobalSearch() }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition truncate">
                          {s.name}
                          <span className="text-gray-400 text-xs ml-1.5">· {s.person}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {!!r.ukEntries?.filter(e => e.person in CH_PERSON_VIEW).length && (
                    <div>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide">C&amp;H entries</p>
                      {r.ukEntries.filter(e => e.person in CH_PERSON_VIEW).map(e => (
                        <button key={`${e.row_id}-${e.column_name}`}
                          onClick={() => { openPersonSubmenu(e.person, e.submenu_id); closeGlobalSearch() }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition truncate">
                          {e.value}
                          <span className="text-gray-400 text-xs ml-1.5">· {e.submenu_name} · {e.column_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {!!r.chLogs?.length && (
                    <div>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide">C&amp;H</p>
                      {r.chLogs.map(l => (
                        <button key={l.id}
                          onClick={() => { changeTab('ch'); setLossView(l.category as LossView); closeGlobalSearch() }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition truncate">
                          {l.notes}
                          <span className="text-gray-400 text-xs ml-1.5">· {l.category_label} · {l.log_date}</span>
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
