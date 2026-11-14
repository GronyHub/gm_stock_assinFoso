'use client'
import { Component, type ReactNode, type CSSProperties } from 'react'
import { ACTIVE_STAFF_ORDERED, staffLabel } from '@/lib/staffList'
import { trimZeros } from '@/lib/fmtNumber'
import type { GmcOpenOverage } from '@/lib/gmcStock'
import type { Attachment } from '../_components/attachmentsShared'
import { MANAGE_LIST_ITEMS, MANAGE_GROUP_LABELS, GRONY_CHECKS_KEYS, ADVERT_KEYS, type ManageView } from '../_components/manageViewData'
import { STAFF_PERSONAL_ITEMS, STAFF_TEAM_ITEMS, STAFF_ADMIN_TEAM_ITEMS, type StaffView } from '../_components/staffViewData'
import { CH_ITEMS, type CHView } from '../_components/chViewData'
import SettingsPane from '../_components/SettingsPane'
import { buildPaneRuns, flattenPaneRuns } from '../_components/paneOrder'
import dynamic from 'next/dynamic'



export class TabErrorBoundary extends Component<{ children: ReactNode }, { error: boolean; message: string }> {
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

export const loading = (h: string) => <div className={`py-10 text-center text-gray-400 text-sm`}>{h}</div>

// Pickers live in LossTab.tsx (150 KB). Importing them statically pulled the
// whole file into the first page load and defeated the dynamic() LossTab below.
export const ExpenseOrdersPanel = dynamic(() => import('../_components/ExpenseOrdersPanel'), { ssr: false })

export const UKSettingsPanel = dynamic(() => import('../_components/UKSettingsPanel'), { ssr: false })

export const Item360Page = dynamic(() => import('../_components/Item360Page'), { ssr: false, loading: () => loading('Loading…') })

export const ItemDetailPanel = dynamic(() => import('../_components/ItemDetailPanel'), { ssr: false })

export const AliasPicker     = dynamic(() => import('../_components/LossTab').then(m => m.AliasPicker),     { ssr: false })

export const MatchPicker     = dynamic(() => import('../_components/LossTab').then(m => m.MatchPicker),     { ssr: false })

export const MergeItemPicker = dynamic(() => import('../_components/LossTab').then(m => m.MergeItemPicker), { ssr: false })

// Opened on demand only -- no reason to ship them with the first load.
export const ItemsTab       = dynamic(() => import('../_components/ItemsTab'),        { ssr: false, loading: () => loading('Loading…') })

export const ExpensesTab    = dynamic(() => import('../_components/ExpensesTab'),     { ssr: false, loading: () => loading('Loading…') })

export const CABTab         = dynamic(() => import('../_components/CABTab'),          { ssr: false, loading: () => loading('Loading…') })

export const TodayContent   = dynamic(() => import('../_components/TodayContent'),    { ssr: false, loading: () => loading('Loading…') })


export const NewExpenseForm = dynamic(() => import('../../expenses/new/page'),          { ssr: false, loading: () => loading('Loading…') })

export const NewItemForm    = dynamic(() => import('../_components/NewItemForm'),     { ssr: false, loading: () => loading('Loading…') })

export const ItemsAnalyticsSection      = dynamic(() => import('../_components/ItemsAnalyticsSection'),      { ssr: false, loading: () => loading('Loading analytics…') })

export const ViolationsAnalyticsSection = dynamic(() => import('../_components/ViolationsAnalyticsSection'), { ssr: false, loading: () => loading('Loading analytics…') })

export const ExpensesAnalyticsSection   = dynamic(() => import('../_components/ExpensesAnalyticsSection'),   { ssr: false, loading: () => loading('Loading analytics…') })

export const LossTab        = dynamic(() => import('../_components/LossTab'),         { ssr: false, loading: () => loading('Loading…') })

export const ProfitLossTab  = dynamic(() => import('../_components/ProfitLossTab'),   { ssr: false, loading: () => loading('Loading…') })

export const DailySummaryTab = dynamic(() => import('../_components/DailySummaryTab'), { ssr: false, loading: () => loading('Loading…') })

export const ShopTeamTimes = dynamic(() => import('../_components/ShopTeamTimes'), { ssr: false, loading: () => loading('Loading…') })

export const GronyManageContent = dynamic(() => import('../_components/GronyManageTab'), { ssr: false, loading: () => loading('Loading…') })

export const VendorsPage    = dynamic(() => import('../../vendors/page'),               { ssr: false, loading: () => loading('Loading…') })

export const CustomersPage  = dynamic(() => import('../../customers/page'),             { ssr: false, loading: () => loading('Loading…') })

export const PurchaseOrdersPage  = dynamic(() => import('../../purchase-orders/page'),        { ssr: false, loading: () => loading('Loading…') })

export const AliasWidePage       = dynamic(() => import('../../aliases/wide/page'),           { ssr: false, loading: () => loading('Loading…') })

export const ServiceMatchesPage  = dynamic(() => import('../../matches/wide/page'),           { ssr: false, loading: () => loading('Loading…') })

export const GmcPacksPage        = dynamic(() => import('../_components/GmcPacksPage'),   { ssr: false, loading: () => loading('Loading…') })

export const ViewPortalAsButton  = dynamic(() => import('@/components/ViewPortalAsButton'), { ssr: false })

export const StaffContent = dynamic(() => import('../_components/StaffPersonTab'),    { ssr: false, loading: () => loading('Loading…') })

export const StaffMemberPersonalTab = dynamic(() => import('../_components/StaffMemberPersonalTab'), { ssr: false, loading: () => loading('Loading…') })

export const UKTab = dynamic(() => import('../_components/UKTab'), { ssr: false, loading: () => loading('Loading…') })

export const CHTab = dynamic(() => import('../_components/CHTab'), { ssr: false, loading: () => loading('Loading…') })

export const ReorderListsPanel = dynamic(() => import('../_components/ReorderListsPanel'), { ssr: false, loading: () => loading('Loading…') })

export const ActivityDurationsPanel = dynamic(() => import('../_components/ActivityDurationsPanel'), { ssr: false, loading: () => loading('Loading…') })

// Sales/Bills/Loss by Date -- folded into Live Sale's own switcher (same
// treatment Count 2 and Log got) since none of them had anything left
// that justified a separate sidebar destination once the "New Sale" flow
// was dropped and the classic Sales list's own tap-a-sale case moved here.
export const LogFlagLists = dynamic(() => import('../_components/LogFlagLists'), { ssr: false })

export const SalesDaysSection = dynamic(() => import('../_components/SalesDaysSection'), { ssr: false })

export const SalesTab = dynamic(() => import('../_components/SalesTab'), { ssr: false })

export const BillsTab = dynamic(() => import('../_components/BillsTab'), { ssr: false })

export const CountsTab = dynamic(() => import('../_components/CountsTab'), { ssr: false })

export const NewBillForm = dynamic(() => import('../../bills/new/page'), { ssr: false })

// Purchase Orders radio inside Bills swaps to this in place, instead of
// navigating to the separate lossView==='purchaseOrders' destination.
export const POTab = dynamic(() => import('../_components/POTab'), { ssr: false })

export const SalesAnalyticsSection = dynamic(() => import('../_components/SalesAnalyticsSection'), { ssr: false })

export const BillsAnalyticsSection = dynamic(() => import('../_components/BillsAnalyticsSection'), { ssr: false })

// Live/Log share one analytics view (same underlying tap data); Count
// Records (which folded in the old Loss by Date feed) gets its own, backed
// by the same reconciliation computeReconciliation() in lib/lossEvents.ts
// computes for every count.
export const LiveSaleAnalyticsSection = dynamic(() => import('../_components/LiveSaleAnalyticsSection'), { ssr: false })

export const LeastSalesChart = dynamic(() => import('../_components/LeastSalesChart'), { ssr: false })

export const LeastPurchasedChart = dynamic(() => import('../_components/LeastPurchasedChart'), { ssr: false })


// Every real staff member, including Grony -- the third top-level tab shows
// whichever one of these matches the logged-in username, and that person's
// own page is built from this same roster (see StaffClient.tsx's own STAFF/
// ALL_STAFF_NAMES constants, which this must stay in sync with).
export const STAFF_ROSTER = ACTIVE_STAFF_ORDERED.map(staffLabel)
 // the active staff (lib/staffList.ts); Rawlings has left, his records stay in the history views

// 'uk' is Grony's own private top-level tab; 'ch' is Grony/Joe's -- both
// tabs' own components re-check the session themselves too, so this is
// just about not showing the tab button to anyone else, not the only thing
// guarding the page.
export type OuterTab = 'today' | 'loss' | 'uk' | 'ch'


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
export type LossView = 'home' | 'items' | 'sales' | 'pl' | 'cab' | 'vendors' | 'customers' | 'dailySummary'
  | 'purchaseOrders' | 'services'
  // The full Counts page (CountsTab.tsx -- records list with edit/delete,
  // Manual Count, Analytics) -- previously only reachable indirectly as a
  // "fix this violation" deep link (see ViolationFixPanel.tsx), now its own
  // CASH_ITEMS row so it's a real, navigable destination on its own.
  | 'counts' | 'item360' | 'flags'
  // Cust. Receipts and New Customer are gone: receipts are found in each customer's details and the Sales Log,
  // and customers are registered from Live Sale's GM box (see jumpToCustomersTab).
  // Same reasoning as 'newCustomer' used to be above -- Expense Orders was a
  // showOrders toggle living inside ExpensesTab itself, invisible to
  // page.tsx, so the pane button could never actually know whether it was
  // the current view (hardcoded active={false} forever) and its own
  // Notes/Tasks/Laws scope had to be computed conditionally inside
  // ExpensesTab. Its own real LossView instead, rendered as its own
  // content block below.
  | 'expenseOrders'
  // Settings' own non-navigation row (View Portal As) is a real content
  // destination too -- see SettingsPane.tsx, now rendered inline in the
  // main pane rather than a toggled second one.
  | 'viewPortalAs' | 'reorderLists' | 'activityDurations' | 'settings'
  | ManageView | StaffView | CHView

// Alias Wide Table and Service Matches used to be their own lossViews --
// they're now reached from inside Items itself (see ItemsExtraView below),
// so an old '?view=aliasWide'/'serviceMatches' link still needs a home to
// land on instead of a blank pane.
export type ItemsExtraView = 'none' | 'aliasWide' | 'serviceMatches' | 'gmcPacks'

// Doubles as the current itemsExtraView->?view= mapping (see the URL-sync
// effect below) and as backward-compat for old '?view=aliasWide' links.
// Name Conflicts used to live here too -- it's now its own flag pill (see
// ERROR_VIOLATIONS/alias_name_conflicts) instead of a menu item, so an old
// '?view=nameConflicts' link just falls through to the normal Items view.
export const OLD_LOSSVIEW_TO_EXTRA: Partial<Record<string, ItemsExtraView>> = {
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
// same set) would stop recognizing it. Items nested under Grony Checks
// and Advert (arrangement, cleanliness, audio, photoshop, etc.) are also
// excluded from MANAGE_LIST_ITEMS but still routed here since they're
// valid ManageViews reached by clicking items in their respective laws panels.
export const MANAGE_VIEW_KEYS = new Set<LossView>([...MANAGE_LIST_ITEMS.map(i => i.key), ...Array.from(GRONY_CHECKS_KEYS), ...Array.from(ADVERT_KEYS), 'properties'])

export const STAFF_VIEW_KEYS = new Set<LossView>([
  ...STAFF_PERSONAL_ITEMS.map(i => i.key), 'staffProfile', ...STAFF_TEAM_ITEMS.map(i => i.key),
  ...STAFF_ADMIN_TEAM_ITEMS.map(i => i.key), 'users', 'roles',
])

// Check if a view is a staff view, including dynamic staff member pages (staffMember_username)
export const isStaffView = (view: string): boolean =>
  STAFF_VIEW_KEYS.has(view as LossView) || view.startsWith('staffMember_')

// C&H's own rows -- same purpose as the two sets above, but for the
// separate C&H tab's own pane content (see chViewData.ts).
export const CH_VIEW_KEYS = new Set<LossView>(CH_ITEMS.map(i => i.key))


// Old top-level tabs that got folded into Grony Cash submenus -- old
// bookmarks/links using ?tab=pl etc. still land on the right submenu instead
// of silently falling back to Today. ?tab=data (the old standalone
// Analytics/"Data" tab, now redistributed as an Analytics toggle on each of
// Items/Sales/Bills/Expenses/Loss/Counts) lands on Items -- there's no
// single tab left to send it to. ?tab=manage and ?tab=staff (the old
// standalone Grony Manage/Staff top menus) now land here too, on each
// area's own former default view, since both folded into this same tab.
export const OLD_TAB_TO_VIEW: Partial<Record<string, LossView>> = {
  pl: 'pl', cab: 'cab', dailySummary: 'dailySummary', data: 'items',
  manage: 'audio', staff: 'home',
}


// Self-contained submenus -- either their own dashboard, or a standalone
// page with its own internal search/filter/add UI -- so the shared
// groups/search/New controls row doesn't apply to them. Every former
// Manage/Staff view belongs here too -- none of them ever had a Cash-style
// groups/search bar of their own.
export const REPORT_VIEWS = new Set<LossView>([
  'home', 'pl', 'cab', 'vendors', 'customers', 'expenseOrders', 'dailySummary',
  'purchaseOrders', 'viewPortalAs', 'reorderLists', 'activityDurations', 'settings', 'services',
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
// pill row (LossOverviewTab) switching between the three. 'feed' kept its
// key (and the gains violation deep-link that already points at it) but is
// relabeled to "Loss by Date". Loss by Item moved twice more since -- first
// to a flag on Items itself, then folded into Item 360 as its landing
// table, then Item 360 itself was removed once its detail popup
// (ItemDetailModal) was reachable from everywhere that needed it -- Live
// Sale's own "Loss by Item" law view (sorts its grid by loss) covers what
// this row used to. Loss by Target became its own Live Sale tab and stayed
// an unbuilt "Coming soon." placeholder there the whole time, until it was
// removed outright for having never gained any real content.
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
// time. New Customer (nested under Customers) stays its own sub-row, not a
// separate CASH_ITEMS entry -- it's already reachable right under its
// parent row, which is itself inside these same sections. Expenses moved
// off this pane entirely -- it's a liveMode tab now, same as Sales/Bills
// (see the tab switcher and jumpToLiveSaleTab).
// Purchase Orders/Vendors/P&L/CAB/Customers all dropped out of this list --
// each is now its own top-level tab (Customers, P&L, CAB) or a radio sub-
// view of one (Purchase Orders + Vendors inside Bills) instead of its own
// pane row -- see liveBillsShowPurchaseOrders/liveBillsShowVendors/
// pickPL/pickLossView('cab')/pickLossView('customers')), cutting a tap and
// keeping related things together. Items is the only row left here as a
// result.
export const CASH_ITEMS: { key: LossView; label: string; icon: string; group?: string }[] = [
  { key: 'items',    label: 'Live',     icon: '📦' },
  // The full Counts page -- see LossView's own 'counts' comment. Kept as
  // its own row (not folded under Items) since it's a distinct destination
  // now, not just a mode inside the Sale/Log/Sales/Bills switcher.
  { key: 'counts',   label: 'Counts',   icon: '🔢' },
]

// flattenPaneRuns needs a group->label lookup to build each run's header
// text, but a Cash row's group already IS its own label (see CASH_ITEMS'
// own comment above) -- this just hands any group string straight back
// instead of needing a real map kept in sync with every possible section
// name (including ones an owner-level account types fresh in Settings).
export const IDENTITY_GROUP_LABELS: Record<string, string> = new Proxy({}, { get: (_, prop: string) => prop })

// Used to bounce someone off a Cash view the moment their permissions load
// and turn out not to include it (see the canSeeCash effect below). Vendors/
// Customers/Purchase Orders/P&L/CAB dropped out of CASH_ITEMS itself (see
// above) but are still Cash-gated content, still reachable by deep link
// (?view=) and by the "+"/global-search jumps and shortcuts that call
// pickLossView('vendors' | 'customers' | 'purchaseOrders' | 'pl' | 'cab')
// directly -- listed here explicitly so this bounce still catches an
// account without Cash access landing on one of them.
export const CASH_VIEW_KEYS = new Set<LossView>([...CASH_ITEMS.map(v => v.key), 'item360', 'vendors', 'customers', 'purchaseOrders', 'pl', 'cab'])

// Feeds the green bar's search placeholder ("Search Items", "Search
// Sales", ...) so it reads as this page's own filter box, distinct from
// the unrelated global search (magnifying glass icon, bottom of the
// content area) that looks across Biz/UK/C&H by name/number.
export const CASH_LABEL = new Map(CASH_ITEMS.map(v => [v.key, v.label]))


export type Item = {
  id: number
  item_name: string
  cf_group: string | null
  selling_rate: string | null
  purchase_rate: string | null
  units_per_pack: string | null
  unit_name: string | null
  product_type: string
  calculated_soh: number
  count_interval?: string | null
}


export type ErrorCategory = 'loss' | 'sales' | 'bills' | 'cab' | 'team'


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
    description: 'This good has no cost/purchase price set (or it is ₵0), so profit and loss on it cannot be calculated. Open the item and enter what it actually costs to buy or produce. (Services do not require cost prices.)',
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
    key: 'bill_no_expense', label: 'No Expense', category: 'bills',
    description: "No bill_expenses row (bank charges, transport, delivery, etc.) has ever been migrated onto this bill from the Expenses tab. Migrate to Bill from the Expenses side if this bill should share one, or ignore if it genuinely has no extra costs.",
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
// daily/7day/15day (the Counts violations) aren't listed either any more --
// they're handled as an early-return special case in goToViolation instead,
// since they jump into a specific tab of Live Sale (Count 2), not a plain
// lossView + violation pill the way everything below still works.
// 'sales'/'bills'/'count' below aren't real LossViews any more -- each is one
// of Live Sale's own embedded tabs now, so goToViolation special-cases them
// into a jumpToLiveSaleTab() call instead of the generic pickLossView(target)
// fallback every other target here still uses.
export const VIOLATION_HOME: Partial<Record<string, LossView | 'sales' | 'bills' | 'count'>> = {
  neg_soh: 'items', no_sp: 'items', no_cp: 'items', no_group: 'items',
  duplicates: 'items', unlinked_named: 'items', service_violation: 'items',
  alias_prezoho_sales: 'items', alias_prezoho_bills: 'items', alias_prezoho_receipts: 'items', alias_flagged: 'items', alias_ambiguous: 'items',
  alias_name_conflicts: 'items',
  // Gains used to land on the standalone Loss by Date tab ('feed'); that
  // tab folded into Count's own Count Records (see liveCountRecordFilter
  // above), so this now jumps there instead.
  gains: 'count',
  no_cash: 'sales', missing_days: 'sales', dup_receipt: 'sales', no_attachment: 'sales', high_wnw: 'sales',
  no_vendor: 'bills', no_items_bills: 'bills', bill_total_mismatch: 'bills', bill_no_attachment: 'bills', bill_no_expense: 'bills',
  unchecked_cab: 'cab',
}


// Which violation keys belong to each lossView -- scopes the info banner
// and filtered views (ItemsTab/SalesTab/LossFeedTab) reached via a "Fix
// now" deep link (see goFixRecords/goToViolation). Counts' own daily/7day/
// 15day no longer need an entry here -- they route straight into Live
// Sale's Count 2 tab instead of a lossView-level pill.
export const LOSSVIEW_PILL_KEYS: Partial<Record<LossView, string[]>> = {
  items: [
    'neg_soh', 'no_sp', 'no_cp', 'no_group', 'duplicates', 'unlinked_named', 'service_violation',
    'alias_prezoho_sales', 'alias_prezoho_bills', 'alias_prezoho_receipts', 'alias_flagged', 'alias_ambiguous', 'alias_name_conflicts',
  ],
  cab: ['unchecked_cab'],
}


// Sales' 6 flag categories, in the order shown on the green bar -- letter is
// the small identifier drawn beside the flag icon (see the sales button
// block below), label is its tooltip.
export const SALES_FLAG_TYPES: { key: string; letter: string; label: string }[] = [
  { key: 'no_cash', letter: 'C', label: 'No Cash Counted' },
  { key: 'missing_days', letter: 'M', label: 'Missing Receipts' },
  { key: 'dup_receipt', letter: 'D', label: 'Duplicate Receipts' },
  { key: 'no_attachment', letter: 'A', label: 'No Attachment' },
  { key: 'high_wnw', letter: 'H', label: 'WNW Over ₵200' },
  // Moved here from the Sale tab's own violation row -- this is a sale that
  // went out at or under its cost, so the fix (correcting that line's price)
  // happens on this tab, not the live tap-to-sell grid.
  { key: 'sold_below_cost', letter: 'B', label: 'Sold Below Cost' },
]


// Items' 11 flag categories -- same treatment as Sales. `not_in_inventory`
// (a 12th type ItemsFlagsPanel used to show) has no dedicated fix view of
// its own to jump to, so it's left off this bar; it's still assignable via
// Joe/Bino's Role Bar panel like the rest of ASSIGNABLE_VIOLATIONS.
export const ITEMS_FLAG_TYPES: { key: string; letter: string; label: string }[] = [
  { key: 'neg_soh', letter: 'N', label: 'Negative Stock Items' },
  { key: 'no_sp', letter: 'S', label: 'No/Zero Selling Prices' },
  { key: 'no_cp', letter: 'C', label: 'No/Zero Cost Prices (Goods)' },
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
export const BILLS_FLAG_TYPES: { key: string; letter: string; label: string }[] = [
  { key: 'no_vendor', letter: 'V', label: 'No Vendor Recorded' },
  { key: 'no_items_bills', letter: 'I', label: 'No Item List' },
  { key: 'bill_total_mismatch', letter: 'T', label: 'Total Mismatch' },
  { key: 'bill_no_attachment', letter: 'A', label: 'No Attachment' },
  { key: 'bill_no_expense', letter: 'E', label: 'No Expense' },
  // Moved here from the Sale tab's own violation row -- an item's cost
  // jumping 20%+ from its previous bill is a bill-data anomaly, and the fix
  // (correcting that bill line's price) happens on this tab.
  { key: 'vcp_jump', letter: 'J', label: 'VCP Jump' },
]


export const VALID_TABS: OuterTab[] = ['today', 'loss', 'uk', 'ch']

export const VALID_ADD_FORMS = ['item', 'sale', 'live', 'bill', 'expense'] as const


// Biz (Today + Grony Cash), UK, and C&H are three separate areas that should
// never visually blur into each other -- each gets its own deep, near-black
// shade for its button and left pane, matching how dark the existing Biz
// blue already is. Today counts as Biz (there's no fourth color) since it's
// just Biz's own home row, not a separate section.
export const PANE_ACCENT: Record<OuterTab, string> = {
  today: '#00072d', loss: '#00072d', uk: '#450a0a', ch: '#052e16',
}


// ── Live Sale's own module-level types/helpers (folded in from the former
// sales/live/page.tsx) ── `LiveItem` is named distinctly from this file's
// own `Item` type above (different shape -- name/group/soh/selling_price/
// cost_price vs. item_name/cf_group/selling_rate/purchase_rate/
// calculated_soh -- these are two independently-fetched catalogues, not a
// dedupe opportunity for this pass).
export type LiveItem = { id: number; name: string; group: string | null; soh: number; selling_price: string | number; cost_price: string | number; acp_price?: string | number; product_type: string | null; gmc_type?: string | null; count_interval?: string | null; count_cadence_days?: number | null; converts_to_item_id?: number | null; converts_to_name?: string | null; derived_from_item_id?: number | null; units_per_pack?: string | number | null; unit_time_seconds?: string | number | null; needs_review?: boolean }

export type Tap = { id: number; item_id: number; item_name: string; price: number | string; staff_name: string; tapped_at: string; undone: boolean; receipt_id?: number; quantity: number; soh?: number | null; is_gmc?: boolean; customer_id_code?: string | null; customer_name?: string | null; customer_phone?: string | null; buyer_id?: number | null; buyer_name?: string | null; buyer_phone?: string | null; invoice_id?: number | null; invoice_number?: string | null; wa_sent_at?: string | null; receipt_cash_counted?: string | number | null; receipt_total?: string | number | null }

export type ViolationType = { key: string; label: string; description?: string }

// Sale mode's due-count queues -- same shape /api/stock/daily,
// /api/stock/gmc-weekly and /api/stock/overdue already return for CountsTab.
export type DueItem = { item_id: number; item_name: string; cf_group: string | null; calculated_soh: number; last_count_date: string | null; days_overdue: number | null }

// The Log tab's Count view -- same shape /api/stock/counts already returns
// for CountsTab's own history table. expected/loss_qty/loss_amt/kind are the
// same reconciliation Loss by Date used to compute on its own -- folded in
// here (see reconciliationByCount in lib/lossEvents.ts) instead of keeping a
// second tab walking the same stock_counts rows separately.
export type CountRecord = { id: number; item_id: number | null; item_name: string; count_date: string; quantity_counted: string; notes: string | null; counted_by: string | null; counted_at: string | null; source: string | null; cf_group: string | null; expected: number | null; loss_qty: number | null; loss_amt: number | null; kind: 'loss' | 'gain' | null }


export function fmtN(v: number) { return v % 1 === 0 ? String(v) : v.toFixed(2) }


export function formatPrice(num: number | string): string {
  return trimZeros(num) || '0'
}


// The three criteria the Sale-mode grid can prioritize items by (see the
// Arrange Order picker) -- kept in sync by hand with app/api/item-sort-order/
// route.ts's own copy of these same names/order rather than importing from
// it, since that file also imports the DB client and isn't meant to be
// pulled into client bundles.
export type ItemSortKey = 'count_status' | 'violations' | 'badge'

export const DEFAULT_ITEM_SORT_ORDER: ItemSortKey[] = ['count_status', 'violations', 'badge']

export const ITEM_SORT_LABELS: Record<ItemSortKey, string> = {
  count_status: 'Count Status (due / overdue)',
  violations: 'Violations (attention flags)',
  badge: "Today's Sales (badge count)",
}


// Squeezes lib/countRules.ts's formatCountInterval() strings ("Every 7d",
// "Dormant", ...) down for the grid card's tight CP/SP/SOH line -- the
// underlying item.count_interval value itself is left alone (it's also used
// as a filter-match key elsewhere), this only shortens what's displayed.
export function shortCountInterval(label: string | null | undefined): string {
  if (!label) return ''
  if (label === 'Daily') return 'DL'
  if (label === 'Dormant') return 'DM'
  if (label === 'Not counted') return 'NC'
  const m = label.match(/^Every (\d+)d$/)
  return m ? `${m[1]}D` : label
}


// "12 Aug '24" -- compact enough for the grid card's own sale-history line
// (first/last sale date, days since) alongside CP/SP/SOH.
export function fmtShortSaleDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  if (isNaN(d.getTime())) return dateStr
  const day = d.getUTCDate()
  const month = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
  const year = String(d.getUTCFullYear()).slice(-2)
  return `${day} ${month} '${year}`
}


export function daysSince(dateStr: string): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(dateStr + 'T00:00:00Z')) / 86400000))
}


// The sales log's Staff column shows initials to save width -- first letter
// of the first two words for a multi-word name ("James Mensah" -> "JM"),
// or just the first two letters of a single-word name ("James" -> "JA"),
// always exactly 2 letters either way. Full name still shows on hover via
// the cell's own title attribute.
export function staffInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return (parts[0] ?? '').slice(0, 2).toUpperCase()
}


// lgAmt is the NET loss/gain in cedis (positive = net loss, negative = net
// gain -- same sign convention Item 360's own loss table uses); lossCount/
// gainCount are how many separate days came up short/over, each
// independent of the other and of lgAmt's net sign (a item can have both
// loss days and gain days that partly offset into one net figure).
// Gain count is deliberately NOT shown here anymore -- it has its own
// "STOCK GAIN" attention banner (see itemAttentionFlags) with its own count,
// so repeating it in this loss line was the same number shown twice.
export function formatLoss(l: { lossCount: number; lgAmt: number; gainCount?: number } | undefined): { text: string; cls: string } {
  const count = l?.lossCount ?? 0
  const amt = l?.lgAmt ?? 0
  const gainCount = l?.gainCount ?? 0
  const fmtAmt = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2))
  if (count === 0 && amt === 0 && gainCount === 0) return { text: 'No loss', cls: 'text-gray-400' }
  if (amt > 0) return { text: `Loss ${count} · -₵${fmtAmt(amt)}`, cls: 'text-red-500 font-semibold' }
  if (amt < 0) return { text: `Loss ${count} · +₵${fmtAmt(Math.abs(amt))}`, cls: 'text-green-600 font-semibold' }
  return { text: `Loss ${count}`, cls: 'text-gray-400' }
}


// Compact filter-bar <select> styling, shared by the type/group/flags
// dropdowns in the green header bars. `appearance-none` matters here more
// than it looks -- iOS Safari ignores an author font-size/padding on a
// closed <select> and substitutes its own oversized system chrome unless
// the native appearance is turned off, which is why those bars render far
// bigger on a phone than the (already small) Tailwind classes suggest. The
// custom chevron below replaces the native arrow that appearance-none also
// removes.
export const COMPACT_SELECT_CLS = 'appearance-none truncate text-[8px] leading-tight px-1 py-1.5 pr-3 border rounded bg-no-repeat focus:outline-none focus:ring-1 focus:ring-blue-400'

export const COMPACT_SELECT_STYLE: CSSProperties = {
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%234b5563'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z' clip-rule='evenodd'/%3E%3C/svg%3E\")",
  backgroundPosition: 'right 2px center',
  backgroundSize: '6px 6px',
}


// Same list ExpensesTab.tsx's own edit form uses for its property_type
// select -- duplicated here (not exported/shared) since it's a small fixed
// list, just for the Expenses toolbar's Type filter.
export const EXPENSES_PROPERTY_TYPES = ['Printer', 'Computer', 'Banners', 'Seating', 'Tables', 'Lamination']


// Bold attention banner for an item's own data-integrity problems -- same
// idea as the COUNT NOW banner (see countStatus/pinnedDueItems below), for
// every check item/page.tsx's own itemsWithViolations tracks. The first four
// (negative stock/missing SP/missing CP/missing group) are computed straight
// off the item's own fields already on LiveItem, since they only ever need
// this one item's own data; the last three (duplicate/unlinked sale/service
// violation) need cross-item data this needs id sets built from the
// itemsWithViolations-derived data below (see liveDuplicateItemIds/
// liveUnlinkedNamedIds/liveServiceViolationIdSet).
//
// Returns every applicable issue, worst first -- callers stack one banner
// per flag (not just the worst one collapsed behind a "+N more"), so a
// genuinely broken item visibly shows everything wrong with it at a glance.
export function itemAttentionFlags(
  item: LiveItem,
  duplicateItemIds: Set<number>,
  unlinkedNamedIds: Set<number>,
  serviceViolationIds: Set<number>,
  netGainByItemId: Map<number, { qty: number; amt: number }>,
  emptyRowCountByItemId: Map<number, number>,
  soldBelowCostDatesByItemId: Map<number, string[]>,
  vcpJumpDatesByItemId: Map<number, string[]>,
  gmcTargetStockByItemId: Map<number, number>,
  gmcOpenOverageByItemId: Map<number, GmcOpenOverage>,
  lowConfidenceAliasIds: Set<number>,
  prezohoNotesIds: Set<number>
): { label: string; bg: string }[] {
  const soh = Number(item.soh)
  const sp = parseFloat(String(item.selling_price)) || 0
  // ACP (falling back to VCP if the item has no synced ACP yet) -- this is
  // the "true" current cost everything except Purchase Orders should read,
  // per the two-tier VCP/ACP model (see lib/vcpSync.ts).
  const cp = parseFloat(String(item.acp_price ?? item.cost_price)) || 0
  const flags: { label: string; bg: string }[] = []
  if (item.product_type !== 'service' && soh < 0) flags.push({ label: '⚠ NEGATIVE STOCK', bg: 'bg-red-600' })
  // Net Gain replaces the old "STOCK GAIN" flag (any single gain count
  // event, regardless of the item's overall position) -- this only fires
  // once the item's TOTAL counted gains actually outweigh its total
  // losses (see liveNetGainByItemId, sourced from /api/losses/summary's
  // signed lgAmt), which should never happen under normal operation: it
  // always means a bill/GMC take was never entered or a count was wrong.
  // An item with some gains that still nets an overall loss is not
  // flagged here at all -- that's just the plain "Net Loss" view instead,
  // not a violation.
  const netGain = netGainByItemId.get(item.id)
  if (netGain) flags.push({ label: `🔺 NET GAIN: ${fmtN(netGain.qty)} · ₵${fmtN(netGain.amt)}`, bg: 'bg-red-600' })
  if (duplicateItemIds.has(item.id)) flags.push({ label: '⚠ DUPLICATE ITEM', bg: 'bg-red-600' })
  if (serviceViolationIds.has(item.id)) flags.push({ label: '⚠ SERVICE VIOLATION', bg: 'bg-rose-600' })
  if (unlinkedNamedIds.has(item.id)) flags.push({ label: '⚠ UNLINKED SALE', bg: 'bg-orange-600' })
  // Both prices are actually set (missing-price is its own separate flag
  // below) but selling at or below ACP -- every sale of this good either
  // breaks even or loses money, which is worse than a missing price, not
  // an alternative to it.
  if (item.product_type !== 'service' && sp > 0 && cp > 0 && cp >= sp) flags.push({ label: '⚠ ACP > SP', bg: 'bg-red-600' })
  // Distinct from the current-pricing check above -- this fires off actual
  // past sale lines (/api/flags' costGteSell) rather than the item's catalog
  // fields, so it still shows even after today's prices were fixed and the
  // item no longer trips the check above. Compares each sale's own price
  // against ACP as of THAT sale's date (see lib/itemDayRows.ts), not today's
  // value, so "history" here means "actually happened on that day," not
  // "would happen if sold today." The affected dates ride along on the
  // label itself, same as the STOCK GAIN count above, so the banner says
  // exactly which day(s) to go check in Item 360.
  const belowCostDates = soldBelowCostDatesByItemId.get(item.id) ?? []
  if (belowCostDates.length > 0) {
    const shown = belowCostDates.slice(0, 3).map(fmtShortSaleDate).join(', ')
    const more = belowCostDates.length > 3 ? ` +${belowCostDates.length - 3} more` : ''
    flags.push({ label: `⚠ SOLD BELOW COST (history): ${shown}${more}`, bg: 'bg-red-700' })
  }
  // A bill where this item's VCP jumped 20%+ from its own previous bill --
  // same threshold as Item 360's own per-item VCP jump badge (see
  // LossTab.tsx's computeVcpJumps), same "affected dates on the label"
  // convention as SOLD BELOW COST above. Corrected by editing that bill's
  // line to the right price (see BillsTab.tsx), which resyncs VCP/ACP and
  // clears this the next time /api/flags is fetched.
  const vcpJumpDates = vcpJumpDatesByItemId.get(item.id) ?? []
  if (vcpJumpDates.length > 0) {
    const shown = vcpJumpDates.slice(0, 3).map(fmtShortSaleDate).join(', ')
    const more = vcpJumpDates.length > 3 ? ` +${vcpJumpDates.length - 3} more` : ''
    flags.push({ label: `⚠ VCP JUMP (history): ${shown}${more}`, bg: 'bg-amber-700' })
  }
  if (sp <= 0) flags.push({ label: '⚠ MISSING SELLING PRICE', bg: 'bg-orange-600' })
  if (item.product_type !== 'service' && cp <= 0) flags.push({ label: '⚠ MISSING COST PRICE', bg: 'bg-orange-500' })
  if (!item.group) flags.push({ label: '⚠ MISSING GROUP', bg: 'bg-amber-500' })
  // needs_review is a plain boolean, independent of cf_group -- a stub gets
  // a real category up front, so it can trip MISSING GROUP too if that's
  // genuinely missing, instead of that being masked until review resolves.
  if (item.needs_review) flags.push({ label: '🔍 NEEDS REVIEW', bg: 'bg-fuchsia-700' })
  if (lowConfidenceAliasIds.has(item.id)) flags.push({ label: '📋 ALIAS NEEDS CHECK', bg: 'bg-indigo-700' })
  if (prezohoNotesIds.has(item.id)) flags.push({ label: '📝 LEDGER NOTES', bg: 'bg-teal-700' })
  // A day row that made it into the item's own history but ended up with
  // every field blank/zero -- a phantom date with no real activity behind
  // it (e.g. a zero-quantity bill line). Doesn't affect stock math, but is
  // dead weight in the item's own record that's worth cleaning up.
  const emptyRowCount = emptyRowCountByItemId.get(item.id) ?? 0
  if (emptyRowCount > 0) flags.push({ label: `⚠ EMPTY DATA: ${emptyRowCount}`, bg: 'bg-gray-500' })
  // Warns on BOTH sides of a GMC pack/service pair: a pack_to_gmc item (buy
  // a new one) and a service_using_gmc item (about to run out mid-service)
  // both carry converts_to_item_id pointing at the same target, so this one
  // check covers both with no type-specific branching. Same thresholds
  // recordTap's own post-tap toast already uses (~3699) -- kept in sync so
  // "low"/"depleted" mean the same thing whether you just tapped it or are
  // only browsing. See /api/sales/live-tap's pack-reset block for what
  // makes this number trustworthy, and /api/items/gmc-target-stock for
  // where it's fetched from.
  if (item.converts_to_item_id) {
    const targetStock = gmcTargetStockByItemId.get(item.converts_to_item_id)
    if (targetStock != null) {
      if (Math.abs(targetStock) < 0.001) flags.push({ label: `🪫 GMC STOCK DEPLETED (${item.converts_to_name ?? 'target'}) -- restock now`, bg: 'bg-red-700' })
      else if (targetStock < 5) flags.push({ label: `🪫 GMC STOCK LOW (${item.converts_to_name ?? 'target'}): ${fmtN(targetStock)} left`, bg: 'bg-amber-600' })
    }
    // The target's current pack (no new one tapped in yet) has already
    // used more than it gave -- either a pack really is short/missing, or
    // one was already physically opened at the shop but never actually
    // tapped in GMC. Either way it needs a physical count of the packs to
    // find out which, so this keeps showing every time the item is seen
    // until a new pack is tapped (clearing it) or the count explains it.
    const overage = gmcOpenOverageByItemId.get(item.converts_to_item_id)
    if (overage) {
      flags.push({
        label: `📦 USAGE EXCEEDS PACK (${item.converts_to_name ?? 'target'}): ${fmtN(overage.used)} used vs ${fmtN(overage.given)} given -- count the packs to check for a shortage, or a pack taken but not yet recorded`,
        bg: 'bg-amber-700',
      })
    }
  }
  return flags
}

  // Whichever inline sub-panel is showing below the Items law panel -- just
  // a service group's item table for now. Selecting a different group
  // replaces it instead of stacking, same as every other flag click on
  // this page.
  export type ItemsInlineExtra = { kind: 'serviceGroup'; group: string }

  // The Shop page: Waiting for team, Done, Laws, Times and (owner and manager) Penalty Points, Manage and more, as tabs.
  export type ShopTab = 'todo' | 'laws' | 'home' | 'manage' | 'times' | 'penalties' | 'tasks' | 'guide'

  // Everything Sales Rec / Summary held, merged into the Sales Log: the day receipts (cash counted, photos, who
  // entered them) and the receipt lines no tap stands behind (history imported back to 2023, lines typed in by
  // hand), loaded per period from /api/sales/log-records; plus Summary's filters (Period, W / G, Bars only, Flags).
  export type LogRec = { id: number; receipt_number: string; day: string; customer_name: string | null; is_gmc: boolean | null; total: string; cash_counted: string | null; attachments: Attachment[] | null }

  export type LogRecLine = { id: number; receipt_id: number; day: string; is_gmc: boolean | null; item_id: number | null; item_name: string; quantity: string | null; item_price: string | null; item_total: string | null; source: string | null }
