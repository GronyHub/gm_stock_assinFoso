'use client'
import { useState, useEffect, useRef, useMemo, Component, Suspense, Fragment, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { hasFeature, DEFAULT_ON_FEATURES, type FeatureKey, type RolePermissionsMap } from '@/lib/permissionsShared'
import { usePresenceReporter } from '@/lib/usePresenceReporter'
import { isOwnerLevel } from '@/lib/roles'
import { fmtTime } from '@/lib/fmtDate'
import PageLawsList, { type LawFormKind } from './_components/PageLawsList'
import ItemDetailModal from './_components/ItemDetailModal'
import { LossDialog, PairingDialog, type LossExtra, type LossPrompt, type PairingPrompt } from './_components/CountDialogs'
import { ItemEditForm, EMPTY_ITEM_EDIT_FORM } from './_components/ItemEditForm'
import HistoryPanel from './_components/HistoryPanel'
import { TrainingGuideModal } from './_components/TrainingGuideModal'
import ItemDetailPanel from './_components/ItemDetailPanel'
import { AliasPicker, MatchPicker, MergeItemPicker, type AliasRecord, type MatchRecord, type CandidateItem } from './_components/LossTab'

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
import { useLawsPanel, useLawFilterState } from './_components/useLawsPanel'
import { COLUMNS, type ColKey } from './_components/lossTabColumns'
import { useColumnPrefs, ColumnsPickerButton } from './_components/columnPrefs'
import { MANAGE_LIST_ITEMS, MANAGE_GROUP_LABELS, MANAGE_GROUP_ICONS, GRONY_CHECKS_ITEMS, GRONY_CHECKS_KEYS, ADVERT_ITEMS, ADVERT_KEYS, useFixedCategoryIds, type ManageView } from './_components/manageViewData'
import { STAFF_PERSONAL_ITEMS, STAFF_TEAM_ITEMS, STAFF_ADMIN_TEAM_ITEMS, type StaffView } from './_components/staffViewData'
import { CH_ITEMS, CH_CHILD_PERSON, CH_PERSON_VIEW, type CHView } from './_components/chViewData'
import { useUKData, UK_PEOPLE } from './_components/ukViewData'
import { SidePaneContainer, SidePaneToggle, SidePaneButton, useSidePaneDisplayMode } from './_components/SidePane'
import SettingsPane from './_components/SettingsPane'
import UKSettingsPanel from './_components/UKSettingsPanel'
import { applyPaneOrder, buildPaneRuns, flattenPaneRuns, type PaneOrderMap } from './_components/paneOrder'
import ServicesGroupTable from './_components/ServicesGroupTable'
import ExpenseOrdersPanel from './_components/ExpenseOrdersPanel'
import dynamic from 'next/dynamic'
const loading = (h: string) => <div className={`py-10 text-center text-gray-400 text-sm`}>{h}</div>
const ItemsTab       = dynamic(() => import('./_components/ItemsTab'),        { ssr: false, loading: () => loading('Loading…') })
const ExpensesTab    = dynamic(() => import('./_components/ExpensesTab'),     { ssr: false, loading: () => loading('Loading…') })
const CABTab         = dynamic(() => import('./_components/CABTab'),          { ssr: false, loading: () => loading('Loading…') })
const TodayContent   = dynamic(() => import('./_components/TodayContent'),    { ssr: false, loading: () => loading('Loading…') })
const NewExpenseForm = dynamic(() => import('../expenses/new/page'),          { ssr: false, loading: () => loading('Loading…') })
const NewItemForm    = dynamic(() => import('./_components/NewItemForm'),     { ssr: false, loading: () => loading('Loading…') })
const ItemsAnalyticsSection      = dynamic(() => import('./_components/ItemsAnalyticsSection'),      { ssr: false, loading: () => loading('Loading analytics…') })
const ViolationsAnalyticsSection = dynamic(() => import('./_components/ViolationsAnalyticsSection'), { ssr: false, loading: () => loading('Loading analytics…') })
const ExpensesAnalyticsSection   = dynamic(() => import('./_components/ExpensesAnalyticsSection'),   { ssr: false, loading: () => loading('Loading analytics…') })
const LossTab        = dynamic(() => import('./_components/LossTab'),         { ssr: false, loading: () => loading('Loading…') })
const ProfitLossTab  = dynamic(() => import('./_components/ProfitLossTab'),   { ssr: false, loading: () => loading('Loading…') })
const DailySummaryTab = dynamic(() => import('./_components/DailySummaryTab'), { ssr: false, loading: () => loading('Loading…') })
const GronyManageContent = dynamic(() => import('./_components/GronyManageTab'), { ssr: false, loading: () => loading('Loading…') })
const VendorsPage    = dynamic(() => import('../vendors/page'),               { ssr: false, loading: () => loading('Loading…') })
const CustomersPage  = dynamic(() => import('../customers/page'),             { ssr: false, loading: () => loading('Loading…') })
const PurchaseOrdersPage  = dynamic(() => import('../purchase-orders/page'),        { ssr: false, loading: () => loading('Loading…') })
const AliasWidePage       = dynamic(() => import('../aliases/wide/page'),           { ssr: false, loading: () => loading('Loading…') })
const ServiceMatchesPage  = dynamic(() => import('../matches/wide/page'),           { ssr: false, loading: () => loading('Loading…') })
const PacksPage           = dynamic(() => import('../inventory/packs/page'),           { ssr: false, loading: () => loading('Loading…') })
const ViewPortalAsButton  = dynamic(() => import('@/components/ViewPortalAsButton'), { ssr: false })
const StaffContent = dynamic(() => import('./_components/StaffPersonTab'),    { ssr: false, loading: () => loading('Loading…') })
const StaffMemberPersonalTab = dynamic(() => import('./_components/StaffMemberPersonalTab'), { ssr: false, loading: () => loading('Loading…') })
const UKTab = dynamic(() => import('./_components/UKTab'), { ssr: false, loading: () => loading('Loading…') })
const CHTab = dynamic(() => import('./_components/CHTab'), { ssr: false, loading: () => loading('Loading…') })
const ReorderListsPanel = dynamic(() => import('./_components/ReorderListsPanel'), { ssr: false, loading: () => loading('Loading…') })
// Sales/Bills/Loss by Date -- folded into Live Sale's own switcher (same
// treatment Count 2 and Log got) since none of them had anything left
// that justified a separate sidebar destination once the "New Sale" flow
// was dropped and the classic Sales list's own tap-a-sale case moved here.
const SalesTab = dynamic(() => import('./_components/SalesTab'), { ssr: false })
const BillsTab = dynamic(() => import('./_components/BillsTab'), { ssr: false })
const NewBillForm = dynamic(() => import('../bills/new/page'), { ssr: false })
const SalesAnalyticsSection = dynamic(() => import('./_components/SalesAnalyticsSection'), { ssr: false })
const BillsAnalyticsSection = dynamic(() => import('./_components/BillsAnalyticsSection'), { ssr: false })
// Live/Log share one analytics view (same underlying tap data); Count
// Records (which folded in the old Loss by Date feed) gets its own, backed
// by the same reconciliation computeReconciliation() in lib/lossEvents.ts
// computes for every count.
const LiveSaleAnalyticsSection = dynamic(() => import('./_components/LiveSaleAnalyticsSection'), { ssr: false })
const LossFeedAnalyticsSection = dynamic(() => import('./_components/LossFeedAnalyticsSection'), { ssr: false })

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
type LossView = 'home' | 'items' | 'sales' | 'expenses' | 'pl' | 'cab' | 'vendors' | 'customers' | 'dailySummary'
  | 'purchaseOrders' | 'services'
  // Cust. Receipts and New Customer folded into Customers' own tabs (same
  // treatment Sales/Bills/Loss by Date/Loss by Target got inside Live
  // Sale) -- see jumpToCustomersTab, since neither is a real LossView any
  // more.
  // Same reasoning as 'newCustomer' used to be above -- Expense Orders was a
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
type ItemsExtraView = 'none' | 'aliasWide' | 'serviceMatches' | 'gmcPacks'
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
// same set) would stop recognizing it. Items nested under Grony Checks
// and Advert (arrangement, cleanliness, audio, photoshop, etc.) are also
// excluded from MANAGE_LIST_ITEMS but still routed here since they're
// valid ManageViews reached by clicking items in their respective laws panels.
const MANAGE_VIEW_KEYS = new Set<LossView>([...MANAGE_LIST_ITEMS.map(i => i.key), ...Array.from(GRONY_CHECKS_KEYS), ...Array.from(ADVERT_KEYS), 'properties'])
const STAFF_VIEW_KEYS = new Set<LossView>([
  ...STAFF_PERSONAL_ITEMS.map(i => i.key), 'staffProfile', ...STAFF_TEAM_ITEMS.map(i => i.key),
  ...STAFF_ADMIN_TEAM_ITEMS.map(i => i.key), 'users', 'roles',
])
// Check if a view is a staff view, including dynamic staff member pages (staffMember_username)
const isStaffView = (view: string): boolean =>
  STAFF_VIEW_KEYS.has(view as LossView) || view.startsWith('staffMember_')
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
  'home', 'pl', 'cab', 'vendors', 'customers', 'expenseOrders', 'dailySummary',
  'purchaseOrders', 'viewPortalAs', 'reorderLists', 'services',
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
// relabeled to "Loss by Date", with Loss by Target following right after as
// its own lossView. Loss by Item moved twice more since -- first to a flag
// on Items itself, then folded into Item 360 as its landing table, then Item
// 360 itself was removed once its detail popup (ItemDetailModal) was
// reachable from everywhere that needed it -- Live Sale's own "Loss by
// Item" law view (sorts its grid by loss) covers what this row used to.
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
  { key: 'items',    label: 'Items',    icon: '📦' },
  { key: 'purchaseOrders',   label: 'Purchase Ord',   icon: '🛒' },
  { key: 'expenses', label: 'Expenses', icon: '💳' },
  { key: 'vendors',   label: 'Vendors',   icon: '🏭' },
  { key: 'pl',       label: 'P&L',      icon: '📈' },
  { key: 'cab',      label: 'CAB',      icon: '🗂️' },
  { key: 'customers', label: 'Customers', icon: '👥' },
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
// daily/7day/15day (the Counts violations) aren't listed either any more --
// they're handled as an early-return special case in goToViolation instead,
// since they jump into a specific tab of Live Sale (Count 2), not a plain
// lossView + violation pill the way everything below still works.
// 'sales'/'bills'/'count' below aren't real LossViews any more -- each is one
// of Live Sale's own embedded tabs now, so goToViolation special-cases them
// into a jumpToLiveSaleTab() call instead of the generic pickLossView(target)
// fallback every other target here still uses.
const VIOLATION_HOME: Partial<Record<string, LossView | 'sales' | 'bills' | 'count'>> = {
  neg_soh: 'items', no_sp: 'items', no_cp: 'items', no_group: 'items',
  duplicates: 'items', unlinked_named: 'items', service_violation: 'items',
  alias_prezoho_sales: 'items', alias_prezoho_bills: 'items', alias_prezoho_receipts: 'items', alias_flagged: 'items', alias_ambiguous: 'items',
  alias_name_conflicts: 'items',
  // Gains used to land on the standalone Loss by Date tab ('feed'); that
  // tab folded into Count's own Count Records (see liveCountRecordFilter
  // above), so this now jumps there instead.
  gains: 'count',
  no_cash: 'sales', missing_days: 'sales', cost_price: 'sales', dup_receipt: 'sales', no_attachment: 'sales', high_wnw: 'sales',
  no_vendor: 'bills', no_items_bills: 'bills', bill_total_mismatch: 'bills', bill_no_attachment: 'bills',
  unchecked_cab: 'cab',
}

// Which violation keys belong to each lossView -- scopes the info banner
// and filtered views (ItemsTab/SalesTab/LossFeedTab) reached via a "Fix
// now" deep link (see goFixRecords/goToViolation). Counts' own daily/7day/
// 15day no longer need an entry here -- they route straight into Live
// Sale's Count 2 tab instead of a lossView-level pill.
const LOSSVIEW_PILL_KEYS: Partial<Record<LossView, string[]>> = {
  items: [
    'neg_soh', 'no_sp', 'no_cp', 'no_group', 'duplicates', 'unlinked_named', 'service_violation',
    'alias_prezoho_sales', 'alias_prezoho_bills', 'alias_prezoho_receipts', 'alias_flagged', 'alias_ambiguous', 'alias_name_conflicts',
  ],
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
const VALID_ADD_FORMS = ['item', 'sale', 'live', 'bill', 'expense'] as const

// Biz (Today + Grony Cash), UK, and C&H are three separate areas that should
// never visually blur into each other -- each gets its own deep, near-black
// shade for its button and left pane, matching how dark the existing Biz
// blue already is. Today counts as Biz (there's no fourth color) since it's
// just Biz's own home row, not a separate section.
const PANE_ACCENT: Record<OuterTab, string> = {
  today: '#00072d', loss: '#00072d', uk: '#450a0a', ch: '#052e16',
}

// ── Live Sale's own module-level types/helpers (folded in from the former
// sales/live/page.tsx) ── `LiveItem` is named distinctly from this file's
// own `Item` type above (different shape -- name/group/soh/selling_price/
// cost_price vs. item_name/cf_group/selling_rate/purchase_rate/
// calculated_soh -- these are two independently-fetched catalogues, not a
// dedupe opportunity for this pass).
type LiveItem = { id: number; name: string; group: string | null; soh: number; selling_price: string | number; cost_price: string | number; product_type: string | null; count_interval?: string | null }
type Tap = { id: number; item_id: number; item_name: string; price: number | string; staff_name: string; tapped_at: string; undone: boolean; receipt_id?: number; quantity: number; soh?: number | null }
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
// Returns every applicable issue, worst first -- callers show just the
// first as the actual banner (still one banner per card, not a stack) and
// use the rest to render a "+N more" alongside it, so a genuinely broken
// item doesn't read as having only one problem.
function itemAttentionFlags(
  item: LiveItem,
  duplicateItemIds: Set<number>,
  unlinkedNamedIds: Set<number>,
  serviceViolationIds: Set<number>
): { label: string; bg: string }[] {
  const soh = Number(item.soh)
  const sp = parseFloat(String(item.selling_price)) || 0
  const cp = parseFloat(String(item.cost_price)) || 0
  const flags: { label: string; bg: string }[] = []
  if (item.product_type !== 'service' && soh < 0) flags.push({ label: '⚠ NEGATIVE STOCK', bg: 'bg-red-600' })
  if (duplicateItemIds.has(item.id)) flags.push({ label: '⚠ DUPLICATE ITEM', bg: 'bg-red-600' })
  if (serviceViolationIds.has(item.id)) flags.push({ label: '⚠ SERVICE VIOLATION', bg: 'bg-rose-600' })
  if (unlinkedNamedIds.has(item.id)) flags.push({ label: '⚠ UNLINKED SALE', bg: 'bg-orange-600' })
  if (sp <= 0) flags.push({ label: '⚠ MISSING SELLING PRICE', bg: 'bg-orange-600' })
  if (cp <= 0) flags.push({ label: '⚠ MISSING COST PRICE', bg: 'bg-orange-500' })
  if (!item.group) flags.push({ label: '⚠ MISSING GROUP', bg: 'bg-amber-500' })
  return flags
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
  // 'losses' (the old standalone Loss Feed tab) lands on Live Sale now --
  // Loss by Date is one of its embedded tabs, jumped to via the mount
  // effect below (jumpToLiveSaleTab isn't defined yet this early in the
  // component, so it can't be called directly from this initializer).
  // A bare /item with no ?view= at all used to default to the Items pane;
  // Live Sale's own Live/Log/Sales/Bills/Loss switcher now covers what that
  // pane was for day to day, so this lands there instead. Items is still one
  // sidebar tap away. Kept in sync with the identical fallback in the
  // searchParams effect below -- that one re-runs right after mount and
  // would otherwise snap this straight back to 'items'.
  const [lossView, setLossView]         = useState<LossView>(
    rawInitialTab === 'losses' ? 'sales'
      : oldTabView ?? initialView ?? (outerTab === 'ch' ? CH_ITEMS[0].key : 'sales')
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
  const [addForm, setAddForm]             = useState<'item' | 'sale' | 'live' | 'bill' | 'expense' | null>(
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
  // Global search's own "Items" result -- opens the item detail popup
  // directly instead of navigating to the Loss by Item page.
  const [globalSearchViewingItemId, setGlobalSearchViewingItemId] = useState<number | null>(null)
  // Seeded from ?jumpDate=/?jumpItem= -- an item's detail popup (see
  // ItemDetailPanel's onDateClick) opens this in a new tab via
  // /item?tab=loss&view=sales&jumpDate=...&jumpItem=..., which the
  // URL-sync effect below strips off again on its first run since only
  // tab/view/q are ever written back to the URL.
  // Read directly by the inlined Live Sale Sales tab below (jumpToDate/
  // jumpToItemName props on <SalesTab>) now that Sales lives inside Live
  // Sale's own Sales tab.
  const [jumpToReceiptDate, setJumpToReceiptDate] = useState<string | null>(searchParams.get('jumpDate'))
  const [jumpToReceiptItemName, setJumpToReceiptItemName] = useState<string | null>(searchParams.get('jumpItem'))
  const [showItemsLaws, setShowItemsLaws] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('showItemsLaws') === 'true'
  })
  const [itemsLawsRefresh, setItemsLawsRefresh] = useState(0)
  const [itemsLawsOpenForm, setItemsLawsOpenForm] = useState<LawFormKind>(null)
  const [hideZeroFlags, setHideZeroFlags] = useState(false)
  const itemsFilters = useLawFilterState()
  // The rest of this page's many smaller panes (P&L, Receipts, Purchase
  // Orders, ...) each get their own inline law panel too, same as Items
  // above -- one useLawsPanel() per scope, rendered through the
  // inlineLaws() helper below instead of hand-rolling the toggle+panel
  // JSX repeatedly. Sales/Bills/Loss by Date/Loss by Target no longer need
  // one of their own -- all four live inside Live Sale's own laws panel now.
  const plLaws = useLawsPanel('showPLLaws')
  const homeLaws = useLawsPanel('showHomeLaws')
  const dailyLaws = useLawsPanel('showDailyLaws')
  const purchaseOrdersLaws = useLawsPanel('showPurchaseOrdersLaws')
  const servicesLaws = useLawsPanel('showServicesLaws')
  const viewPortalAsLaws = useLawsPanel('showViewPortalAsLaws')
  const reorderListsLaws = useLawsPanel('showReorderListsLaws')
  const expenseOrdersLaws = useLawsPanel('showExpenseOrdersLaws')
  const aliasWideTableLaws = useLawsPanel('showAliasWideTableLaws')
  const serviceMatchesLaws = useLawsPanel('showServiceMatchesLaws')
  const liveSaleLaws = useLawsPanel('showLiveSaleLaws')
  const [liveExpanded, setLiveExpanded] = useState(false)
  const rawLiveProductType = searchParams.get('liveType')
  const initialLiveProductType = (rawLiveProductType === 'goods' || rawLiveProductType === 'services') ? rawLiveProductType : 'all'
  const [liveProductTypeFilter, setLiveProductTypeFilter] = useState<'all' | 'goods' | 'services'>(initialLiveProductType)
  const rawLiveGroup = searchParams.get('liveGroup')
  const [liveGroupFilter, setLiveGroupFilter] = useState<string | null>(rawLiveGroup ?? null)
  const [liveHelpModalOpen, setLiveHelpModalOpen] = useState(false)
  const rawLiveMode = searchParams.get('mode')
  const initialLiveMode = (rawLiveMode as 'sale' | 'sales' | 'bills' | 'lossByTarget' | 'log' | 'count' | null) ?? 'sale'
  const [liveMode, setLiveMode] = useState<'sale' | 'sales' | 'bills' | 'lossByTarget' | 'log' | 'count'>(initialLiveMode)
  const [itemsPageMode, setItemsPageMode] = useState<'sale' | 'sales' | 'bills' | 'lossByTarget' | 'log' | 'count'>(initialLiveMode)
  const rawLiveSalesViolation = searchParams.get('liveSalesViolation')
  const rawLiveBillsViolation = searchParams.get('liveBillsViolation')
  const [liveSalesViolationFilter, setLiveSalesViolationFilter] = useState<string | null>(rawLiveSalesViolation ?? null)
  const [liveBillsViolationFilter, setLiveBillsViolationFilter] = useState<string | null>(rawLiveBillsViolation ?? null)
  const rawLiveSaleFilter = searchParams.get('liveSaleFilter')
  const initialLiveSaleFilter: { kind: 'loss' } | { kind: 'gain' } | { kind: 'soh' } | { kind: 'interval'; label: string } | { kind: 'flag'; key: string } | null =
    rawLiveSaleFilter === 'loss' ? { kind: 'loss' } :
    rawLiveSaleFilter === 'gain' ? { kind: 'gain' } :
    rawLiveSaleFilter === 'soh' ? { kind: 'soh' } :
    rawLiveSaleFilter?.startsWith('interval:') ? { kind: 'interval', label: rawLiveSaleFilter.slice(9) } :
    rawLiveSaleFilter?.startsWith('flag:') ? { kind: 'flag', key: rawLiveSaleFilter.slice(5) } :
    null
  const [liveSaleFilter, setLiveSaleFilter] = useState<{ kind: 'loss' } | { kind: 'gain' } | { kind: 'soh' } | { kind: 'interval'; label: string } | { kind: 'flag'; key: string } | null>(initialLiveSaleFilter)
  const rawLiveCountView = searchParams.get('liveCountView')
  const initialLiveCountView: { kind: 'interval'; label: string } | { kind: 'records' } | { kind: 'history' } | null =
    rawLiveCountView === 'records' ? { kind: 'records' } :
    rawLiveCountView === 'history' ? { kind: 'history' } :
    rawLiveCountView?.startsWith('interval:') ? { kind: 'interval', label: rawLiveCountView.slice(9) } :
    { kind: 'records' }
  const [liveCountView, setLiveCountView] = useState<{ kind: 'interval'; label: string } | { kind: 'records' } | { kind: 'history' } | null>(initialLiveCountView)
  const rawLiveEmbeddedSearch = searchParams.get('liveSearch')
  const [liveEmbeddedSearch, setLiveEmbeddedSearch] = useState(rawLiveEmbeddedSearch ?? '')
  const rawSidePaneHidden = searchParams.get('sidebarHidden')
  const initialSidePaneHidden = rawSidePaneHidden === '1'
  const [sidePaneHidden, setSidePaneHidden] = useState(initialSidePaneHidden)
  // Deep links into a specific Live Sale tab (Sale/Sales/Bills/Count/Loss by
  // Tgt/Log) -- the "Sale Log" search result, a "Fix now: Counts" button, a
  // Daily/7-Day/15-Day Counts violation pill, a Sales/Bills/gains violation
  // pill, and the global search's Sales/Bills results all jump here now
  // that none of those is a real LossView any more (each folded into one of
  // Live Sale's own tabs). Seq is a plain incrementing counter so the same
  // tab can be jumped to twice in a row and still fire.
  const [liveSaleJumpSeq, setLiveSaleJumpSeq] = useState(0)
  const [liveSaleJumpTab, setLiveSaleJumpTab] = useState<'sale' | 'sales' | 'bills' | 'count' | 'lossByTarget' | 'log'>('sale')
  const [liveSaleJumpViolation, setLiveSaleJumpViolation] = useState<string | null>(null)
  const [liveSaleJumpSearch, setLiveSaleJumpSearch] = useState<string | null>(null)
  function jumpToLiveSaleTab(tab: 'sale' | 'sales' | 'bills' | 'count' | 'lossByTarget' | 'log', violation: string | null = null, search: string | null = null) {
    pickLossView('sales')
    setLiveSaleJumpTab(tab)
    setLiveSaleJumpViolation(violation)
    setLiveSaleJumpSearch(search)
    setLiveSaleJumpSeq(s => s + 1)
  }
  // Deep links into a specific Customers tab -- the "+" shortcut menu's
  // "New Customer" and the global search's page-jump list both land here
  // now that neither Cust. Receipts nor New Customer is a real LossView
  // any more (both folded into Customers' own tabs).
  const [customersJumpSeq, setCustomersJumpSeq] = useState(0)
  const [customersJumpTab, setCustomersJumpTab] = useState<'customers' | 'receipts' | 'new'>('customers')
  function jumpToCustomersTab(tab: 'customers' | 'receipts' | 'new') {
    pickLossView('customers')
    setCustomersJumpTab(tab)
    setCustomersJumpSeq(s => s + 1)
  }
  // Finishes the old ?tab=losses deep link (see the lossView initializer
  // above) -- can't call jumpToLiveSaleTab directly from that initializer
  // since it isn't defined yet that early in the component.
  useEffect(() => {
    if (rawInitialTab === 'losses') jumpToLiveSaleTab('count')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function inlineLaws(scopeKey: string, panel: ReturnType<typeof useLawsPanel>) {
    return (<>
      <LawsToggleBar show={panel.show} setShow={panel.setShow}
        openForm={panel.openForm} setOpenForm={panel.setOpenForm}
        hideZeroFlags={panel.hideZeroFlags} setHideZeroFlags={panel.setHideZeroFlags}
          activeFilters={panel.activeFilters} toggleFilter={panel.toggleFilter} dark={false} />
      {panel.show && (
        <div className="border border-gray-200 rounded-xl bg-white overflow-hidden mt-2">
          <PageLawsList scopeKey={scopeKey} isItemsLaws={true} onChange={panel.bumpRefresh}
            openForm={panel.openForm} setOpenForm={panel.setOpenForm}
            hideZeroFlags={panel.hideZeroFlags} setHideZeroFlags={panel.setHideZeroFlags}

              activeFilters={panel.activeFilters} />
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

  // Active Biz staff members fetched from /api/staff/status -- used to dynamically
  // create individual staff member pages in the pane below STAFF_TEAM_ITEMS.
  // Only includes staff in STAFF_ROSTER (Biz members), not all app users.
  const [activeStaff, setActiveStaff] = useState<{ username: string; active: boolean }[]>([])
  const fetchStaff = () => {
    fetch('/api/staff/status').then(r => r.ok ? r.json() : [])
      .then(d => {
        if (!Array.isArray(d)) return
        const bizStaff = d.filter((s: any) => s.active && STAFF_ROSTER.some(name => name.toLowerCase() === s.username.toLowerCase()))
        setActiveStaff(bizStaff)
      })
      .catch(() => {})
  }
  useEffect(() => { fetchStaff() }, [])
  usePolling(fetchStaff, 30000)

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
  // view instead of the normal list -- these four (plus Counts, which owns
  // the same toggle itself, see CountsTab) are where the removed "Data"
  // tab's eight sections got redistributed to.
  const [showAnalytics, setShowAnalytics] = useState(searchParams.get('analytics') === '1')
  // Sales' own combined 🚩 flags view -- lifted up here (like itemsExtraView
  // above) so its trigger can sit on the green bar next to New, matching
  // Items' flag icon + count instead of a separate button inside Sales'
  // own gray toolbar row.

  const [items, setItems]           = useState<Item[]>([])
  const [itemsLoading, setItemsLoading] = useState(true)
  const liveGroups = useMemo(
    () => Array.from(new Set(items.map(i => i.cf_group).filter((g): g is string => !!g))).sort(),
    [items]
  )
  // Services' left-pane rows -- one button per distinct cf_group already in
  // use across the item catalog (goods and services alike; "Services" here
  // is just this section's name, not a product_type filter), derived
  // straight from `items` rather than a separate fetch. Clicking one opens
  // a direct list of that group's items, same shape as UK's flat submenus.
  const serviceGroups = useMemo(() =>
    Array.from(new Set(items.map(i => i.cf_group).filter((g): g is string => !!g && g.trim() !== ''))).sort()
  , [items])
  // Whichever inline sub-panel is showing below the Items law panel -- just
  // a service group's item table for now. Selecting a different group
  // replaces it instead of stacking, same as every other flag click on
  // this page.
  type ItemsInlineExtra = { kind: 'serviceGroup'; group: string }
  const [itemsInlineExtra, setItemsInlineExtra] = useState<ItemsInlineExtra | null>(null)

  function loadItems() {
    fetch('/api/items').then(r => r.json()).then(d => {
      setItems(Array.isArray(d) ? d : [])
      setItemsLoading(false)
    })
  }

  useEffect(() => { loadItems() }, [])
  usePolling(loadItems, 120000)

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
  usePolling(loadLossGroups, 120000)

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
  // Same filter as serviceViolationCount, just the item ids instead of the
  // count -- feeds Live Sale's itemsWithViolations (see loadBadgeData below).
  const [serviceViolationIds, setServiceViolationIds] = useState<number[]>([])
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
      const violating = list.filter((r: any) =>
        r.product_type === 'service' && (Number(r.cnt) !== 0 || Number(r.gmc) !== 0 || Number(r.bl) !== 0)
      )
      setServiceViolationCount(violating.length)
      setServiceViolationIds(violating.map((r: any) => r.item_id))
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
  usePolling(loadBadgeData, 120000)

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
  function loadTaskCounts() {
    fetch('/api/tasks').then(r => r.ok ? r.json() : []).then((all: unknown) => {
      const list = Array.isArray(all) ? all as { submenu?: string | null; done?: boolean }[] : []
      const counts: Record<string, number> = {}
      for (const t of list) {
        if (t.done || !t.submenu) continue
        counts[t.submenu] = (counts[t.submenu] ?? 0) + 1
      }
      setTaskCounts(counts)
    }).catch(() => {})
  }
  useEffect(() => { loadTaskCounts() }, [])
  usePolling(loadTaskCounts, 120000)
  const taskCountFor = (scopeKey: string) => taskCounts[scopeKey] ?? 0
  // A few pane rows' PageToolIcons scopeKey differs from their own pane
  // label (either because the label was later shortened for the pane -- see
  // 'Loss by Tgt'/'Purchase Ord' -- or because the content page hardcodes
  // its own scopeKey independent of CASH_LABEL) -- see each page's own
  // <PageToolIcons scopeKey=.../> call for the authoritative string.
  const CASH_TASK_SCOPE_OVERRIDES: Partial<Record<LossView, string>> = {
    purchaseOrders: 'Purchase Orders',
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
    if (typeof window === 'undefined' || !window.localStorage) return
    localStorage.setItem('showItemsLaws', showItemsLaws.toString())
  }, [showItemsLaws])

  function changeTab(t: OuterTab) {
    setOuterTab(t)
    setViolation(null)
    setAddForm(null)
    setShowAnalytics(false)
    setSettingsOpen(false)
    if (t !== 'loss') setProductType('all')
    if (t === 'loss') {
      setLossView('items')
      setItemsPageMode('sale')
    }
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

  // From the loss dialog: jump to the records that usually explain a
  // "loss". Sales/Bills/Counts all land inside Live Sale now -- its own
  // Sales/Bills tabs for the first two, and Sale mode's pinned "COUNT NOW"
  // block/count-interval law views for the third.
  function goFixRecords(view: 'sales' | 'bills' | 'counts') {
    if (view === 'counts') { jumpToLiveSaleTab('sale'); return }
    jumpToLiveSaleTab(view)
  }

  // The "+" shortcut menu (see AddShortcutButton) -- jumps straight to a
  // "create new" flow wherever it already lives. Item/Expenses reuse the
  // existing addForm mechanism (pickLossView resets it, so set it after);
  // Sales/Bills land on Live Sale's own Sales/Bills tab instead now (New
  // Sale is gone -- Sale mode's own tap-a-sale flow is the replacement;
  // Bills' "+ New Bill" is one click away on its tab rather than opening
  // pre-expanded); the rest reopen via a per-target signal since their
  // forms are local component state with no addForm equivalent. Staff Time
  // lands on Team Times, not a per-person page -- Personal has no Times row
  // of its own anymore (see Team Times' own history), but TimesTab's admin
  // "add entry" form works the same regardless of whose page it's opened from.
  function handleShortcut(key: ShortcutKey) {
    switch (key) {
      case 'sale':       jumpToLiveSaleTab('sale'); break
      case 'bill':       jumpToLiveSaleTab('bills'); break
      case 'item':       pickLossView('items');     setAddForm('item'); break
      case 'expense':    pickLossView('expenses');  setAddForm('expense'); break
      case 'cabConfirm': pickLossView('cab');       setCabConfirmSignal(n => n + 1); break
      case 'customer':   jumpToCustomersTab('new'); break
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
    // Alias Wide Table/Service Matches/Name Conflicts are sub-views of
    // Items itself (lossView stays 'items') -- they still need their own
    // ?view= entry, or leaving/refreshing on one of them silently drops
    // you back on the plain item list instead of where you actually were.
    if (outerTab === 'loss' && lossView === 'items' && itemsExtraView !== 'none') params.set('view', itemsExtraView)
    // 'sales' (Live Sale) is the default landing view now (see lossView's
    // initial state above and the searchParams-sync effect below, both of
    // which treat a missing ?view= as 'sales') -- so 'sales' is the one
    // that gets to omit ?view= for a clean URL. This used to check
    // `lossView !== 'items'` instead, back when Items was still the
    // default landing view -- that default flipped to Live Sale, but this
    // check was never updated to match, so navigating to Items would
    // write a URL with no ?view=, which the sync-back effect below then
    // misread as "no view specified" and silently bounced back to Sales.
    else if (outerTab === 'loss' && lossView !== 'sales') params.set('view', lossView)
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
    // Live Sale mode-specific filters
    if (liveMode) params.set('mode', liveMode); else params.delete('mode')
    if (liveProductTypeFilter !== 'all') params.set('liveType', liveProductTypeFilter); else params.delete('liveType')
    if (liveGroupFilter) params.set('liveGroup', liveGroupFilter); else params.delete('liveGroup')
    if (liveSalesViolationFilter) params.set('liveSalesViolation', liveSalesViolationFilter); else params.delete('liveSalesViolation')
    if (liveBillsViolationFilter) params.set('liveBillsViolation', liveBillsViolationFilter); else params.delete('liveBillsViolation')
    if (liveSaleFilter) {
      const filterValue = liveSaleFilter.kind === 'interval' ? `interval:${liveSaleFilter.label}` : liveSaleFilter.kind
      params.set('liveSaleFilter', filterValue)
    } else params.delete('liveSaleFilter')
    if (liveCountView && liveCountView.kind !== 'records') {
      const countViewValue = liveCountView.kind === 'interval' ? `interval:${liveCountView.label}` : liveCountView.kind
      params.set('liveCountView', countViewValue)
    } else params.delete('liveCountView')
    if (liveEmbeddedSearch) params.set('liveSearch', liveEmbeddedSearch); else params.delete('liveSearch')
    if (sidePaneHidden) params.set('sidebarHidden', '1'); else params.delete('sidebarHidden')
    const qs = params.toString()
    const target = qs ? `/item?${qs}` : '/item'
    const current = window.location.pathname + window.location.search
    if (target === current) return
    router.push(target, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outerTab, lossView, settingsOpen, itemsExtraView, group, productType, violation, showAnalytics, addForm, liveMode, liveProductTypeFilter, liveGroupFilter, liveSalesViolationFilter, liveBillsViolationFilter, liveSaleFilter, liveCountView, liveEmbeddedSearch, sidePaneHidden])

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
      // No ?view= at all -> land on Live Sale, matching the initial-state
      // fallback above. A recognized extra-view link (Alias Wide Table etc.)
      // still anchors to Items, since that's the pane it actually opens on.
      const nextView: LossView = (urlExtraView ? 'items' : rawUrlView) as LossView ?? 'sales'
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  function goToViolation(key: string) {
    // The loss-summary rows point at Count Records (the old Loss by Date
    // feed folded into it), one of Live Sale's own embedded tabs now, not a
    // plain lossView.
    if (key === '__loss_feed') { jumpToLiveSaleTab('count'); return }
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
    // Daily/7-Day/15-Day Counts aren't a separate lossView any more, and
    // no longer have a dedicated violation-filtered list to jump to --
    // Live Sale's own pinned "COUNT NOW" block and its Daily/Every 7d/
    // Every 15d law views already cover the same ground from Sale mode.
    if (key === 'daily' || key === '7day' || key === '15day') { jumpToLiveSaleTab('sale'); return }
    const targetView = VIOLATION_HOME[key]
    if (!targetView) return
    // Sales/Bills/gains pills all land inside one of Live Sale's own
    // embedded tabs now, rather than a plain lossView -- see jumpToLiveSaleTab.
    if (targetView === 'sales' || targetView === 'bills' || targetView === 'count') {
      jumpToLiveSaleTab(targetView, key)
      return
    }
    pickLossView(targetView)
    setViolation(key)
  }

  const lawsKeys = [
    'showAccessLaws', 'showAdvertLaws', 'showAliasWideTableLaws',
    'showBillsLaws', 'showCABLaws', 'showCloserLaws', 'showCountsLaws', 'showCustomersLaws',
    'showDailyLaws', 'showDressCodeLaws', 'showExpenseOrdersLaws', 'showExpensesLaws',
    'showGronyChecksLaws', 'showHomeLaws', 'showItem360Laws', 'showItemsFlagsLaws',
    'showItemsLaws', 'showLiveSaleLaws', 'showLossByDateLaws', 'showLossByItemLaws',
    'showLossByTargetLaws', 'showNewCustomerLaws', 'showNewSaleLaws', 'showOpenerLaws',
    'showPayslipsLaws', 'showPLLaws', 'showProfileLaws', 'showPropertiesLaws',
    'showPurchaseOrdersLaws', 'showReceiptsLaws', 'showReorderListsLaws', 'showSalesLaws',
    'showServiceMatchesLaws', 'showServicesLaws', 'showStaffAnalyticsLaws', 'showTeamAssessmentLaws',
    'showTeamLogsLaws', 'showTeamMeetingLaws', 'showTeamProfilesLaws', 'showTeamReviewLaws',
    'showTeamRotaLaws', 'showTeamTimesLaws', 'showVendorsLaws', 'showViewPortalAsLaws',
    'showViolationsLaws',
  ]

  function areAllLawsShown() {
    if (typeof window === 'undefined' || !window.localStorage) return false
    return lawsKeys.every(k => localStorage.getItem(k) === 'true')
  }

  function toggleAllLaws() {
    if (typeof window === 'undefined' || !window.localStorage) return
    const allShown = areAllLawsShown()
    lawsKeys.forEach(k => localStorage.setItem(k, allShown ? 'false' : 'true'))
    window.location.reload()
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
  // paneOrder/paneLabels/paneGroups/paneHidden below all share one pattern:
  // an owner-level account can customize the sidebar (Settings > Reorder
  // Lists) and everyone else's pane should pick that up without a refresh.
  // These used to poll every 5s each (hand-rolled setInterval, no
  // visibility guard) -- for cosmetic settings that realistically change a
  // few times a year, that was four separate endpoints getting hit
  // thousands of times a day per open tab, including tabs sitting hidden
  // in the background, for nothing. usePolling's existing 60s/
  // visibility-gated cadence (same as everything else in this file) is
  // still fast enough that a reorder shows up for other staff within a
  // minute, at a small fraction of the request volume.
  const [paneOrder, setPaneOrder] = useState<PaneOrderMap>({})
  const fetchPaneOrder = () => fetch('/api/pane-order').then(r => r.ok ? r.json() : {}).then(setPaneOrder).catch(() => {})
  useEffect(() => { fetchPaneOrder() }, [])
  usePolling(fetchPaneOrder, 120000)
  // Same shared-with-everyone pattern as paneOrder above, but for display
  // labels instead of row order -- see ReorderListsPanel.tsx and
  // /api/pane-labels. Purely cosmetic: a row's `key` (used for routing,
  // PageToolIcons scopeKey, and every task/notes/laws/flag lookup) never
  // changes, so this can't orphan any of that data.
  const [paneLabels, setPaneLabels] = useState<Record<string, string>>({})
  const fetchPaneLabels = () => fetch('/api/pane-labels').then(r => r.ok ? r.json() : {}).then(setPaneLabels).catch(() => {})
  useEffect(() => { fetchPaneLabels() }, [])
  usePolling(fetchPaneLabels, 120000)
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
  const fetchPaneGroups = () => fetch('/api/pane-groups').then(r => r.ok ? r.json() : {}).then(setPaneGroups).catch(() => {})
  useEffect(() => { fetchPaneGroups() }, [])
  usePolling(fetchPaneGroups, 120000)
  // Same shared-with-everyone pattern again, but for which rows are hidden
  // from the sidebar entirely -- see /api/pane-hidden and
  // ReorderListsPanel.tsx. Purely a visibility override, same guarantee as
  // paneLabels/paneGroups above: a hidden row's key, routing, and every
  // task/notes/laws/flag lookup keyed off it are untouched, so un-hiding it
  // later brings it straight back with everything intact.
  const [paneHidden, setPaneHidden] = useState<Record<string, boolean>>({})
  const fetchPaneHidden = () => fetch('/api/pane-hidden').then(r => r.ok ? r.json() : {}).then(setPaneHidden).catch(() => {})
  useEffect(() => { fetchPaneHidden() }, [])
  usePolling(fetchPaneHidden, 120000)
  // New Sale/Live Sale/Log used to be hardcoded sub-buttons nested under
  // the Sales row, then their own standalone rows. Now Sales, Bills, Loss
  // by Date, and Loss by Target have all folded into Live Sale's own mode
  // switcher (Sale/Sales/Bills/Loss by Date/Loss by Tgt/Log) the same way
  // Count 2 and Log did before them, so the 'sales' CASH_ITEMS row (now
  // labeled "Live Sale") is a plain row again like any other -- no more
  // addForm-based sub-item special-casing needed.
  function cashItemActive(key: string) {
    return lossView === key
  }
  function cashItemClick(key: string) {
    pickLossView(key as LossView)
  }
  function cashItemTaskScope(key: string) {
    return cashTaskScopeKey(key as LossView)
  }
  const combinedCashItems = CASH_ITEMS.map(item => {
    const override = paneGroups[item.key]
    if (!override) return { ...item, standaloneOverride: false }
    if (override.standalone) return { ...item, group: paneLabel(item.key, item.label), standaloneOverride: true }
    return { ...item, group: override.group_name ?? undefined, standaloneOverride: false }
  })
  const effectiveCashItems = combinedCashItems
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
      { label: 'GMC Packs', action: () => { pickLossView('items'); setItemsExtraView('gmcPacks') } },
      // Live Sale's own tabs aren't their own CASH_ITEMS entries, so the
      // map above never picks them up -- listed by hand here instead, same
      // as every other page search already jumps straight to. New Sale is
      // gone (dropped in favor of Sale mode's own tap-a-sale flow), so
      // there's no entry for it any more.
      { label: 'Live Sale', action: () => jumpToLiveSaleTab('sale') },
      { label: 'Sale Log', action: () => jumpToLiveSaleTab('log') },
      { label: 'New Customer', action: () => jumpToCustomersTab('new') },
      { label: 'Cust. Receipts', action: () => jumpToCustomersTab('receipts') },
      { label: 'Expense Orders', action: () => pickLossView('expenseOrders') },
      { label: 'Properties at Shop', action: () => { pickLossView('properties'); setPropertiesInitialTab('available') } },
      { label: 'Properties not at Shop', action: () => { pickLossView('properties'); setPropertiesInitialTab('away') } },
      ...serviceGroups.map(g => ({ label: `Services — ${g}`, action: () => { pickLossView('items'); setItemsInlineExtra({ kind: 'serviceGroup', group: g }) } })),
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
  // Hide the side pane -- toggled from the small button floating over
  // SidePaneToggle's own label row (onHide) and, while hidden, from the
  // small floating restore button below. Persisted to URL so it survives refresh.

  // Live Sale takes over the whole content area with its own thing to do
  // (build a cart, tap items, review a log, browse Sales/Bills/Loss by
  // Date/Loss by Tgt) -- the Analytics toggle and flag badges above it
  // belong to submenus that don't apply here, so they're just clutter.
  const salesFormOpen = lossView === 'sales'

  // ── Live Sale's own state/logic (folded in from the former
  // sales/live/page.tsx, formerly a separately-mounted <LiveSaleForm>
  // reached via ~30 drilled props + 3 DOM portal slots) ── every
  // LiveSaleForm-internal identifier below is `live`-prefixed, continuing
  // this file's own existing convention (liveExpanded/liveGroups/etc. above)
  // and avoiding collisions with this component's ~90 other hooks. A
  // "controlledX ?? internalX" fallback that only ever existed to support
  // LiveSaleForm being usable stand-alone is deleted outright -- there is
  // only ever one owner now (this component's own already-existing
  // liveExpanded/liveProductTypeFilter/liveGroupFilter/liveHelpModalOpen
  // state, declared above).
  usePresenceReporter('live-tapping a sale')
  const liveCanDeleteCounts = isOwnerLevel(session?.user as any)

  const [liveAllItems, setLiveAllItems] = useState<LiveItem[]>([])
  const [liveItemsLoading, setLiveItemsLoading] = useState(true)
  const [liveTaps, setLiveTaps] = useState<Tap[]>([])
  // Shop opening/last-sign-out clock times per date -- backs the Log tab's
  // Gap column for the first/last tap of each day (see liveDayBounds effect
  // below and /api/staff-times/day-bounds).
  const [liveDayBounds, setLiveDayBounds] = useState<Record<string, { openTime: string | null; closeTime: string | null }>>({})
  const [liveSaleType, setLiveSaleType] = useState<'WIC' | 'GMC'>('WIC')
  const [liveTapError, setLiveTapError] = useState('')
  // Tapping an item's name opens its full Item 360 detail (loss/gain
  // history, pack-chain, aliases, merge) as its own popup -- separate from
  // liveSelectedItem/the sale-tap sheet, since the two can be open from
  // different rows at once with no relationship to each other.
  const [liveViewingItemId, setLiveViewingItemId] = useState<number | null>(null)
  const [liveEditingGridItemId, setLiveEditingGridItemId] = useState<number | null>(null)
  const liveGridEditSaleTapRef = useRef<HTMLDivElement>(null)
  const [liveGridEditLoading, setLiveGridEditLoading] = useState(false)
  const [liveGridEditError, setLiveGridEditError] = useState('')
  const [liveGridEditAliases, setLiveGridEditAliases] = useState<AliasRecord[]>([])
  const [liveGridEditMatches, setLiveGridEditMatches] = useState<MatchRecord[]>([])
  const [liveGridEditConfirmDelete, setLiveGridEditConfirmDelete] = useState(false)
  const [liveGridEditDeleting, setLiveGridEditDeleting] = useState(false)
  const [liveGridEditDeleteError, setLiveGridEditDeleteError] = useState('')
  const [liveGridEditSaving, setLiveGridEditSaving] = useState(false)
  const [liveGridEditCountQty, setLiveGridEditCountQty] = useState('')
  const [liveGridEditCountPrice, setLiveGridEditCountPrice] = useState('')
  const [liveGridEditCountError, setLiveGridEditCountError] = useState('')
  const [liveGridEditCountSaving, setLiveGridEditCountSaving] = useState(false)
  const [liveSelectedItem, setLiveSelectedItem] = useState<LiveItem | null>(null)
  // Snapshot of whether liveSelectedItem was due-for-count at the moment its
  // sheet opened -- liveCountStatus itself updates the instant a count is
  // saved (the item drops out of the due queues), so comparing "was due
  // on open" against "still due now" is how the sheet tells "never was
  // due" apart from "just got counted", regardless of whether that count
  // went straight through or via the loss/pairing dialogs.
  const [liveDueWhenOpened, setLiveDueWhenOpened] = useState(false)
  const [liveQty, setLiveQty] = useState('')
  const [livePrice, setLivePrice] = useState('')
  const [liveSaving, setLiveSaving] = useState(false)
  // Editing the selected item's own fields -- opened from an "Edit" button
  // inside the same sale-tap sheet instead of navigating to Item 360, so a
  // quick price/group/count-cadence fix doesn't require leaving the sheet
  // (or the item picked for a sale). Swaps the sheet's body to the edit
  // form in place; Cancel returns to the normal sale/count view without
  // closing the sheet.
  const [liveEditingSelectedItem, setLiveEditingSelectedItem] = useState(false)
  const [liveEditForm, setLiveEditForm] = useState(EMPTY_ITEM_EDIT_FORM)
  const [liveEditCurrentCountInterval, setLiveEditCurrentCountInterval] = useState<string | null>(null)
  const [liveEditCurrentSoh, setLiveEditCurrentSoh] = useState<number | null>(null)
  const [liveEditLoading, setLiveEditLoading] = useState(false)
  const [liveEditSaving, setLiveEditSaving] = useState(false)
  const [liveEditError, setLiveEditError] = useState('')
  useEffect(() => {
    if (liveEditingGridItemId != null && liveGridEditSaleTapRef.current) {
      setTimeout(() => {
        liveGridEditSaleTapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }, [liveEditingGridItemId])
  // "Large screen" -- breaks Live Sale out of the pane/content layout into a
  // fixed fullscreen overlay, covering this component's own top green bar
  // and footer (still mounted underneath, just visually hidden) -- so each
  // mode below renders its own copy of the mode toggle/filter bar/search
  // box while liveExpanded is true instead of relying on those.
  const liveRootClassName = `bg-white flex flex-col ${liveExpanded ? 'fixed inset-0 z-50 overflow-y-auto' : 'h-full'}`
  const [liveCurrentView, setLiveCurrentView] = useState<{ kind: 'violation' | 'serviceGroup' | 'lossByItem' | 'aliasWide' | 'serviceMatches' | 'newItem' | 'dailySummary'; key?: string; group?: string } | null>(null)
  // Sale mode's own item-grid filter -- Loss/Gain (from liveLossByItemId
  // below) and Low SOH (item.soh <= 0) are plain buckets; 'interval' reuses
  // each item's own count_interval string (the same Daily/Every Nd/Not
  // counted labels the Count tab's liveCountIntervalFlags buckets by) so a
  // cadence bucket here can never drift out of sync with the Count tab's own.
  const [liveItemPickerQuery, setLiveItemPickerQuery] = useState('')
  const [liveItemPickerResults, setLiveItemPickerResults] = useState<LiveItem[]>([])
  const [liveShowItemPicker, setLiveShowItemPicker] = useState(false)
  const [livePickedItemId, setLivePickedItemId] = useState<number | null>(null)
  // Sales/Bills/Loss by Date/Loss by Target each kept their own laws/notes/
  // tasks under their own scopeKey (from back when each was its own page) --
  // still sitting in the database under those same scope keys, so each tab
  // gets its own laws icon here to reach them, same as Sale mode's own
  // (liveSaleLaws, declared above).
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
  // filtered view of Count's own Count Records (see liveCountRecordFilter) --
  // folded in as extra columns there instead of a fourth tab walking the
  // same stock_counts rows a second time.

  // Count tab's own local navigation -- Daily/Every Nd/Dormant/etc, Count
  // Records, and Count History used to only be reachable through the laws
  // panel (as liveCurrentView kinds); moved to their own tab with this
  // simpler local state instead of reusing liveCurrentView, since that's
  // Sale mode's own overlay mechanism and these views no longer belong
  // there. Defaults to Count Records -- that's the landing view for the
  // Count tab, since a raw list of "what's due" is less useful than seeing
  // what's actually been counted until you pick a specific category to
  // drill into.
  // Finishes a jumpToLiveSaleTab() call -- moved here as a plain effect
  // keyed on liveSaleJumpSeq (declared above, alongside jumpToLiveSaleTab
  // itself) instead of crossing a prop boundary into a separate component.
  useEffect(() => {
    if (!liveSaleJumpSeq || !liveSaleJumpTab) return
    setLiveMode(liveSaleJumpTab)
    setLiveSalesViolationFilter(liveSaleJumpTab === 'sales' ? liveSaleJumpViolation : null)
    setLiveBillsViolationFilter(liveSaleJumpTab === 'bills' ? liveSaleJumpViolation : null)
    // The 'gains' violation pill is the one way the old Loss by Date's own
    // filter (not a violation key it understands) needs setting on arrival
    // -- every other loss-feed jump defaults back to the Losses side, into
    // Count Records rather than the interval buckets.
    if (liveSaleJumpTab === 'count') {
      setLiveCountView({ kind: 'records' })
      setLiveCountRecordFilter(liveSaleJumpViolation === 'gains' ? 'gain' : 'loss')
    }
    setLiveEmbeddedSearch(liveSaleJumpSearch ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveSaleJumpSeq])
  const [liveDailyItems, setLiveDailyItems] = useState<DueItem[]>([])
  const [liveGmcWeeklyItems, setLiveGmcWeeklyItems] = useState<DueItem[]>([])
  const [liveOverdueItems, setLiveOverdueItems] = useState<DueItem[]>([])
  const [liveCountQty, setLiveCountQty] = useState('')
  const [liveCountSaving, setLiveCountSaving] = useState(false)
  const [liveCountError, setLiveCountError] = useState('')
  const [liveLossPrompt, setLiveLossPrompt] = useState<LossPrompt | null>(null)
  const [livePairingPrompt, setLivePairingPrompt] = useState<PairingPrompt | null>(null)
  const [liveCountRecords, setLiveCountRecords] = useState<CountRecord[]>([])
  const [liveEditingCountId, setLiveEditingCountId] = useState<number | null>(null)
  const [liveEditCountQty, setLiveEditCountQty] = useState('')
  const [liveEditCountNotes, setLiveEditCountNotes] = useState('')
  const [liveEditCountSaving, setLiveEditCountSaving] = useState(false)
  // Count Records' All/Losses/Gains filter -- the old Loss by Date tab's own
  // Losses/Gains toggle, now scoped down to a filter on the same table
  // instead of a second table walking the same rows.
  const [liveCountRecordFilter, setLiveCountRecordFilter] = useState<'all' | 'loss' | 'gain'>('all')
  // Bills has no internal "add new" of its own (unlike Sales, which this
  // tap-to-sell mode already covers) -- it always relied on its own tab
  // rendering NewBillForm as a sibling, so that comes along with it.
  const [liveBillsAddingNew, setLiveBillsAddingNew] = useState(false)
  const [liveSalesShowAnalytics, setLiveSalesShowAnalytics] = useState(false)
  const [liveBillsShowAnalytics, setLiveBillsShowAnalytics] = useState(false)
  // Sale mode's own Analytics toggle -- named distinctly from the generic
  // "live" prefix (source collision: this file's live-prefix convention
  // would otherwise turn the original `liveShowAnalytics` into a name that
  // reads like it means "Live Sale generally" rather than "Sale mode
  // specifically") to keep it visually distinct from liveSalesShowAnalytics
  // (the Sales tab's own toggle) right above.
  const [saleModeShowAnalytics, setSaleModeShowAnalytics] = useState(false)
  const [liveLogShowAnalytics, setLiveLogShowAnalytics] = useState(false)
  const [liveCountShowAnalytics, setLiveCountShowAnalytics] = useState(false)

  // Item-group options for Live Sale's own filter selects -- built from
  // liveAllItems (Live Sale's own catalogue fetch), NOT the hub's own
  // `items`/liveGroups above (a different, separately-fetched catalogue --
  // not a dedupe opportunity for this pass, see LiveItem's own comment).
  const liveCatalogueGroups = useMemo(() => {
    const uniqueGroups = new Set<string>()
    for (const item of liveAllItems) {
      if (item.group) uniqueGroups.add(item.group)
    }
    return Array.from(uniqueGroups).sort()
  }, [liveAllItems])

  // SalesTab/BillsTab expect items shaped {id, item_name, cf_group} -- Live
  // Sale's own item list already uses {id, name, group} for everything
  // else, so this is just a field-name adapter, not a different data
  // source (same trick countsTabItems used to use for CountsTab).
  const liveSalesBillsItems = useMemo(
    () => liveAllItems.map(i => ({ id: i.id, item_name: i.name, cf_group: i.group })),
    [liveAllItems]
  )

  // Merges the 3 due-count queues into one per-item lookup for Count
  // mode's grid badges -- daily/7-day GMC items are "due", 15-day items
  // are "overdue" (a stronger color); an item in none of the 3 just isn't
  // due right now. The queues never overlap the same item in practice
  // (each excludes the others' item set server-side), so layering order
  // here only matters as a safety default, not a real precedence rule.
  const liveCountStatus = useMemo(() => {
    const map = new Map<number, { level: 'due' | 'overdue'; label: string }>()
    for (const it of liveDailyItems) {
      map.set(it.item_id, { level: 'due', label: !it.days_overdue || it.days_overdue <= 0 ? 'Today' : `${it.days_overdue}d` })
    }
    for (const it of liveGmcWeeklyItems) {
      map.set(it.item_id, { level: 'due', label: !it.days_overdue || it.days_overdue <= 0 ? 'Due' : `${it.days_overdue}d` })
    }
    for (const it of liveOverdueItems) {
      map.set(it.item_id, { level: 'overdue', label: `${it.days_overdue ?? '?'}d` })
    }
    return map
  }, [liveDailyItems, liveGmcWeeklyItems, liveOverdueItems])

  // One view per distinct count-interval label actually in use (Daily,
  // Every 7d, Every 15d, Every 30d, Not counted, or any custom override
  // someone's set on an item's edit form -- the set isn't fixed to just
  // those, since count_cadence_days is a free-form number). Built from
  // liveAllItems rather than liveCatalogueItems so the counts don't shrink/
  // shift as other filters (product type, group, WIC/GMC) get applied.
  const liveCountIntervalFlags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const it of liveAllItems) {
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
        active: liveCountView?.kind === 'interval' && liveCountView.label === label,
        onViewClick: () => {
          setLiveCountView(liveCountView?.kind === 'interval' && liveCountView.label === label
            ? null
            : { kind: 'interval' as const, label })
        }
      }))
  }, [liveAllItems, liveCountView])

  // Same violation-type label/description lists ITEMS_FLAG_TYPES/
  // SALES_FLAG_TYPES/BILLS_FLAG_TYPES already back for the Items/Sales/Bills
  // flag icons above -- computed here too (Live Sale's own flags panel,
  // and the Sales/Bills tabs' own inline law panels below, all read them).
  const liveViolationTypes: ViolationType[] = ITEMS_FLAG_TYPES.map(({ key, label }) => ({ key, label, description: ERROR_VIOLATIONS.find(v => v.key === key)?.description }))
  const liveSalesViolationTypes: ViolationType[] = SALES_FLAG_TYPES.map(({ key, label }) => ({ key, label, description: ERROR_VIOLATIONS.find(v => v.key === key)?.description }))
  const liveBillsViolationTypes: ViolationType[] = BILLS_FLAG_TYPES.map(({ key, label }) => ({ key, label, description: ERROR_VIOLATIONS.find(v => v.key === key)?.description }))

  // Same object literal the old <LiveSaleForm itemsWithViolations={...}/>
  // call site built inline -- lifted into its own memo since it's now read
  // directly by liveDuplicateItemIds/liveUnlinkedNamedIds/
  // liveServiceViolationIdSet/liveCatalogueItems below instead of crossing
  // a prop boundary.
  const liveItemsWithViolations = useMemo(() => ({
    neg_soh: liveAllItems.filter(i => Number(i.soh) < 0 && i.product_type !== 'service').map(i => i.id),
    no_sp: liveAllItems.filter(i => !i.selling_price || parseFloat(String(i.selling_price)) === 0).map(i => i.id),
    no_cp: liveAllItems.filter(i => !i.cost_price || parseFloat(String(i.cost_price)) === 0).map(i => i.id),
    no_group: liveAllItems.filter(i => !i.group).map(i => i.id),
    // Both sides of every non-dismissed duplicate pair -- ids only, same as
    // the other four keys here.
    duplicates: [...new Set((globalFlags?.duplicates ?? []).flatMap((d: any) => [d.id1, d.id2]))] as number[],
    unlinked_named: (globalFlags?.unlinkedNamed ?? []).map((r: any) => r.item_id) as number[],
    service_violation: serviceViolationIds,
  }), [liveAllItems, globalFlags, serviceViolationIds])

  // Build mode-specific flags array with Live Sale callbacks
  // Only show flags relevant to the current mode
  const liveComputedFlags = useMemo(() => {
    const flags = []

    // Items violation flags (for Sale/Log modes)
    if (liveMode === 'sale' || liveMode === 'log') {
      flags.push(...liveViolationTypes.map((v: ViolationType) => ({
        key: v.key,
        label: v.label,
        description: v.description,
        count: violationCounts[v.key] ?? 0,
        onViewClick: () => {
          setLiveCurrentView(liveCurrentView?.kind === 'violation' && liveCurrentView.key === v.key
            ? null
            : { kind: 'violation' as const, key: v.key })
        }
      })))
    }

    // Sales violation flags (for Sales mode)
    if (liveMode === 'sales') {
      flags.push(...liveSalesViolationTypes.map((v: ViolationType) => ({
        key: v.key,
        label: v.label,
        description: v.description,
        count: violationCounts[v.key] ?? 0,
        active: liveSalesViolationFilter === v.key,
        onViewClick: () => {
          if (liveSalesViolationFilter === v.key) { setLiveSalesViolationFilter(null); return }
          setLiveSalesViolationFilter(v.key)
        }
      })))
    }

    // Bills violation flags (for Bills mode)
    if (liveMode === 'bills') {
      flags.push(...liveBillsViolationTypes.map((v: ViolationType) => ({
        key: v.key,
        label: v.label,
        description: v.description,
        count: violationCounts[v.key] ?? 0,
        active: liveBillsViolationFilter === v.key,
        onViewClick: () => {
          if (liveBillsViolationFilter === v.key) { setLiveBillsViolationFilter(null); return }
          setLiveBillsViolationFilter(v.key)
        }
      })))
    }

    // Count interval flags (for Count mode)
    if (liveMode === 'count') {
      flags.push(...liveCountIntervalFlags)
    }

    return flags
  }, [liveMode, violationCounts, liveCurrentView, liveSalesViolationFilter, liveBillsViolationFilter, liveCountIntervalFlags])

  // All available views (shown in all modes)
  const liveAllViews = useMemo(() => [
    {
      key: 'loss_by_item',
      label: 'Loss by Item',
      count: 0,
      onViewClick: () => {
        setLiveCurrentView(liveCurrentView?.kind === 'lossByItem' ? null : { kind: 'lossByItem' as const })
      }
    },
    {
      key: 'alias_wide_table',
      label: 'Alias Wide Table',
      count: 0,
      onViewClick: () => {
        setLiveCurrentView(liveCurrentView?.kind === 'aliasWide' ? null : { kind: 'aliasWide' as const })
      }
    },
    {
      key: 'service_matches',
      label: 'Service Matches',
      count: 0,
      onViewClick: () => {
        setLiveCurrentView(liveCurrentView?.kind === 'serviceMatches' ? null : { kind: 'serviceMatches' as const })
      }
    },
    {
      key: 'new_item',
      label: '+ New Item',
      count: 0,
      onViewClick: () => {
        setLiveCurrentView(liveCurrentView?.kind === 'newItem' ? null : { kind: 'newItem' as const })
      }
    },
    {
      key: 'daily_summary',
      label: 'Daily Summary',
      count: 0,
      onViewClick: () => {
        setLiveCurrentView(liveCurrentView?.kind === 'dailySummary' ? null : { kind: 'dailySummary' as const })
      }
    },
  ], [liveCurrentView])

  // Fetch items (Live Sale's own catalogue -- see LiveItem's own comment)
  useEffect(() => {
    fetch('/api/items/all')
      .then(r => r.json())
      .then(d => { setLiveAllItems(Array.isArray(d) ? d : []); setLiveItemsLoading(false) })
      .catch(() => setLiveItemsLoading(false))
  }, [])

  // Items with at least one past GMC (internal-use) sale on record -- the
  // only existing definition of "GMC items" anywhere in the app (see
  // /api/items/gmc-ids). Fetched once; when liveSaleType flips to GMC the
  // grid narrows to this set so a walk-in item can't accidentally get
  // tapped under an internal-use receipt.
  const [liveGmcItemIds, setLiveGmcItemIds] = useState<Set<number>>(new Set())
  useEffect(() => {
    fetch('/api/items/gmc-ids')
      .then(r => r.json())
      .then(d => setLiveGmcItemIds(new Set(Array.isArray(d) ? d : [])))
      .catch(() => {})
  }, [])

  // Loss count/amount per item -- same numbers Item 360's own loss ranking
  // is built from (/api/losses/summary), shown inline next to price/cost/
  // stock/count-interval so a loss-prone item is visible without opening
  // its Item 360 detail. Fetched once, same as the GMC id set above.
  const [liveLossByItemId, setLiveLossByItemId] = useState<Map<number, { lossCount: number; lgAmt: number; gainCount: number }>>(new Map())
  useEffect(() => {
    fetch('/api/losses/summary')
      .then(r => r.json())
      .then((d: { item_id: number; lossCount: number; lgAmt: number; gainCount: number }[]) => {
        setLiveLossByItemId(new Map(Array.isArray(d) ? d.map(r => [r.item_id, { lossCount: r.lossCount, lgAmt: r.lgAmt, gainCount: r.gainCount }]) : []))
      })
      .catch(() => {})
  }, [])

  // Id sets for the three itemAttentionFlag checks that need cross-item data
  // (see the function's own comment) -- built once here off
  // liveItemsWithViolations instead of re-scanning it on every card's
  // render. Renamed liveServiceViolationIdSet (not serviceViolationIds) --
  // this component already has its own serviceViolationIds state (feeding
  // liveItemsWithViolations.service_violation above), so the same name here
  // would silently shadow it instead of erroring.
  const liveDuplicateItemIds = useMemo(() => new Set<number>(liveItemsWithViolations.duplicates ?? []), [liveItemsWithViolations])
  const liveUnlinkedNamedIds = useMemo(() => new Set<number>(liveItemsWithViolations.unlinked_named ?? []), [liveItemsWithViolations])
  const liveServiceViolationIdSet = useMemo(() => new Set<number>(liveItemsWithViolations.service_violation ?? []), [liveItemsWithViolations])

  // Fetch taps
  useEffect(() => {
    fetch('/api/sales/live-taps')
      .then(r => r.json())
      .then(d => { setLiveTaps(Array.isArray(d) ? d : []) })
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
      setLiveDailyItems(Array.isArray(daily) ? daily : [])
      setLiveGmcWeeklyItems(Array.isArray(gmcWeekly) ? gmcWeekly : [])
      setLiveOverdueItems(Array.isArray(overdue) ? overdue : [])
    }).catch(() => {})
  }, [])

  // Count Records -- fetched only once it's actually being looked at, via
  // Count tab's own "Count Records" view (see renderCountRecordsTable),
  // unlike the queues above (this is the full all-time history, not a
  // small due-today list). The Log tab dropped its own Count view since
  // it's the same table, reachable from the Count tab instead.
  const liveViewingCountRecords = liveCountView?.kind === 'records'
  useEffect(() => {
    if (!liveViewingCountRecords) return
    fetch('/api/stock/counts')
      .then(r => r.json())
      .then(d => setLiveCountRecords(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [liveViewingCountRecords])

  // Search items as user types
  useEffect(() => {
    if (!liveItemPickerQuery.trim()) {
      setLiveItemPickerResults([])
      setLiveShowItemPicker(false)
      return
    }
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/items/search?q=${encodeURIComponent(liveItemPickerQuery)}`)
        const results = await r.json()
        setLiveItemPickerResults(Array.isArray(results) ? results : [])
        setLiveShowItemPicker(true)
      } catch (e) {
        setLiveItemPickerResults([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [liveItemPickerQuery])

  // Count sales by item (all historical taps)
  const liveToday = new Date().toISOString().slice(0, 10)
  const liveSalesCounts = useMemo(() => {
    const counts = new Map<number, number>()
    for (const tap of liveTaps) {
      if (!tap.undone) {
        counts.set(tap.item_id, (counts.get(tap.item_id) ?? 0) + tap.quantity)
      }
    }
    return counts
  }, [liveTaps])

  // Options for Sale mode's own item-grid filter (liveSaleFilter above) --
  // Loss/Gain/Low SOH plus one per count-interval label currently in use,
  // same buckets and sort order as the Count tab's liveCountIntervalFlags so
  // the two read consistently even though they're built for different modes.
  const liveSaleFilterFlags = useMemo(() => {
    // Apply product type and group filters first so counts reflect actual available items
    let baseFiltered = [...liveAllItems]
    if (liveProductTypeFilter === 'goods') {
      baseFiltered = baseFiltered.filter(item => item.product_type !== 'service')
    } else if (liveProductTypeFilter === 'services') {
      baseFiltered = baseFiltered.filter(item => item.product_type === 'service')
    }
    if (liveGroupFilter !== null) {
      baseFiltered = baseFiltered.filter(item => item.group === liveGroupFilter)
    }

    const lossCount = baseFiltered.filter(it => (liveLossByItemId.get(it.id)?.lossCount ?? 0) > 0).length
    const gainCount = baseFiltered.filter(it => (liveLossByItemId.get(it.id)?.gainCount ?? 0) > 0).length
    const sohCount = baseFiltered.filter(it => it.soh <= 0).length

    const negativeStockCount = baseFiltered.filter(it => it.product_type !== 'service' && Number(it.soh) < 0).length
    const duplicateCount = baseFiltered.filter(it => liveDuplicateItemIds.has(it.id)).length
    const serviceViolationCount = baseFiltered.filter(it => liveServiceViolationIdSet.has(it.id)).length
    const unlinkedCount = baseFiltered.filter(it => liveUnlinkedNamedIds.has(it.id)).length
    const missingSellingPriceCount = baseFiltered.filter(it => (parseFloat(String(it.selling_price)) || 0) <= 0).length
    const missingCostPriceCount = baseFiltered.filter(it => (parseFloat(String(it.cost_price)) || 0) <= 0).length
    const missingGroupCount = baseFiltered.filter(it => !it.group).length

    const intervalCounts = new Map<string, number>()
    for (const it of baseFiltered) {
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
      { key: 'flag_negative_stock', label: '⚠ Negative Stock', count: negativeStockCount },
      { key: 'flag_duplicate', label: '⚠ Duplicate Item', count: duplicateCount },
      { key: 'flag_service_violation', label: '⚠ Service Violation', count: serviceViolationCount },
      { key: 'flag_unlinked', label: '⚠ Unlinked Sale', count: unlinkedCount },
      { key: 'flag_missing_selling_price', label: '⚠ Missing Selling Price', count: missingSellingPriceCount },
      { key: 'flag_missing_cost_price', label: '⚠ Missing Cost Price', count: missingCostPriceCount },
      { key: 'flag_missing_group', label: '⚠ Missing Group', count: missingGroupCount },
    ]
  }, [liveAllItems, liveLossByItemId, liveProductTypeFilter, liveGroupFilter, liveDuplicateItemIds, liveServiceViolationIdSet, liveUnlinkedNamedIds])

  // Filter and sort items based on current view and product type
  const liveCatalogueItems = useMemo(() => {
    if (liveAllItems.length === 0) return []

    let filtered = [...liveAllItems]

    // If an item is picked, show ONLY that item
    if (livePickedItemId !== null) {
      filtered = filtered.filter(item => item.id === livePickedItemId)
      return filtered
    }

    // Apply product type filter
    if (liveProductTypeFilter === 'goods') {
      filtered = filtered.filter(item => item.product_type !== 'service')
    } else if (liveProductTypeFilter === 'services') {
      filtered = filtered.filter(item => item.product_type === 'service')
    }

    // Apply group filter
    if (liveGroupFilter !== null) {
      filtered = filtered.filter(item => item.group === liveGroupFilter)
    }

    // GMC (internal use) only ever taps items with a GMC history -- keeps
    // the browse grid from offering a normal walk-in item under an
    // internal-use receipt. Doesn't apply to a deliberately searched-and-
    // picked item above, since that's how an item gets its first-ever GMC
    // record in the first place.
    if (liveMode === 'sale' && liveSaleType === 'GMC') {
      filtered = filtered.filter(item => liveGmcItemIds.has(item.id))
    }

    // Apply Sale mode's own Loss/Gain/SOH/count-interval/flag filter
    if (liveSaleFilter?.kind === 'loss') {
      filtered = filtered.filter(item => (liveLossByItemId.get(item.id)?.lossCount ?? 0) > 0)
    } else if (liveSaleFilter?.kind === 'gain') {
      filtered = filtered.filter(item => (liveLossByItemId.get(item.id)?.gainCount ?? 0) > 0)
    } else if (liveSaleFilter?.kind === 'soh') {
      filtered = filtered.filter(item => item.soh <= 0)
    } else if (liveSaleFilter?.kind === 'interval') {
      filtered = filtered.filter(item => item.count_interval === liveSaleFilter.label)
    } else if (liveSaleFilter?.kind === 'flag') {
      const key = liveSaleFilter.key
      if (key === 'flag_negative_stock') {
        filtered = filtered.filter(item => item.product_type !== 'service' && Number(item.soh) < 0)
      } else if (key === 'flag_duplicate') {
        filtered = filtered.filter(item => liveDuplicateItemIds.has(item.id))
      } else if (key === 'flag_service_violation') {
        filtered = filtered.filter(item => liveServiceViolationIdSet.has(item.id))
      } else if (key === 'flag_unlinked') {
        filtered = filtered.filter(item => liveUnlinkedNamedIds.has(item.id))
      } else if (key === 'flag_missing_selling_price') {
        filtered = filtered.filter(item => (parseFloat(String(item.selling_price)) || 0) <= 0)
      } else if (key === 'flag_missing_cost_price') {
        filtered = filtered.filter(item => (parseFloat(String(item.cost_price)) || 0) <= 0)
      } else if (key === 'flag_missing_group') {
        filtered = filtered.filter(item => !item.group)
      }
    }

    // Apply view filter
    if (liveCurrentView?.kind === 'serviceGroup' && liveCurrentView.group) {
      filtered = filtered.filter(item => item.group === liveCurrentView.group)
    } else if (liveCurrentView?.kind === 'violation' && liveCurrentView.key) {
      // Filter items by violation type using pre-computed violation data
      const violationItemIds = (liveItemsWithViolations as Record<string, number[]>)[liveCurrentView.key]
      if (violationItemIds) {
        filtered = filtered.filter(item => violationItemIds.includes(item.id))
      } else {
        filtered = []
      }
    } else if (liveCurrentView?.kind === 'lossByItem') {
      // Sort by loss amount when viewing loss by item
      return filtered.sort((a, b) => {
        const lossA = Math.abs(Number(a.selling_price || 0) - Number(a.cost_price || 0))
        const lossB = Math.abs(Number(b.selling_price || 0) - Number(b.cost_price || 0))
        return lossB - lossA
      })
    }

    // Sort by sales count (highest to lowest)
    return filtered.sort((a, b) => (liveSalesCounts.get(b.id) ?? 0) - (liveSalesCounts.get(a.id) ?? 0))
  }, [liveAllItems, liveSalesCounts, liveCurrentView, liveProductTypeFilter, liveGroupFilter, livePickedItemId, liveSaleType, liveGmcItemIds, liveMode, liveSaleFilter, liveLossByItemId, liveItemsWithViolations, liveDuplicateItemIds, liveServiceViolationIdSet, liveUnlinkedNamedIds])

  // Log tab's two histories, grouped by date -- computed unconditionally
  // (not inside an `if (liveMode === 'log')` branch) since every mode
  // renders from the same mounted component instance, switched by
  // liveMode; a useMemo that only ran while liveMode==='log' would change
  // the hook count the moment you switched tabs and crash the page.
  const liveTapsByDate = useMemo(() => {
    const groups = new Map<string, typeof liveTaps>()
    for (const tap of liveTaps) {
      const date = tap.tapped_at.slice(0, 10)
      if (!groups.has(date)) groups.set(date, [])
      groups.get(date)!.push(tap)
    }
    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a))
  }, [liveTaps])

  // Shop open/close bounds for the Log tab's Gap column -- only fetched
  // while Log is actually being looked at (same "not until it's viewed"
  // treatment as Count Records below), and only for dates not already
  // fetched, so switching back to Log after the first time doesn't refetch
  // every date again.
  useEffect(() => {
    if (liveMode !== 'log') return
    const dates = liveTapsByDate.map(([date]) => date).filter(d => !(d in liveDayBounds))
    if (!dates.length) return
    fetch(`/api/staff-times/day-bounds?dates=${dates.join(',')}`)
      .then(r => r.json())
      .then((d: { date: string; openTime: string | null; closeTime: string | null }[]) => {
        if (!Array.isArray(d)) return
        setLiveDayBounds(prev => {
          const next = { ...prev }
          for (const row of d) next[row.date] = { openTime: row.openTime, closeTime: row.closeTime }
          return next
        })
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveMode, liveTapsByDate])

  const liveCountsByDate = useMemo(() => {
    const q = liveEmbeddedSearch.trim().toLowerCase()
    const filtered = liveCountRecords.filter(rec => {
      if (liveCountRecordFilter === 'loss' && rec.kind !== 'loss') return false
      if (liveCountRecordFilter === 'gain' && rec.kind !== 'gain') return false
      if (q && !rec.item_name.toLowerCase().includes(q)) return false
      return true
    })
    const groups = new Map<string, typeof liveCountRecords>()
    for (const rec of filtered) {
      const date = rec.count_date.slice(0, 10)
      if (!groups.has(date)) groups.set(date, [])
      groups.get(date)!.push(rec)
    }
    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a))
  }, [liveCountRecords, liveCountRecordFilter, liveEmbeddedSearch])

  // All-Time/Yesterday/This Week/Month/Year loss totals -- same period
  // summary the old Loss by Date tab pinned above its own table, computed
  // from every record regardless of liveCountRecordFilter/search so it
  // always reads as the whole picture, not whatever's currently filtered
  // in view.
  const liveCountLossSummary = useMemo(() => {
    const fmtLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const today0 = new Date(); today0.setHours(0, 0, 0, 0)
    const y = new Date(today0); y.setDate(y.getDate() - 1)
    const weekStart = new Date(today0); weekStart.setDate(weekStart.getDate() - ((today0.getDay() + 6) % 7))
    const monthStart = `${today0.getFullYear()}-${String(today0.getMonth() + 1).padStart(2, '0')}-01`
    const yearStart = `${today0.getFullYear()}-01-01`
    const yesterday = fmtLocal(y), ws = fmtLocal(weekStart)
    const losses = liveCountRecords.filter(r => r.kind === 'loss')
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
  }, [liveCountRecords])

  // Sale mode's own due-count callout -- staff mostly live in Sale mode, so
  // a due item needs to be visible right there instead of requiring a trip
  // to a separate count screen. Pinned as its own block at the very top
  // (not interleaved into the sales-frequency order below it), so the
  // normal most-sold-first list staff rely on for fast tapping never
  // reshuffles just because something unrelated went overdue.
  const [livePinnedDueItems, liveRestCatalogueItems] = useMemo(() => {
    if (liveMode !== 'sale') return [[], liveCatalogueItems] as [LiveItem[], LiveItem[]]
    const due: LiveItem[] = []
    const rest: LiveItem[] = []
    for (const item of liveCatalogueItems) {
      if (liveCountStatus.has(item.id)) due.push(item)
      else rest.push(item)
    }
    const urgency = (item: LiveItem) => {
      const d = liveCountStatus.get(item.id)!
      const n = parseInt(d.label, 10)
      return (d.level === 'overdue' ? 1000 : 0) + (isNaN(n) ? 0 : n)
    }
    due.sort((a, b) => urgency(b) - urgency(a))

    // Split rest into flagged (multiple), flagged (single), and unflagged
    const multipleFlags: LiveItem[] = []
    const singleFlag: LiveItem[] = []
    const noFlags: LiveItem[] = []
    for (const item of rest) {
      const flags = itemAttentionFlags(item, liveDuplicateItemIds, liveUnlinkedNamedIds, liveServiceViolationIdSet)
      if (flags.length > 1) multipleFlags.push(item)
      else if (flags.length === 1) singleFlag.push(item)
      else noFlags.push(item)
    }
    // Sort each group by sales count (highest first)
    const sortBySales = (a: LiveItem, b: LiveItem) => (liveSalesCounts.get(b.id) ?? 0) - (liveSalesCounts.get(a.id) ?? 0)
    multipleFlags.sort(sortBySales)
    singleFlag.sort(sortBySales)
    noFlags.sort(sortBySales)

    const restSorted = [...multipleFlags, ...singleFlag, ...noFlags]
    return [due, restSorted] as [LiveItem[], LiveItem[]]
  }, [liveCatalogueItems, liveCountStatus, liveMode, liveDuplicateItemIds, liveUnlinkedNamedIds, liveServiceViolationIdSet, liveSalesCounts])

  async function recordTap() {
    if (!liveSelectedItem || !liveQty) return
    setLiveSaving(true)
    setLiveTapError('')

    const qtyNum = Number(liveQty)
    const priceNum = livePrice ? Number(livePrice) : Number(liveSelectedItem.selling_price)

    if (qtyNum <= 0) {
      setLiveTapError('Quantity must be greater than 0')
      setLiveSaving(false)
      return
    }

    if (priceNum <= 0) {
      setLiveTapError('Price must be greater than 0')
      setLiveSaving(false)
      return
    }

    try {
      const res = await fetch('/api/sales/live-tap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: liveSelectedItem.id,
          quantity: qtyNum,
          customPrice: livePrice ? priceNum : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setLiveTapError(data.error || 'Could not record tap')
        setLiveSaving(false)
        return
      }
      setLiveTaps(prev => [data.tap, ...prev])
      setLiveSelectedItem(null)
      setLiveQty('')
      setLivePrice('')
    } catch (e) {
      setLiveTapError('Network error')
    } finally {
      setLiveSaving(false)
    }
  }

  async function undoTap(tapId: number) {
    try {
      const res = await fetch(`/api/sales/live-taps/${tapId}?action=undo`, { method: 'POST' })
      if (res.ok) {
        setLiveTaps(prev => prev.map(t => t.id === tapId ? { ...t, undone: true } : t))
      } else {
        setLiveTapError('Could not undo tap')
      }
    } catch (e) {
      setLiveTapError('Could not undo tap')
    }
  }

  // Same /api/stock/count contract CountsTab's own CountRow/ManualCountForm
  // already submit through -- a pack-pairing or loss-reason requirement
  // comes back as a 409 with a flag the caller re-submits against once the
  // prompt is answered, not a plain error, so this mirrors that retry shape
  // exactly rather than reinventing it. Used by the inline "Count today's
  // stock" field the Sale sheet grows for a due item (see the modal below).
  async function submitCount(item: LiveItem, qty: number, lossExtra?: LossExtra) {
    setLiveCountSaving(true)
    setLiveCountError('')
    const res = await fetch('/api/stock/count', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.id, qty, notes: '', ...(lossExtra ?? {}) }),
    })
    setLiveCountSaving(false)
    if (res.ok) {
      setLiveDailyItems(prev => prev.filter(i => i.item_id !== item.id))
      setLiveGmcWeeklyItems(prev => prev.filter(i => i.item_id !== item.id))
      setLiveOverdueItems(prev => prev.filter(i => i.item_id !== item.id))
      setLiveCountQty('')
      return
    }
    const d = await res.json().catch(() => null)
    if (res.status === 409 && d?.requires_pack_count) {
      setLivePairingPrompt({ itemName: item.name, packs: d.packs, retry: () => submitCount(item, qty, lossExtra) })
      return
    }
    if (res.status === 409 && d?.requires_loss_reason) {
      setLiveLossPrompt({ d, retry: extra => submitCount(item, qty, extra) })
      return
    }
    setLiveCountError(d?.error ?? 'Could not save count.')
  }

  // Groups/conversion-target list ItemEditForm needs, derived from the
  // catalogue Live Sale already has loaded rather than a separate fetch.
  const liveEditGroups = useMemo(() =>
    Array.from(new Set(liveAllItems.map(i => i.group).filter((g): g is string => !!g))).sort()
  , [liveAllItems])
  const liveEditAllItemsList = useMemo(() =>
    liveAllItems.map(i => ({ item_id: i.id, item_name: i.name }))
  , [liveAllItems])

  // The sale-tap sheet's own Item fields don't carry cf_group/units_per_pack/
  // unit_name/converts_to_item_id/count_excluded/count_cadence_days (not
  // needed for tapping a sale), so opening the edit form fetches the full
  // item record the same way LossTab's ItemEditForm does.
  async function startEditSelectedItem() {
    if (!liveSelectedItem) return
    setLiveEditingSelectedItem(true)
    setLiveEditError('')
    setLiveEditLoading(true)
    setLiveEditCurrentCountInterval(null)
    setLiveEditCurrentSoh(null)
    setLiveCountQty('')
    setLiveCountError('')
    try {
      const r = await fetch(`/api/items/${liveSelectedItem.id}`)
      const d = await r.json()
      setLiveEditForm({
        item_name: d?.canonical_name ?? liveSelectedItem.name,
        cf_group: d?.cf_group ?? '',
        selling_rate: d?.selling_price != null ? String(d.selling_price) : '',
        purchase_rate: d?.purchase_rate != null ? String(d.purchase_rate) : '',
        units_per_pack: d?.units_per_pack != null ? String(d.units_per_pack) : '',
        unit_name: d?.unit_name ?? '',
        converts_to_item_id: d?.converts_to_item_id ? String(d.converts_to_item_id) : '',
        count_excluded: !!d?.count_excluded,
        count_cadence_days: d?.count_cadence_days != null ? String(d.count_cadence_days) : '',
        count_excluded_reason: d?.count_excluded_reason ?? '',
        is_gmc: !!d?.is_gmc,
      })
      setLiveEditCurrentCountInterval(d?.count_interval ?? null)
      setLiveEditCurrentSoh(d?.calculated_soh != null ? parseFloat(d.calculated_soh) : null)
    } catch {
      setLiveEditError('Could not load item details.')
    }
    setLiveEditLoading(false)
  }

  async function openEditGridItem(itemId: number) {
    setLiveEditingGridItemId(itemId)
    setLiveGridEditError('')
    setLiveGridEditLoading(true)
    setLiveGridEditConfirmDelete(false)
    try {
      const item = liveAllItems.find(i => i.id === itemId)
      if (!item) {
        setLiveGridEditError('Item not found')
        setLiveGridEditLoading(false)
        return
      }

      // Fetch all data in parallel
      const [itemRes, aliasesRes, matchesRes] = await Promise.all([
        fetch(`/api/items/${itemId}`),
        fetch('/api/aliases/wide'),
        fetch('/api/good-service-matches')
      ])

      const d = await itemRes.json()
      setLiveEditForm({
        item_name: d?.canonical_name ?? item.name,
        cf_group: d?.cf_group ?? '',
        selling_rate: d?.selling_price != null ? String(d.selling_price) : '',
        purchase_rate: d?.purchase_rate != null ? String(d.purchase_rate) : '',
        units_per_pack: d?.units_per_pack != null ? String(d.units_per_pack) : '',
        unit_name: d?.unit_name ?? '',
        converts_to_item_id: d?.converts_to_item_id ? String(d.converts_to_item_id) : '',
        count_excluded: !!d?.count_excluded,
        count_cadence_days: d?.count_cadence_days != null ? String(d.count_cadence_days) : '',
        count_excluded_reason: d?.count_excluded_reason ?? '',
        is_gmc: !!d?.is_gmc,
      })
      setLiveEditCurrentCountInterval(d?.count_interval ?? null)
      setLiveEditCurrentSoh(d?.calculated_soh != null ? parseFloat(d.calculated_soh) : null)

      const aliasesData = await aliasesRes.json()
      if (Array.isArray(aliasesData)) {
        const itemAliases = aliasesData.find((row: any) => row.item_id === itemId)
        const aliases = itemAliases?.aliases ?? []
        setLiveGridEditAliases(aliases.map((a: any) => ({ id: a.id, name: a.name })).filter((a: AliasRecord) => a.name))
      }

      const matchesData = await matchesRes.json()
      if (Array.isArray(matchesData)) {
        const itemName = item.name.trim().toLowerCase()
        const itemMatches = matchesData.filter((row: any) => {
          const gk = (row.good_name ?? '').trim().toLowerCase()
          const sk = (row.service_name ?? '').trim().toLowerCase()
          return gk === itemName || sk === itemName
        })
        setLiveGridEditMatches(itemMatches.map((m: any) => ({ id: m.id, name: m.good_name === item.name ? m.service_name : m.good_name })))
      }
    } catch {
      setLiveGridEditError('Could not load item details.')
    }
    setLiveGridEditLoading(false)
  }

  async function deleteGridEditItem() {
    if (!liveEditingGridItemId) return
    setLiveGridEditDeleting(true)
    setLiveGridEditDeleteError('')
    const res = await fetch(`/api/items/${liveEditingGridItemId}`, { method: 'DELETE' })
    const d = await res.json().catch(() => ({}))
    setLiveGridEditDeleting(false)
    if (res.ok) {
      setLiveEditingGridItemId(null)
      setLiveGridEditConfirmDelete(false)
    } else {
      setLiveGridEditDeleteError(d.error || 'Could not delete item.')
    }
  }

  async function recordCountFromModal() {
    if (!liveEditingGridItemId || !liveGridEditCountQty) return
    setLiveGridEditCountSaving(true)
    setLiveGridEditCountError('')

    const qtyNum = Number(liveGridEditCountQty)
    const priceNum = liveGridEditCountPrice ? Number(liveGridEditCountPrice) : undefined
    const editItem = liveAllItems.find(i => i.id === liveEditingGridItemId)
    const defaultPrice = editItem ? Number(editItem.selling_price) : 0

    if (qtyNum <= 0) {
      setLiveGridEditCountError('Quantity must be greater than 0')
      setLiveGridEditCountSaving(false)
      return
    }

    if (priceNum !== undefined && priceNum <= 0) {
      setLiveGridEditCountError('Price must be greater than 0')
      setLiveGridEditCountSaving(false)
      return
    }

    try {
      const res = await fetch('/api/sales/live-tap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: liveEditingGridItemId,
          quantity: qtyNum,
          customPrice: priceNum || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setLiveGridEditCountError(data.error || 'Could not record count')
        setLiveGridEditCountSaving(false)
        return
      }
      setLiveTaps(prev => [data.tap, ...prev])
      setLiveGridEditCountQty('')
      setLiveGridEditCountPrice('')
    } catch (e) {
      setLiveGridEditCountError('Network error')
    } finally {
      setLiveGridEditCountSaving(false)
    }
  }

  async function saveEditSelectedItem() {
    if (!liveSelectedItem) return
    setLiveEditSaving(true)
    setLiveEditError('')
    const res = await fetch(`/api/items/${liveSelectedItem.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_name: liveEditForm.item_name || undefined,
        cf_group: liveEditForm.cf_group || null,
        selling_rate: liveEditForm.selling_rate ? parseFloat(liveEditForm.selling_rate) : null,
        purchase_rate: liveEditForm.purchase_rate ? parseFloat(liveEditForm.purchase_rate) : null,
        units_per_pack: liveEditForm.units_per_pack ? parseFloat(liveEditForm.units_per_pack) : null,
        unit_name: liveEditForm.unit_name || null,
        converts_to_item_id: liveEditForm.converts_to_item_id ? Number(liveEditForm.converts_to_item_id) : null,
        count_excluded: liveEditForm.count_excluded,
        count_cadence_days: liveEditForm.count_cadence_days ? parseInt(liveEditForm.count_cadence_days, 10) : null,
        count_excluded_reason: liveEditForm.count_excluded_reason || null,
      }),
    })
    setLiveEditSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => null)
      setLiveEditError(d?.error ?? 'Could not save changes.')
      return
    }
    const updated = await res.json()
    const itemId = liveSelectedItem.id
    setLiveSelectedItem(prev => prev && prev.id === itemId ? {
      ...prev,
      name: updated.item_name ?? prev.name,
      selling_price: updated.selling_rate ?? prev.selling_price,
      cost_price: updated.purchase_rate ?? prev.cost_price,
    } : prev)
    // Refetch the full catalogue so this item's price/group/count-interval
    // label update everywhere else in Live Sale (grid, other views), not
    // just inside this sheet.
    fetch('/api/items/all').then(r => r.json()).then(d => setLiveAllItems(Array.isArray(d) ? d : [])).catch(() => {})
    setLiveEditingSelectedItem(false)
  }

  // Same edit/delete pair Counts' own list already offers -- kept here so
  // fixing or removing a count record doesn't require leaving Live Sale
  // just because that mode still also exists.
  function startEditCount(r: CountRecord) {
    setLiveEditCountQty(String(r.quantity_counted))
    setLiveEditCountNotes(r.notes ?? '')
    setLiveEditingCountId(r.id)
  }

  async function saveEditCount(lossExtra?: LossExtra) {
    if (liveEditingCountId == null) return
    setLiveEditCountSaving(true)
    const res = await fetch(`/api/stock/counts/${liveEditingCountId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity_counted: Number(liveEditCountQty), notes: liveEditCountNotes, ...(lossExtra ?? {}) }),
    })
    setLiveEditCountSaving(false)
    if (res.ok) {
      const updated: CountRecord = await res.json()
      setLiveCountRecords(prev => prev.map(r => r.id === liveEditingCountId ? { ...r, ...updated } : r))
      setLiveEditingCountId(null)
    } else {
      const d = await res.json().catch(() => null)
      if (res.status === 409 && d?.requires_loss_reason) {
        setLiveLossPrompt({ d, retry: extra => saveEditCount(extra) })
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
      setLiveCountRecords(prev => prev.filter(x => x.id !== r.id))
      if (liveEditingCountId === r.id) setLiveEditingCountId(null)
    } else {
      alert((await res.json().catch(() => null))?.error ?? 'Could not delete count.')
    }
  }

  // The tab switcher for Items page internal navigation -- allows switching
  // between the items table and Live Sale modes without changing the sidebar.
  function renderTabSwitcher(compact: boolean) {
    const btnCls = (active: boolean, color: string) =>
      `font-bold rounded-md transition whitespace-nowrap shrink-0 ${compact ? 'px-1.5 py-1 text-[10px]' : 'px-2 py-1 text-xs'} ${
        active ? `${color} text-white` : 'text-gray-500 hover:text-gray-700'
      }`
    // Always one line -- scrolls horizontally rather than wrapping onto a
    // second row when there isn't room for all buttons.
    return (
      <div className="flex bg-gray-200 rounded-lg p-0.5 overflow-x-auto max-w-full">
        <button type="button" onClick={() => { setItemsPageMode('sale'); setLiveMode('sale') }} title="Sale" className={btnCls(itemsPageMode === 'sale', 'bg-blue-600')}>Sale</button>
        <button type="button" onClick={() => { setItemsPageMode('log'); setLiveMode('log') }} title="Log" className={btnCls(itemsPageMode === 'log', 'bg-gray-700')}>Log</button>
        <button type="button" onClick={() => { setItemsPageMode('sales'); setLiveMode('sales') }} title="Sales" className={btnCls(itemsPageMode === 'sales', 'bg-emerald-600')}>Sales</button>
        <button type="button" onClick={() => { setItemsPageMode('bills'); setLiveMode('bills') }} title="Bills" className={btnCls(itemsPageMode === 'bills', 'bg-orange-600')}>Bills</button>
        <button type="button" onClick={() => { setItemsPageMode('lossByTarget'); setLiveMode('lossByTarget') }} title="Loss by Target" className={btnCls(itemsPageMode === 'lossByTarget', 'bg-pink-600')}>Loss by Tgt</button>
        <button type="button" onClick={() => { setItemsPageMode('count'); setLiveMode('count') }} title="Count" className={btnCls(itemsPageMode === 'count', 'bg-indigo-600')}>Count</button>
      </div>
    )
  }

  // Deprecated: use renderTabSwitcher instead. Kept for any remaining references.
  function renderModeToggle(compact: boolean) {
    return renderTabSwitcher(compact)
  }

  // The switcher's permanent home -- its own top row, above every mode's own
  // header/filter bar, identical on all six modes. Rendered compactly in
  // this component's own top green bar instead (see the mode-toggle spot
  // below) while liveExpanded is false; while liveExpanded is true that bar
  // sits visually hidden behind Live Sale's own `fixed inset-0` overlay
  // (see liveRootClassName), so each mode's own content renders this full
  // row up top instead.
  function renderModeToggleRow() {
    return (<>
      {liveExpanded && (
        <div className="px-2 py-1.5 border-b border-gray-200 bg-gray-50 overflow-x-auto shrink-0">
          {renderModeToggle(false)}
        </div>
      )}
    </>)
  }

  // All filters bar -- type, group, sale filters available on all tabs
  function renderAllFiltersBar() {
    return (
      <div className="w-full flex items-center gap-2 px-2 py-1 bg-gray-100 border-b border-gray-200 flex-wrap">
        <select
          value={liveProductTypeFilter}
          onChange={e => setLiveProductTypeFilter(e.target.value as 'all' | 'goods' | 'services')}
          className="text-[10px] px-2 py-0.5 rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400 flex-1"
        >
          <option value="all">All</option>
          <option value="goods">Goods</option>
          <option value="services">Services</option>
        </select>
        <select
          value={liveGroupFilter || ''}
          onChange={e => setLiveGroupFilter(e.target.value || null)}
          className="text-[10px] px-2 py-0.5 rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400 flex-1"
        >
          <option value="">Groups</option>
          {liveGroups.map(g => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <select
          value={liveSaleFilter ? liveSaleFilter.kind === 'interval' ? `interval:${liveSaleFilter.label}` : liveSaleFilter.kind === 'flag' ? `flag:${liveSaleFilter.key}` : liveSaleFilter.kind : liveCurrentView?.kind === 'violation' ? `violation:${liveCurrentView.key}` : liveCurrentView?.kind === 'aliasWide' ? 'view:aliasWide' : liveCurrentView?.kind === 'serviceMatches' ? 'view:serviceMatches' : ''}
          onChange={e => {
            const v = e.target.value
            if (!v) {
              setLiveSaleFilter(null)
              setLiveCurrentView(null)
            } else if (v.startsWith('interval:')) {
              setLiveCurrentView(null)
              setLiveSaleFilter({ kind: 'interval', label: v.slice('interval:'.length) })
            } else if (v.startsWith('violation:')) {
              setLiveSaleFilter(null)
              const violationKey = v.slice('violation:'.length)
              setLiveCurrentView({ kind: 'violation' as const, key: violationKey })
            } else if (v.startsWith('flag:')) {
              setLiveCurrentView(null)
              setLiveSaleFilter({ kind: 'flag', key: v.slice('flag:'.length) })
            } else if (v.startsWith('view:')) {
              setLiveSaleFilter(null)
              const viewKey = v.slice('view:'.length)
              if (viewKey === 'aliasWide') setLiveCurrentView({ kind: 'aliasWide' as const })
              else if (viewKey === 'serviceMatches') setLiveCurrentView({ kind: 'serviceMatches' as const })
            } else {
              setLiveCurrentView(null)
              setLiveSaleFilter({ kind: v as 'loss' | 'gain' | 'soh' })
            }
          }}
          className="text-[10px] px-2 py-0.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white flex-1"
        >
          <option value="">Filter</option>
          {liveSaleFilterFlags.filter(f => !f.key.startsWith('flag_')).map(f => {
            let value = f.key
            if (f.key.startsWith('interval_')) value = `interval:${f.label}`
            return (
              <option key={f.key} value={value}>
                {f.label} ({f.count})
              </option>
            )
          })}
          <optgroup label="Items">
            {ITEMS_FLAG_TYPES.map(f => (
              <option key={f.key} value={`violation:${f.key}`}>
                {f.label} ({(liveItemsWithViolations as Record<string, number[]>)[f.key]?.length ?? 0})
              </option>
            ))}
          </optgroup>
          <optgroup label="Views">
            <option value="view:aliasWide">Alias Wide Table</option>
            <option value="view:serviceMatches">Service Matches</option>
            <option value="view:gmcPacks">GMC Packs</option>
          </optgroup>
        </select>
      </div>
    )
  }

  // The count records table -- also doubles as the old Loss by Date feed
  // (see liveCountRecordFilter/liveCountLossSummary above), since that was
  // always just this same stock_counts history with the reconciliation
  // columns (Expected/Loss-Gain) added and filtered to the discrepancy rows.
  function renderCountRecordsTable() {
    const COUNT_RECORDS_GRID = 'grid-cols-[minmax(7rem,1.4fr)_5rem_3rem_4rem_4rem_4rem_5rem_4rem_minmax(6rem,1fr)_5.5rem]'
    return (
      <div className="flex-1 overflow-auto">
        {liveCountsByDate.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            {liveCountRecords.length === 0 ? 'No counts recorded' : 'No counts match the current filter/search'}
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
            {liveCountsByDate.map(([date, dateRecs]) => (
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
                            onClick={() => liveEditingCountId === rec.id ? setLiveEditingCountId(null) : startEditCount(rec)}
                            className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded-full hover:bg-blue-100 transition"
                          >
                            {liveEditingCountId === rec.id ? 'Close' : 'Edit'}
                          </button>
                          {liveCanDeleteCounts && (
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
                    {liveEditingCountId === rec.id && (
                      <div className="bg-blue-50/60 border-b border-gray-100 px-4 py-3 flex items-end gap-3 flex-wrap">
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Qty Counted</p>
                          <input
                            type="number" min="0" step="any"
                            value={liveEditCountQty}
                            onChange={e => setLiveEditCountQty(e.target.value)}
                            className="w-28 bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Notes</p>
                          <input
                            value={liveEditCountNotes}
                            onChange={e => setLiveEditCountNotes(e.target.value)}
                            placeholder="Optional"
                            className="w-48 bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => saveEditCount()}
                            disabled={liveEditCountSaving}
                            className="bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-lg px-4 py-1.5 disabled:opacity-40 transition"
                          >
                            {liveEditCountSaving ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setLiveEditingCountId(null)}
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

  // Item search box + "Clear Item" + WIC/GMC toggle + Sale mode's own
  // Analytics button -- rendered compactly in this component's own footer
  // (in Biz/UK/C&H's usual spot) while liveExpanded is false, or as its own
  // full-size row up top of the Sale-mode content while liveExpanded is
  // true (see liveRootClassName's own comment -- the footer is visually
  // hidden behind the fullscreen overlay in that case). Only ever rendered
  // while liveMode === 'sale' (both call sites already gate on that), so
  // the WIC/GMC toggle and Analytics button below don't need their own
  // liveMode check the way the original LiveSaleForm's searchControlsNode
  // did (it was one shared function reachable from a slot the host could
  // in principle request from any mode).
  function renderLiveSearchControls(compact: boolean) {
    const pickedItem = livePickedItemId !== null ? liveAllItems.find(i => i.id === livePickedItemId) : null
    const displayValue = pickedItem ? pickedItem.name : liveItemPickerQuery
    return (
      <>
        <div className="relative flex-1 min-w-0">
          <input
            type="text"
            value={displayValue}
            onChange={e => {
              if (pickedItem) {
                setLivePickedItemId(null)
                setLiveItemPickerQuery(e.target.value)
              } else {
                setLiveItemPickerQuery(e.target.value)
              }
            }}
            onFocus={() => {
              if (pickedItem) {
                setLivePickedItemId(null)
                setLiveItemPickerQuery('')
              } else if (liveItemPickerQuery.trim()) {
                setLiveShowItemPicker(true)
              }
            }}
            placeholder={compact ? 'Search item…' : 'Search & pick item…'}
            className={`border focus:outline-none focus:ring-1 w-full pr-7 ${
              compact ? 'text-[11px] px-2 py-1 rounded-md bg-white' : 'text-sm px-3 py-1.5 w-32 sm:w-48 rounded-lg'
            } ${
              livePickedItemId !== null
                ? 'border-green-400 bg-green-50 focus:ring-green-400'
                : 'border-gray-300 focus:ring-blue-400'
            }`}
          />
          {(liveItemPickerQuery || livePickedItemId !== null) && (
            <span
              onClick={() => {
                setLiveItemPickerQuery('')
                setLiveItemPickerResults([])
                setLiveShowItemPicker(false)
                setLivePickedItemId(null)
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer text-sm"
            >
              ✕
            </span>
          )}
          {liveShowItemPicker && liveItemPickerResults.length > 0 && (
            <div className={`absolute top-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto ${
              compact ? 'left-0 w-56' : 'left-0 right-0'
            }`}>
              {liveItemPickerResults.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setLivePickedItemId(item.id)
                    setLiveItemPickerQuery('')
                    setLiveShowItemPicker(false)
                  }}
                  className="w-full text-left px-2 py-1 hover:bg-green-50 border-b border-gray-100 last:border-b-0 text-[11px] text-gray-700 flex items-center justify-between gap-2"
                >
                  <span className="font-semibold text-gray-900 truncate">{item.name}</span>
                  <span className="text-[9px] text-gray-500 shrink-0">₵{formatPrice(item.selling_price)} S:{Math.ceil(Number(item.soh))}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {livePickedItemId !== null && (
          <button
            type="button"
            onClick={() => {
              setLivePickedItemId(null)
              setLiveItemPickerQuery('')
            }}
            className={`font-semibold bg-green-600 text-white hover:bg-green-700 transition ${
              compact ? 'px-1 py-0.5 text-[10px] rounded-md' : 'px-2 py-1.5 text-sm rounded-lg'
            }`}
          >
            {compact ? '✕ Item' : 'Clear Item'}
          </button>
        )}
        <button
          type="button"
          onClick={() => setLiveSaleType(t => t === 'WIC' ? 'GMC' : 'WIC')}
          title="Tap to switch between WIC and GMC"
          className={`font-semibold transition shrink-0 ${compact ? 'px-2 py-1 text-[10px] rounded-md' : 'px-4 py-1.5 text-sm rounded'} ${
            liveSaleType === 'GMC'
              ? 'bg-purple-600 text-white'
              : 'bg-blue-600 text-white'
          }`}
        >
          {liveSaleType}
        </button>
        <button
          type="button"
          onClick={() => setSaleModeShowAnalytics(a => !a)}
          title="Analytics"
          className={`shrink-0 font-bold transition ${compact ? 'px-2 py-1 text-sm rounded-md' : 'px-2.5 py-1 text-xs rounded-lg'} ${
            saleModeShowAnalytics ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          📊
        </button>
      </>
    )
  }

  // Sale mode's own item-grid filter (Loss/Gain/Low SOH/count interval, see
  // liveSaleFilterFlags) -- `compact` picks which of the two sizes the old
  // LiveSaleForm used depending on where it rendered: the smaller one
  // (w-[4.5rem]) matches its standalone green filter bar (shown here only
  // while liveExpanded), the larger one matches what it portaled into the
  // host's own footer row (shown here while !liveExpanded).
  function renderLiveSaleFilterSelect(compact: boolean) {
    return (
      <select
        value={liveSaleFilter ? liveSaleFilter.kind === 'interval' ? `interval:${liveSaleFilter.label}` : liveSaleFilter.kind === 'flag' ? `flag:${liveSaleFilter.key}` : liveSaleFilter.kind : liveCurrentView?.kind === 'violation' ? `violation:${liveCurrentView.key}` : liveCurrentView?.kind === 'aliasWide' ? 'view:aliasWide' : liveCurrentView?.kind === 'serviceMatches' ? 'view:serviceMatches' : ''}
        onChange={e => {
          const v = e.target.value
          if (!v) {
            setLiveSaleFilter(null)
            setLiveCurrentView(null)
          } else if (v.startsWith('interval:')) {
            setLiveCurrentView(null)
            setLiveSaleFilter({ kind: 'interval', label: v.slice('interval:'.length) })
          } else if (v.startsWith('violation:')) {
            // Use the law icon's filtering mechanism for flag filters
            setLiveSaleFilter(null)
            const violationKey = v.slice('violation:'.length)
            setLiveCurrentView({ kind: 'violation' as const, key: violationKey })
          } else if (v.startsWith('flag:')) {
            setLiveCurrentView(null)
            setLiveSaleFilter({ kind: 'flag', key: v.slice('flag:'.length) })
          } else if (v.startsWith('view:')) {
            setLiveSaleFilter(null)
            const viewKey = v.slice('view:'.length)
            if (viewKey === 'aliasWide') setLiveCurrentView({ kind: 'aliasWide' as const })
            else if (viewKey === 'serviceMatches') setLiveCurrentView({ kind: 'serviceMatches' as const })
          } else {
            setLiveCurrentView(null)
            setLiveSaleFilter({ kind: v as 'loss' | 'gain' | 'soh' })
          }
        }}
        className={compact
          ? 'text-[10px] px-1 py-0.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white shrink-0'
          : 'text-xs px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white'}
      >
        <option value="">Filter</option>
        {liveSaleFilterFlags.filter(f => !f.key.startsWith('flag_')).map(f => {
          let value = f.key
          if (f.key.startsWith('interval_')) value = `interval:${f.label}`
          return (
            <option key={f.key} value={value}>
              {f.label} ({f.count})
            </option>
          )
        })}
        {/* Items violation flags - use ITEMS_FLAG_TYPES with violation filtering (same as law icons) */}
        <optgroup label="Items">
          {ITEMS_FLAG_TYPES.map(f => (
            <option key={f.key} value={`violation:${f.key}`}>
              {f.label} ({(liveItemsWithViolations as Record<string, number[]>)[f.key]?.length ?? 0})
            </option>
          ))}
        </optgroup>
        {/* Views for managing relationships */}
        <optgroup label="Views">
          <option value="view:aliasWide">Alias Wide Table</option>
          <option value="view:serviceMatches">Service Matches</option>
          <option value="view:gmcPacks">GMC Packs</option>
        </optgroup>
      </select>
    )
  }

  function renderLiveItemFlagsFilter() {
    // Get just the Items violation flags (first 7 from liveComputedFlags)
    const itemsFlags = liveComputedFlags.slice(0, ITEMS_FLAG_TYPES.length)
    return itemsFlags.map((flag: any) => (
      <button
        key={flag.key}
        onClick={flag.onViewClick}
        className={`text-[10px] px-2 py-1 rounded border transition whitespace-nowrap ${
          liveCurrentView?.kind === 'violation' && liveCurrentView.key === flag.key
            ? 'bg-blue-600 text-white border-blue-700'
            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}
        title={flag.description || ''}
      >
        {flag.label} ({flag.count})
      </button>
    ))
  }

  return (
    <div className="-mx-4 -mt-4 -mb-6 flex flex-col h-[100dvh] md:h-[calc(100dvh-56px)]">

      {/* ── Body ── No separate header row any more -- Grony Cash/UK/C&H
          (formerly the top tab row) and global search now live inside the
          pane's own footer instead (see below), so the pane itself reaches
          the very top of the screen. The pane is no longer Cash-specific
          either: it renders regardless of outerTab, so Today/UK/C&H all get
          it alongside their own content instead of losing all navigation
          the moment you leave Grony Cash. */}
      <div className="relative flex-1 min-h-0 flex overflow-hidden">
        {!sidePaneHidden && (
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
            <SidePaneToggle mode={cashDisplayMode} onChange={changeCashDisplayMode} label={session?.user?.name ?? username} onHide={() => setSidePaneHidden(true)} />

            {/* Cash/Manage/Staff's own rows only make sense while actually
                on that tab -- UK and C&H are separate areas with no
                relationship to any of these, so the list is just empty
                (toggle + View/Sign out only) while on either of them. */}
            {outerTab === 'loss' && (<>
            {canSeeCash && (
            <div>
              {applyPaneOrder(combinedCashItems, paneOrder.cash).filter(v => (v.key !== 'pl' || canSeePL) && !paneHidden[v.key]).map((v, i) => (
                <Fragment key={v.key}>
                  <SidePaneButton icon={v.icon} label={paneLabel(v.key, v.label)} mode={cashDisplayMode}
                    active={paneActive(cashItemActive(v.key))} divider={i > 0}
                    badge={v.key === 'sales' ? (salesFlagsCount + billsFlagsCount + countsFlagsCount + lossByDateFlagsCount)
                      : v.key === 'items' ? itemsFlagsCount
                      : v.key === 'cab' ? cabFlagsCount
                      : v.key === 'expenses' ? expensesFlagsCount
                      : v.key === 'customers' ? customersFlagsCount
                      : v.key === 'vendors' ? vendorsFlagsCount
                      : undefined}
                    taskBadge={taskCountFor(cashItemTaskScope(v.key))}
                    onClick={() => cashItemClick(v.key)} />
                </Fragment>
              ))}
              {/* Expense Orders */}
              <SidePaneButton icon="🧾" label="Expense Orders" mode={cashDisplayMode} divider
                active={paneActive(lossView === 'expenseOrders')}
                taskBadge={taskCountFor('Expense Orders')}
                onClick={() => pickLossView('expenseOrders')} />
            </div>
            )}

            {canSeeManage && (
            <div className="mt-1 pt-1 border-t border-white/30">
              {(() => {
                const orderedItems = applyPaneOrder(MANAGE_LIST_ITEMS, paneOrder.manage).filter(item => !paneHidden[item.key])
                const runs = buildPaneRuns(orderedItems)
                const flatRows = flattenPaneRuns(runs, MANAGE_GROUP_LABELS)
                return flatRows.map((row, idx) => {
                  const entry = row.item
                  const badge = entry.key === 'opener' ? openerBadgeCount
                    : entry.key === 'closer' ? (globalFlags?.missingClosingReports?.length ?? 0)
                    : entry.key === 'jingle' ? jingleFlagsCount
                    : entry.key === 'equipment' ? equipmentFlagsCount
                    : entry.key === 'audio_status' ? advertStatusFlagsCount
                    : undefined
                  return (
                    <Fragment key={`${entry.key}-${idx}`}>
                      {row.header && (
                        <div className="flex items-center gap-1.5 px-1 py-1 text-[9px] font-bold text-blue-200 uppercase tracking-wide">
                          <span className="text-sm">{MANAGE_GROUP_ICONS[row.header] || '•'}</span>
                          <span>{row.header}</span>
                        </div>
                      )}
                      <SidePaneButton icon={entry.icon} label={paneLabel(entry.key, entry.label)} mode={cashDisplayMode} divider={row.divider}
                        active={paneActive(lossView === entry.key)} badge={badge}
                        taskBadge={taskCountFor(entry.label)}
                        onClick={() => pickLossView(entry.key)} />
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
                {STAFF_TEAM_ITEMS.filter(t => !paneHidden[t.key]).map((t, i) => (
                  <SidePaneButton key={t.key} icon={t.icon} label={paneLabel(t.key, t.label)} mode={cashDisplayMode} divider={i > 0}
                    active={paneActive(lossView === t.key)}
                    badge={t.key === 'staff_dress' ? dressFlagsCount : t.key === 'teamTimes' ? staffTimesFlagsCount : undefined}
                    taskBadge={taskCountFor(t.label)}
                    onClick={() => pickLossView(t.key)} />
                ))}
              </div>
            )}

            {canSeeTeam && activeStaff.length > 0 && (
              <div className="mt-1 pt-1 border-t border-white/30">
                <div className="text-xs font-semibold text-gray-400 px-3 py-2">Staff Members</div>
                {activeStaff.map((staff, i) => {
                  const staffViewKey = `staffMember_${staff.username}` as LossView
                  return (
                    <SidePaneButton key={staff.username} icon="👤" label={staff.username.charAt(0).toUpperCase() + staff.username.slice(1)} mode={cashDisplayMode} divider={i > 0}
                      active={paneActive(lossView === staffViewKey)}
                      onClick={() => pickLossView(staffViewKey)} />
                  )
                })}
              </div>
            )}

            {myStaffName && (
              <div className="mt-1 pt-1 border-t border-white/30">
                {(() => {
                  const personalItems = STAFF_PERSONAL_ITEMS.filter(t => viewingSelf || t.key !== 'staffPayslips')
                  let itemIndex = 0
                  return (<>
                    {personalItems.map((t) => (
                      <SidePaneButton key={t.key} icon={t.icon} label={t.label} mode={cashDisplayMode} divider={itemIndex++ > 0}
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
                      {ch.submenus.map((s, j) => (
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
              {ukAllSubmenus.map((s, i) => (
                <SidePaneButton key={s.id} icon="📋" label={`${s.person} ${s.name}`} mode={cashDisplayMode} divider={i > 0}
                  active={paneActive(uk.selectedSubmenuId === s.id)}
                  taskBadge={taskCountFor(`${s.person} ${s.name}`)}
                  onClick={() => { uk.pickPerson(s.person as typeof uk.person); uk.pickSubmenu(s.id); setSettingsOpen(false) }} />
              ))}

              {ukGeneralSubmenus.length > 0 && (
                <div className="mt-1 pt-1 border-t border-white/30">
                  {ukGeneralSubmenus.map((s, i) => (
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

            {/* Biz/UK/C&H navigation buttons at bottom of sidebar */}
            <div className="mt-1 pt-1 border-t border-white/30 flex flex-col gap-1">
              {(canSeeUK || canSeeCH) && (
                <button onClick={() => changeTab('loss')} title="Biz"
                  style={{ color: PANE_ACCENT.loss }}
                  className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition
                    ${outerTab === 'loss' ? 'bg-white/10 border-2 border-current' : 'border-2 border-transparent text-white/40 hover:text-white/70'}`}>
                  💰 Biz
                </button>
              )}
              {canSeeUK && (
                <button onClick={() => changeTab('uk')} title="UK"
                  style={{ color: PANE_ACCENT.uk }}
                  className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition
                    ${outerTab === 'uk' ? 'bg-white/10 border-2 border-current' : 'border-2 border-transparent text-white/40 hover:text-white/70'}`}>
                  🇬🇧 UK
                </button>
              )}
              {canSeeCH && (
                <button onClick={() => changeTab('ch')} title="C&H"
                  style={{ color: PANE_ACCENT.ch }}
                  className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition
                    ${outerTab === 'ch' ? 'bg-white/10 border-2 border-current' : 'border-2 border-transparent text-white/40 hover:text-white/70'}`}>
                  🏢 C&H
                </button>
              )}
            </div>
        </SidePaneContainer>
        )}
        {/* Restore button while the pane is hidden -- floats over the
            content area's own top-left corner rather than taking a layout
            slot of its own, same reasoning as SidePaneToggle's onHide button
            above (no extra border/column either way). */}
        {sidePaneHidden && (
          <button
            type="button"
            onClick={() => setSidePaneHidden(false)}
            title="Show sidebar"
            className="absolute top-1.5 left-1.5 z-20 w-5 h-5 rounded-full bg-gray-800/80 hover:bg-gray-800 text-white text-[10px] flex items-center justify-center shadow transition"
          >
            ▶
          </button>
        )}

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
              {/* Tab switcher: Items vs Live Sale modes */}
              <div className="px-6 py-1.5 border-b border-green-700">
                <div className="flex items-center gap-3 justify-between min-w-0">
                  <div className="flex items-center gap-1.5 overflow-x-auto min-w-0">
                    {renderTabSwitcher(true)}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Control buttons next to tab switcher */}
                    {lossView === 'items' && (
                      <>
                        <ColumnsPickerButton prefs={itemsColPrefs} dark extraToggles={[
                          { key: 'aliasWide', label: 'Alias Wide Table', active: itemsExtraView === 'aliasWide',
                            onToggle: () => setItemsExtraView(v => v === 'aliasWide' ? 'none' : 'aliasWide') },
                          { key: 'serviceMatches', label: 'Service Matches', active: itemsExtraView === 'serviceMatches',
                            onToggle: () => setItemsExtraView(v => v === 'serviceMatches' ? 'none' : 'serviceMatches') },
                        ]} />
                      </>
                    )}
                  </div>
                </div>
              </div>
              {/* Row 2: filter bar — hidden on report-style submenus. */}
              {showControls && (outerTab === 'loss' && (lossView === 'sales' || lossView === 'items')) && (
                <div className="w-full flex items-center gap-1 px-2 py-1 bg-green-700 border-b border-green-800">
                  <select
                    value={liveProductTypeFilter}
                    onChange={e => setLiveProductTypeFilter(e.target.value as 'all' | 'goods' | 'services')}
                    className="text-[9px] px-1.5 py-0.5 rounded-md border border-green-500 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400 w-20"
                  >
                    <option value="all">All</option>
                    <option value="goods">Goods</option>
                    <option value="services">Services</option>
                  </select>
                  <select
                    value={liveGroupFilter || ''}
                    onChange={e => setLiveGroupFilter(e.target.value || null)}
                    className="text-[9px] px-1.5 py-0.5 rounded-md border border-green-500 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400 w-24"
                  >
                    <option value="">Groups</option>
                    {liveGroups.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                  <select
                    value={liveSaleFilter ? liveSaleFilter.kind === 'interval' ? `interval:${liveSaleFilter.label}` : liveSaleFilter.kind === 'flag' ? `flag:${liveSaleFilter.key}` : liveSaleFilter.kind : liveCurrentView?.kind === 'violation' ? `violation:${liveCurrentView.key}` : liveCurrentView?.kind === 'aliasWide' ? 'view:aliasWide' : liveCurrentView?.kind === 'serviceMatches' ? 'view:serviceMatches' : ''}
                    onChange={e => {
                      const v = e.target.value
                      if (!v) {
                        setLiveSaleFilter(null)
                        setLiveCurrentView(null)
                      } else if (v.startsWith('interval:')) {
                        setLiveCurrentView(null)
                        setLiveSaleFilter({ kind: 'interval', label: v.slice('interval:'.length) })
                      } else if (v.startsWith('violation:')) {
                        setLiveSaleFilter(null)
                        const violationKey = v.slice('violation:'.length)
                        setLiveCurrentView({ kind: 'violation' as const, key: violationKey })
                      } else if (v.startsWith('flag:')) {
                        setLiveCurrentView(null)
                        setLiveSaleFilter({ kind: 'flag', key: v.slice('flag:'.length) })
                      } else if (v.startsWith('view:')) {
                        setLiveSaleFilter(null)
                        const viewKey = v.slice('view:'.length)
                        if (viewKey === 'aliasWide') setLiveCurrentView({ kind: 'aliasWide' as const })
                        else if (viewKey === 'serviceMatches') setLiveCurrentView({ kind: 'serviceMatches' as const })
                      } else {
                        setLiveCurrentView(null)
                        setLiveSaleFilter({ kind: v as 'loss' | 'gain' | 'soh' })
                      }
                    }}
                    className="text-[9px] px-1.5 py-0.5 border border-green-500 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white w-28"
                  >
                    <option value="">Filter</option>
                    {liveSaleFilterFlags.filter(f => !f.key.startsWith('flag_')).map(f => {
                      let value = f.key
                      if (f.key.startsWith('interval_')) value = `interval:${f.label}`
                      return (
                        <option key={f.key} value={value}>
                          {f.label} ({f.count})
                        </option>
                      )
                    })}
                    <optgroup label="Items">
                      {ITEMS_FLAG_TYPES.map(f => (
                        <option key={f.key} value={`violation:${f.key}`}>
                          {f.label} ({(liveItemsWithViolations as Record<string, number[]>)[f.key]?.length ?? 0})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Views">
                      <option value="view:aliasWide">Alias Wide Table</option>
                      <option value="view:serviceMatches">Service Matches</option>
                      <option value="view:gmcPacks">GMC Packs</option>
                    </optgroup>
                  </select>
                </div>
              )}
              {/* Row 3: search bar + controls — hidden on report-style submenus. */}
              {showControls && (
                <div className="px-2 py-1 border-b border-green-700">
                  <div className="flex items-center gap-2 justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {(lossView === 'sales' || lossView === 'items') && renderLiveSearchControls(true)}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => setGlobalSearchOpen(true)} title="Search"
                        className="w-6 h-6 rounded-full flex items-center justify-center text-sm border-2 border-transparent text-white opacity-70 hover:opacity-100 transition shrink-0">
                        🔍
                      </button>
                      <button
                        type="button"
                        onClick={() => setLiveHelpModalOpen(true)}
                        title="Help"
                        className="shrink-0 w-5 h-5 rounded-md text-[10px] font-semibold border flex items-center justify-center transition bg-gray-200 text-gray-700 hover:bg-gray-300 border-gray-400"
                      >
                        ?
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Content ── */}
          <div className="relative flex-1 min-h-0 overflow-y-auto">
        {(outerTab === 'loss' && lossView === 'sales') || (outerTab === 'loss' && lossView === 'items') ? (<>
          {/* Filter bar moved to green header above */}
          {/* Log tab */}
          {liveMode === 'log' && (
            <div className={liveRootClassName}>
              {/* "Large screen" makes this root `fixed inset-0`, covering
                  this component's own top green bar/footer -- still mounted
                  underneath, just visually hidden. This floating button is
                  the actual way back out, reachable regardless of which mode
                  is showing or how far the content underneath has scrolled. */}
              {liveExpanded && (
                <button
                  type="button"
                  onClick={() => setLiveExpanded(false)}
                  title="Exit large screen"
                  className="fixed top-2 right-2 z-[60] w-8 h-8 rounded-full bg-gray-900/80 text-white text-sm font-bold flex items-center justify-center shadow-lg hover:bg-gray-900 transition"
                >
                  ✕
                </button>
              )}
              {renderModeToggleRow()}
              <div className="flex justify-end px-1.5 py-1 border-b border-gray-100">
                <button
                  type="button"
                  onClick={() => setLiveLogShowAnalytics(a => !a)}
                  title="Analytics"
                  className={`shrink-0 font-bold rounded-lg px-2 py-1 text-[10px] transition ${
                    liveLogShowAnalytics ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  📊
                </button>
              </div>
              {liveLogShowAnalytics ? (
                <div className="px-3 pt-3 flex-1 overflow-auto"><LiveSaleAnalyticsSection /></div>
              ) : (
              <div className="flex-1 overflow-auto">
                {liveTaps.length === 0 ? (
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
                    {liveTapsByDate.map(([date, dateTaps]) => {
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
                            const bounds = liveDayBounds[date]
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
          )}

          {/* Sales tab -- the classic Sales Receipts list. Folded in here since it
              had nothing left that justified its own sidebar destination once the
              New Sale form was dropped and its own tap-a-sale case moved to Sale mode. */}
          {liveMode === 'sales' && (
            <div className={liveRootClassName}>
              {liveExpanded && (
                <button
                  type="button"
                  onClick={() => setLiveExpanded(false)}
                  title="Exit large screen"
                  className="fixed top-2 right-2 z-[60] w-8 h-8 rounded-full bg-gray-900/80 text-white text-sm font-bold flex items-center justify-center shadow-lg hover:bg-gray-900 transition"
                >
                  ✕
                </button>
              )}
              {renderModeToggleRow()}
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-gray-900">Sales</h2>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={liveEmbeddedSearch}
                    onChange={e => setLiveEmbeddedSearch(e.target.value)}
                    placeholder="Search…"
                    className="text-xs px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 w-32"
                  />
                  <LawsToggleBar show={salesLaws.show} setShow={salesLaws.setShow}
                    openForm={salesLaws.openForm} setOpenForm={salesLaws.setOpenForm}
                    hideZeroFlags={salesLaws.hideZeroFlags} setHideZeroFlags={salesLaws.setHideZeroFlags}
                    activeFilters={salesLaws.activeFilters} toggleFilter={salesLaws.toggleFilter} dark={false} />
                  <button type="button" onClick={() => setLiveSalesShowAnalytics(a => !a)}
                    title="Analytics"
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${liveSalesShowAnalytics ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    📊
                  </button>
                  <button
                    type="button"
                    onClick={() => setLiveHelpModalOpen(true)}
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
                    flags={liveSalesViolationTypes.map((v: ViolationType) => ({
                      key: v.key, label: v.label, description: v.description,
                      count: violationCounts[v.key] ?? 0,
                      onViewClick: () => setLiveSalesViolationFilter(f => f === v.key ? null : v.key),
                    }))}
                    openForm={salesLaws.openForm}
                    setOpenForm={salesLaws.setOpenForm}
                    hideZeroFlags={salesLaws.hideZeroFlags}
                    setHideZeroFlags={salesLaws.setHideZeroFlags}
                    activeFilters={salesLaws.activeFilters}
                  />
                </div>
              )}
              {liveSalesShowAnalytics ? (
                <div className="px-3 pt-3 flex-1 overflow-auto"><SalesAnalyticsSection /></div>
              ) : (
                <div className="flex-1 overflow-auto">
                  <SalesTab items={liveSalesBillsItems} groupFilter={liveGroupFilter} search={liveEmbeddedSearch}
                    violation={liveSalesViolationFilter}
                    jumpToDate={jumpToReceiptDate} jumpToItemName={jumpToReceiptItemName}
                    onJumpDone={() => { setJumpToReceiptDate(null); setJumpToReceiptItemName(null) }} />
                </div>
              )}
            </div>
          )}

          {/* Bills tab -- BillsTab itself has no "add new" flow of its own; it always
              relied on a sibling NewBillForm rendered externally, which now lives
              inside this tab's own header instead. */}
          {liveMode === 'bills' && (
            <div className={liveRootClassName}>
              {liveExpanded && (
                <button
                  type="button"
                  onClick={() => setLiveExpanded(false)}
                  title="Exit large screen"
                  className="fixed top-2 right-2 z-[60] w-8 h-8 rounded-full bg-gray-900/80 text-white text-sm font-bold flex items-center justify-center shadow-lg hover:bg-gray-900 transition"
                >
                  ✕
                </button>
              )}
              {renderModeToggleRow()}
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-gray-900">Bills</h2>
                <div className="flex items-center gap-2">
                  {!liveBillsAddingNew && (
                    <input
                      type="text"
                      value={liveEmbeddedSearch}
                      onChange={e => setLiveEmbeddedSearch(e.target.value)}
                      placeholder="Search…"
                      className="text-xs px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 w-32"
                    />
                  )}
                  <button type="button" onClick={() => setLiveBillsAddingNew(a => !a)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${liveBillsAddingNew ? 'bg-red-600 text-white' : 'bg-green-600 text-white hover:bg-green-500'}`}>
                    {liveBillsAddingNew ? 'Cancel' : '+ New Bill'}
                  </button>
                  {!liveBillsAddingNew && (
                    <LawsToggleBar show={billsLaws.show} setShow={billsLaws.setShow}
                      openForm={billsLaws.openForm} setOpenForm={billsLaws.setOpenForm}
                      hideZeroFlags={billsLaws.hideZeroFlags} setHideZeroFlags={billsLaws.setHideZeroFlags}
                      activeFilters={billsLaws.activeFilters} toggleFilter={billsLaws.toggleFilter} dark={false} />
                  )}
                  {!liveBillsAddingNew && (
                    <button type="button" onClick={() => setLiveBillsShowAnalytics(a => !a)}
                      title="Analytics"
                      className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${liveBillsShowAnalytics ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      📊
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setLiveHelpModalOpen(true)}
                    className="w-8 h-8 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 font-semibold text-sm flex items-center justify-center transition"
                    title="Help"
                  >
                    ?
                  </button>
                </div>
              </div>
              {!liveBillsAddingNew && billsLaws.show && (
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 overflow-auto max-h-48">
                  <PageLawsList
                    scopeKey="Bills"
                    isItemsLaws={true}
                    onChange={billsLaws.bumpRefresh}
                    flags={liveBillsViolationTypes.map((v: ViolationType) => ({
                      key: v.key, label: v.label, description: v.description,
                      count: violationCounts[v.key] ?? 0,
                      onViewClick: () => setLiveBillsViolationFilter(f => f === v.key ? null : v.key),
                    }))}
                    openForm={billsLaws.openForm}
                    setOpenForm={billsLaws.setOpenForm}
                    hideZeroFlags={billsLaws.hideZeroFlags}
                    setHideZeroFlags={billsLaws.setHideZeroFlags}
                    activeFilters={billsLaws.activeFilters}
                  />
                </div>
              )}
              {liveBillsAddingNew ? (
                <div className="px-4 flex-1 overflow-auto">
                  <NewBillForm onSuccess={() => setLiveBillsAddingNew(false)} />
                </div>
              ) : liveBillsShowAnalytics ? (
                <div className="px-3 pt-3 flex-1 overflow-auto"><BillsAnalyticsSection /></div>
              ) : (
                <div className="flex-1 overflow-auto">
                  <BillsTab items={liveSalesBillsItems} groupFilter={liveGroupFilter} search={liveEmbeddedSearch} violation={liveBillsViolationFilter} />
                </div>
              )}
            </div>
          )}

          {/* Loss by Target tab -- still an unimplemented placeholder upstream; kept
              here purely so its sidebar destination can be retired without losing
              the (currently empty) spot for whenever it's built. */}
          {liveMode === 'lossByTarget' && (
            <div className={liveRootClassName}>
              {liveExpanded && (
                <button
                  type="button"
                  onClick={() => setLiveExpanded(false)}
                  title="Exit large screen"
                  className="fixed top-2 right-2 z-[60] w-8 h-8 rounded-full bg-gray-900/80 text-white text-sm font-bold flex items-center justify-center shadow-lg hover:bg-gray-900 transition"
                >
                  ✕
                </button>
              )}
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
                    onClick={() => setLiveHelpModalOpen(true)}
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
          )}

          {/* Every count-related view that used to only be reachable through the
              laws panel (⚖️) on Sale mode: Daily/Every Nd/Dormant/etc
              (liveCountIntervalFlags), Count Records (the full all-time history
              table), and Count History (the audit log of who counted/edited/
              deleted what). Moved to its own tab since they're audit/browse
              views, not part of actually tapping a sale. */}
          {liveMode === 'count' && (() => {
            const intervalItems = liveCountView?.kind === 'interval'
              ? liveAllItems.filter(it => it.count_interval === liveCountView.label)
              : []
            return (
              <div className={liveRootClassName}>
                {liveExpanded && (
                  <button
                    type="button"
                    onClick={() => setLiveExpanded(false)}
                    title="Exit large screen"
                    className="fixed top-2 right-2 z-[60] w-8 h-8 rounded-full bg-gray-900/80 text-white text-sm font-bold flex items-center justify-center shadow-lg hover:bg-gray-900 transition"
                  >
                    ✕
                  </button>
                )}
                {renderModeToggleRow()}
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-2 flex-wrap">
                  <h2 className="text-sm font-bold text-gray-900">Count</h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Count Records doubles as the old Loss by Date feed -- these
                        controls (search, the All/Losses/Gains filter, and Analytics)
                        only make sense there, not on the interval buckets or the
                        audit log. */}
                    {liveCountView?.kind === 'records' && (<>
                      <input
                        type="text"
                        value={liveEmbeddedSearch}
                        onChange={e => setLiveEmbeddedSearch(e.target.value)}
                        placeholder="Search…"
                        className="text-xs px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 w-32"
                      />
                      <div className="inline-flex bg-gray-200 rounded-lg p-0.5">
                        <button type="button" onClick={() => setLiveCountRecordFilter('all')}
                          className={`px-2 py-1 text-[10px] font-bold rounded-md transition ${liveCountRecordFilter === 'all' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
                          All
                        </button>
                        <button type="button" onClick={() => setLiveCountRecordFilter('loss')}
                          className={`px-2 py-1 text-[10px] font-bold rounded-md transition ${liveCountRecordFilter === 'loss' ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
                          Losses
                        </button>
                        <button type="button" onClick={() => setLiveCountRecordFilter('gain')}
                          className={`px-2 py-1 text-[10px] font-bold rounded-md transition ${liveCountRecordFilter === 'gain' ? 'bg-amber-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
                          🚩 Gains
                        </button>
                      </div>
                      <button type="button" onClick={() => setLiveCountShowAnalytics(a => !a)}
                        title="Analytics"
                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${liveCountShowAnalytics ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        📊
                      </button>
                    </>)}
                    <button
                      type="button"
                      onClick={() => setLiveHelpModalOpen(true)}
                      className="w-8 h-8 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 font-semibold text-sm flex items-center justify-center transition"
                      title="Help"
                    >
                      ?
                    </button>
                  </div>
                </div>
                <div className="px-4 py-2 border-b border-gray-200 bg-white flex items-center gap-1.5 flex-wrap">
                  {liveCountIntervalFlags.map(f => (
                    <button key={f.key} type="button" onClick={f.onViewClick}
                      className={`text-xs font-semibold px-2 py-1 rounded-full transition ${f.active ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {f.label} ({f.count})
                    </button>
                  ))}
                  <button type="button" onClick={() => setLiveCountView(liveCountView?.kind === 'records' ? null : { kind: 'records' })}
                    className={`text-xs font-semibold px-2 py-1 rounded-full transition ${liveCountView?.kind === 'records' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    Count Records
                  </button>
                  <button type="button" onClick={() => setLiveCountView(liveCountView?.kind === 'history' ? null : { kind: 'history' })}
                    className={`text-xs font-semibold px-2 py-1 rounded-full transition ${liveCountView?.kind === 'history' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    Count History
                  </button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  {!liveCountView && (
                    <p className="py-16 text-center text-gray-400 text-xs">Pick a category above to view its items.</p>
                  )}
                  {liveCountView?.kind === 'interval' && (
                    intervalItems.length === 0 ? (
                      <p className="py-16 text-center text-gray-400 text-xs">No items in &quot;{liveCountView.label}&quot;.</p>
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
                  {liveCountView?.kind === 'records' && (
                    liveCountShowAnalytics ? (
                      <div className="px-3 pt-3"><LossFeedAnalyticsSection /></div>
                    ) : (<>
                      <div className="grid grid-cols-5 gap-0.5 px-2 pt-1 shrink-0">
                        {liveCountLossSummary.map(r => (
                          <div key={r.label} className="bg-white border border-gray-200 rounded px-1 py-0.5 text-center">
                            <p className="text-[7px] text-gray-400 truncate">{r.label}</p>
                            <p className={`text-[8px] font-bold ${r.period.n > 0 ? 'text-red-600' : 'text-green-600'}`}>₵{fmtN(r.period.amt)}</p>
                          </div>
                        ))}
                      </div>
                      {renderCountRecordsTable()}
                    </>)
                  )}
                  {liveCountView?.kind === 'history' && (
                    <div className="flex-1 min-h-0 flex flex-col px-4 py-4">
                      <HistoryPanel keywords={['stock', 'count']} />
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Sale mode (the default/landing mode) */}
          {liveMode === 'sale' && (<>
          <div className={liveRootClassName}>
            {liveExpanded && (
              <button
                type="button"
                onClick={() => setLiveExpanded(false)}
                title="Exit large screen"
                className="fixed top-2 right-2 z-[60] w-8 h-8 rounded-full bg-gray-900/80 text-white text-sm font-bold flex items-center justify-center shadow-lg hover:bg-gray-900 transition"
              >
                ✕
              </button>
            )}
            {renderModeToggleRow()}

            {/* Filter Bar -- Green bar at top, shown only while liveExpanded
                (this component's own top green bar already covers the
                type/group filters/laws/help the rest of the time -- see
                above -- and is visually hidden behind this fixed overlay
                once liveExpanded, so it needs its own copy here too rather
                than losing the type/group filters entirely). */}
            {liveExpanded && (
            <div className="bg-green-700 -mx-0 px-2 py-1 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <div className="flex gap-1 items-center">
                    <select
                      value={liveProductTypeFilter}
                      onChange={e => setLiveProductTypeFilter(e.target.value as 'all' | 'goods' | 'services')}
                      className="text-[11px] px-1.5 py-0.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white w-[4.5rem]"
                    >
                      <option value="all">All types</option>
                      <option value="goods">Goods</option>
                      <option value="services">Services</option>
                    </select>
                    <select
                      value={liveGroupFilter || ''}
                      onChange={e => setLiveGroupFilter(e.target.value || null)}
                      className="text-[11px] px-1.5 py-0.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white w-[4.5rem]"
                    >
                      <option value="">All groups</option>
                      {liveCatalogueGroups.map(group => (
                        <option key={group} value={group}>{group}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-1 items-center">
                    <select
                      value={liveCurrentView?.kind === 'violation' ? `violation:${liveCurrentView.key}` : liveCurrentView?.kind === 'lossByItem' ? 'view:lossByItem' : liveCurrentView?.kind === 'dailySummary' ? 'view:dailySummary' : ''}
                      onChange={e => {
                        const v = e.target.value
                        if (!v) {
                          setLiveCurrentView(null)
                        } else if (v.startsWith('violation:')) {
                          const violationKey = v.slice('violation:'.length)
                          setLiveCurrentView({ kind: 'violation' as const, key: violationKey })
                        } else if (v.startsWith('view:')) {
                          const viewKey = v.slice('view:'.length)
                          if (viewKey === 'lossByItem') setLiveCurrentView({ kind: 'lossByItem' as const })
                          else if (viewKey === 'dailySummary') setLiveCurrentView({ kind: 'dailySummary' as const })
                        }
                      }}
                      title="Flags & Views"
                      className="text-[10px] px-1.5 py-0.5 border border-white rounded-md focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white/80 text-gray-800 hover:bg-white shrink-0"
                    >
                      <option value="">⚖️ Flags</option>
                      <optgroup label={liveMode === 'sale' || liveMode === 'log' ? 'Items' : (liveMode === 'sales' ? 'Sales' : (liveMode === 'bills' ? 'Bills' : 'Count'))}>
                        {liveComputedFlags.filter(f => f.key.startsWith('flag_') || f.key.startsWith('violation_')).map(f => (
                          <option key={f.key} value={`violation:${f.key}`}>
                            {f.label} ({f.count})
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Views">
                        <option value="view:lossByItem">Loss by Item</option>
                        <option value="view:dailySummary">Daily Summary</option>
                      </optgroup>
                    </select>
                    <button
                      type="button"
                      onClick={() => setLiveHelpModalOpen(true)}
                      className="w-5 h-5 rounded-md bg-white text-gray-600 hover:bg-gray-100 font-semibold text-[10px] flex items-center justify-center transition"
                      title="Help"
                    >
                      ?
                    </button>
                  </div>
                </div>
                {/* Items Violation Flags Filter */}
                <div className="flex gap-1 flex-wrap px-0">
                  {renderLiveItemFlagsFilter()}
                </div>
            </div>
            )}

            {/* Search & Controls -- rendered here only while liveExpanded (the
                fullscreen overlay hides this component's own footer, where
                these normally live -- see the footer's own Live Sale branch
                below). */}
            {liveExpanded && (
              <div className="px-4 py-3 border-b border-gray-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-2 items-center ml-auto">
                    {renderLiveSearchControls(false)}
                  </div>
                </div>
              </div>
            )}

            {saleModeShowAnalytics ? (
              <div className="px-3 pt-3 flex-1 overflow-auto"><LiveSaleAnalyticsSection /></div>
            ) : (<>

            {/* GMC warning -- internal-use recording is easy to mis-tap and hard
                to catch afterward (it's excluded from revenue/margin and feeds
                the stock-gain reconciliation checks), so this stays loud and
                impossible to miss for as long as GMC is selected. */}
            {liveSaleType === 'GMC' && (
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

            {/* Current View Indicator */}
            {liveCurrentView && (
              <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-700">
                  {liveCurrentView.kind === 'violation' && `Viewing: Items with "${liveComputedFlags.find(f => f.key === liveCurrentView.key)?.label}"`}
                  {liveCurrentView.kind === 'lossByItem' && `Viewing: Loss by Item (${liveCatalogueItems.length} items)`}
                  {liveCurrentView.kind === 'aliasWide' && `Viewing: Alias Wide Table`}
                  {liveCurrentView.kind === 'serviceMatches' && `Viewing: Service Matches`}
                  {liveCurrentView.kind === 'newItem' && `Creating New Item`}
                  {liveCurrentView.kind === 'dailySummary' && `Daily Sales Summary`}
                </span>
                <button
                  type="button"
                  onClick={() => setLiveCurrentView(null)}
                  className="text-xs font-semibold px-2 py-1 rounded bg-white text-blue-600 hover:bg-blue-100 transition"
                >
                  ✕ Clear
                </button>
              </div>
            )}

            {/* Alias Wide Table View */}
            {liveCurrentView?.kind === 'aliasWide' && (
              <div className="flex-1 overflow-y-auto">
                <AliasWidePage />
              </div>
            )}

            {/* Service Matches View */}
            {liveCurrentView?.kind === 'serviceMatches' && (
              <div className="flex-1 overflow-y-auto">
                <ServiceMatchesPage />
              </div>
            )}

            {/* Daily Summary View */}
            {liveCurrentView?.kind === 'dailySummary' && (
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {(() => {
                  try {
                    const validTaps = liveTaps.filter(t => !t.undone)
                    const todayTaps = validTaps.filter(t => t.tapped_at.startsWith(liveToday))
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
                                const item = liveAllItems.find(i => i.id === itemId)
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
            {liveCurrentView?.kind === 'newItem' && (
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <NewItemForm onSuccess={() => { setLiveCurrentView(null); setLiveAllItems([]) }} />
              </div>
            )}

            {/* Items Grid - 2 Columns */}
            {liveCurrentView?.kind !== 'aliasWide' && liveCurrentView?.kind !== 'serviceMatches' && liveCurrentView?.kind !== 'newItem' && liveCurrentView?.kind !== 'dailySummary' && (
            <div className="flex-1 overflow-y-auto">
              {liveItemsLoading ? (
                <p className="text-xs text-gray-400 text-center py-8">Loading…</p>
              ) : liveCatalogueItems.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8">
                  {liveCurrentView ? 'No items in this view' : 'No items found'}
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-0 p-0">
                  {livePinnedDueItems.length > 0 && (
                    <div className="col-span-3 px-2 py-1 bg-gray-800 text-[9px] font-bold text-white uppercase tracking-wide">
                      {livePinnedDueItems.length} item{livePinnedDueItems.length !== 1 ? 's' : ''} need{livePinnedDueItems.length === 1 ? 's' : ''} counting
                    </div>
                  )}
                  {livePinnedDueItems.map(item => {
                    const count = liveSalesCounts.get(item.id) ?? 0
                    const due = liveCountStatus.get(item.id)!
                    const overdue = due.level === 'overdue'
                    return (
                      <div
                        key={item.id}
                        className={`relative flex flex-col border-r border-b group ${overdue ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}
                      >
                        <div className={`px-2 py-0.5 text-[8px] font-extrabold text-white tracking-wide ${overdue ? 'bg-red-600' : 'bg-amber-500'}`}>
                          ⚠ COUNT NOW {overdue ? `· ${due.label} OVERDUE` : `· ${due.label}`}
                        </div>
                        <div className="px-1 py-0.5 flex flex-col hover:bg-black/5 transition">
                          <button
                            type="button"
                            onClick={() => openEditGridItem(item.id)}
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
                            <span className={formatLoss(liveLossByItemId.get(item.id)).cls}>{formatLoss(liveLossByItemId.get(item.id)).text}</span>
                          </p>
                        </div>
                        {count > 0 && (
                          <span className="absolute top-1 right-1 inline-flex items-center justify-center min-w-3 h-3 px-0.5 rounded-full bg-blue-600 text-white text-[8px] font-bold">
                            {count}
                          </span>
                        )}
                      </div>
                    )
                  })}
                  {livePinnedDueItems.length > 0 && liveRestCatalogueItems.length > 0 && (
                    <div className="col-span-3 border-b border-gray-200" />
                  )}
                  {liveRestCatalogueItems.map(item => {
                    const count = liveSalesCounts.get(item.id) ?? 0
                    const flags = itemAttentionFlags(item, liveDuplicateItemIds, liveUnlinkedNamedIds, liveServiceViolationIdSet)
                    const flag = flags[0] ?? null
                    return (
                      <div
                        key={item.id}
                        className={`relative flex flex-col border-r border-b group ${flag ? 'bg-orange-50 border-orange-100' : 'border-gray-100'}`}
                      >
                        {flag && (
                          <div className={`px-2 py-0.5 text-[8px] font-extrabold text-white tracking-wide ${flag.bg} flex items-center justify-between gap-1`}>
                            <span className="truncate">{flag.label}</span>
                            {flags.length > 1 && <span className="shrink-0 opacity-90">+{flags.length - 1} more</span>}
                          </div>
                        )}
                        <div className="px-1 py-0.5 flex flex-col hover:bg-black/5 transition">
                          <button
                            type="button"
                            onClick={() => openEditGridItem(item.id)}
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
                            <span className={formatLoss(liveLossByItemId.get(item.id)).cls}>{formatLoss(liveLossByItemId.get(item.id)).text}</span>
                          </p>
                        </div>
                        {count > 0 && (
                          <span className="absolute top-1 right-1 inline-flex items-center justify-center min-w-3 h-3 px-0.5 rounded-full bg-blue-600 text-white text-[8px] font-bold">
                            {count}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            )}

            {/* Modal */}
            {liveSelectedItem && (() => {
              const due = liveCountStatus.get(liveSelectedItem.id)
              const flags = itemAttentionFlags(liveSelectedItem, liveDuplicateItemIds, liveUnlinkedNamedIds, liveServiceViolationIdSet)
              const flag = flags[0] ?? null
              const expected = Number(liveSelectedItem.soh)
              const enteredCount = liveCountQty === '' ? null : Number(liveCountQty)
              const countShort = enteredCount !== null && !isNaN(enteredCount) && enteredCount < expected
              return (
              <div className="fixed inset-0 bg-black/50 flex items-end z-50">
                <div className="w-full bg-white rounded-t-2xl shadow-xl max-h-[92dvh] overflow-y-auto">
                  <div className="px-4 py-4 border-b border-gray-200 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-gray-900 truncate">{liveSelectedItem.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        <span>Selling: ₵{formatPrice(liveSelectedItem.selling_price)}</span>
                        <span className="text-gray-400"> · </span>
                        <span>Cost: ₵{formatPrice(liveSelectedItem.cost_price)}</span>
                        <span className="text-gray-400"> · </span>
                        <span>Stock: {Math.ceil(Number(liveSelectedItem.soh))} pc</span>
                      </p>
                    </div>
                    {!liveEditingSelectedItem && (
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
                  {liveEditingSelectedItem ? (
                    <div className="p-4">
                      {liveEditLoading ? (
                        <p className="text-xs text-gray-400 text-center py-6">Loading…</p>
                      ) : (
                        <ItemEditForm
                          form={liveEditForm}
                          onChange={setLiveEditForm}
                          groups={liveEditGroups}
                          itemId={liveSelectedItem.id}
                          isService={liveSelectedItem.product_type === 'service'}
                          allItems={liveEditAllItemsList}
                          size="large"
                          currentCountInterval={liveEditCurrentCountInterval}
                          currentSoh={liveEditCurrentSoh}
                        />
                      )}
                      {liveEditError && (
                        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600 font-medium">
                          {liveEditError}
                        </div>
                      )}

                      {/* Manual count -- lets this item be counted from the edit
                          view even when it isn't currently due (the due block
                          below only shows up for items the count queues have
                          already flagged). Its own submit, going through the
                          same submitCount() the due block uses, so it hits the
                          same pack-pairing/loss-reason prompts. */}
                      {!liveEditLoading && liveSelectedItem.product_type !== 'service' && (
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
                                value={liveCountQty}
                                onChange={e => setLiveCountQty(e.target.value)}
                                placeholder="Counted quantity"
                                className="flex-1 text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-gray-400"
                                disabled={liveCountSaving}
                              />
                              <button
                                type="button"
                                onClick={() => setLiveCountQty(String(expected))}
                                disabled={liveCountSaving}
                                className="shrink-0 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
                              >
                                ={expected}
                              </button>
                              <button
                                type="button"
                                onClick={() => enteredCount !== null && submitCount(liveSelectedItem, enteredCount)}
                                disabled={liveCountQty === '' || liveCountSaving}
                                className={`shrink-0 px-3 py-2 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50 ${countShort ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-800'}`}
                              >
                                {liveCountSaving ? '…' : countShort ? 'Save as loss' : 'Save Count'}
                              </button>
                            </div>
                            {enteredCount !== null && !isNaN(enteredCount) && (
                              <p className={`text-xs font-semibold ${countShort ? 'text-red-600' : 'text-emerald-600'}`}>
                                {countShort
                                  ? `${(expected - enteredCount).toFixed(2).replace(/\.00$/, '')} short of expected — a reason will be requested`
                                  : 'On target'}
                              </p>
                            )}
                            {liveCountError && <p className="text-xs font-semibold text-red-600">{liveCountError}</p>}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 pt-4">
                        <button
                          type="button"
                          onClick={() => {
                            setLiveEditingSelectedItem(false)
                            setLiveEditError('')
                            setLiveCountQty('')
                            setLiveCountError('')
                          }}
                          disabled={liveEditSaving}
                          className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold rounded-lg transition disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={saveEditSelectedItem}
                          disabled={liveEditSaving || liveEditLoading || !liveEditForm.item_name.trim()}
                          className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
                        >
                          {liveEditSaving ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                  <>
                  {/* Same negative-stock/missing-price/missing-cost/missing-group
                      banner the grid card shows (see itemAttentionFlags) -- shown
                      here too since the modal is reached directly from a search
                      pick as well as from a grid card, and a searched-and-picked
                      item skips the grid card entirely. */}
                  {flag && (
                    <div className={`mx-4 mt-4 px-3 py-1.5 rounded-lg text-xs font-extrabold text-white flex items-center justify-between gap-2 ${flag.bg}`}>
                      <span>{flag.label}</span>
                      {flags.length > 1 && <span className="opacity-90">+{flags.length - 1} more</span>}
                    </div>
                  )}

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
                            value={liveCountQty}
                            onChange={e => setLiveCountQty(e.target.value)}
                            placeholder="Counted quantity"
                            className="flex-1 text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-amber-400"
                            disabled={liveCountSaving}
                          />
                          <button
                            type="button"
                            onClick={() => setLiveCountQty(String(expected))}
                            disabled={liveCountSaving}
                            className="shrink-0 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
                          >
                            ={expected}
                          </button>
                          <button
                            type="button"
                            onClick={() => enteredCount !== null && submitCount(liveSelectedItem, enteredCount)}
                            disabled={liveCountQty === '' || liveCountSaving}
                            className={`shrink-0 px-3 py-2 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50 ${countShort ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}
                          >
                            {liveCountSaving ? '…' : countShort ? 'Save as loss' : 'Save Count'}
                          </button>
                        </div>
                        {enteredCount !== null && !isNaN(enteredCount) && (
                          <p className={`text-xs font-semibold ${countShort ? 'text-red-600' : 'text-emerald-600'}`}>
                            {countShort
                              ? `${(expected - enteredCount).toFixed(2).replace(/\.00$/, '')} short of expected — a reason will be requested`
                              : 'On target'}
                          </p>
                        )}
                        {liveCountError && <p className="text-xs font-semibold text-red-600">{liveCountError}</p>}
                      </div>
                    </div>
                  )}
                  {!due && liveDueWhenOpened && (
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
                        value={liveQty}
                        onChange={e => setLiveQty(e.target.value)}
                        placeholder="Enter quantity"
                        className="w-full text-lg font-semibold text-gray-900 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-blue-400"
                        disabled={liveSaving}
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
                          value={livePrice}
                          onChange={e => setLivePrice(e.target.value)}
                          placeholder={formatPrice(liveSelectedItem.selling_price)}
                          className="w-full text-lg font-semibold text-gray-900 bg-gray-50 border border-gray-300 rounded-lg pl-7 pr-3 py-2 outline-none focus:ring-1 focus:ring-blue-400"
                          disabled={liveSaving}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Defaults to ₵{formatPrice(liveSelectedItem.selling_price)}
                      </p>
                    </div>

                    {liveTapError && (
                      <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600 font-medium">
                        {liveTapError}
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setLiveSelectedItem(null)
                          setLiveQty('')
                          setLivePrice('')
                          setLiveTapError('')
                          setLiveCountQty('')
                          setLiveCountError('')
                          setLiveEditingSelectedItem(false)
                          setLiveEditError('')
                        }}
                        disabled={liveSaving}
                        className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold rounded-lg transition disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={recordTap}
                        disabled={!liveQty || liveSaving}
                        className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
                      >
                        {liveSaving ? 'Saving…' : 'Tap'}
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
          </div>

          {/* Item detail popup -- opened by tapping an item's name, instead of
              navigating to the Loss by Item page (which no longer exists as
              its own destination). Kept as a sibling outside liveRootClassName
              (same as LossDialog/PairingDialog below) so it isn't clipped by
              the overlay's own overflow-y-auto while liveExpanded. Only ever
              set from Sale mode's own grid, so it (along with the loss/pairing
              dialogs below) only needs rendering here, not in every mode. */}
          {liveViewingItemId != null && (
            <ItemDetailModal itemId={liveViewingItemId} onClose={() => setLiveViewingItemId(null)} />
          )}

          {liveEditingGridItemId != null && (() => {
            const editItem = liveAllItems.find(i => i.id === liveEditingGridItemId)
            return (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
                <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
                    <h2 className="text-sm font-bold text-red-600">{editItem?.name.toUpperCase()}</h2>
                    <button
                      type="button"
                      onClick={() => {
                        setLiveEditingGridItemId(null)
                        setLiveViewingItemId(null)
                      }}
                      className="text-gray-500 hover:text-gray-700 text-xl font-light"
                    >
                      ×
                    </button>
                  </div>
                  <div className="overflow-y-auto">
                    <div className="p-2 border-b border-gray-200">
                      {liveGridEditLoading ? (
                        <p className="text-center text-gray-500 text-xs">Loading…</p>
                      ) : editItem ? (
                        <ItemEditForm
                          form={liveEditForm}
                          onChange={setLiveEditForm}
                          groups={liveEditGroups}
                          itemId={editItem.id}
                          isService={editItem.product_type === 'service'}
                          allItems={liveEditAllItemsList}
                          size="compact"
                          currentCountInterval={liveEditCurrentCountInterval}
                          currentSoh={liveEditCurrentSoh}
                        />
                      ) : (
                        <p className="text-center text-red-600 text-xs">Item not found</p>
                      )}
                      {liveGridEditError && (
                        <div className="mt-1 bg-red-50 border border-red-200 rounded px-2 py-1 text-xs text-red-600 font-medium">
                          {liveGridEditError}
                        </div>
                      )}
                    </div>
                    {editItem && !liveGridEditLoading && (() => {
                      const overdueItem = liveOverdueItems.find(i => i.item_id === editItem.id)
                      return (
                      <div ref={liveGridEditSaleTapRef} className="p-2 border-b border-gray-200">
                        {overdueItem && (
                          <div className="mb-2 p-1.5 bg-red-100 border border-red-300 rounded">
                            <p className="text-[9px] font-bold text-red-900 mb-1">⚠ COUNT NOW – {overdueItem.days_overdue}d overdue</p>
                            <p className="text-[8px] text-red-800 mb-1">System expects {overdueItem.calculated_soh} on the shelf.</p>
                            <div className="flex gap-1">
                              <input
                                type="number"
                                inputMode="decimal"
                                min="1"
                                step="1"
                                value={liveGridEditCountQty}
                                onChange={e => setLiveGridEditCountQty(e.target.value)}
                                placeholder="Counted quantity"
                                className="flex-1 text-xs font-semibold text-gray-900 bg-white border border-gray-300 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-red-400"
                              />
                              <button
                                disabled={!liveGridEditCountQty}
                                className="px-1.5 py-0.5 bg-green-600 hover:bg-green-700 text-white text-[8px] font-semibold rounded transition disabled:opacity-50">
                                ={liveGridEditCountQty || '?'}
                              </button>
                              <button
                                onClick={recordCountFromModal}
                                disabled={!liveGridEditCountQty || liveGridEditCountSaving}
                                className="px-2 py-0.5 bg-orange-500 hover:bg-orange-600 text-white text-[8px] font-semibold rounded transition disabled:opacity-50">
                                {liveGridEditCountSaving ? 'Saving…' : 'Save Count'}
                              </button>
                            </div>
                          </div>
                        )}
                        <div className="bg-orange-100 border border-orange-300 rounded p-1.5 mb-1">
                          <p className="text-[10px] font-semibold text-orange-900">⚠ SALE TAP</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] text-gray-700 font-medium">Qty</p>
                          <div className="flex gap-1">
                            <input
                              type="number"
                              inputMode="decimal"
                              min="1"
                              step="1"
                              value={liveQty}
                              onChange={e => setLiveQty(e.target.value)}
                              placeholder="Qty"
                              className="flex-1 text-xs font-semibold text-gray-900 bg-white border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400"
                            />
                            <button
                              disabled={!liveQty}
                              className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-[9px] font-semibold rounded transition disabled:opacity-50">
                              ={liveQty || '?'}
                            </button>
                          </div>
                          <p className="text-[9px] text-gray-700 font-medium">Price</p>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-[9px]">₵</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.01"
                              value={livePrice}
                              onChange={e => setLivePrice(e.target.value)}
                              placeholder={editItem ? formatPrice(editItem.selling_price) : 'Price'}
                              className="w-full text-xs font-semibold text-gray-900 bg-white border border-gray-300 rounded pl-5 pr-2 py-1 outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </div>
                          <p className="text-[8px] text-gray-500">Defaults to ₵{editItem ? formatPrice(editItem.selling_price) : '0'}</p>
                          <button
                            onClick={recordTap}
                            disabled={!liveQty || liveSaving}
                            className="w-full px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-[9px] font-semibold rounded transition disabled:opacity-50">
                            {liveSaving ? 'Recording…' : 'Tap'}
                          </button>
                        </div>
                      </div>
                    )})()}
                    {editItem && !liveGridEditLoading && (
                      <div className="bg-gray-50">
                        <div className="px-2 py-1.5 space-y-2">
                          <div>
                            <label className="text-[7px] font-bold text-gray-500 block mb-1">Aliases</label>
                            <AliasPicker itemId={editItem.id} current={liveGridEditAliases} onChange={setLiveGridEditAliases} />
                          </div>
                          <div>
                            <label className="text-[7px] font-bold text-gray-500 block mb-1">
                              {editItem.product_type === 'service' ? 'Goods used' : 'Services used'}
                            </label>
                            <MatchPicker
                              itemId={editItem.id}
                              itemName={editItem.name}
                              isService={editItem.product_type === 'service'}
                              current={liveGridEditMatches}
                              candidatePool={editItem.product_type === 'service' ? Array.from(liveGmcItemIds).map((id: number) => {
                                const item = liveAllItems.find(i => i.id === id)
                                return { item_id: id, item_name: item?.name ?? '', product_type: 'good' }
                              }) : Array.from(liveGmcItemIds).map((id: number) => {
                                const item = liveAllItems.find(i => i.id === id)
                                return { item_id: id, item_name: item?.name ?? '', product_type: 'service' }
                              })}
                              onChange={setLiveGridEditMatches}
                            />
                          </div>
                          {isOwnerLevel(session?.user as any) && (
                            <div>
                              <label className="text-[7px] font-bold text-gray-500 block mb-1">Merge</label>
                              <MergeItemPicker
                                itemId={editItem.id}
                                itemName={editItem.name}
                                typeLabel={editItem.product_type === 'service' ? 'service' : 'good'}
                                mergePool={liveAllItems.filter(i => i.id !== editItem.id).map(i => ({
                                  item_id: i.id,
                                  item_name: i.name,
                                  product_type: i.product_type
                                }))}
                                onMerged={() => setLiveEditingGridItemId(null)}
                              />
                            </div>
                          )}
                          {isOwnerLevel(session?.user as any) && (
                            <div>
                              {!liveGridEditConfirmDelete ? (
                                <button
                                  onClick={() => setLiveGridEditConfirmDelete(true)}
                                  className="w-full bg-gray-100 hover:bg-red-50 text-red-600 text-[9px] font-semibold rounded py-1 transition">
                                  Delete
                                </button>
                              ) : (
                                <div className="space-y-1">
                                  <p className="text-[8px] text-red-600">No sales/bills/counts?</p>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={deleteGridEditItem}
                                      disabled={liveGridEditDeleting}
                                      className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-[8px] font-semibold rounded py-1 transition">
                                      {liveGridEditDeleting ? 'Deleting…' : 'Confirm'}
                                    </button>
                                    <button
                                      onClick={() => { setLiveGridEditConfirmDelete(false); setLiveGridEditDeleteError('') }}
                                      className="px-2 py-1 bg-gray-100 text-gray-600 text-[8px] font-semibold rounded">
                                      Cancel
                                    </button>
                                  </div>
                                  {liveGridEditDeleteError && <p className="text-[8px] text-red-600 font-medium">{liveGridEditDeleteError}</p>}
                                </div>
                              )}
                            </div>
                          )}
                          <div>
                            <label className="text-[7px] font-bold text-gray-500 block mb-1">Manual Count</label>
                            <div className="space-y-1">
                              <input
                                type="number"
                                inputMode="decimal"
                                min="1"
                                step="1"
                                value={liveGridEditCountQty}
                                onChange={e => setLiveGridEditCountQty(e.target.value)}
                                placeholder="Qty"
                                className="w-full text-xs font-semibold text-gray-900 bg-white border border-gray-300 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-blue-400"
                                disabled={liveGridEditCountSaving}
                              />
                              <div className="relative">
                                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-500 text-[8px]">₵</span>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min="0"
                                  step="0.01"
                                  value={liveGridEditCountPrice}
                                  onChange={e => setLiveGridEditCountPrice(e.target.value)}
                                  placeholder={editItem ? formatPrice(editItem.selling_price) : 'Price'}
                                  className="w-full text-xs font-semibold text-gray-900 bg-white border border-gray-300 rounded pl-4 pr-1.5 py-0.5 outline-none focus:ring-1 focus:ring-blue-400"
                                  disabled={liveGridEditCountSaving}
                                />
                              </div>
                              {liveGridEditCountError && (
                                <div className="bg-red-50 border border-red-200 rounded px-1.5 py-0.5 text-[8px] text-red-600">
                                  {liveGridEditCountError}
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={recordCountFromModal}
                                disabled={!liveGridEditCountQty || liveGridEditCountSaving}
                                className="w-full px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white text-[8px] font-semibold rounded transition disabled:opacity-50">
                                {liveGridEditCountSaving ? 'Recording…' : 'Record'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {editItem && !liveGridEditLoading && (
                      <div className="bg-gray-50">
                        <h3 className="px-2 py-1 text-[9px] font-bold text-gray-900 border-b border-gray-200">Details</h3>
                        <ItemDetailPanel itemId={editItem.id} onItemGone={() => setLiveEditingGridItemId(null)} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}

          {liveLossPrompt && <LossDialog prompt={liveLossPrompt} onClose={() => setLiveLossPrompt(null)} />}
          {livePairingPrompt && <PairingDialog prompt={livePairingPrompt} onClose={() => setLivePairingPrompt(null)} />}
          </>)}

          <TrainingGuideModal isOpen={liveHelpModalOpen} onClose={() => setLiveHelpModalOpen(false)} lawsPanel={liveSaleLaws} />
        </> ) : null}
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
            <div className="px-4 pt-2 space-y-2">
              <CustomersPage initialSearch={customerSearchText} onFlagCountChange={setCustomersFlagsCount}
                jumpToTabSeq={customersJumpSeq} jumpToTab={customersJumpTab} />
            </div>
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
              <ReorderListsPanel cashItems={combinedCashItems} manageItems={MANAGE_LIST_ITEMS} staffItems={STAFF_TEAM_ITEMS}
                paneOrder={paneOrder} setPaneOrder={setPaneOrder} paneLabels={paneLabels} setPaneLabels={setPaneLabels}
                paneGroups={paneGroups} setPaneGroups={setPaneGroups} paneHidden={paneHidden} setPaneHidden={setPaneHidden} />
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
              onSelectCheckType={(key) => pickLossView(key)}
              missingClosingReportsCount={globalFlags?.missingClosingReports?.length ?? 0}
              onOpenStaff={() => pickLossView('teamTimes')}
              propertiesInitialTab={propertiesInitialTab} />
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && isStaffView(lossView) && (
          <TabErrorBoundary>
            {lossView.startsWith('staffMember_') ? (
              // Individual staff member personal page
              (() => {
                const staffName = lossView.substring('staffMember_'.length)
                return (
                  <StaffMemberPersonalTab
                    staffName={staffName} username={username} role={role}
                    canManage={canManage} staffRoster={STAFF_ROSTER}
                    routablePages={routablePages} categoryIds={fixedCategoryIds} />
                )
              })()
            ) : myStaffName ? (
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
        {outerTab === 'today' && addForm !== 'expense' && (
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
                        <button key={i.id} onClick={() => { setGlobalSearchViewingItemId(i.id); closeGlobalSearch() }}
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
                          onClick={() => { changeTab('loss'); jumpToLiveSaleTab('sales', null, s.receipt_number || s.customer_name || ''); closeGlobalSearch() }}
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
                          onClick={() => { changeTab('loss'); jumpToLiveSaleTab('bills', null, b.bill_number || b.vendor_name || ''); closeGlobalSearch() }}
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
      {globalSearchViewingItemId != null && (
        <ItemDetailModal itemId={globalSearchViewingItemId} onClose={() => setGlobalSearchViewingItemId(null)} />
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
