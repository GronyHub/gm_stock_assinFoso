'use client'
import { useState, useEffect, useRef, useMemo, Component, Suspense, Fragment, type ReactNode, type CSSProperties } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { hasFeature, DEFAULT_ON_FEATURES, type FeatureKey, type RolePermissionsMap } from '@/lib/permissionsShared'
import { usePresenceReporter } from '@/lib/usePresenceReporter'
import { isOwnerLevel } from '@/lib/roles'
import { fmtDate, fmtTime } from '@/lib/fmtDate'
import { trimZeros } from '@/lib/fmtNumber'
import { formatGapMins } from '@/lib/fmtGap'
import PageLawsList, { type LawFormKind } from './_components/PageLawsList'
import ItemDetailModal from './_components/ItemDetailModal'
import { LossDialog, GainDialog, PairingDialog, type LossExtra, type LossPrompt, type GainExtra, type GainPrompt, type PairingPrompt } from './_components/CountDialogs'
import { ItemEditForm, EMPTY_ITEM_EDIT_FORM } from './_components/ItemEditForm'
import HistoryPanel from './_components/HistoryPanel'
import { TrainingGuideModal } from './_components/TrainingGuideModal'
import { LawsTasksModal } from './_components/LawsTasksModal'
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
import PaneDaily from './_components/PaneDaily'
import AddShortcutButton, { type ShortcutKey } from './_components/AddShortcutButton'
import { MyAssignmentsSummary } from './_components/MyAssignmentsSummary'
import AssignWidget from './_components/AssignWidget'
import LawsToggleBar from './_components/LawsToggleBar'
import { useLawsPanel, useLawFilterState } from './_components/useLawsPanel'
import { COLUMNS, type ColKey } from './_components/lossTabColumns'
import { SALES_COLUMNS, type ColKey as SalesColKey } from './_components/salesTabColumns'
import { COLUMNS as BILLS_COLUMNS, type ColKey as BillsColKey } from './_components/billsTabColumns'
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
const GmcPacksPage        = dynamic(() => import('./_components/GmcPacksPage'),   { ssr: false, loading: () => loading('Loading…') })
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
type LossView = 'home' | 'items' | 'sales' | 'pl' | 'cab' | 'vendors' | 'customers' | 'dailySummary'
  | 'purchaseOrders' | 'services'
  // Cust. Receipts and New Customer folded into Customers' own tabs (same
  // treatment Sales/Bills/Loss by Date/Expenses got inside Live Sale) -- see
  // jumpToCustomersTab, since neither is a real LossView any more.
  // Same reasoning as 'newCustomer' used to be above -- Expense Orders was a
  // showOrders toggle living inside ExpensesTab itself, invisible to
  // page.tsx, so the pane button could never actually know whether it was
  // the current view (hardcoded active={false} forever) and its own
  // Notes/Tasks/Laws scope had to be computed conditionally inside
  // ExpensesTab. Its own real LossView instead, rendered as its own
  // content block below.
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
  pl: 'pl', cab: 'cab', dailySummary: 'dailySummary', data: 'items',
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
const CASH_ITEMS: { key: LossView; label: string; icon: string; group?: string }[] = [
  { key: 'items',    label: 'Items',    icon: '📦' },
  { key: 'purchaseOrders',   label: 'Purchase Ord',   icon: '🛒' },
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
  no_cash: 'sales', missing_days: 'sales', dup_receipt: 'sales', no_attachment: 'sales', high_wnw: 'sales',
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
type LiveItem = { id: number; name: string; group: string | null; soh: number; selling_price: string | number; cost_price: string | number; acp_price?: string | number; product_type: string | null; gmc_type?: string | null; count_interval?: string | null; count_cadence_days?: number | null; converts_to_item_id?: number | null; converts_to_name?: string | null; units_per_pack?: string | number | null; unit_time_seconds?: string | number | null }
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
  return trimZeros(num) || '0'
}

// The three criteria the Sale-mode grid can prioritize items by (see the
// Arrange Order picker) -- kept in sync by hand with app/api/item-sort-order/
// route.ts's own copy of these same names/order rather than importing from
// it, since that file also imports the DB client and isn't meant to be
// pulled into client bundles.
type ItemSortKey = 'count_status' | 'violations' | 'badge'
const DEFAULT_ITEM_SORT_ORDER: ItemSortKey[] = ['count_status', 'violations', 'badge']
const ITEM_SORT_LABELS: Record<ItemSortKey, string> = {
  count_status: 'Count Status (due / overdue)',
  violations: 'Violations (attention flags)',
  badge: "Today's Sales (badge count)",
}

// Squeezes lib/countRules.ts's formatCountInterval() strings ("Every 7d",
// "Dormant", ...) down for the grid card's tight CP/SP/SOH line -- the
// underlying item.count_interval value itself is left alone (it's also used
// as a filter-match key elsewhere), this only shortens what's displayed.
function shortCountInterval(label: string | null | undefined): string {
  if (!label) return ''
  if (label === 'Daily') return 'DL'
  if (label === 'Dormant') return 'DM'
  if (label === 'Not counted') return 'NC'
  const m = label.match(/^Every (\d+)d$/)
  return m ? `${m[1]}D` : label
}

// "12 Aug '24" -- compact enough for the grid card's own sale-history line
// (first/last sale date, days since) alongside CP/SP/SOH.
function fmtShortSaleDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  if (isNaN(d.getTime())) return dateStr
  const day = d.getUTCDate()
  const month = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
  const year = String(d.getUTCFullYear()).slice(-2)
  return `${day} ${month} '${year}`
}

function daysSince(dateStr: string): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(dateStr + 'T00:00:00Z')) / 86400000))
}

// The sales log's Staff column shows initials to save width -- first letter
// of the first two words for a multi-word name ("James Mensah" -> "JM"),
// or just the first two letters of a single-word name ("James" -> "JA"),
// always exactly 2 letters either way. Full name still shows on hover via
// the cell's own title attribute.
function staffInitials(name: string): string {
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
function formatLoss(l: { lossCount: number; lgAmt: number; gainCount?: number } | undefined): { text: string; cls: string } {
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
const COMPACT_SELECT_CLS = 'appearance-none truncate text-[8px] leading-tight px-1 py-1.5 pr-3 border rounded bg-no-repeat focus:outline-none focus:ring-1 focus:ring-blue-400'
const COMPACT_SELECT_STYLE: CSSProperties = {
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%234b5563'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z' clip-rule='evenodd'/%3E%3C/svg%3E\")",
  backgroundPosition: 'right 2px center',
  backgroundSize: '6px 6px',
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
// Returns every applicable issue, worst first -- callers stack one banner
// per flag (not just the worst one collapsed behind a "+N more"), so a
// genuinely broken item visibly shows everything wrong with it at a glance.
function itemAttentionFlags(
  item: LiveItem,
  duplicateItemIds: Set<number>,
  unlinkedNamedIds: Set<number>,
  serviceViolationIds: Set<number>,
  gainCountByItemId: Map<number, number>,
  emptyRowCountByItemId: Map<number, number>,
  soldBelowCostDatesByItemId: Map<number, string[]>,
  vcpJumpDatesByItemId: Map<number, string[]>
): { label: string; bg: string }[] {
  const soh = Number(item.soh)
  const sp = parseFloat(String(item.selling_price)) || 0
  // ACP (falling back to VCP if the item has no synced ACP yet) -- this is
  // the "true" current cost everything except Purchase Orders should read,
  // per the two-tier VCP/ACP model (see lib/vcpSync.ts).
  const cp = parseFloat(String(item.acp_price ?? item.cost_price)) || 0
  const flags: { label: string; bg: string }[] = []
  if (item.product_type !== 'service' && soh < 0) flags.push({ label: '⚠ NEGATIVE STOCK', bg: 'bg-red-600' })
  // A gain (count came in ABOVE what records support) is just as much a
  // violation as a loss -- it always means a bill/GMC take was never
  // entered or an earlier count was wrong. It doesn't fix itself, so it
  // has to surface the same way negative stock/duplicates do until a
  // staff member finds the missing record (or corrects the count). The
  // count rides along on the banner itself -- it used to also show as
  // "Gain N" in the CP/SP/loss line, which just repeated the same number.
  const gainCount = gainCountByItemId.get(item.id) ?? 0
  if (gainCount > 0) flags.push({ label: `🔺 STOCK GAIN: ${gainCount}`, bg: 'bg-red-600' })
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
  // A day row that made it into the item's own history but ended up with
  // every field blank/zero -- a phantom date with no real activity behind
  // it (e.g. a zero-quantity bill line). Doesn't affect stock math, but is
  // dead weight in the item's own record that's worth cleaning up.
  const emptyRowCount = emptyRowCountByItemId.get(item.id) ?? 0
  if (emptyRowCount > 0) flags.push({ label: `⚠ EMPTY DATA: ${emptyRowCount}`, bg: 'bg-gray-500' })
  return flags
}

function ItemHubPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawInitialTab = searchParams.get('tab')
  const oldTabView = rawInitialTab ? OLD_TAB_TO_VIEW[rawInitialTab] : undefined
  // 'losses' (the old standalone Loss Feed tab) and the old pl/cab/data/
  // manage/staff top-level tabs (all folded into Grony Cash by now) still
  // land somewhere sensible instead of silently falling back to Today.
  // 'expenses' used to be its own top-level tab too, then a LossView of its
  // own; now it's a liveMode tab like Sales/Bills, so it's handled the same
  // way 'losses' already is -- lands on 'loss', finished via the mount
  // effect below (jumpToLiveSaleTab isn't defined yet this early).
  const initialTab = (rawInitialTab === 'losses' || rawInitialTab === 'expenses' || oldTabView ? 'loss' : rawInitialTab) as OuterTab | null
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
    rawInitialTab === 'losses' || rawInitialTab === 'expenses' ? 'sales'
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
  // Seeded from ?jumpBillId= -- Item 360's VCP cell (see LossTab.tsx's
  // VcpCell / ItemDetailPanel's onBillClick) opens this in a new tab via
  // /item?tab=loss&view=sales&mode=bills&jumpBillId=..., same pattern as
  // jumpToReceiptDate above.
  const [jumpToBillId, setJumpToBillId] = useState<number | null>(
    searchParams.get('jumpBillId') ? Number(searchParams.get('jumpBillId')) : null
  )
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
  // JSX repeatedly. Sales/Bills/Loss by Date no longer need one of their
  // own -- all three live inside Live Sale's own laws panel now.
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
  const rawLiveGmcType = searchParams.get('liveGmcType')
  const [liveGmcTypeFilter, setLiveGmcTypeFilter] = useState<string | null>(rawLiveGmcType ?? null)
  const [liveHelpModalOpen, setLiveHelpModalOpen] = useState(false)
  const [liveShowLawsTasksModal, setLiveShowLawsTasksModal] = useState(false)
  const [liveSalesShowLawsTasksModal, setLiveSalesShowLawsTasksModal] = useState(false)
  const [liveBillsShowLawsTasksModal, setLiveBillsShowLawsTasksModal] = useState(false)
  // Priority order the Sale-mode grid arranges items in -- shared across
  // every staff member via /api/item-sort-order (any staff can change it,
  // not just owner), so a reorder here changes what everyone else's app
  // shows too, next time they load it. Starts at the same default the grid
  // always used (count status first, then violations, then today's sales)
  // until the real value loads.
  const [liveItemSortOrder, setLiveItemSortOrder] = useState<ItemSortKey[]>(DEFAULT_ITEM_SORT_ORDER)
  const [liveSortOrderModalOpen, setLiveSortOrderModalOpen] = useState(false)
  const rawLiveMode = searchParams.get('mode')
  const initialLiveMode = (rawLiveMode as 'sale' | 'sales' | 'bills' | 'log' | 'expenses' | null) ?? 'sale'
  const [liveMode, setLiveMode] = useState<'sale' | 'sales' | 'bills' | 'log' | 'expenses'>(initialLiveMode)
  const [itemsPageMode, setItemsPageMode] = useState<'sale' | 'sales' | 'bills' | 'log' | 'expenses'>(initialLiveMode)
  const rawLiveSalesViolation = searchParams.get('liveSalesViolation')
  const rawLiveBillsViolation = searchParams.get('liveBillsViolation')
  const [liveSalesViolationFilter, setLiveSalesViolationFilter] = useState<string | null>(rawLiveSalesViolation ?? null)
  const [liveBillsViolationFilter, setLiveBillsViolationFilter] = useState<string | null>(rawLiveBillsViolation ?? null)
  const rawLiveSaleFilter = searchParams.get('liveSaleFilter')
  const initialLiveSaleFilter: { kind: 'loss' } | { kind: 'gain' } | { kind: 'count_0' } | { kind: 'count_1' } | { kind: 'interval'; label: string } | { kind: 'flag'; key: string } | null =
    rawLiveSaleFilter === 'loss' ? { kind: 'loss' } :
    rawLiveSaleFilter === 'gain' ? { kind: 'gain' } :
    rawLiveSaleFilter === 'count_0' ? { kind: 'count_0' } :
    rawLiveSaleFilter === 'count_1' ? { kind: 'count_1' } :
    rawLiveSaleFilter?.startsWith('interval:') ? { kind: 'interval', label: rawLiveSaleFilter.slice(9) } :
    rawLiveSaleFilter?.startsWith('flag:') ? { kind: 'flag', key: rawLiveSaleFilter.slice(5) } :
    null
  const [liveSaleFilter, setLiveSaleFilter] = useState<{ kind: 'loss' } | { kind: 'gain' } | { kind: 'count_0' } | { kind: 'count_1' } | { kind: 'interval'; label: string } | { kind: 'flag'; key: string } | null>(initialLiveSaleFilter)
  const rawLiveSaleView = searchParams.get('liveSaleView')
  const initialLiveSaleView: { kind: 'grid' } | { kind: 'loss_by_date' } | { kind: 'loss_by_items' } | null =
    rawLiveSaleView === 'loss_by_date' ? { kind: 'loss_by_date' } :
    rawLiveSaleView === 'loss_by_items' ? { kind: 'loss_by_items' } :
    null
  const [liveSaleView, setLiveSaleView] = useState<{ kind: 'grid' } | { kind: 'loss_by_date' } | { kind: 'loss_by_items' } | null>(initialLiveSaleView)
  const rawLiveCountView = searchParams.get('liveCountView')
  const initialLiveCountView: { kind: 'interval'; label: string } | { kind: 'records' } | { kind: 'history' } | { kind: 'intervals' } | null =
    rawLiveCountView === 'records' ? { kind: 'records' } :
    rawLiveCountView === 'history' ? { kind: 'history' } :
    rawLiveCountView === 'intervals' ? { kind: 'intervals' } :
    rawLiveCountView?.startsWith('interval:') ? { kind: 'interval', label: rawLiveCountView.slice(9) } :
    { kind: 'records' }
  const [liveCountView, setLiveCountView] = useState<{ kind: 'interval'; label: string } | { kind: 'records' } | { kind: 'history' } | { kind: 'intervals' } | null>(initialLiveCountView)
  const rawLiveEmbeddedSearch = searchParams.get('liveSearch')
  const [liveEmbeddedSearch, setLiveEmbeddedSearch] = useState(rawLiveEmbeddedSearch ?? '')
  const [liveShowCountFullPage, setLiveShowCountFullPage] = useState(false)
  const [liveSaleViolationFilter, setLiveSaleViolationFilter] = useState<'all' | 'countDue' | 'counts' | 'lossGain' | 'duplicates' | 'unlinked' | 'service' | 'soldBelowCost' | 'vcpJump' | 'emptyRow' | 'withViolations' | 'noViolations' | 'lossbydate' | 'lossbyitems'>('noViolations')
  const [liveCountsRecordStatusFilter, setLiveCountsRecordStatusFilter] = useState<'all' | 'loss' | 'gain' | 'ok'>('all')
  const [liveCountDeleteLoading, setLiveCountDeleteLoading] = useState<number | null>(null)
  const [liveEditingItemIntervalId, setLiveEditingItemIntervalId] = useState<number | null>(null)
  const [liveEditingItemIntervalDays, setLiveEditingItemIntervalDays] = useState<string>('')
  const [liveEditingItemIntervalSaving, setLiveEditingItemIntervalSaving] = useState(false)
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
  const [liveSaleJumpTab, setLiveSaleJumpTab] = useState<'sale' | 'sales' | 'bills' | 'log' | 'expenses'>('sale')
  const [liveSaleJumpViolation, setLiveSaleJumpViolation] = useState<string | null>(null)
  const [liveSaleJumpSearch, setLiveSaleJumpSearch] = useState<string | null>(null)
  function jumpToLiveSaleTab(tab: 'sale' | 'sales' | 'bills' | 'log' | 'expenses', violation: string | null = null, search: string | null = null) {
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
  // Finishes the old ?tab=losses/?tab=expenses deep links (see the lossView
  // initializer above) -- can't call jumpToLiveSaleTab directly from that
  // initializer since it isn't defined yet that early in the component.
  useEffect(() => {
    if (rawInitialTab === 'losses') jumpToLiveSaleTab('sale')
    else if (rawInitialTab === 'expenses') jumpToLiveSaleTab('expenses')
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
        showToast(d.error || 'Could not rename group.', 'error')
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
    const noCp = items.filter(i => i.product_type !== 'service' && (!i.purchase_rate || parseFloat(i.purchase_rate) === 0)).length
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
  // 'Purchase Ord' -- or because the content page hardcodes its own
  // scopeKey independent of CASH_LABEL) -- see each page's own
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
  // "create new" flow wherever it already lives. Item reuses the existing
  // addForm mechanism (pickLossView resets it, so set it after);
  // Sales/Bills/Expenses land on Live Sale's own tab instead now (New Sale
  // is gone -- Sale mode's own tap-a-sale flow is the replacement; Bills'/
  // Expenses' "+ New Bill"/"+ New Expense" is one click away on its own tab
  // rather than opening pre-expanded); the rest reopen via a per-target
  // signal since their forms are local component state with no addForm
  // equivalent. Staff Time lands on Team Times, not a per-person page --
  // Personal has no Times row of its own anymore (see Team Times' own
  // history), but TimesTab's admin "add entry" form works the same
  // regardless of whose page it's opened from.
  function handleShortcut(key: ShortcutKey) {
    switch (key) {
      case 'sale':       jumpToLiveSaleTab('sale'); break
      case 'bill':       jumpToLiveSaleTab('bills'); break
      case 'item':       pickLossView('items');     setAddForm('item'); break
      case 'expense':    jumpToLiveSaleTab('expenses'); break
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
    if (liveGmcTypeFilter) params.set('liveGmcType', liveGmcTypeFilter); else params.delete('liveGmcType')
    if (liveSalesViolationFilter) params.set('liveSalesViolation', liveSalesViolationFilter); else params.delete('liveSalesViolation')
    if (liveBillsViolationFilter) params.set('liveBillsViolation', liveBillsViolationFilter); else params.delete('liveBillsViolation')
    if (liveSaleFilter) {
      const filterValue = liveSaleFilter.kind === 'interval' ? `interval:${liveSaleFilter.label}` : liveSaleFilter.kind
      params.set('liveSaleFilter', filterValue)
    } else params.delete('liveSaleFilter')
    if (liveSaleView && liveSaleView.kind !== 'grid') {
      const saleViewValue = liveSaleView.kind
      params.set('liveSaleView', saleViewValue)
    } else params.delete('liveSaleView')
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
  }, [outerTab, lossView, settingsOpen, itemsExtraView, group, productType, violation, showAnalytics, addForm, liveMode, liveProductTypeFilter, liveGroupFilter, liveGmcTypeFilter, liveSalesViolationFilter, liveBillsViolationFilter, liveSaleFilter, liveSaleView, liveCountView, liveEmbeddedSearch, sidePaneHidden])

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
    if (key === '__loss_feed') { jumpToLiveSaleTab('sale'); return }
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
    // Sales/Bills pills all land inside one of Live Sale's own
    // embedded tabs now, rather than a plain lossView -- see jumpToLiveSaleTab.
    if (targetView === 'sales' || targetView === 'bills') {
      jumpToLiveSaleTab(targetView, key)
      return
    }
    // Count records now display in Sale mode via checkboxes
    if (targetView === 'count') {
      jumpToLiveSaleTab('sale', key)
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
    'showNewCustomerLaws', 'showNewSaleLaws', 'showOpenerLaws',
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
  // the Sales row, then their own standalone rows. Now Sales, Bills, and
  // Loss by Date have all folded into Live Sale's own mode switcher
  // (Sale/Sales/Bills/Loss by Date/Log) the same way Count 2 and Log did
  // before them, so the 'sales' CASH_ITEMS row (now labeled "Live Sale") is
  // a plain row again like any other -- no more addForm-based sub-item
  // special-casing needed.
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
  // Date) -- the Analytics toggle and flag badges above it belong to
  // submenus that don't apply here, so they're just clutter.
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
  const liveGridEditQtyInputRef = useRef<HTMLInputElement>(null)
  const [liveGridEditLoading, setLiveGridEditLoading] = useState(false)
  const [liveGridEditError, setLiveGridEditError] = useState('')
  const [liveGridEditAliases, setLiveGridEditAliases] = useState<AliasRecord[]>([])
  const [liveGridEditMatches, setLiveGridEditMatches] = useState<MatchRecord[]>([])
  const [liveGridEditRelationsOpen, setLiveGridEditRelationsOpen] = useState(false)
  const [liveGridEditConfirmDelete, setLiveGridEditConfirmDelete] = useState(false)
  const [liveGridEditDeleting, setLiveGridEditDeleting] = useState(false)
  const [liveGridEditDeleteError, setLiveGridEditDeleteError] = useState('')
  const [liveGridEditSaving, setLiveGridEditSaving] = useState(false)
  const [liveGridEditCountQty, setLiveGridEditCountQty] = useState('')
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
  const [liveGmcTargetItem, setLiveGmcTargetItem] = useState<{ id: number; name: string; soh: number } | null>(null)
  const [liveGmcCountSaving, setLiveGmcCountSaving] = useState(false)
  const [liveTapStatus, setLiveTapStatus] = useState<string[]>([])
  const [liveTapTime, setLiveTapTime] = useState(() => {
    const now = new Date()
    return now.toISOString().slice(0, 16)
  })
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
  const [liveEditingTapId, setLiveEditingTapId] = useState<number | null>(null)
  const [liveEditingTapTime, setLiveEditingTapTime] = useState('')
  const [liveEditingTapSaving, setLiveEditingTapSaving] = useState(false)
  const [liveEditingCountTime, setLiveEditingCountTime] = useState('')
  const [liveEditingCountTimeSaving, setLiveEditingCountTimeSaving] = useState(false)
  const [liveReconcilingTaps, setLiveReconcilingTaps] = useState(false)
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' | 'info' }>>([])

  function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const id = Math.random().toString(36).slice(2, 9)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }

  function renderClickableItemName(itemName: string, className?: string) {
    const item = liveAllItems.find(it => it.name.toLowerCase() === itemName.toLowerCase())
    if (!item) return <span className={className}>{itemName}</span>
    return (
      <span
        onClick={() => setLiveViewingItemId(item.id)}
        className={`cursor-pointer text-blue-600 hover:text-blue-800 hover:underline transition ${className || ''}`}
      >
        {itemName}
      </span>
    )
  }

  useEffect(() => {
    if (liveEditingGridItemId != null && liveGridEditSaleTapRef.current) {
      setTimeout(() => {
        liveGridEditSaleTapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // Land straight in the Qty box with the numeric keypad already up --
        // tapping an item here means "I'm about to tap a sale," so typing
        // the quantity shouldn't need an extra tap to focus the field first.
        liveGridEditQtyInputRef.current?.focus()
      }, 100)
    }
  }, [liveEditingGridItemId])
  // "Large screen" -- breaks Live Sale out of the pane/content layout into a
  // fixed fullscreen overlay, covering this component's own top green bar
  // and footer (still mounted underneath, just visually hidden) -- so each
  // mode below renders its own copy of the mode toggle/filter bar/search
  // box while liveExpanded is true instead of relying on those.
  const liveRootClassName = `bg-white flex flex-col ${liveExpanded ? 'fixed inset-0 z-50 overflow-y-auto' : 'h-full'}`
  const [liveCurrentView, setLiveCurrentView] = useState<{ kind: 'violation' | 'serviceGroup' | 'lossByItem' | 'aliasWide' | 'serviceMatches' | 'newItem' | 'dailySummary' | 'gmcPacks'; key?: string; group?: string } | null>(null)
  // Sale mode's own item-grid filter -- Loss/Gain (from liveLossByItemId
  // below) and Low SOH (item.soh <= 0) are plain buckets; 'interval' reuses
  // each item's own count_interval string (the same Daily/Every Nd/Not
  // counted labels the Count tab's liveCountIntervalFlags buckets by) so a
  // cadence bucket here can never drift out of sync with the Count tab's own.
  const [liveItemPickerQuery, setLiveItemPickerQuery] = useState('')
  const [liveItemPickerResults, setLiveItemPickerResults] = useState<LiveItem[]>([])
  const [liveShowItemPicker, setLiveShowItemPicker] = useState(false)
  const [livePickedItemId, setLivePickedItemId] = useState<number | null>(null)
  // Sales/Bills/Loss by Date each kept their own laws/notes/tasks under
  // their own scopeKey (from back when each was its own page) -- still
  // sitting in the database under those same scope keys, so each tab gets
  // its own laws icon here to reach them, same as Sale mode's own
  // (liveSaleLaws, declared above).
  const salesLaws = useLawsPanel('showSalesLaws')
  const billsLaws = useLawsPanel('showBillsLaws')

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
  // 'bills' followed once the classic Sales Receipts list and Bills lost
  // anything that justified a separate sidebar destination once "New Sale"
  // was dropped. Loss by Date's own
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
    if (liveSaleJumpTab === 'sales') {
      // Keep the Sales radio row's mutual exclusivity intact -- jumping
      // straight to a violation should win over whatever History/Bars
      // Only/WIC/GMC was left selected from before.
      setLiveSalesShowHistory(false)
      setLiveSalesBarsOnly(false)
      setLiveSalesShowW(true)
      setLiveSalesShowG(true)
    }
    setLiveBillsViolationFilter(liveSaleJumpTab === 'bills' ? liveSaleJumpViolation : null)
    if (liveSaleJumpTab === 'bills') {
      // Keep the Bills radio row's mutual exclusivity intact -- same
      // reasoning as the Sales block above.
      setLiveBillsShowHistory(false)
      setLiveBillsAddingNew(false)
      setLiveBillsBarsOnly(false)
    }
    if (liveSaleJumpTab === 'expenses') {
      // Keep the Expenses radio row's mutual exclusivity intact -- same
      // reasoning as the Sales/Bills blocks above.
      setLiveExpensesShowHistory(false)
      setLiveExpensesAddingNew(false)
      setLiveExpensesActiveFlag(null)
    }
    setLiveEmbeddedSearch(liveSaleJumpSearch ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveSaleJumpSeq])
  const [liveDailyItems, setLiveDailyItems] = useState<DueItem[]>([])
  const [liveGmcWeeklyItems, setLiveGmcWeeklyItems] = useState<DueItem[]>([])
  const [liveOverdueItems, setLiveOverdueItems] = useState<DueItem[]>([])
  // "Count(2/2000)" summary above the tab switcher -- total items expected
  // to be counted at some point vs. how many already have a count logged
  // today. null until first loaded, so the summary stays hidden rather than
  // flashing "Count(0/0)".
  const [liveCountProgress, setLiveCountProgress] = useState<{ total: number; doneToday: number } | null>(null)
  const [liveCountQty, setLiveCountQty] = useState('')
  const [liveCountSaving, setLiveCountSaving] = useState(false)
  const [liveCountError, setLiveCountError] = useState('')
  const [liveDebugLogs, setLiveDebugLogs] = useState<string[]>([])
  const addCountLog = (msg: string) => {
    console.log(msg)
    setLiveDebugLogs(prev => [...prev, msg])
    setTimeout(() => setLiveDebugLogs(prev => prev.slice(1)), 5000)
  }
  const [liveLossPrompt, setLiveLossPrompt] = useState<LossPrompt | null>(null)
  const [liveGainPrompt, setLiveGainPrompt] = useState<GainPrompt | null>(null)
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
  const [liveShowCountDue, setLiveShowCountDue] = useState(false)
  // Bills has no internal "add new" of its own (unlike Sales, which this
  // tap-to-sell mode already covers) -- it always relied on its own tab
  // rendering NewBillForm as a sibling, so that comes along with it.
  const [liveBillsAddingNew, setLiveBillsAddingNew] = useState(false)
  // Expenses has no internal "add new" of its own either -- same pattern as
  // Bills, reusing the standalone /expenses/new form as a sibling.
  const [liveExpensesAddingNew, setLiveExpensesAddingNew] = useState(false)
  const [liveSalesShowAnalytics, setLiveSalesShowAnalytics] = useState(false)
  const [liveBillsShowAnalytics, setLiveBillsShowAnalytics] = useState(false)
  const [liveExpensesShowAnalytics, setLiveExpensesShowAnalytics] = useState(false)
  // Sales tab's own History/Bars Only/W/G controls -- owned here (not inside
  // SalesTab) so they can render alongside the violation-filter radios in
  // this component's own header row instead of a second row of their own.
  const [liveSalesShowHistory, setLiveSalesShowHistory] = useState(false)
  const [liveSalesBarsOnly, setLiveSalesBarsOnly] = useState(false)
  const [liveSalesShowW, setLiveSalesShowW] = useState(true)
  const [liveSalesShowG, setLiveSalesShowG] = useState(true)
  // Period (month/year), the Columns picker, and the bulk-attach toggle,
  // moved up the same way so they render on the same bar as Search/Filter
  // instead of a second row inside SalesTab. colPrefs itself is owned here
  // too (not just its button) -- useColumnPrefs is a hook, so the button
  // and the table it controls have to share the exact same instance.
  const [liveSalesMonthFilter, setLiveSalesMonthFilter] = useState<number | null>(null)
  const [liveSalesYearFilter, setLiveSalesYearFilter] = useState<number | null>(null)
  const [liveSalesShowBulkAttach, setLiveSalesShowBulkAttach] = useState(false)
  const [liveSalesAvailableYears, setLiveSalesAvailableYears] = useState<number[]>([])
  const liveSalesColPrefs = useColumnPrefs<SalesColKey>('salesTable', SALES_COLUMNS)
  // Bills tab's own History/Bars Only/Vendor/Month/Year/colPrefs -- same
  // lift-up treatment Sales already got, for the same reason (render
  // alongside the violation radios in this component's own header row).
  const [liveBillsShowHistory, setLiveBillsShowHistory] = useState(false)
  const [liveBillsBarsOnly, setLiveBillsBarsOnly] = useState(false)
  const [liveBillsVendorFilter, setLiveBillsVendorFilter] = useState<string | null>(null)
  const [liveBillsMonthFilter, setLiveBillsMonthFilter] = useState<number | null>(null)
  const [liveBillsYearFilter, setLiveBillsYearFilter] = useState<number | null>(null)
  const [liveBillsAvailableVendors, setLiveBillsAvailableVendors] = useState<string[]>([])
  const [liveBillsAvailableYears, setLiveBillsAvailableYears] = useState<number[]>([])
  const liveBillsColPrefs = useColumnPrefs<BillsColKey>('billsTab', BILLS_COLUMNS)
  // Expenses tab's own History/flag-violation state -- same lift-up
  // treatment as Sales/Bills, so they render in one mutually-exclusive
  // radio row alongside New Expense. colPrefs stays inside ExpensesTab
  // itself (not lifted) -- its storage key depends on several other
  // ExpensesTab-local view states (groupBy, property filters) that aren't
  // being lifted, so colPrefs has to stay co-located with them.
  const [liveExpensesShowHistory, setLiveExpensesShowHistory] = useState(false)
  const [liveExpensesActiveFlag, setLiveExpensesActiveFlag] = useState<'similar' | 'bundled' | 'no_vendor' | 'properties_no_location' | null>(null)
  const [liveExpensesFlagCounts, setLiveExpensesFlagCounts] = useState<Record<'similar' | 'bundled' | 'no_vendor' | 'properties_no_location', number>>({
    similar: 0, bundled: 0, no_vendor: 0, properties_no_location: 0,
  })
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

  // Item id -> cost price, for the Log tab's CP/Profit columns -- a tap only
  // carries its own sale price, not the item's cost, so this looks it up
  // from the same catalogue fetch everything else here already uses.
  // Services never carry their own cost_price (it's cleared/zeroed by
  // design -- cost pricing belongs on the GMC material they actually
  // consume, see migrate-service-gmc-data), so a service's cost is instead
  // however many units of its converts_to_item_id material one tap uses
  // (units_per_pack) times THAT item's own cost price.
  const liveCostPriceByItemId = useMemo(() => {
    const byId = new Map<number, LiveItem>()
    for (const item of liveAllItems) byId.set(item.id, item)
    const m = new Map<number, number>()
    for (const item of liveAllItems) {
      if (item.product_type === 'service' && item.converts_to_item_id) {
        const target = byId.get(item.converts_to_item_id)
        const targetCost = target ? parseFloat(String(target.cost_price)) || 0 : 0
        const perTap = parseFloat(String(item.units_per_pack)) || 1
        m.set(item.id, perTap * targetCost)
      } else {
        m.set(item.id, parseFloat(String(item.cost_price)) || 0)
      }
    }
    return m
  }, [liveAllItems])

  // SalesTab/BillsTab expect items shaped {id, item_name, cf_group} -- Live
  // Sale's own item list already uses {id, name, group} for everything
  // else, so this is just a field-name adapter, not a different data
  // source (same trick countsTabItems used to use for CountsTab).
  const liveSalesBillsItems = useMemo(
    () => liveAllItems.map(i => ({ id: i.id, item_name: i.name, cf_group: i.group, selling_price: i.selling_price })),
    [liveAllItems]
  )

  // The Sales header's whole radio row (All/violations/History/Bars Only/
  // WIC/GMC) behaves as one mutually-exclusive group even though it's
  // backed by several separate state variables (kept separate rather than
  // merged into one enum, since liveSalesViolationFilter alone is already
  // read/written elsewhere -- URL persistence, deep-link jumps, the Sale
  // mode Filter dropdown's flag list). liveSalesRadioValue derives which
  // single option is "selected" from that state, and selectLiveSalesRadio
  // is the one place that changes it, always clearing every other option.
  const liveSalesRadioValue = liveSalesShowHistory ? 'history'
    : liveSalesBarsOnly ? 'bars_only'
    : liveSalesViolationFilter ? liveSalesViolationFilter
    : (liveSalesShowW && !liveSalesShowG) ? 'wic'
    : (!liveSalesShowW && liveSalesShowG) ? 'gmc'
    : 'all'
  function selectLiveSalesRadio(value: string) {
    const violationKeys = ['no_cash', 'missing_days', 'dup_receipt', 'high_wnw', 'no_attachment']
    setLiveSalesShowHistory(value === 'history')
    setLiveSalesBarsOnly(value === 'bars_only')
    setLiveSalesViolationFilter(violationKeys.includes(value) ? value : null)
    setLiveSalesShowW(value !== 'gmc')
    setLiveSalesShowG(value !== 'wic')
  }

  // Same mutually-exclusive-radio-row treatment for Bills: All/violations/
  // New Bill/Bars Only/History. New Bill fits the same "exclusive view
  // selector" set as History -- both swap the whole content area out for
  // something other than the plain bill list (a create form vs. an audit
  // log), same as a violation filter swaps it for a filtered list.
  const liveBillsRadioValue = liveBillsShowHistory ? 'history'
    : liveBillsAddingNew ? 'new_bill'
    : liveBillsBarsOnly ? 'bars_only'
    : liveBillsViolationFilter ? liveBillsViolationFilter
    : 'all'
  function selectLiveBillsRadio(value: string) {
    const violationKeys = ['no_vendor', 'no_items_bills', 'bill_total_mismatch', 'bill_no_attachment']
    setLiveBillsShowHistory(value === 'history')
    setLiveBillsAddingNew(value === 'new_bill')
    setLiveBillsBarsOnly(value === 'bars_only')
    setLiveBillsViolationFilter(violationKeys.includes(value) ? value : null)
  }

  // Same treatment for Expenses: All/New Expense/History/the four flag
  // violations as one mutually-exclusive radio group. No Bars Only
  // equivalent -- Expenses' list has no day-bar/item-line grouping like
  // Sales/Bills' receipts do.
  const EXPENSES_FLAG_KEYS = ['similar', 'bundled', 'no_vendor', 'properties_no_location'] as const
  const liveExpensesRadioValue = liveExpensesShowHistory ? 'history'
    : liveExpensesAddingNew ? 'new_expense'
    : liveExpensesActiveFlag ? liveExpensesActiveFlag
    : 'all'
  function selectLiveExpensesRadio(value: string) {
    setLiveExpensesShowHistory(value === 'history')
    setLiveExpensesAddingNew(value === 'new_expense')
    setLiveExpensesActiveFlag((EXPENSES_FLAG_KEYS as readonly string[]).includes(value) ? value as typeof EXPENSES_FLAG_KEYS[number] : null)
  }

  // Merges the 3 due-count queues into one per-item lookup for Count
  // mode's grid badges -- daily/7-day GMC items are "due", 15-day items
  // are "overdue" (a stronger color); an item in none of the 3 just isn't
  // due right now. The queues never overlap the same item in practice
  // (each excludes the others' item set server-side), so layering order
  // here only matters as a safety default, not a real precedence rule.
  const liveCountStatus = useMemo(() => {
    const map = new Map<number, { level: 'due' | 'overdue'; label: string; days_overdue: number | null }>()
    for (const it of liveDailyItems) {
      map.set(it.item_id, { level: 'due', label: !it.days_overdue || it.days_overdue <= 0 ? 'Today' : `${it.days_overdue}d`, days_overdue: it.days_overdue })
    }
    for (const it of liveGmcWeeklyItems) {
      map.set(it.item_id, { level: 'due', label: !it.days_overdue || it.days_overdue <= 0 ? 'Due' : `${it.days_overdue}d`, days_overdue: it.days_overdue })
    }
    for (const it of liveOverdueItems) {
      map.set(it.item_id, { level: 'overdue', label: `${it.days_overdue ?? '?'}d`, days_overdue: it.days_overdue })
    }
    return map
  }, [liveDailyItems, liveGmcWeeklyItems, liveOverdueItems])

  // Map of item_id to last_count_date for items due for counting
  const liveLastCountDateByItemId = useMemo(() => {
    const map = new Map<number, string | null>()
    for (const it of liveDailyItems) {
      map.set(it.item_id, it.last_count_date)
    }
    for (const it of liveGmcWeeklyItems) {
      map.set(it.item_id, it.last_count_date)
    }
    for (const it of liveOverdueItems) {
      map.set(it.item_id, it.last_count_date)
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
    no_cp: liveAllItems.filter(i => i.product_type !== 'service' && (!i.cost_price || parseFloat(String(i.cost_price)) === 0)).map(i => i.id),
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

  // Shared across every staff member -- see /api/item-sort-order.
  useEffect(() => {
    fetch('/api/item-sort-order')
      .then(r => r.json())
      .then((d: { order?: ItemSortKey[] }) => {
        if (Array.isArray(d?.order) && d.order.length === DEFAULT_ITEM_SORT_ORDER.length) setLiveItemSortOrder(d.order)
      })
      .catch(() => {})
  }, [])

  // Persists immediately (no separate Save step) -- any staff member can
  // write this, so there's no confirm/cancel flow to gate; the swap is its
  // own confirmation. Optimistic: the grid re-sorts right away, the fetch
  // just makes it stick for everyone else too.
  function moveItemSortKey(key: ItemSortKey, dir: -1 | 1) {
    setLiveItemSortOrder(prev => {
      const i = prev.indexOf(key)
      const j = i + dir
      if (i < 0 || j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      fetch('/api/item-sort-order', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: next }),
      }).catch(() => {})
      return next
    })
  }

  // Loss count/amount per item -- same numbers Item 360's own loss ranking
  // is built from (/api/losses/summary), shown inline next to price/cost/
  // stock/count-interval so a loss-prone item is visible without opening
  // its Item 360 detail. Fetched once, same as the GMC id set above.
  const [liveLossByItemId, setLiveLossByItemId] = useState<Map<number, { lossCount: number; lgAmt: number; gainCount: number; emptyRowCount: number }>>(new Map())
  useEffect(() => {
    fetch('/api/losses/summary')
      .then(r => r.json())
      .then((d: { item_id: number; lossCount: number; lgAmt: number; gainCount: number; emptyRowCount: number }[]) => {
        setLiveLossByItemId(new Map(Array.isArray(d) ? d.map(r => [r.item_id, { lossCount: r.lossCount, lgAmt: r.lgAmt, gainCount: r.gainCount, emptyRowCount: r.emptyRowCount }]) : []))
      })
      .catch(() => {})
  }, [])

  // First/last recorded sale date and average monthly quantity per item --
  // off the item's full sales_receipt_lines history (see
  // /api/items/sale-history), shown next to CP/SP/SOH same as the loss
  // figures above. Fetched once, same pattern.
  const [liveSaleHistoryByItemId, setLiveSaleHistoryByItemId] = useState<Map<number, { firstSaleDate: string; lastSaleDate: string; avgMonthlyQty: number }>>(new Map())
  useEffect(() => {
    fetch('/api/items/sale-history')
      .then(r => r.json())
      .then((d: { item_id: number; first_sale_date: string; last_sale_date: string; avg_monthly_qty: number }[]) => {
        setLiveSaleHistoryByItemId(new Map(Array.isArray(d) ? d.map(r => [r.item_id, { firstSaleDate: r.first_sale_date, lastSaleDate: r.last_sale_date, avgMonthlyQty: r.avg_monthly_qty }]) : []))
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
  // Item id -> every date it had a past sale line at or under today's cost
  // price -- sourced from /api/flags' costGteSell. This is now the only
  // place this violation lives (the old Sales tab flag of the same query
  // was removed -- all item-level flags start from Live Sale), so it both
  // drives the item card's "SOLD BELOW COST (history)" banner and the
  // ACP > SP count in the Sale mode header below.
  const liveSoldBelowCostDatesByItemId = useMemo(() => {
    const m = new Map<number, string[]>()
    for (const r of globalFlags?.costGteSell ?? []) {
      const date = r.receipt_date?.slice(0, 10)
      if (!date) continue
      if (!m.has(r.item_id)) m.set(r.item_id, [])
      if (!m.get(r.item_id)!.includes(date)) m.get(r.item_id)!.push(date)
    }
    for (const dates of m.values()) dates.sort()
    return m
  }, [globalFlags])
  // Item id -> every bill date where that item's VCP jumped 20%+ from its
  // own previous bill -- sourced from /api/flags' vcpJumps (same threshold
  // as Item 360's own VCP jump badge, see LossTab.tsx's computeVcpJumps).
  // Drives the item card's "VCP JUMP (history)" banner below.
  const liveVcpJumpDatesByItemId = useMemo(() => {
    const m = new Map<number, string[]>()
    for (const r of globalFlags?.vcpJumps ?? []) {
      const date = r.bill_date?.slice(0, 10)
      if (!date) continue
      if (!m.has(r.item_id)) m.set(r.item_id, [])
      if (!m.get(r.item_id)!.includes(date)) m.get(r.item_id)!.push(date)
    }
    for (const dates of m.values()) dates.sort()
    return m
  }, [globalFlags])
  // Fourth cross-item check: any item with an outstanding count gain (see
  // liveLossByItemId above), fed straight off the same per-item loss/gain
  // map the grid already fetches for its Loss/Gain badge. Keeps the actual
  // count (not just a Set of flagged ids) so the STOCK GAIN banner can show
  // "STOCK GAIN: N" instead of just flagging the item.
  const liveGainCountByItemId = useMemo(() => {
    const counts = new Map<number, number>()
    liveLossByItemId.forEach((v, id) => { if ((v.gainCount ?? 0) > 0) counts.set(id, v.gainCount ?? 0) })
    return counts
  }, [liveLossByItemId])
  // Fifth cross-item check: any item with day rows that are entirely
  // blank/zero (count, WIC, GMC, bills, converted-in all empty) -- a
  // phantom date with no real data behind it. Same map, same reasoning.
  const liveEmptyRowCountByItemId = useMemo(() => {
    const counts = new Map<number, number>()
    liveLossByItemId.forEach((v, id) => { if ((v.emptyRowCount ?? 0) > 0) counts.set(id, v.emptyRowCount ?? 0) })
    return counts
  }, [liveLossByItemId])

  // Violation counts for filter bar
  const liveDuplicateCount = liveDuplicateItemIds.size
  const liveUnlinkedCount = liveUnlinkedNamedIds.size
  const liveServiceViolationCount = liveServiceViolationIdSet.size
  const liveGainCount = liveGainCountByItemId.size
  const liveSoldBelowCostCount = liveSoldBelowCostDatesByItemId.size
  const liveVcpJumpCount = liveVcpJumpDatesByItemId.size
  const liveEmptyRowCount = liveEmptyRowCountByItemId.size

  // Items with any loss or gain records needing trade-off resolution
  const liveItemsWithLossOrGainIds = useMemo(() => {
    const ids = new Set<number | null>()
    for (const rec of liveCountRecords) {
      if (rec.kind === 'loss' || rec.kind === 'gain') {
        ids.add(rec.item_id)
      }
    }
    return ids
  }, [liveCountRecords])
  const liveItemsWithLossOrGainCount = liveItemsWithLossOrGainIds.size

  // Fetch taps
  useEffect(() => {
    fetch('/api/sales/live-taps')
      .then(r => r.json())
      .then(d => {
        const taps = Array.isArray(d) ? d.filter((t): t is Tap => t != null) : []
        setLiveTaps(taps)
      })
      .catch(() => setLiveTaps([]))
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

  function loadCountProgress() {
    fetch('/api/stock/count-progress')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => setLiveCountProgress({ total: d.total ?? 0, doneToday: d.doneToday ?? 0 }))
      .catch(() => {})
  }
  useEffect(loadCountProgress, [])
  usePolling(loadCountProgress, 60000)

  // Count Records -- fetched when viewing the Count Records view, showing full-page
  // count display in Sale mode, or viewing Loss by Date/Items views. Unlike the queues
  // above, this is the full all-time history, not a small due-today list.
  const liveViewingCountRecords = liveCountView?.kind === 'records' || liveShowCountFullPage || liveSaleView?.kind === 'loss_by_date' || liveSaleView?.kind === 'loss_by_items'
  useEffect(() => {
    if (!liveViewingCountRecords) {
      setLiveCountRecords([])
      return
    }
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
        if (Array.isArray(results)) {
          const sorted = results.sort((a, b) => {
            const aHasSoh = Number(a.soh) > 0
            const bHasSoh = Number(b.soh) > 0
            if (aHasSoh === bHasSoh) return 0
            return aHasSoh ? -1 : 1
          })
          setLiveItemPickerResults(sorted)
        } else {
          setLiveItemPickerResults([])
        }
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
    for (const tap of (liveTaps || [])) {
      if (tap && !tap.undone) {
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
    const countZeroSoh = baseFiltered.filter(it => Number(it.soh) === 0).length
    const countOneSoh = baseFiltered.filter(it => Number(it.soh) === 1).length

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
      { key: 'count_0', label: 'Count of 0', count: countZeroSoh },
      { key: 'count_1', label: 'Count of 1', count: countOneSoh },
      ...intervalFlags,
      { key: 'flag_negative_stock', label: '⚠ Negative Stock', count: negativeStockCount },
      { key: 'flag_duplicate', label: '⚠ Duplicate Item', count: duplicateCount },
      { key: 'flag_service_violation', label: '⚠ Service Violation', count: serviceViolationCount },
      { key: 'flag_unlinked', label: '⚠ Unlinked Sale', count: unlinkedCount },
      { key: 'flag_missing_selling_price', label: '⚠ No/Zero Selling Price', count: missingSellingPriceCount },
      { key: 'flag_missing_cost_price', label: '⚠ No/Zero Cost Price (Goods)', count: missingCostPriceCount },
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

    // Apply search query filter - filter table in real-time as user types
    if (liveItemPickerQuery.trim()) {
      const query = liveItemPickerQuery.toLowerCase()
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.group?.toLowerCase().includes(query)
      )
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

    // Apply GMC type filter
    if (liveGmcTypeFilter !== null) {
      if (liveGmcTypeFilter === 'none') {
        filtered = filtered.filter(item => !item.gmc_type || item.gmc_type === '')
      } else {
        filtered = filtered.filter(item => item.gmc_type === liveGmcTypeFilter)
      }
    }

    // GMC (internal use) only ever taps items with a GMC history -- keeps
    // the browse grid from offering a normal walk-in item under an
    // internal-use receipt. Doesn't apply to a deliberately searched-and-
    // picked item above, since that's how an item gets its first-ever GMC
    // record in the first place.
    if (liveMode === 'sale' && liveSaleType === 'GMC') {
      filtered = filtered.filter(item => liveGmcItemIds.has(item.id))
    }

    // Show only items due for count when the filter is active in Sale mode
    if (liveSaleViolationFilter === 'countDue' && liveMode === 'sale') {
      filtered = filtered.filter(item => liveCountStatus.has(item.id))
    }

    // Apply Sale mode's own Loss/Gain/Count/count-interval/flag filter
    if (liveSaleFilter?.kind === 'loss') {
      filtered = filtered.filter(item => (liveLossByItemId.get(item.id)?.lossCount ?? 0) > 0)
    } else if (liveSaleFilter?.kind === 'gain') {
      filtered = filtered.filter(item => (liveLossByItemId.get(item.id)?.gainCount ?? 0) > 0)
    } else if (liveSaleFilter?.kind === 'count_0') {
      filtered = filtered.filter(item => Number(item.soh) === 0)
    } else if (liveSaleFilter?.kind === 'count_1') {
      filtered = filtered.filter(item => Number(item.soh) === 1)
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
  }, [liveAllItems, liveSalesCounts, liveCurrentView, liveProductTypeFilter, liveGroupFilter, liveGmcTypeFilter, livePickedItemId, liveSaleType, liveGmcItemIds, liveMode, liveSaleFilter, liveLossByItemId, liveItemsWithViolations, liveDuplicateItemIds, liveServiceViolationIdSet, liveUnlinkedNamedIds, liveItemPickerQuery, liveSaleViolationFilter, liveCountStatus])

  // Log tab's two histories, grouped by date -- computed unconditionally
  // (not inside an `if (liveMode === 'log')` branch) since every mode
  // renders from the same mounted component instance, switched by
  // liveMode; a useMemo that only ran while liveMode==='log' would change
  // the hook count the moment you switched tabs and crash the page.
  const liveTapsByDate = useMemo(() => {
    const groups = new Map<string, typeof liveTaps>()
    for (const tap of liveTaps) {
      if (!tap || !tap.tapped_at) continue
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

  // Fetch target GMC item info when a GMC service is selected
  // Handles two cases:
  // 1. GMC item as its own service (no converts_to_item_id) - track its own SOH
  // 2. Service using GMC material (has converts_to_item_id) - track the material's SOH
  useEffect(() => {
    if (!liveSelectedItem) {
      setLiveGmcTargetItem(null)
      return
    }

    const isGmcService = liveSelectedItem.product_type === 'service' && liveSelectedItem.gmc_type

    if (!isGmcService) {
      setLiveGmcTargetItem(null)
      return
    }

    // Determine which item to track:
    // - If converts_to_item_id exists, track the material being consumed
    // - Otherwise, track the GMC item's own SOH
    const targetItemId = liveSelectedItem.converts_to_item_id || liveSelectedItem.id

    // Fetch target item info including SOH
    fetch(`/api/items/${targetItemId}`)
      .then(r => r.json())
      .then(data => {
        if (data && data.canonical_name && data.calculated_soh !== undefined) {
          setLiveGmcTargetItem({
            id: targetItemId,
            name: data.canonical_name,
            soh: parseFloat(data.calculated_soh) || 0,
          })
        }
      })
      .catch(() => setLiveGmcTargetItem(null))
  }, [liveSelectedItem])

  const liveItemsWithTradeOffs = useMemo(() => {
    const byItemId = new Map<number | null, ItemTradeOff>()

    for (const rec of liveCountRecords) {
      if (rec.kind === 'loss' || rec.kind === 'gain') {
        const key = rec.item_id
        if (!byItemId.has(key)) {
          byItemId.set(key, {
            itemId: key,
            itemName: rec.item_name,
            lossQty: 0,
            gainQty: 0,
            net: 0,
            tradeOffRecords: []
          })
        }
        const entry = byItemId.get(key)!
        entry.tradeOffRecords.push(rec)

        const qty = Math.abs(rec.loss_qty ?? 0)
        if (rec.kind === 'loss') {
          entry.lossQty += qty
        } else {
          entry.gainQty += qty
        }
      }
    }

    // Calculate net and filter to only items that have both loss and gain
    const result: ItemTradeOff[] = []
    for (const entry of byItemId.values()) {
      if (entry.lossQty > 0 && entry.gainQty > 0) {
        entry.net = entry.lossQty - entry.gainQty
        result.push(entry)
      }
    }

    return result.sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
  }, [liveCountRecords])

  const liveTradeOffByItemId = useMemo(() => {
    const map = new Map<number | null, ItemTradeOff>()
    for (const item of liveItemsWithTradeOffs) {
      map.set(item.itemId, item)
    }
    return map
  }, [liveItemsWithTradeOffs])

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

  // Loss records organized by item name for "Loss by Items" view
  const liveLossesByItem = useMemo(() => {
    const q = liveEmbeddedSearch.trim().toLowerCase()
    const losses = liveCountRecords.filter(rec => {
      if (rec.kind !== 'loss') return false
      if (q && !rec.item_name.toLowerCase().includes(q)) return false
      return true
    })
    const groups = new Map<string, typeof liveCountRecords>()
    for (const rec of losses) {
      const itemName = rec.item_name
      if (!groups.has(itemName)) groups.set(itemName, [])
      groups.get(itemName)!.push(rec)
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([itemName, recs]) => [itemName, recs.sort((a, b) => new Date(b.count_date).getTime() - new Date(a.count_date).getTime())] as const)
  }, [liveCountRecords, liveEmbeddedSearch])

  // Loss records organized by date for "Loss by Date" view
  const liveLossesByDate = useMemo(() => {
    const q = liveEmbeddedSearch.trim().toLowerCase()
    const losses = liveCountRecords.filter(rec => {
      if (rec.kind !== 'loss') return false
      if (q && !rec.item_name.toLowerCase().includes(q)) return false
      return true
    })
    const groups = new Map<string, typeof liveCountRecords>()
    for (const rec of losses) {
      const date = rec.count_date.slice(0, 10)
      if (!groups.has(date)) groups.set(date, [])
      groups.get(date)!.push(rec)
    }
    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a))
  }, [liveCountRecords, liveEmbeddedSearch])

  // Sale mode count records display - shows individual records with trade-off matching
  // Each record shows when it was counted, item, status, and whether it can be offset
  // by a gain/loss of the same item from a different count
  const liveSaleCountRecords = useMemo(() => {
    const q = liveEmbeddedSearch.trim().toLowerCase()

    // Filter records by Loss/Gain violation and search
    const filtered = liveCountRecords.filter(rec => {
      // Show different record types based on the active filter
      if (liveSaleViolationFilter === 'lossGain') {
        // Loss/Gain filter: show only loss/gain records
        if (rec.kind !== 'loss' && rec.kind !== 'gain') return false
      } else if (liveSaleViolationFilter === 'counts') {
        // Counts filter: show ALL records (loss/gain/ok)
        // No filtering by kind needed
      } else {
        // Other filters: show only counted records (no loss/gain)
        if (rec.kind === 'loss' || rec.kind === 'gain') return false
      }

      if (q && !rec.item_name.toLowerCase().includes(q)) return false
      return true
    })

    // For each record, find potential trade-off opportunities with other records
    type RecordWithTradeOff = typeof filtered[0] & {
      tradeOffWith?: { id: number; kind: 'loss' | 'gain' | null; qty: number; date: string }
    }

    const withTradeOffs: RecordWithTradeOff[] = filtered.map(rec => {
      // For loss records, find gains of same item; for gains, find losses
      if (rec.kind === 'loss' || rec.kind === 'gain') {
        const targetKind = rec.kind === 'loss' ? 'gain' : 'loss'
        const opposite = liveCountRecords.find(other =>
          other.item_id === rec.item_id &&
          other.id !== rec.id &&
          other.kind === targetKind
        )
        if (opposite) {
          return {
            ...rec,
            tradeOffWith: {
              id: opposite.id,
              kind: opposite.kind,
              qty: Math.abs(opposite.loss_qty ?? 0),
              date: opposite.count_date.slice(0, 10),
            }
          }
        }
      }
      return rec
    })

    // Sort by count_date descending (newest first)
    return withTradeOffs.sort((a, b) => b.count_date.localeCompare(a.count_date))
  }, [liveCountRecords, liveSaleViolationFilter, liveEmbeddedSearch])

  // Identify items with trade-off opportunities and calculate their net position
  type ItemTradeOff = {
    itemId: number | null
    itemName: string
    lossQty: number
    gainQty: number
    net: number // positive = net loss, negative = net gain
    tradeOffRecords: CountRecord[]
  }

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
  // to a separate count screen. Which of count status/violations/today's
  // sales takes priority (and whether due items end up pinned as their own
  // block up top at all) is configurable now -- see liveItemSortOrder and
  // the Arrange Order picker below.
  //
  // Violation count per item, precomputed once rather than recomputed
  // inside the sort comparator below (which would call itemAttentionFlags
  // O(n log n) times instead of O(n)) -- render still calls it again per
  // card since it needs the actual flag list, not just the count.
  const liveViolationCountByItemId = useMemo(() => {
    const m = new Map<number, number>()
    for (const item of liveCatalogueItems) {
      m.set(item.id, itemAttentionFlags(item, liveDuplicateItemIds, liveUnlinkedNamedIds, liveServiceViolationIdSet, liveGainCountByItemId, liveEmptyRowCountByItemId, liveSoldBelowCostDatesByItemId, liveVcpJumpDatesByItemId).length)
    }
    return m
  }, [liveCatalogueItems, liveDuplicateItemIds, liveUnlinkedNamedIds, liveServiceViolationIdSet, liveGainCountByItemId, liveEmptyRowCountByItemId, liveSoldBelowCostDatesByItemId, liveVcpJumpDatesByItemId])

  // The Sale-mode grid's arrangement -- a single list sorted by whichever
  // priority order liveItemSortOrder currently holds (see the Arrange
  // Order picker, shared across every staff member via
  // /api/item-sort-order), rather than a hardcoded due-items-always-first
  // split. Each criterion resolves to a score where higher sorts earlier;
  // ties fall through to the next criterion in the configured order.
  const liveSortedCatalogueItems = useMemo(() => {
    if (liveMode !== 'sale') return liveCatalogueItems

    // Filter to violation items based on selected violation filter
    let itemsToSort = liveCatalogueItems
    if (liveSaleViolationFilter === 'countDue') {
      itemsToSort = liveCatalogueItems.filter(item => {
        const status = liveCountStatus.get(item.id)
        return status && status.level === 'overdue'
      })
    } else if (liveSaleViolationFilter === 'lossGain') {
      itemsToSort = liveCatalogueItems.filter(item => liveItemsWithLossOrGainIds.has(item.id))
    } else if (liveSaleViolationFilter === 'duplicates') {
      itemsToSort = liveCatalogueItems.filter(item => liveDuplicateItemIds.has(item.id))
    } else if (liveSaleViolationFilter === 'unlinked') {
      itemsToSort = liveCatalogueItems.filter(item => liveUnlinkedNamedIds.has(item.id))
    } else if (liveSaleViolationFilter === 'service') {
      itemsToSort = liveCatalogueItems.filter(item => liveServiceViolationIdSet.has(item.id))
    } else if (liveSaleViolationFilter === 'soldBelowCost') {
      itemsToSort = liveCatalogueItems.filter(item => liveSoldBelowCostDatesByItemId.has(item.id))
    } else if (liveSaleViolationFilter === 'vcpJump') {
      itemsToSort = liveCatalogueItems.filter(item => liveVcpJumpDatesByItemId.has(item.id))
    } else if (liveSaleViolationFilter === 'emptyRow') {
      itemsToSort = liveCatalogueItems.filter(item => liveEmptyRowCountByItemId.has(item.id))
    } else if (liveSaleViolationFilter === 'withViolations') {
      itemsToSort = liveCatalogueItems.filter(item => liveViolationCountByItemId.has(item.id) && (liveViolationCountByItemId.get(item.id) ?? 0) > 0)
    }
    // noViolations shows all items but hides violation banners (handled in render, not filtering)

    const scoreFns: Record<ItemSortKey, (item: LiveItem) => number> = {
      count_status: item => {
        const d = liveCountStatus.get(item.id)
        if (!d) return 0
        // Items never counted (days_overdue is null) get highest priority
        if (d.days_overdue === null) return 2000
        const days = d.days_overdue ?? 0
        return (d.level === 'overdue' ? 1000 : 0) + days
      },
      violations: item => liveViolationCountByItemId.get(item.id) ?? 0,
      // Folds in the old "0 SOH sorts last" tie-break as part of this one
      // criterion's own score, rather than a separate sort pass. That
      // tie-break only makes sense for goods -- services aren't physical
      // stock, so their soh is always 0 and would otherwise get every
      // single service demoted below every good with any stock at all,
      // splitting goods and services into two solid blocks regardless of
      // actual sales. Services are treated as always "in stock" here so
      // they interleave with goods purely by sales count instead.
      badge: item => {
        const hasSoh = item.product_type === 'service' || Number(item.soh) > 0
        const sales = liveSalesCounts.get(item.id) ?? 0
        return hasSoh ? 1_000_000 + sales : sales
      },
    }
    return [...itemsToSort].sort((a, b) => {
      for (const key of liveItemSortOrder) {
        const diff = scoreFns[key](b) - scoreFns[key](a)
        if (diff !== 0) return diff
      }
      return 0
    })
  }, [liveCatalogueItems, liveCountStatus, liveMode, liveViolationCountByItemId, liveSalesCounts, liveItemSortOrder, liveSaleViolationFilter, liveItemsWithTradeOffs, liveDuplicateItemIds, liveUnlinkedNamedIds, liveServiceViolationIdSet, liveGainCountByItemId, liveSoldBelowCostDatesByItemId, liveVcpJumpDatesByItemId, liveEmptyRowCountByItemId])

  // How many leading items are due for a count -- only meaningful (and only
  // used to draw the "N items need counting" header + divider) when count
  // status is the TOP-priority criterion, since that's the only ordering
  // where due items are guaranteed to land as a contiguous prefix rather
  // than scattered through the list.
  const liveDueCatalogueCount = useMemo(() => {
    if (liveItemSortOrder[0] !== 'count_status') return 0
    let count = 0
    for (const item of liveSortedCatalogueItems) {
      if (liveCountStatus.has(item.id)) count++
    }
    return count
  }, [liveSortedCatalogueItems, liveCountStatus, liveItemSortOrder])

  function addTapStatus(msg: string) {
    console.log('[recordTap]', msg)
    setLiveTapStatus(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${msg}`])
  }

  async function recordTap(item?: LiveItem) {
    addTapStatus('STARTED - checking item & quantity')
    const tapItem = item || liveSelectedItem
    if (!tapItem || !liveQty) {
      const missing = !tapItem ? 'item' : 'quantity'
      addTapStatus(`ERROR: Missing ${missing}`)
      showToast(`Missing: ${missing}`, 'error')
      return
    }
    addTapStatus(`✓ Item: ${tapItem.name}, Qty: ${liveQty}`)
    setLiveSaving(true)
    setLiveTapError('')

    const qtyNum = Number(liveQty)
    const priceNum = livePrice ? Number(livePrice) : Number(tapItem.selling_price)

    if (qtyNum <= 0) {
      addTapStatus('ERROR: Quantity must be > 0')
      setLiveTapError('Quantity must be greater than 0')
      setLiveSaving(false)
      return
    }

    if (priceNum <= 0) {
      addTapStatus('ERROR: Price must be > 0')
      setLiveTapError('Price must be greater than 0')
      setLiveSaving(false)
      return
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    try {
      addTapStatus('Sending to API...')
      const res = await fetch('/api/sales/live-tap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: tapItem.id,
          quantity: qtyNum,
          customPrice: livePrice ? priceNum : undefined,
          isGMC: liveSaleType === 'GMC',
          tapTime: liveTapTime,
        }),
        signal: controller.signal,
      })

      addTapStatus(`API responded: ${res.status} ${res.statusText}`)
      let data
      try {
        data = await res.json()
        addTapStatus('Parsed response JSON')
      } catch (parseErr) {
        const errMsg = `JSON parse error: ${res.status} ${res.statusText}`
        addTapStatus(`ERROR: ${errMsg}`)
        setLiveTapError(errMsg)
        showToast(errMsg, 'error')
        setLiveSaving(false)
        clearTimeout(timeoutId)
        return
      }

      if (!res.ok) {
        const errMsg = data.error || `Server error: ${res.status}`
        addTapStatus(`ERROR: ${errMsg}`)
        setLiveTapError(errMsg)
        showToast(errMsg, 'error')
        setLiveSaving(false)
        clearTimeout(timeoutId)
        return
      }

      if (!data.tap) {
        const errMsg = 'Server returned invalid response - no tap data'
        addTapStatus(`ERROR: ${errMsg}`)
        setLiveTapError(errMsg)
        showToast(errMsg, 'error')
        setLiveSaving(false)
        clearTimeout(timeoutId)
        return
      }

      addTapStatus(`✓✓✓ SUCCESS - Tap recorded!`)
      setLiveTaps(prev => [data.tap, ...prev])
      if (!item) setLiveSelectedItem(null)
      setLiveQty('')
      setLivePrice('')
      setTimeout(() => setLiveTapStatus([]), 2000)
      showToast(`✓ ${tapItem.name} × ${qtyNum} recorded`, 'success')

      // Check if target GMC item SOH reached 0
      if (data.targetSohAfterReduction !== undefined && data.targetSohAfterReduction !== null) {
        const gmcItemName = data.targetItemName || tapItem.name
        if (Math.abs(data.targetSohAfterReduction) < 0.001) {
          showToast(`⚠ Stock depleted! Restock "${gmcItemName}" now`, 'error')
        } else if (data.targetSohAfterReduction < 5) {
          showToast(`⚠ Low stock: "${gmcItemName}" (${data.targetSohAfterReduction} left)`, 'info')
        }
      }

      alert(`✓ Tap Recorded!\n${tapItem.name} × ${qtyNum}`)
    } catch (e) {
      const errMsg = e instanceof Error && e.name === 'AbortError'
        ? 'Request timed out - server not responding'
        : e instanceof Error ? e.message : 'Network error - check connection'
      addTapStatus(`ERROR: ${errMsg}`)
      setLiveTapError(errMsg)
      showToast(errMsg, 'error')
    } finally {
      addTapStatus('Cleanup - done')
      clearTimeout(timeoutId)
      setLiveSaving(false)
    }
  }

  async function recordCountAndSale() {
    if (!liveSelectedItem || !liveGmcTargetItem || !liveQty) {
      showToast('Missing required data', 'error')
      return
    }

    const qtyNum = Number(liveQty)
    if (qtyNum <= 0) {
      showToast('Quantity must be greater than 0', 'error')
      return
    }

    setLiveGmcCountSaving(true)
    setLiveTapError('')

    try {
      // First, record the sale tap
      const tapRes = await fetch('/api/sales/live-tap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: liveSelectedItem.id,
          quantity: qtyNum,
          customPrice: livePrice ? Number(livePrice) : undefined,
          isGMC: liveSaleType === 'GMC',
          tapTime: liveTapTime,
        }),
      })

      const tapData = await tapRes.json()
      if (!tapRes.ok) {
        setLiveTapError(tapData.error || 'Failed to record sale')
        showToast(tapData.error || 'Failed to record sale', 'error')
        setLiveGmcCountSaving(false)
        return
      }

      // Then, record a stock count for the target GMC item
      const remainingQty = Math.max(0, liveGmcTargetItem.soh - qtyNum)
      const countRes = await fetch('/api/stock/count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: liveGmcTargetItem.id,
          qty: remainingQty,
          notes: `Auto-counted when ${liveSelectedItem.name} service was recorded`,
        }),
      })

      const countData = await countRes.json()
      if (!countRes.ok) {
        // Sale was recorded successfully, but count failed. Show warning but continue.
        showToast(`Sale recorded, but count failed: ${countData.error || 'Unknown error'}`, 'info')
      } else {
        showToast(`✓ ${liveSelectedItem.name} sale & ${liveGmcTargetItem.name} count recorded`, 'success')
      }

      // Clear the form on success
      setLiveTaps(prev => [tapData.tap, ...prev])
      setLiveSelectedItem(null)
      setLiveQty('')
      setLivePrice('')
      setLiveGmcTargetItem(null)
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Network error'
      setLiveTapError(errMsg)
      showToast(errMsg, 'error')
    } finally {
      setLiveGmcCountSaving(false)
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

  // One-off fix for taps undone before undo actually reversed the receipt
  // line it fed into (see reverseTapReceiptEffect in lib/liveSales.ts) --
  // those still show their full quantity in Sales/stock totals. Safe to
  // run more than once; a second run finds nothing left to reverse.
  async function reconcileUndoneTaps() {
    if (!confirm('Fix past undone sales that were never removed from totals? This only affects taps already undone in the Log.')) return
    setLiveReconcilingTaps(true)
    try {
      const res = await fetch('/api/sales/live-taps/reconcile', { method: 'POST' })
      const d = await res.json().catch(() => null)
      if (res.ok) {
        showToast(d?.message ?? 'Done', 'success')
      } else {
        showToast(d?.error ?? 'Could not run the fix', 'error')
      }
    } catch (e) {
      showToast('Could not run the fix', 'error')
    } finally {
      setLiveReconcilingTaps(false)
    }
  }

  async function saveEditingTapTime() {
    if (!liveEditingTapId || !liveEditingTapTime) return
    setLiveEditingTapSaving(true)
    try {
      const tapDateTime = new Date(liveEditingTapTime + ':00Z')
      const res = await fetch(`/api/sales/live-taps/${liveEditingTapId}?action=update-time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tappedAt: tapDateTime.toISOString() }),
      })
      if (res.ok) {
        const data = await res.json()
        setLiveTaps(prev => prev.map(t => t.id === liveEditingTapId ? { ...t, tapped_at: data.tapped_at } : t))
        setLiveEditingTapId(null)
        setLiveEditingTapTime('')
        showToast('Tap time updated', 'success')
      } else {
        setLiveTapError('Could not save tap time')
        showToast('Could not save tap time', 'error')
      }
    } catch (e) {
      setLiveTapError('Could not save tap time')
      showToast('Could not save tap time', 'error')
    } finally {
      setLiveEditingTapSaving(false)
    }
  }

  // Same /api/stock/count contract CountsTab's own CountRow/ManualCountForm
  // already submit through -- a pack-pairing or loss-reason requirement
  // comes back as a 409 with a flag the caller re-submits against once the
  // prompt is answered, not a plain error, so this mirrors that retry shape
  // exactly rather than reinventing it. Used by the inline "Count today's
  // stock" field the Sale sheet grows for a due item (see the modal below).
  async function submitCount(item: LiveItem, qty: number, lossExtra?: LossExtra) {
    addCountLog(`submitCount called: item=${item.id}, qty=${qty}`)
    setLiveCountSaving(true)
    setLiveCountError('')
    try {
      addCountLog(`Sending count to API: itemId=${item.id}, qty=${qty}`)
      const res = await fetch('/api/stock/count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, qty, notes: '', ...(lossExtra ?? {}) }),
      })
      setLiveCountSaving(false)
      addCountLog(`Count API response: status=${res.status}, ok=${res.ok}`)
      if (res.ok) {
        addCountLog(`✓ Count saved successfully`)
        setLiveDailyItems(prev => prev.filter(i => i.item_id !== item.id))
        setLiveGmcWeeklyItems(prev => prev.filter(i => i.item_id !== item.id))
        setLiveOverdueItems(prev => prev.filter(i => i.item_id !== item.id))
        loadCountProgress()
        setLiveCountQty('')
        showToast(`✓ ${item.name} counted`, 'success')
        return
      }
      const d = await res.json().catch(() => null)
      addCountLog(`✗ Count API error: ${d?.error ?? 'unknown error'}`)
      if (res.status === 409 && d?.requires_pack_count) {
        setLivePairingPrompt({ itemName: item.name, packs: d.packs, retry: () => submitCount(item, qty, lossExtra) })
        return
      }
      if (res.status === 409 && d?.requires_loss_reason) {
        setLiveLossPrompt({ d, retry: extra => submitCount(item, qty, extra) })
        return
      }
      const errMsg = d?.error ?? 'Could not save count.'
      setLiveCountError(errMsg)
      showToast(errMsg, 'error')
    } catch (error) {
      setLiveCountSaving(false)
      addCountLog(`✗ submitCount error: ${error instanceof Error ? error.message : String(error)}`)
      const errMsg = error instanceof Error ? error.message : 'Network error - could not save count'
      setLiveCountError(errMsg)
      showToast(errMsg, 'error')
      console.error('submitCount error:', error)
    }
  }

  // Groups/conversion-target list ItemEditForm needs, derived from the
  // catalogue Live Sale already has loaded rather than a separate fetch.
  const liveEditGroups = useMemo(() =>
    Array.from(new Set(liveAllItems.map(i => i.group).filter((g): g is string => !!g))).sort()
  , [liveAllItems])
  const liveEditAllItemsList = useMemo(() =>
    liveAllItems.map(i => ({ item_id: i.id, item_name: i.name, gmc_type: i.gmc_type }))
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
        unit_time_seconds: d?.unit_time_seconds != null ? String(d.unit_time_seconds) : '',
        converts_to_item_id: d?.converts_to_item_id ? String(d.converts_to_item_id) : '',
        count_excluded: !!d?.count_excluded,
        count_cadence_days: d?.count_cadence_days != null ? String(d.count_cadence_days) : '',
        count_excluded_reason: d?.count_excluded_reason ?? '',
        gmc_type: d?.gmc_type ?? '',
        product_type: d?.product_type ?? '',
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
    setLiveGridEditRelationsOpen(false)
    setLiveTapStatus([])
    // Reset from whatever the previously-opened item left behind -- these
    // only get set below if the fetch actually finds rows for THIS item, so
    // without this an item with zero aliases/matches would keep showing the
    // last item's aliases/matches instead of "—".
    setLiveGridEditAliases([])
    setLiveGridEditMatches([])
    try {
      const item = liveAllItems.find(i => i.id === itemId)
      if (!item) {
        setLiveGridEditError('Item not found')
        setLiveGridEditLoading(false)
        return
      }

      // Scoped to this one item (?itemId=/?name=) rather than the whole
      // aliases/matches tables -- opening an item used to cost a full-table
      // fetch+aggregate just to find this one item's own rows, which is why
      // this sheet could take a while to appear as the catalogue grew.
      const [itemRes, aliasesRes, matchesRes] = await Promise.all([
        fetch(`/api/items/${itemId}`),
        fetch(`/api/aliases/wide?itemId=${itemId}`),
        fetch(`/api/good-service-matches?name=${encodeURIComponent(item.name)}`)
      ])

      if (!itemRes.ok) {
        setLiveGridEditError(`Failed to load item: ${itemRes.status}`)
        setLiveGridEditLoading(false)
        return
      }

      const d = await itemRes.json()
      setLiveEditForm({
        item_name: d?.canonical_name ?? item.name,
        cf_group: d?.cf_group ?? '',
        selling_rate: d?.selling_price != null ? String(d.selling_price) : '',
        purchase_rate: d?.purchase_rate != null ? String(d.purchase_rate) : '',
        units_per_pack: d?.units_per_pack != null ? String(d.units_per_pack) : '',
        unit_name: d?.unit_name ?? '',
        unit_time_seconds: d?.unit_time_seconds != null ? String(d.unit_time_seconds) : '',
        converts_to_item_id: d?.converts_to_item_id ? String(d.converts_to_item_id) : '',
        count_excluded: !!d?.count_excluded,
        count_cadence_days: d?.count_cadence_days != null ? String(d.count_cadence_days) : '',
        count_excluded_reason: d?.count_excluded_reason ?? '',
        gmc_type: d?.gmc_type ?? '',
        product_type: d?.product_type ?? '',
      })
      setLiveEditCurrentCountInterval(d?.count_interval ?? null)
      setLiveEditCurrentSoh(d?.calculated_soh != null ? parseFloat(d.calculated_soh) : null)

      if (aliasesRes.ok) {
        const aliasesData = await aliasesRes.json()
        if (Array.isArray(aliasesData)) {
          const itemAliases = aliasesData.find((row: any) => row.item_id === itemId)
          const aliases = itemAliases?.aliases ?? []
          setLiveGridEditAliases(aliases.map((a: any) => ({ id: a.id, name: a.name })).filter((a: AliasRecord) => a.name))
        }
      }

      if (matchesRes.ok) {
        const matchesData = await matchesRes.json()
        if (Array.isArray(matchesData)) {
          setLiveGridEditMatches(matchesData.map((m: any) => ({ id: m.id, name: m.good_name === item.name ? m.service_name : m.good_name })))
        }
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

async function recordCountFromModal(lossExtra?: LossExtra, gainExtra?: GainExtra) {
    if (!liveEditingGridItemId || !liveGridEditCountQty) return
    setLiveGridEditCountSaving(true)
    setLiveGridEditCountError('')

    const qtyNum = Number(liveGridEditCountQty)

    if (qtyNum < 0 || isNaN(qtyNum)) {
      setLiveGridEditCountError('Quantity cannot be negative')
      setLiveGridEditCountSaving(false)
      return
    }

    try {
      const res = await fetch('/api/stock/count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: liveEditingGridItemId,
          qty: qtyNum,
          notes: 'Grid count',
          ...(lossExtra ?? {}),
          ...(gainExtra ?? {}),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (res.status === 409 && data?.requires_pack_count) {
          const itemName = liveAllItems.find(i => i.id === liveEditingGridItemId)?.name ?? ''
          setLivePairingPrompt({ itemName, packs: data.packs, retry: () => recordCountFromModal(lossExtra, gainExtra) })
          return
        }
        if (res.status === 409 && data?.requires_gain_confirmation) {
          setLiveGainPrompt({ d: data, retry: extra => recordCountFromModal(lossExtra, extra) })
          return
        }
        if (res.status === 409 && data?.requires_loss_reason) {
          setLiveLossPrompt({ d: data, retry: extra => recordCountFromModal(extra, gainExtra) })
          return
        }
        setLiveGridEditCountError(data.error || 'Could not record count')
        return
      }
      setLiveGridEditCountQty('')
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
        unit_time_seconds: liveEditForm.unit_time_seconds ? parseInt(liveEditForm.unit_time_seconds, 10) : null,
        converts_to_item_id: liveEditForm.converts_to_item_id ? Number(liveEditForm.converts_to_item_id) : null,
        count_excluded: liveEditForm.count_excluded,
        count_cadence_days: liveEditForm.count_cadence_days ? parseInt(liveEditForm.count_cadence_days, 10) : null,
        count_excluded_reason: liveEditForm.count_excluded_reason || null,
        gmc_type: liveEditForm.gmc_type || null,
        product_type: liveEditForm.product_type || null,
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
      gmc_type: updated.gmc_type ?? prev.gmc_type,
    } : prev)
    // Refetch the full catalogue so this item's price/group/count-interval
    // label update everywhere else in Live Sale (grid, other views), not
    // just inside this sheet.
    fetch('/api/items/all').then(r => r.json()).then(d => setLiveAllItems(Array.isArray(d) ? d : [])).catch(() => {})
    setLiveEditingSelectedItem(false)
  }

  // Save only the GMC type field immediately when the tick button is clicked,
  // without waiting for the full form save or closing the edit mode.
  // Works for both sale-tap sheet and grid edit modal items.
  async function saveGmcTypeOnly(gmcType: string) {
    const itemId = liveSelectedItem?.id || liveEditingGridItemId
    if (!itemId) {
      throw new Error('No item to save')
    }
    try {
      const res = await fetch(`/api/items/${itemId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gmc_type: gmcType || null }),
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'API error' }))
        throw new Error(error.error || 'Failed to save GMC type')
      }
      const updated = await res.json()
      // Update the selected item in sale-tap sheet
      if (liveSelectedItem && liveSelectedItem.id === itemId) {
        setLiveSelectedItem(prev => {
          if (prev && prev.id === itemId) {
            return {
              ...prev,
              gmc_type: updated.gmc_type ?? prev.gmc_type,
            }
          }
          return prev
        })
      }
      // Refresh the item list so grid shows updated values
      fetch('/api/items/all').then(r => r.json()).then(d => setLiveAllItems(Array.isArray(d) ? d : [])).catch(() => {})
    } catch (e) {
      throw e
    }
  }

  async function saveConversionTargetOnly(convertToItemId: string | null) {
    // Works for both sale-tap sheet (liveSelectedItem) and grid edit modal (liveEditingGridItemId)
    const itemId = liveSelectedItem?.id || liveEditingGridItemId
    if (!itemId) return
    try {
      const res = await fetch(`/api/items/${itemId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ converts_to_item_id: convertToItemId ? Number(convertToItemId) : null }),
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'API error' }))
        const errorMsg = error.error || 'Failed to save conversion target'
        setLiveEditError(errorMsg)
        setLiveGridEditError(errorMsg)
        return
      }
      const updated = await res.json()
      setLiveEditForm(prev => ({ ...prev, converts_to_item_id: updated.converts_to_item_id ? String(updated.converts_to_item_id) : '' }))
      // Clear errors on success
      setLiveEditError('')
      setLiveGridEditError('')
      // Refresh items list
      fetch('/api/items/all').then(r => r.json()).then(d => setLiveAllItems(Array.isArray(d) ? d : [])).catch(() => {})
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to save conversion target'
      setLiveEditError(errorMsg)
      setLiveGridEditError(errorMsg)
    }
  }

  async function saveGridEditItem() {
    if (!liveEditingGridItemId) return
    setLiveEditSaving(true)
    setLiveGridEditError('')
    const res = await fetch(`/api/items/${liveEditingGridItemId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_name: liveEditForm.item_name || undefined,
        cf_group: liveEditForm.cf_group || null,
        selling_rate: liveEditForm.selling_rate ? parseFloat(liveEditForm.selling_rate) : null,
        purchase_rate: liveEditForm.purchase_rate ? parseFloat(liveEditForm.purchase_rate) : null,
        units_per_pack: liveEditForm.units_per_pack ? parseFloat(liveEditForm.units_per_pack) : null,
        unit_name: liveEditForm.unit_name || null,
        unit_time_seconds: liveEditForm.unit_time_seconds ? parseInt(liveEditForm.unit_time_seconds, 10) : null,
        converts_to_item_id: liveEditForm.converts_to_item_id ? Number(liveEditForm.converts_to_item_id) : null,
        count_excluded: liveEditForm.count_excluded,
        count_cadence_days: liveEditForm.count_cadence_days ? parseInt(liveEditForm.count_cadence_days, 10) : null,
        count_excluded_reason: liveEditForm.count_excluded_reason || null,
        gmc_type: liveEditForm.gmc_type || null,
        product_type: liveEditForm.product_type || null,
      }),
    })
    setLiveEditSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => null)
      setLiveGridEditError(d?.error ?? 'Could not save changes.')
      return
    }
    // Refresh items list so grid shows updated values everywhere
    fetch('/api/items/all').then(r => r.json()).then(d => setLiveAllItems(Array.isArray(d) ? d : [])).catch(() => {})
    setLiveEditingGridItemId(null)
    setLiveViewingItemId(null)
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
      showToast('Count updated', 'success')
    } else {
      const d = await res.json().catch(() => null)
      if (res.status === 409 && d?.requires_loss_reason) {
        setLiveLossPrompt({ d, retry: extra => saveEditCount(extra) })
        return
      }
      const errMsg = d?.error ?? 'Could not save count.'
      showToast(errMsg, 'error')
    }
  }

  async function deleteCountRecord(r: CountRecord) {
    const dateLabel = new Date(r.count_date.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    if (!confirm(`Delete the count of ${Number(r.quantity_counted)} for "${r.item_name}" on ${dateLabel}? This changes the loss/gain math from that day onward.`)) return
    const res = await fetch(`/api/stock/counts/${r.id}`, { method: 'DELETE' })
    if (res.ok) {
      setLiveCountRecords(prev => prev.filter(x => x.id !== r.id))
      if (liveEditingCountId === r.id) setLiveEditingCountId(null)
      showToast('Count deleted', 'success')
    } else {
      const errMsg = (await res.json().catch(() => null))?.error ?? 'Could not delete count.'
      showToast(errMsg, 'error')
    }
  }

  async function saveEditingCountTime() {
    if (!liveEditingCountId || !liveEditingCountTime) return
    setLiveEditingCountTimeSaving(true)
    try {
      const countDateTime = new Date(liveEditingCountTime + ':00Z')
      const res = await fetch(`/api/stock/counts/${liveEditingCountId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counted_at: countDateTime.toISOString() }),
      })
      if (res.ok) {
        const data = await res.json()
        setLiveCountRecords(prev => prev.map(r => r.id === liveEditingCountId ? { ...r, counted_at: data.counted_at } : r))
        setLiveEditingCountId(null)
        setLiveEditingCountTime('')
        showToast('Count time updated', 'success')
      } else {
        showToast('Could not save count time', 'error')
      }
    } catch (e) {
      showToast('Could not save count time', 'error')
    } finally {
      setLiveEditingCountTimeSaving(false)
    }
  }

  // The tab switcher for Items page internal navigation -- allows switching
  // between the items table and Live Sale modes without changing the sidebar.
  function renderTabSwitcher(compact: boolean) {
    // Each tab is its own standalone button (own background/border) rather
    // than a segment inside one shared pill -- an inactive tab used to be
    // just plain text sitting on the container's own gray-200 background,
    // which read as one continuous switch instead of separate buttons.
    const btnCls = (active: boolean, color: string) =>
      `font-bold rounded-md border transition whitespace-nowrap shrink-0 ${compact ? 'px-1.5 py-1 text-[10px]' : 'px-2 py-1 text-xs'} ${
        active ? `${color} text-white border-transparent` : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
      }`
    // Always one line -- scrolls horizontally rather than wrapping onto a
    // second row when there isn't room for all buttons.
    return (
      <div className="flex gap-6 overflow-x-auto max-w-full">
        <button type="button" onClick={() => { setItemsPageMode('sale'); setLiveMode('sale') }} title="Sale" className={btnCls(itemsPageMode === 'sale', 'bg-blue-600')}>Sale</button>
        <button type="button" onClick={() => { setItemsPageMode('log'); setLiveMode('log') }} title="Log" className={btnCls(itemsPageMode === 'log', 'bg-gray-700')}>Log</button>
        <button type="button" onClick={() => { setItemsPageMode('sales'); setLiveMode('sales') }} title="Sales" className={btnCls(itemsPageMode === 'sales', 'bg-emerald-600')}>Sales</button>
        <button type="button" onClick={() => { setItemsPageMode('bills'); setLiveMode('bills') }} title="Bills" className={btnCls(itemsPageMode === 'bills', 'bg-orange-600')}>Bills</button>
        <button type="button" onClick={() => { setItemsPageMode('expenses'); setLiveMode('expenses') }} title="Expenses" className={btnCls(itemsPageMode === 'expenses', 'bg-rose-600')}>Expenses</button>
      </div>
    )
  }

  // Deprecated: use renderTabSwitcher instead. Kept for any remaining references.
  function renderModeToggle(compact: boolean) {
    return renderTabSwitcher(compact)
  }

  // "Corrected/worked on today" summary, one line per mode, shown above the
  // tab switcher. Only modes with a real, existing notion of "today's total"
  // get a number -- right now that's just the count-cadence flags task
  // (every countable item has a known cadence and stock_counts rows are
  // dated, so total/doneToday are both real), labeled "Flags" since "Count"
  // alone reads as a page name rather than a task. Sale mode gets its own
  // always-on "Sold Below Cost" violation count instead (see liveSoldBelowCostDatesByItemId) --
  // the one item-level violation that's meant to be visible right on Live
  // Sale's own header rather than buried in a Flags dropdown. Log/Sales/
  // Bills have no such total (their violations are open-ended backlogs, not
  // a fixed today's-list), so they render nothing rather than a fake/
  // misleading count. Whoever's assigned to it (see AssignWidget type="flags"
  // on the Count mode's own page) shows right alongside the number.
  function renderModeProgressSummary(compact: boolean, dark: boolean) {
    if (liveMode === 'sale') {
      return null
    }
    if (!liveCountProgress || liveCountProgress.total === 0) return null
    const assignee = assignments['flags']
    return (
      <div className={`flex items-center justify-center gap-2 ${compact ? 'text-[9px]' : 'text-[10px]'} ${dark ? 'text-white/70' : 'text-gray-500'}`}>
        <span className={`font-semibold ${dark ? 'text-white/90' : 'text-gray-700'}`}>Flags</span>
        <span>({liveCountProgress.doneToday}/{liveCountProgress.total})</span>
        {assignee && <span className="capitalize">— {assignee}</span>}
      </div>
    )
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
          {liveMode === 'sale' && renderModeProgressSummary(false, false)}
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
          value={liveGmcTypeFilter || ''}
          onChange={e => setLiveGmcTypeFilter(e.target.value || null)}
          className="text-[10px] px-2 py-0.5 rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400 flex-1"
        >
          <option value="">GMC Types</option>
          <option value="none">None</option>
          <option value="gmc">GMC</option>
          <option value="service_no_gmc">Service only</option>
          <option value="pack_to_gmc">PKG→GMC</option>
          <option value="service_using_gmc">SVC/GMC</option>
        </select>
        <select
          value={liveSaleFilter ? liveSaleFilter.kind === 'interval' ? `interval:${liveSaleFilter.label}` : liveSaleFilter.kind === 'flag' ? `flag:${liveSaleFilter.key}` : liveSaleFilter.kind : liveCurrentView?.kind === 'violation' ? `violation:${liveCurrentView.key}` : liveCurrentView?.kind === 'aliasWide' ? 'view:aliasWide' : liveCurrentView?.kind === 'serviceMatches' ? 'view:serviceMatches' : liveCurrentView?.kind === 'gmcPacks' ? 'view:gmcPacks' : ''}
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
              else if (viewKey === 'gmcPacks') setLiveCurrentView({ kind: 'gmcPacks' as const })
            } else {
              setLiveCurrentView(null)
              setLiveSaleFilter({ kind: v as 'loss' | 'gain' | 'count_0' | 'count_1' })
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

  // Sales tab filter bar (Laws & Tasks only)
  function renderSalesFiltersBar() {
    return (
      <select
        value=""
        onChange={e => {
          const v = e.target.value
          if (v === 'help:laws') {
            setLiveSalesShowLawsTasksModal(true)
          }
        }}
        className="text-xs px-1.5 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white w-16 shrink-0"
      >
        <option value="">Filter</option>
        <option value="help:laws">⚖️ Laws & Tasks</option>
      </select>
    )
  }

  // Bills tab filter bar (Laws & Tasks only -- violations moved to their own
  // radio buttons in the header, same as Sales' filter bar)
  function renderBillsFiltersBar() {
    return (
      <select
        value=""
        onChange={e => {
          const v = e.target.value
          if (v === 'help:laws') {
            setLiveBillsShowLawsTasksModal(true)
          }
        }}
        className="text-xs px-1.5 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white w-16 shrink-0"
      >
        <option value="">Filter</option>
        <option value="help:laws">⚖️ Laws & Tasks</option>
      </select>
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
                        <p className="text-xs font-semibold truncate">{renderClickableItemName(rec.item_name, 'text-gray-900')}</p>
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
                          {rec.counted_at && (
                            <button
                              type="button"
                              onClick={() => {
                                setLiveEditingCountId(rec.id)
                                setLiveEditingCountTime(rec.counted_at!.slice(0, 16))
                              }}
                              title="Edit time"
                              className="text-[10px] font-bold text-blue-600 hover:bg-blue-100 rounded leading-none px-1.5 py-0.5"
                            >
                              🕐
                            </button>
                          )}
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

  function renderLossesByDateTable() {
    const COUNT_RECORDS_GRID = 'grid-cols-[minmax(7rem,1.4fr)_5rem_3rem_4rem_4rem_4rem_5rem_4rem_minmax(6rem,1fr)]'
    return (
      <div className="flex-1 overflow-auto">
        {liveLossesByDate.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            {liveCountRecords.length === 0 ? 'No counts recorded' : 'No losses found'}
          </p>
        ) : (
          <div className="inline-block min-w-full">
            <div className={`grid ${COUNT_RECORDS_GRID} gap-0 bg-gray-50 border-b border-gray-200 sticky top-0 z-10`}>
              <div className="sticky left-0 z-10 bg-gray-50 px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase">Item</div>
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase">Group</div>
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase text-center">Qty</div>
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase text-center">Exp</div>
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase text-center">Loss</div>
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase text-center">Time</div>
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase">By</div>
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase">Source</div>
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase">Notes</div>
            </div>
            {liveLossesByDate.map(([date, dateRecs]) => (
              <div key={date}>
                <div className={`grid ${COUNT_RECORDS_GRID} gap-0 bg-red-50 border-b border-red-200 sticky top-[26px] z-9`}>
                  <div className="col-span-9 px-2 py-1 text-[10px] font-semibold text-red-700">
                    {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {dateRecs.length} losses
                  </div>
                </div>
                {dateRecs.map(rec => (
                  <div key={rec.id}>
                    <div className={`group grid ${COUNT_RECORDS_GRID} gap-0 border-b border-gray-100 items-center hover:bg-gray-50 transition`}>
                      <div className="sticky left-0 z-[1] bg-white group-hover:bg-gray-50 px-2 py-1">
                        <p className="text-xs font-semibold truncate">{renderClickableItemName(rec.item_name, 'text-gray-900')}</p>
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
                        <p className="text-xs font-bold text-red-600">
                          -{fmtN(Math.abs(rec.loss_qty ?? 0))}
                        </p>
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
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  function renderLossesByItemsTable() {
    const COUNT_RECORDS_GRID = 'grid-cols-[minmax(7rem,1.4fr)_5rem_3rem_4rem_4rem_4rem_5rem_4rem_minmax(6rem,1fr)]'
    return (
      <div className="flex-1 overflow-auto">
        {liveLossesByItem.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            {liveCountRecords.length === 0 ? 'No counts recorded' : 'No losses found'}
          </p>
        ) : (
          <div className="inline-block min-w-full">
            <div className={`grid ${COUNT_RECORDS_GRID} gap-0 bg-gray-50 border-b border-gray-200 sticky top-0 z-10`}>
              <div className="sticky left-0 z-10 bg-gray-50 px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase">Item</div>
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase">Group</div>
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase text-center">Qty</div>
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase text-center">Exp</div>
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase text-center">Loss</div>
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase text-center">Time</div>
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase">By</div>
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase">Source</div>
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase">Notes</div>
            </div>
            {liveLossesByItem.map(([itemName, itemRecs]) => (
              <div key={itemName}>
                <div className={`grid ${COUNT_RECORDS_GRID} gap-0 bg-red-50 border-b border-red-200 sticky top-[26px] z-9`}>
                  <div className="col-span-9 px-2 py-1 text-[10px] font-semibold text-red-700">
                    {itemName} · {itemRecs.length} losses
                  </div>
                </div>
                {itemRecs.map(rec => (
                  <div key={rec.id}>
                    <div className={`group grid ${COUNT_RECORDS_GRID} gap-0 border-b border-gray-100 items-center hover:bg-gray-50 transition`}>
                      <div className="sticky left-0 z-[1] bg-white group-hover:bg-gray-50 px-2 py-1">
                        <p className="text-xs font-semibold truncate">{renderClickableItemName(rec.item_name, 'text-gray-900')}</p>
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
                        <p className="text-xs font-bold text-red-600">
                          -{fmtN(Math.abs(rec.loss_qty ?? 0))}
                        </p>
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
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  function renderCountIntervalsView() {
    const intervalGroups = liveCountIntervalFlags.map(flag => ({
      label: flag.label,
      count: flag.count,
      items: liveAllItems.filter(i => i.count_interval === flag.label).sort((a, b) => String(a.name).localeCompare(String(b.name)))
    }))

    return (
      <div className="flex-1 overflow-y-auto flex flex-col">
        <div className="px-3 py-2 text-xs font-bold text-gray-600 sticky top-0 bg-gray-50 z-10 border-b border-gray-200">
          Count Intervals — Items grouped by their counting schedule
        </div>
        <div className="flex-1 overflow-auto">
          {intervalGroups.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No counting intervals</p>
          ) : (
            <div className="divide-y divide-gray-200">
              {intervalGroups.map(group => (
                <div key={group.label} className="bg-white">
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">{group.label} ({group.count})</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {group.items.map(item => (
                      <div key={item.id} className="px-3 py-2 flex items-center justify-between hover:bg-gray-50 transition group">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">{item.name}</p>
                          <p className="text-[10px] text-gray-500">ID: {item.id}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-2 shrink-0">
                          {liveEditingItemIntervalId === item.id ? (
                            <>
                              <input
                                type="number"
                                min="1"
                                value={liveEditingItemIntervalDays}
                                onChange={e => setLiveEditingItemIntervalDays(e.target.value)}
                                placeholder="Days"
                                className="w-16 px-2 py-1 text-xs border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setLiveEditingItemIntervalSaving(true)
                                  fetch('/api/items/' + item.id, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ count_cadence_days: liveEditingItemIntervalDays ? Number(liveEditingItemIntervalDays) : null })
                                  }).then(async (res) => {
                                    setLiveEditingItemIntervalSaving(false)
                                    if (res.ok) {
                                      setLiveEditingItemIntervalId(null)
                                      setLiveEditingItemIntervalDays('')
                                      window.location.reload()
                                    } else {
                                      alert('Failed to update interval')
                                    }
                                  }).catch(e => {
                                    setLiveEditingItemIntervalSaving(false)
                                    alert('Error: ' + e.message)
                                  })
                                }}
                                disabled={liveEditingItemIntervalSaving}
                                className="px-2 py-1 text-[10px] font-bold text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                              >
                                ✓
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setLiveEditingItemIntervalId(null)
                                  setLiveEditingItemIntervalDays('')
                                }}
                                className="px-2 py-1 text-[10px] font-bold text-gray-600 hover:bg-gray-200 rounded"
                              >
                                ✕
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setLiveEditingItemIntervalId(item.id)
                                setLiveEditingItemIntervalDays(item.count_cadence_days ? String(item.count_cadence_days) : '')
                              }}
                              className="px-2 py-1 text-[10px] font-bold text-blue-600 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition"
                              title="Edit counting interval"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  function getViolationDescription(filterType: typeof liveSaleViolationFilter) {
    const descriptions: Record<string, { title: string; description: string; steps: string[] }> = {
      all: {
        title: 'All Items',
        description: 'Showing all items in the catalogue. Items may have different violation statuses.',
        steps: [
          'Use the filter buttons above to narrow down to specific violations',
          'Click on any item card to view details and fix violations',
          'Check the violation badges on each item for quick status',
          'Items with no violations show no violation headers'
        ]
      },
      countDue: {
        title: '🔄 Count Due',
        description: 'Items that are scheduled or overdue for physical inventory counting based on their count cadence. Focus on these first to keep inventory current.',
        steps: [
          '1. Open the item by clicking its card',
          '2. Navigate to the Counts tab',
          '3. Enter the actual quantity counted',
          '4. Record any notes about the count',
          '5. Confirm the count',
          '6. The item will be removed from "Count Due" once recorded'
        ]
      },
      counts: {
        title: '📋 Counts',
        description: 'All physical count records taken. Shows completed counts with expected vs counted quantities, helping verify inventory accuracy over time.',
        steps: [
          '1. Review count records by date to track counting activity',
          '2. Each row shows item, quantity counted, expected amount, and time recorded',
          '3. Click Edit to adjust count time or notes if needed',
          '4. Use this view to audit counting patterns and identify trends',
          '5. Compare with Loss/Gain view to see which counts created discrepancies',
          '6. Archive or delete counts only after they have been reconciled'
        ]
      },
      lossGain: {
        title: '↔️ Loss/Gain/TradeOff',
        description: 'Items with inventory discrepancies showing losses or gains. "Net Gain" should NEVER exist — if present, it indicates a counting or data entry error that must be investigated. Losses occur when physical counts fall short of expected quantities; gains (rare) indicate over-counting or prior documentation errors. Trade-offs allow matching losses against gains on different dates to net zero.',
        steps: [
          '1. Review each item showing losses or gains',
          '2. Identify the total net loss/gain amount for the item (shown in currency)',
          '3. If any "Net Gain" exists, investigate the root cause immediately',
          '4. Use Trade-Off suggestions to match losses from one date against gains from another',
          '5. Work through matches until each item\'s discrepancies are reconciled',
          '6. Unmatched losses represent actual inventory write-offs that impact margin',
          '7. All net losses across items should total to the physical variance to investigate'
        ]
      },
      duplicates: {
        title: '🔄 Duplicates',
        description: 'Multiple items in the system that represent the same physical product, causing split inventory and sales data.',
        steps: [
          '1. Open one of the duplicate items',
          '2. Click the "Duplicates" violation badge',
          '3. Click "Fix" on the duplicate item',
          '4. Select which duplicate to keep and which to merge into it',
          '5. Choose how to handle the inventory (combine totals)',
          '6. Confirm the merge - the losing item becomes inactive'
        ]
      },
      unlinked: {
        title: '🔗 Unlinked',
        description: 'Items with sales or purchase records that reference a name but no linked item ID, causing fragmented sales data.',
        steps: [
          '1. Open the unlinked item',
          '2. Click the "Unlinked" violation badge',
          '3. Review the list of unlinked references (sale/bill lines)',
          '4. Click "Fix" next to each reference',
          '5. Confirm the link to the correct item',
          '6. The violation will clear once all references are linked'
        ]
      },
      service: {
        title: '⚙️ Service',
        description: 'Service items with invalid configuration, such as missing required linked items or incorrect type settings.',
        steps: [
          '1. Open the service item',
          '2. Click the "Service" violation badge to see specific issues',
          '3. If missing "converts to": set the item it represents',
          '4. If type mismatch: verify the "Converts to" item is properly configured',
          '5. If GMC type is wrong: verify whether it uses GMC materials or not',
          '6. Save changes - the violation will clear once corrected'
        ]
      },
      gains: {
        title: '📈 Gains',
        description: 'Items with unexplained inventory gains from stock counts, indicating either miscounting or unrecorded receipts.',
        steps: [
          '1. Open the item and check its count history',
          '2. Look at the difference between expected and counted quantity',
          '3. Investigate the cause: miscounting, unrecorded receipt, or data error',
          '4. If it\'s a legitimate gain, document it in the count notes',
          '5. If it\'s an error, create a correcting count entry',
          '6. Once understood, mark the gain as reconciled'
        ]
      },
      soldBelowCost: {
        title: '💔 Sold Below Cost',
        description: 'Items that have been sold at prices below their actual cost, resulting in financial loss per unit sold.',
        steps: [
          '1. Open the item to review pricing history',
          '2. Check the ACP (Average Cost Price) in Item 360',
          '3. Review sales on the dates below cost was detected',
          '4. Determine if this was intentional (clearance) or a mistake',
          '5. If a mistake: adjust the selling price immediately',
          '6. For future prevention, ensure SP > ACP before selling'
        ]
      },
      vcpJump: {
        title: '📊 VCP Jump',
        description: 'Items with a sudden significant change in cost price from recent bills, indicating a pricing anomaly to review.',
        steps: [
          '1. Open the item to view recent bill history',
          '2. Click the "VCP JUMP" badge to see the price history',
          '3. Review the bills on both sides of the jump',
          '4. Verify if the price change is correct (new supplier, negotiation, etc)',
          '5. If incorrect: edit the bill line to correct the price',
          '6. Click "Confirm" on the badge once verified - this dismisses the alert'
        ]
      },
      emptyRow: {
        title: '⚠️ Empty Row',
        description: 'Items with incomplete or missing critical data that should be filled in or the item should be deleted.',
        steps: [
          '1. Open the item by clicking its card',
          '2. Review which fields are missing or empty',
          '3. For each empty field: either fill it in or determine if it\'s required',
          '4. If the item is incomplete and not needed: delete it (owner-level permission)',
          '5. If item is a placeholder: fill in the missing details',
          '6. Save changes - the empty row marker will clear once data is complete'
        ]
      },
      withViolations: {
        title: '🚩 Items with Violations',
        description: 'Showing only items that have one or more violations. Each violation type is shown as a badge on the item.',
        steps: [
          'Items are grouped by violation type for easier navigation',
          'Each item shows all violations it has as separate badges',
          'Click on a violation badge to jump to that specific violation type filter',
          'Click the item card to view details and start fixing violations',
          'Work through items from top to bottom to resolve all violations'
        ]
      },
      noViolations: {
        title: '✓ All(NV) - No Violation Banners',
        description: 'Showing all items without violation banners displayed. Perfect for normal sales operations where you don\'t want to be distracted by violation alerts.',
        steps: [
          'All items are shown regardless of violation status',
          'Violation headers and banners are hidden to reduce visual clutter',
          'COUNT NOW, trade-off, and other alert banners are not displayed',
          'Use this mode for efficient sales workflows without distractions',
          'Switch to "All(V)" or specific violation filters to address data issues'
        ]
      }
    }
    return descriptions[filterType] || null
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
        value={liveSaleFilter ? liveSaleFilter.kind === 'interval' ? `interval:${liveSaleFilter.label}` : liveSaleFilter.kind === 'flag' ? `flag:${liveSaleFilter.key}` : liveSaleFilter.kind : liveCurrentView?.kind === 'violation' ? `violation:${liveCurrentView.key}` : liveCurrentView?.kind === 'aliasWide' ? 'view:aliasWide' : liveCurrentView?.kind === 'serviceMatches' ? 'view:serviceMatches' : liveCurrentView?.kind === 'gmcPacks' ? 'view:gmcPacks' : ''}
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
            else if (viewKey === 'gmcPacks') setLiveCurrentView({ kind: 'gmcPacks' as const })
          } else {
            setLiveCurrentView(null)
            setLiveSaleFilter({ kind: v as 'loss' | 'gain' | 'count_0' | 'count_1' })
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
              <PaneDaily mode={cashDisplayMode}
                onDaily={() => { setLossView('dailySummary'); setSettingsOpen(false) }}
                dailyActive={paneActive(lossView === 'dailySummary')} />
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
              {/* Home first, above Items -- used to live in this pane's
                  footer (paired with Daily) so it stayed on screen
                  regardless of scroll position; moved to the top of the
                  list itself instead, same "jump to a view of this same
                  pane" click behavior as before. */}
              <SidePaneButton icon="🏠" label="Home" mode={cashDisplayMode}
                active={paneActive(lossView === 'home')} badge={unreadAnnouncements}
                onClick={() => { setLossView('home'); setUnreadAnnouncements(0); setSettingsOpen(false) }} />
              {applyPaneOrder(combinedCashItems, paneOrder.cash).filter(v => (v.key !== 'pl' || canSeePL) && !paneHidden[v.key]).map((v, i) => (
                <Fragment key={v.key}>
                  <SidePaneButton icon={v.icon} label={paneLabel(v.key, v.label)} mode={cashDisplayMode}
                    active={paneActive(cashItemActive(v.key))} divider
                    badge={v.key === 'sales' ? (salesFlagsCount + billsFlagsCount + countsFlagsCount + lossByDateFlagsCount)
                      // Expenses moved off its own CASH_ITEMS row onto the Items
                      // row's badge -- 'items' is the real, reachable entry point
                      // into the Sale/Log/Sales/Bills/Expenses tab switcher now
                      // (there's no CASH_ITEMS row with key 'sales' any more), so
                      // that's where its flag count needs to actually show up.
                      : v.key === 'items' ? (itemsFlagsCount + expensesFlagsCount)
                      : v.key === 'cab' ? cabFlagsCount
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
          {/* Sale/Log/Sales/Count/Bills only belong to Items (lossView
              'items' -- the sidebar row -- and 'sales', the same screen's
              default landing view) -- every other lossView (Vendors,
              Expenses, CAB, Opener, etc.) has nothing to do with this
              switcher, so it no longer shows there. */}
          {outerTab === 'loss' && (lossView === 'items' || lossView === 'sales') && (
            <div className="shrink-0 bg-white border-b border-gray-200">
              {/* Tab switcher: Items vs Live Sale modes -- a 3-column grid
                  (rather than flex+justify-between) so the tabs stay
                  centered in the row even when the right-side controls
                  aren't there (most lossViews) or are (Items' columns
                  picker), instead of always hugging the left edge. */}
              <div className="px-6 py-1.5 border-b border-gray-200">
                {liveMode === 'sale' && renderModeProgressSummary(true, true)}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 min-w-0">
                  <div />
                  <div className="flex items-center gap-1.5 overflow-x-auto min-w-0 justify-self-center">
                    {renderTabSwitcher(true)}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 justify-self-end">
                    {/* Control buttons next to tab switcher */}
                    {lossView === 'items' && (
                        <ColumnsPickerButton prefs={itemsColPrefs} dark extraToggles={[
                          { key: 'aliasWide', label: 'Alias Wide Table', active: itemsExtraView === 'aliasWide',
                            onToggle: () => setItemsExtraView(v => v === 'aliasWide' ? 'none' : 'aliasWide') },
                          { key: 'serviceMatches', label: 'Service Matches', active: itemsExtraView === 'serviceMatches',
                            onToggle: () => setItemsExtraView(v => v === 'serviceMatches' ? 'none' : 'serviceMatches') },
                        ]} />
                    )}
                  </div>
                </div>
              </div>
              {/* Row 2: filter bar — hidden on report-style submenus. */}
              {showControls && (outerTab === 'loss' && (lossView === 'sales' || lossView === 'items')) && (liveMode === 'sale' || liveMode === 'log') && (
                <div className="w-full flex items-center gap-0.5 px-1.5 py-0.5 bg-white border-b border-gray-200">
                  <select
                    value={liveProductTypeFilter}
                    onChange={e => setLiveProductTypeFilter(e.target.value as 'all' | 'goods' | 'services')}
                    className={`${COMPACT_SELECT_CLS} border-gray-300 bg-white text-gray-900 flex-1 min-w-0`}
                    style={COMPACT_SELECT_STYLE}
                  >
                    <option value="all">All</option>
                    <option value="goods">Goods</option>
                    <option value="services">Services</option>
                  </select>
                  <select
                    value={liveGroupFilter || ''}
                    onChange={e => setLiveGroupFilter(e.target.value || null)}
                    className={`${COMPACT_SELECT_CLS} border-gray-300 bg-white text-gray-900 flex-1 min-w-0`}
                    style={COMPACT_SELECT_STYLE}
                  >
                    <option value="">Groups</option>
                    {liveGroups.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              )}
              {/* Filter dropdown for items view only */}
              {showControls && outerTab === 'loss' && (liveMode === 'sale' || liveMode === 'log') && (
                <div className="w-full flex items-center gap-0.5 px-1.5 py-0.5 bg-white border-b border-gray-200">
                  <select
                    value={liveGmcTypeFilter ? `gmc:${liveGmcTypeFilter}` : liveSaleFilter ? liveSaleFilter.kind === 'interval' ? `interval:${liveSaleFilter.label}` : liveSaleFilter.kind === 'flag' ? `flag:${liveSaleFilter.key}` : liveSaleFilter.kind : liveCurrentView?.kind === 'violation' ? `violation:${liveCurrentView.key}` : liveCurrentView?.kind === 'aliasWide' ? 'view:aliasWide' : liveCurrentView?.kind === 'serviceMatches' ? 'view:serviceMatches' : liveCurrentView?.kind === 'gmcPacks' ? 'view:gmcPacks' : liveCurrentView?.kind === 'newItem' ? 'view:newItem' : ''}
                    onChange={e => {
                      const v = e.target.value
                      const selectEl = e.target as HTMLSelectElement
                      if (!v) {
                        setLiveSaleFilter(null)
                        setLiveCurrentView(null)
                        setLiveGmcTypeFilter(null)
                      } else if (v.startsWith('action:')) {
                        const action = v.slice('action:'.length)
                        let endpoint = ''
                        let confirmMsg = ''

                        switch (action) {
                          case 'migrate-gmc':
                            endpoint = '/api/items/migrate-service-gmc-data'
                            confirmMsg = 'Migrate all services using GMC?\n\nThis will transfer counts, bills, and sales from services to their target GMC items, then clear cost prices from the services.'
                            break
                          case 'fix-gmc-losses':
                            endpoint = '/api/fix-service-gmc-loss-records'
                            confirmMsg = 'Transfer loss revision records from services using GMC to their target items?\n\nThis will move the audit trail of deletions from services to the actual inventory items.'
                            break
                          case 'add-gmc-constraints':
                            endpoint = '/api/add-service-gmc-constraints'
                            confirmMsg = 'Add database constraints to enforce service GMC data integrity?\n\nThis will prevent:\n- Cost prices on services\n- Stock counts on services\n- Bills on services\n- Sales on services'
                            break
                          case 'clear-gmc-costs':
                            endpoint = '/api/clear-service-gmc-costs'
                            confirmMsg = 'Clear cost prices from services using GMC?\n\nCost pricing information should only exist on the target GMC items, not on the services themselves.'
                            break
                        }

                        if (confirm(confirmMsg)) {
                          fetch(endpoint, { method: 'POST' })
                            .then(r => r.json())
                            .then(data => {
                              if (!data.error) {
                                showToast(data.message || 'Operation completed', 'success')
                              } else {
                                showToast(data.error, 'error')
                              }
                            })
                            .catch(e => showToast(e.message || 'Operation failed', 'error'))
                            .finally(() => selectEl.value = '')
                        } else {
                          selectEl.value = ''
                        }
                      } else if (v.startsWith('interval:')) {
                        setLiveCurrentView(null)
                        setLiveGmcTypeFilter(null)
                        setLiveSaleFilter({ kind: 'interval', label: v.slice('interval:'.length) })
                      } else if (v.startsWith('violation:')) {
                        setLiveSaleFilter(null)
                        setLiveGmcTypeFilter(null)
                        const violationKey = v.slice('violation:'.length)
                        setLiveCurrentView({ kind: 'violation' as const, key: violationKey })
                      } else if (v.startsWith('flag:')) {
                        setLiveCurrentView(null)
                        setLiveGmcTypeFilter(null)
                        setLiveSaleFilter({ kind: 'flag', key: v.slice('flag:'.length) })
                      } else if (v.startsWith('view:')) {
                        setLiveSaleFilter(null)
                        setLiveGmcTypeFilter(null)
                        const viewKey = v.slice('view:'.length)
                        if (viewKey === 'aliasWide') setLiveCurrentView({ kind: 'aliasWide' as const })
                        else if (viewKey === 'serviceMatches') setLiveCurrentView({ kind: 'serviceMatches' as const })
                        else if (viewKey === 'gmcPacks') setLiveCurrentView({ kind: 'gmcPacks' as const })
                        else if (viewKey === 'newItem') setLiveCurrentView({ kind: 'newItem' as const })
                      } else if (v.startsWith('gmc:')) {
                        setLiveSaleFilter(null)
                        setLiveCurrentView(null)
                        setLiveGmcTypeFilter(v.slice('gmc:'.length))
                      } else if (v === 'help:help') {
                        // Opens the Help Guide modal
                        setLiveHelpModalOpen(true)
                        selectEl.value = ''
                      } else if (v === 'help:laws') {
                        // Opens the Laws & Tasks modal
                        setLiveShowLawsTasksModal(true)
                        selectEl.value = ''
                      } else if (v === 'settings:sortorder') {
                        setLiveSortOrderModalOpen(true)
                        selectEl.value = ''
                      } else {
                        setLiveCurrentView(null)
                        setLiveGmcTypeFilter(null)
                        setLiveSaleFilter({ kind: v as 'loss' | 'gain' | 'count_0' | 'count_1' })
                      }
                    }}
                    className={`${COMPACT_SELECT_CLS} border-gray-300 bg-white text-gray-900 flex-1 min-w-0`}
                    style={COMPACT_SELECT_STYLE}
                  >
                    <option value="">Filter</option>
                    <optgroup label="Help">
                      <option value="help:help">❓ Help Guide</option>
                      <option value="help:laws">⚖️ Laws & Tasks</option>
                    </optgroup>
                    <optgroup label="Settings">
                      <option value="settings:sortorder">⇅ Arrange Item Order</option>
                    </optgroup>
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
                      <option value="view:newItem">+ New Item</option>
                    </optgroup>
                    <optgroup label="GMC Types">
                      <option value="gmc:none">None</option>
                      <option value="gmc:gmc">GMC only, no service</option>
                      <option value="gmc:service_no_gmc">Service only</option>
                      <option value="gmc:pack_to_gmc">Pack → GMC</option>
                      <option value="gmc:service_using_gmc">Service uses GMC</option>
                    </optgroup>
                    {isOwnerLevel(session?.user as any) && (
                      <optgroup label="Service GMC">
                        <option value="action:migrate-gmc">↻ Migrate Service GMC Data</option>
                        <option value="action:fix-gmc-losses">→ Fix Service Loss Records</option>
                        <option value="action:add-gmc-constraints">🔒 Add Service GMC Constraints</option>
                        <option value="action:clear-gmc-costs">💰 Clear Service Cost Prices</option>
                      </optgroup>
                    )}
                  </select>
                </div>
              )}
              {/* Sale mode filter bar */}
              {showControls && liveMode === 'sale' && (
                <div className="px-2 py-0.5 border-b border-green-700 flex flex-wrap items-center gap-0 text-[9px]">
                  {/* View-only filters (black) */}
                  <label className="flex items-center gap-0.5 cursor-pointer hover:underline whitespace-nowrap text-gray-700">
                    <input type="radio" name="liveViolationFilter" checked={liveSaleViolationFilter === 'withViolations'} onChange={() => { setLiveSaleViolationFilter('withViolations'); setLiveShowCountFullPage(false); setLiveSaleView(null) }} className="cursor-pointer w-3 h-3" />
                    <span>All(V)</span>
                  </label>
                  <span className="text-gray-400 px-1">·</span>
                  <label className="flex items-center gap-0.5 cursor-pointer hover:underline whitespace-nowrap text-gray-700">
                    <input type="radio" name="liveViolationFilter" checked={liveSaleViolationFilter === 'noViolations'} onChange={() => { setLiveSaleViolationFilter('noViolations'); setLiveShowCountFullPage(false); setLiveSaleView(null) }} className="cursor-pointer w-3 h-3" />
                    <span>All(NV)</span>
                  </label>
                  <span className="text-gray-400 px-1">·</span>
                  <label className="flex items-center gap-0.5 cursor-pointer hover:underline whitespace-nowrap text-gray-700">
                    <input type="radio" name="liveViolationFilter" checked={liveSaleViolationFilter === 'counts'} onChange={() => { setLiveSaleViolationFilter('counts'); setLiveShowCountFullPage(true); setLiveSaleView(null); setLiveCountView(null) }} className="cursor-pointer w-3 h-3" />
                    <span>Counts{liveCountRecords.length > 0 && ` (${liveCountRecords.filter(r => r.kind !== 'loss' && r.kind !== 'gain').length})`}</span>
                  </label>
                  <label className="flex items-center gap-0.5 cursor-pointer hover:underline whitespace-nowrap text-gray-700">
                    <input type="radio" name="liveViolationFilter" checked={liveSaleViolationFilter === 'lossbydate'} onChange={() => { setLiveSaleViolationFilter('lossbydate'); setLiveShowCountFullPage(false); setLiveSaleView({ kind: 'loss_by_date' }) }} className="cursor-pointer w-3 h-3" />
                    <span>Loss by Date</span>
                  </label>
                  <label className="flex items-center gap-0.5 cursor-pointer hover:underline whitespace-nowrap text-gray-700">
                    <input type="radio" name="liveViolationFilter" checked={liveSaleViolationFilter === 'lossbyitems'} onChange={() => { setLiveSaleViolationFilter('lossbyitems'); setLiveShowCountFullPage(false); setLiveSaleView({ kind: 'loss_by_items' }) }} className="cursor-pointer w-3 h-3" />
                    <span>Loss by Items</span>
                  </label>

                  {/* Action-required filters (red) - arranged by priority */}
                  <span className="text-gray-400 px-1">·</span>
                  <label className="flex items-center gap-0.5 cursor-pointer hover:underline whitespace-nowrap text-red-600">
                    <input type="radio" name="liveViolationFilter" checked={liveSaleViolationFilter === 'countDue'} onChange={() => { setLiveSaleViolationFilter('countDue'); setLiveShowCountFullPage(false); setLiveSaleView(null) }} className="cursor-pointer w-3 h-3" />
                    <span>Count Due{liveCountStatus.size > 0 && ` (${liveCountStatus.size})`}</span>
                  </label>
                  <label className="flex items-center gap-0.5 cursor-pointer hover:underline whitespace-nowrap text-red-600">
                    <input type="radio" name="liveViolationFilter" checked={liveSaleViolationFilter === 'lossGain'} onChange={() => { setLiveSaleViolationFilter('lossGain'); setLiveShowCountFullPage(false); setLiveSaleView(null) }} className="cursor-pointer w-3 h-3" />
                    <span>Loss/Gain/TradeOff{liveItemsWithLossOrGainCount > 0 && ` (${liveItemsWithLossOrGainCount})`}</span>
                  </label>
                  <span className="text-gray-400 px-1">·</span>
                  {liveDuplicateCount > 0 && (<><span className="text-gray-400 px-1">·</span>
                  <label className="flex items-center gap-0.5 cursor-pointer hover:underline whitespace-nowrap text-red-600">
                    <input type="radio" name="liveViolationFilter" checked={liveSaleViolationFilter === 'duplicates'} onChange={() => { setLiveSaleViolationFilter('duplicates'); setLiveShowCountFullPage(false); setLiveSaleView(null) }} className="cursor-pointer w-3 h-3" />
                    <span>Duplicates ({liveDuplicateCount})</span>
                  </label></>)}
                  {liveSoldBelowCostCount > 0 && (<><span className="text-gray-400 px-1">·</span>
                  <label className="flex items-center gap-0.5 cursor-pointer hover:underline whitespace-nowrap text-red-600">
                    <input type="radio" name="liveViolationFilter" checked={liveSaleViolationFilter === 'soldBelowCost'} onChange={() => { setLiveSaleViolationFilter('soldBelowCost'); setLiveShowCountFullPage(false); setLiveSaleView(null) }} className="cursor-pointer w-3 h-3" />
                    <span>Sold Below Cost ({liveSoldBelowCostCount})</span>
                  </label></>)}
                  {liveServiceViolationCount > 0 && (<><span className="text-gray-400 px-1">·</span>
                  <label className="flex items-center gap-0.5 cursor-pointer hover:underline whitespace-nowrap text-red-600">
                    <input type="radio" name="liveViolationFilter" checked={liveSaleViolationFilter === 'service'} onChange={() => { setLiveSaleViolationFilter('service'); setLiveShowCountFullPage(false); setLiveSaleView(null) }} className="cursor-pointer w-3 h-3" />
                    <span>Service ({liveServiceViolationCount})</span>
                  </label></>)}
                  {liveUnlinkedCount > 0 && (<><span className="text-gray-400 px-1">·</span>
                  <label className="flex items-center gap-0.5 cursor-pointer hover:underline whitespace-nowrap text-red-600">
                    <input type="radio" name="liveViolationFilter" checked={liveSaleViolationFilter === 'unlinked'} onChange={() => { setLiveSaleViolationFilter('unlinked'); setLiveShowCountFullPage(false); setLiveSaleView(null) }} className="cursor-pointer w-3 h-3" />
                    <span>Unlinked ({liveUnlinkedCount})</span>
                  </label></>)}
                  {liveVcpJumpCount > 0 && (<><span className="text-gray-400 px-1">·</span>
                  <label className="flex items-center gap-0.5 cursor-pointer hover:underline whitespace-nowrap text-red-600">
                    <input type="radio" name="liveViolationFilter" checked={liveSaleViolationFilter === 'vcpJump'} onChange={() => { setLiveSaleViolationFilter('vcpJump'); setLiveShowCountFullPage(false); setLiveSaleView(null) }} className="cursor-pointer w-3 h-3" />
                    <span>VCP Jump ({liveVcpJumpCount})</span>
                  </label></>)}
                  {liveEmptyRowCount > 0 && (<><span className="text-gray-400 px-1">·</span>
                  <label className="flex items-center gap-0.5 cursor-pointer hover:underline whitespace-nowrap text-red-600">
                    <input type="radio" name="liveViolationFilter" checked={liveSaleViolationFilter === 'emptyRow'} onChange={() => { setLiveSaleViolationFilter('emptyRow'); setLiveShowCountFullPage(false); setLiveSaleView(null) }} className="cursor-pointer w-3 h-3" />
                    <span>Empty Row ({liveEmptyRowCount})</span>
                  </label></>)}
                </div>
              )}
              {/* Row 3: search bar + controls — hidden on report-style submenus, and on
                  Sales/Bills (they render their own title+search+analytics+help row
                  inside their own liveMode block instead). */}
              {showControls && (liveMode === 'sale' || liveMode === 'log') && (
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
              <div className="flex justify-end items-center gap-1.5 px-1.5 py-1 border-b border-gray-100">
                {isOwnerLevel(session?.user as any) && (
                  <button
                    type="button"
                    onClick={reconcileUndoneTaps}
                    disabled={liveReconcilingTaps}
                    title="Fix past undone sales that were never removed from totals"
                    className="shrink-0 font-bold rounded-lg px-2 py-1 text-[10px] bg-gray-100 text-gray-600 hover:bg-gray-200 transition disabled:opacity-50"
                  >
                    {liveReconcilingTaps ? '…' : 'Fix undone sales'}
                  </button>
                )}
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
                  // A real <table> instead of independent per-row grid divs --
                  // table-layout:auto sizes each column to exactly the widest
                  // cell actually in it (no wasted gap on rows with a shorter
                  // item name than others), while still keeping every column
                  // aligned down the page, which independent grids can't do
                  // on their own. Item's <th>/<td>s stay sticky left-0, the
                  // header row stays sticky top-0, and each date header
                  // spans the full row via a real colSpan -- all standard
                  // table equivalents of what the grid version did by hand.
                  <table className="border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="sticky left-0 top-0 z-20 bg-gray-50 h-[13px] px-0.5 text-[8px] leading-none font-semibold text-gray-600 uppercase text-left whitespace-nowrap">Item</th>
                        <th className="sticky top-0 z-10 bg-gray-50 h-[13px] px-0.5 text-[8px] leading-none font-semibold text-gray-600 uppercase text-right whitespace-nowrap">Total</th>
                        <th className="sticky top-0 z-10 bg-gray-50 h-[13px] px-0.5 text-[8px] leading-none font-semibold text-gray-600 uppercase whitespace-nowrap">Time</th>
                        <th className="sticky top-0 z-10 bg-gray-50 h-[13px] px-0.5 text-[8px] leading-none font-semibold text-gray-600 uppercase text-right whitespace-nowrap">SP</th>
                        <th className="sticky top-0 z-10 bg-gray-50 h-[13px] px-0.5 text-[8px] leading-none font-semibold text-gray-600 uppercase text-right whitespace-nowrap">CP</th>
                        <th className="sticky top-0 z-10 bg-gray-50 h-[13px] px-0.5 text-[8px] leading-none font-semibold text-gray-600 uppercase text-right whitespace-nowrap">PF</th>
                        <th className="sticky top-0 z-10 bg-gray-50 h-[13px] px-0.5 text-[8px] leading-none font-semibold text-gray-600 uppercase whitespace-nowrap">Qty</th>
                        <th className="sticky top-0 z-10 bg-gray-50 h-[13px] px-0.5 text-[8px] leading-none font-semibold text-gray-600 uppercase text-left whitespace-nowrap">Staff</th>
                        <th className="sticky top-0 z-10 bg-gray-50 h-[13px] px-0.5 text-[8px] leading-none font-semibold text-gray-600 uppercase whitespace-nowrap">SOH</th>
                        <th className="sticky top-0 z-10 bg-gray-50 h-[13px] px-0.5 text-[8px] leading-none font-semibold text-gray-600 uppercase text-right whitespace-nowrap" title="Time since the previous tap -- since shop opening for the day's first, until the last staff signed out for the day's last">Gap</th>
                        <th className="sticky top-0 z-10 bg-gray-50 h-[13px] px-0.5" />
                      </tr>
                    </thead>
                    <tbody>
                    {liveTapsByDate.map(([date, dateTaps]) => {
                      const dateTotal = (dateTaps || []).filter((t): t is Tap => t != null && !t.undone).reduce((s, t) => s + Number(t.price) * t.quantity, 0)
                      const dateProfitTotal = (dateTaps || []).filter((t): t is Tap => t != null && !t.undone)
                        .reduce((s, t) => s + (Number(t.price) - (liveCostPriceByItemId.get(t.item_id) ?? 0)) * t.quantity, 0)
                      return (
                        <Fragment key={date}>
                          {/* Date header */}
                          <tr className="bg-green-50 border-b border-green-200">
                            <td colSpan={11} className="sticky top-[13px] z-10 bg-green-50 h-[13px] px-0.5 text-[8px] leading-none font-semibold text-green-700 whitespace-nowrap">
                              {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · Total: ₵{formatPrice(dateTotal)}
                              {' · PF: '}<span className={dateProfitTotal < 0 ? 'text-red-600' : ''}>₵{formatPrice(dateProfitTotal)}</span>
                            </td>
                          </tr>

                          {/* Date's taps -- `group` + an explicit bg on the sticky
                              first cell (not bg-inherit) so scrolled-under columns
                              don't show through it, same fix as Item 360's table. */}
                          {(dateTaps || []).filter((t): t is Tap => t != null).map((tap, i) => {
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
                            const filteredTaps = (dateTaps || []).filter((t): t is Tap => t != null)
                            const bounds = liveDayBounds[date]
                            const isOldest = i === filteredTaps.length - 1
                            const isNewest = i === 0
                            let gapMins: number | null = null
                            if (isNewest && bounds?.closeTime) {
                              gapMins = (new Date(bounds.closeTime).getTime() - new Date(tap.tapped_at).getTime()) / 60000
                            } else if (isOldest && bounds?.openTime) {
                              gapMins = (new Date(tap.tapped_at).getTime() - new Date(bounds.openTime).getTime()) / 60000
                            } else {
                              const prevTap = filteredTaps[i + 1]
                              if (prevTap) gapMins = (new Date(tap.tapped_at).getTime() - new Date(prevTap.tapped_at).getTime()) / 60000
                            }
                            const tapCostPrice = liveCostPriceByItemId.get(tap.item_id) ?? 0
                            const tapProfit = (Number(tap.price) - tapCostPrice) * tap.quantity
                            // Undone taps keep their own muted/struck-through
                            // look (not renderClickableItemName's blue/
                            // underline, which would make an undone sale
                            // look active) but should still open the item's
                            // modal on tap, same as any other row here.
                            const tapItem = liveAllItems.find(it => it.name.toLowerCase() === tap.item_name.toLowerCase())
                            return (
                            <tr
                              key={tap.id}
                              className={`group hover:bg-gray-50 transition ${
                                tap.undone ? 'bg-gray-50 opacity-60' : ''
                              }`}
                            >
                              <td className={`sticky left-0 z-[1] leading-none px-0.5 py-0 group-hover:bg-gray-50 ${tap.undone ? 'bg-gray-50' : 'bg-white'}`}>
                                {tap.undone ? (
                                  <span
                                    onClick={tapItem ? () => setLiveViewingItemId(tapItem.id) : undefined}
                                    className={`text-[9px] leading-none font-semibold whitespace-nowrap line-through text-gray-400 ${tapItem ? 'cursor-pointer hover:text-gray-600' : ''}`}
                                  >
                                    {tap.item_name}
                                  </span>
                                ) : (
                                  renderClickableItemName(tap.item_name, 'text-[9px] leading-none font-semibold whitespace-nowrap text-gray-900')
                                )}
                              </td>
                              <td className="leading-none px-0.5 py-0 text-right">
                                <span className={`text-[9px] leading-none font-semibold whitespace-nowrap ${tap.undone ? 'text-gray-400' : 'text-blue-600'}`}>
                                  ₵{formatPrice(Number(tap.price) * tap.quantity)}
                                </span>
                              </td>
                              <td className="leading-none px-0.5 py-0 text-center">
                                <span className="text-[8px] leading-none text-gray-500 whitespace-nowrap">{fmtTime(tap.tapped_at)}</span>
                              </td>
                              <td className="leading-none px-0.5 py-0 text-right">
                                <span className={`text-[9px] leading-none font-semibold whitespace-nowrap ${tap.undone ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                  ₵{formatPrice(tap.price)}
                                </span>
                              </td>
                              <td className="leading-none px-0.5 py-0 text-right">
                                <span className={`text-[9px] leading-none font-semibold whitespace-nowrap ${tap.undone ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                  ₵{formatPrice(tapCostPrice)}
                                </span>
                              </td>
                              <td className="leading-none px-0.5 py-0 text-right">
                                <span className={`text-[9px] leading-none font-semibold whitespace-nowrap ${tap.undone ? 'text-gray-400' : tapProfit < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                  ₵{formatPrice(tapProfit)}
                                </span>
                              </td>
                              <td className="leading-none px-0.5 py-0 text-center">
                                <span className={`text-[9px] leading-none font-semibold ${tap.undone ? 'text-gray-400' : 'text-gray-900'}`}>
                                  {tap.quantity}
                                </span>
                              </td>
                              <td className="leading-none px-0.5 py-0" title={tap.staff_name}>
                                <span className="text-[9px] leading-none text-gray-600 whitespace-nowrap">{staffInitials(tap.staff_name)}</span>
                              </td>
                              <td className="leading-none px-0.5 py-0 text-center">
                                <span className="text-[9px] leading-none text-gray-500 whitespace-nowrap">{tap.soh !== null && tap.soh !== undefined ? Math.ceil(tap.soh) : '-'}</span>
                              </td>
                              <td className="leading-none px-0.5 py-0 text-right" title={isNewest ? 'Until last sign-out' : isOldest ? 'Since shop opening' : 'Since previous tap'}>
                                <span className="text-[9px] leading-none text-gray-500 whitespace-nowrap">{gapMins !== null ? formatGapMins(gapMins) : '-'}</span>
                              </td>
                              <td className="leading-none px-0.5 py-0">
                                <div className="flex items-center justify-center gap-0.5">
                                  {!tap.undone && (
                                    <>
                                      <button
                                        onClick={() => {
                                          setLiveEditingTapId(tap.id)
                                          setLiveEditingTapTime(tap.tapped_at.slice(0, 16))
                                        }}
                                        title="Edit time"
                                        className="text-[10px] font-bold text-blue-600 hover:bg-blue-100 rounded leading-none p-0 border-0"
                                      >
                                        🕐
                                      </button>
                                      <button
                                        onClick={() => undoTap(tap.id)}
                                        title="Undo"
                                        className="text-[10px] font-bold text-red-600 hover:bg-red-100 rounded leading-none p-0 border-0"
                                      >
                                        ↩
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                            )
                          })}
                        </Fragment>
                      )
                    })}
                    </tbody>
                  </table>
                )}
              </div>
              )}
            </div>
          )}

          {/* Edit tap time modal */}
          {liveEditingTapId != null && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
              <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-4">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Edit Tap Time</h3>
                <input
                  type="datetime-local"
                  value={liveEditingTapTime}
                  onChange={e => setLiveEditingTapTime(e.target.value)}
                  className="w-full text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded px-3 py-2 outline-none focus:ring-1 focus:ring-blue-400 mb-4"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setLiveEditingTapId(null)
                      setLiveEditingTapTime('')
                    }}
                    className="flex-1 px-3 py-2 bg-gray-300 hover:bg-gray-400 text-gray-900 text-sm font-semibold rounded transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEditingTapTime}
                    disabled={liveEditingTapSaving}
                    className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded transition disabled:opacity-50"
                  >
                    {liveEditingTapSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit count time modal */}
          {liveEditingCountId != null && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
              <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-4">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Edit Count Time</h3>
                <input
                  type="datetime-local"
                  value={liveEditingCountTime}
                  onChange={e => setLiveEditingCountTime(e.target.value)}
                  className="w-full text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded px-3 py-2 outline-none focus:ring-1 focus:ring-blue-400 mb-4"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setLiveEditingCountId(null)
                      setLiveEditingCountTime('')
                    }}
                    className="flex-1 px-3 py-2 bg-gray-300 hover:bg-gray-400 text-gray-900 text-sm font-semibold rounded transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEditingCountTime}
                    disabled={liveEditingCountTimeSaving}
                    className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded transition disabled:opacity-50"
                  >
                    {liveEditingCountTimeSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
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
              {/* Row 1: Search, Filter dropdown, Analytics, global search, Help -- no
                  title text, the tab switcher above already says "Sales". */}
              <div className="px-1.5 py-1 border-b border-gray-200 bg-gray-50 flex items-center justify-end gap-1 flex-wrap">
                <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide">Period</span>
                <select value={liveSalesMonthFilter ?? ''} onChange={e => setLiveSalesMonthFilter(e.target.value ? Number(e.target.value) : null)}
                  className="text-[10px] text-gray-700 bg-white border border-gray-200 rounded px-1 py-0.5 outline-none">
                  <option value="">All Months</option>
                  {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
                <select value={liveSalesYearFilter ?? ''} onChange={e => setLiveSalesYearFilter(e.target.value ? Number(e.target.value) : null)}
                  className="text-[10px] text-gray-700 bg-white border border-gray-200 rounded px-1 py-0.5 outline-none">
                  <option value="">All Years</option>
                  {liveSalesAvailableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                {(liveSalesMonthFilter !== null || liveSalesYearFilter !== null) && (
                  <button onClick={() => { setLiveSalesMonthFilter(null); setLiveSalesYearFilter(null) }}
                    className="text-[9px] font-semibold text-blue-600 hover:text-blue-700">
                    Clear
                  </button>
                )}
                <div className="border-l border-gray-300 h-4 mx-0.5" />
                <input
                  type="text"
                  value={liveEmbeddedSearch}
                  onChange={e => setLiveEmbeddedSearch(e.target.value)}
                  placeholder="Search…"
                  className="text-xs px-1.5 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 w-20"
                />
                {renderSalesFiltersBar()}
                <button type="button" onClick={() => setGlobalSearchOpen(true)} title="Global Search"
                  className="w-7 h-7 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center transition">
                  🔍
                </button>
                <label className="flex items-center gap-0.5 text-[10px] font-semibold text-gray-600 cursor-pointer select-none whitespace-nowrap">
                  <input type="radio" checked={liveSalesShowAnalytics} onClick={() => setLiveSalesShowAnalytics(a => !a)} onChange={() => {}}
                    className="cursor-pointer w-2.5 h-2.5" />
                  Analytics
                </label>
                <label title="Bulk-attach a folder of form photos/scans, matched by date"
                  className="flex items-center gap-0.5 text-[10px] font-semibold text-gray-600 cursor-pointer select-none whitespace-nowrap">
                  <input type="radio" checked={liveSalesShowBulkAttach} onClick={() => setLiveSalesShowBulkAttach(true)} onChange={() => {}}
                    className="cursor-pointer w-2.5 h-2.5" />
                  Attach
                </label>
                <ColumnsPickerButton prefs={liveSalesColPrefs} radioStyle />
                <label className="flex items-center gap-0.5 text-[10px] font-semibold text-gray-600 cursor-pointer select-none whitespace-nowrap">
                  <input type="radio" checked={liveHelpModalOpen} onClick={() => setLiveHelpModalOpen(true)} onChange={() => {}}
                    className="cursor-pointer w-2.5 h-2.5" />
                  Help
                </label>
              </div>
              {/* Rows 2-3: one mutually-exclusive radio group, split across two fixed
                  rows -- "All" plus the non-violation toggles (History/Bars Only/
                  WIC/GMC) first, then the violation filters (red, with live counts,
                  sorted by count descending) -- instead of one scrolling row, so
                  every option stays visible with no horizontal scroll. Only one of
                  the whole group can be selected at a time; see liveSalesRadioValue
                  / selectLiveSalesRadio above. */}
              <div className="px-1.5 py-0.5 bg-white border-b border-gray-100 flex items-center gap-1.5 flex-wrap">
                <label className="flex items-center gap-0.5 cursor-pointer hover:underline whitespace-nowrap text-gray-700 text-[10px] shrink-0">
                  <input type="radio" name="liveSalesRadio" checked={liveSalesRadioValue === 'all'} onChange={() => selectLiveSalesRadio('all')} className="cursor-pointer w-2.5 h-2.5" />
                  <span>All</span>
                </label>
                <label className="shrink-0 flex items-center gap-0.5 text-[10px] font-semibold text-gray-600 cursor-pointer select-none">
                  <input type="radio" name="liveSalesRadio" checked={liveSalesRadioValue === 'history'} onChange={() => selectLiveSalesRadio('history')}
                    className="cursor-pointer w-2.5 h-2.5" />
                  History
                </label>
                <label title="Show only the date bars, hiding each receipt's item lines"
                  className="shrink-0 flex items-center gap-0.5 text-[10px] font-semibold text-gray-600 cursor-pointer select-none">
                  <input type="radio" name="liveSalesRadio" checked={liveSalesRadioValue === 'bars_only'} onChange={() => selectLiveSalesRadio('bars_only')}
                    className="cursor-pointer w-2.5 h-2.5" />
                  Bars Only
                </label>
                <label title="Show only Walk-In receipts" className="shrink-0 flex items-center gap-0.5 text-[10px] font-semibold text-gray-600 cursor-pointer select-none">
                  <input type="radio" name="liveSalesRadio" checked={liveSalesRadioValue === 'wic'} onChange={() => selectLiveSalesRadio('wic')}
                    className="cursor-pointer w-2.5 h-2.5" />
                  WIC
                </label>
                <label title="Show only Grony Multimedia receipts" className="shrink-0 flex items-center gap-0.5 text-[10px] font-semibold text-gray-600 cursor-pointer select-none">
                  <input type="radio" name="liveSalesRadio" checked={liveSalesRadioValue === 'gmc'} onChange={() => selectLiveSalesRadio('gmc')}
                    className="cursor-pointer w-2.5 h-2.5" />
                  GMC
                </label>
              </div>
              <div className="px-1.5 py-0.5 bg-white border-b border-gray-200 flex items-center gap-1 flex-wrap">
                {[
                  { key: 'no_cash', label: 'No Cash', count: globalFlags?.noCash?.length ?? 0 },
                  { key: 'missing_days', label: 'Missing Days', count: globalFlags?.missingDays?.length ?? 0 },
                  { key: 'dup_receipt', label: 'Dup Receipt', count: globalFlags?.dupReceipts?.length ?? 0 },
                  { key: 'high_wnw', label: 'High WNW', count: globalFlags?.highWnw?.length ?? 0 },
                  { key: 'no_attachment', label: 'No Attachment', count: globalFlags?.noAttachment?.length ?? 0 },
                ].sort((a, b) => b.count - a.count).map((v, i) => (
                  <Fragment key={v.key}>
                    {i > 0 && <span className="text-gray-300 text-[10px]">·</span>}
                    <label className="flex items-center gap-0.5 cursor-pointer hover:underline whitespace-nowrap text-red-600 text-[10px] shrink-0">
                      <input type="radio" name="liveSalesRadio" checked={liveSalesRadioValue === v.key} onChange={() => selectLiveSalesRadio(v.key)} className="cursor-pointer w-2.5 h-2.5" />
                      <span>{v.label} ({v.count})</span>
                    </label>
                  </Fragment>
                ))}
              </div>
              {liveSalesShowAnalytics ? (
                <div className="px-3 pt-3 flex-1 overflow-auto"><SalesAnalyticsSection /></div>
              ) : (
                <div className="flex-1 overflow-auto">
                  <SalesTab items={liveSalesBillsItems} groupFilter={liveGroupFilter} search={liveEmbeddedSearch}
                    violation={liveSalesViolationFilter}
                    jumpToDate={jumpToReceiptDate} jumpToItemName={jumpToReceiptItemName}
                    onJumpDone={() => { setJumpToReceiptDate(null); setJumpToReceiptItemName(null) }}
                    showHistory={liveSalesShowHistory} setShowHistory={setLiveSalesShowHistory}
                    barsOnly={liveSalesBarsOnly} setBarsOnly={setLiveSalesBarsOnly}
                    showW={liveSalesShowW} setShowW={setLiveSalesShowW}
                    showG={liveSalesShowG} setShowG={setLiveSalesShowG}
                    colPrefs={liveSalesColPrefs}
                    monthFilter={liveSalesMonthFilter} setMonthFilter={setLiveSalesMonthFilter}
                    yearFilter={liveSalesYearFilter} setYearFilter={setLiveSalesYearFilter}
                    showBulkAttach={liveSalesShowBulkAttach} setShowBulkAttach={setLiveSalesShowBulkAttach}
                    onAvailableYearsChange={setLiveSalesAvailableYears} />
                </div>
              )}
            </div>
          )}

          {/* Bills tab -- BillsTab itself has no "add new" flow of its own; it always
              relied on a sibling NewBillForm rendered externally, which now lives
              inside this tab's own header instead. Same compact-header/radio-row
              treatment as Sales. */}
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
              <div className="px-1.5 py-1 border-b border-gray-200 bg-gray-50 flex items-center justify-end gap-1 flex-wrap">
                <select value={liveBillsVendorFilter ?? ''} onChange={e => setLiveBillsVendorFilter(e.target.value || null)}
                  className="text-[10px] text-gray-700 bg-white border border-gray-200 rounded px-1 py-0.5 outline-none max-w-[100px]">
                  <option value="">All Vendors</option>
                  {liveBillsAvailableVendors.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <select value={liveBillsMonthFilter ?? ''} onChange={e => setLiveBillsMonthFilter(e.target.value ? Number(e.target.value) : null)}
                  className="text-[10px] text-gray-700 bg-white border border-gray-200 rounded px-1 py-0.5 outline-none">
                  <option value="">All Months</option>
                  {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
                <select value={liveBillsYearFilter ?? ''} onChange={e => setLiveBillsYearFilter(e.target.value ? Number(e.target.value) : null)}
                  className="text-[10px] text-gray-700 bg-white border border-gray-200 rounded px-1 py-0.5 outline-none">
                  <option value="">All Years</option>
                  {liveBillsAvailableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                {(liveBillsVendorFilter !== null || liveBillsMonthFilter !== null || liveBillsYearFilter !== null) && (
                  <button onClick={() => { setLiveBillsVendorFilter(null); setLiveBillsMonthFilter(null); setLiveBillsYearFilter(null) }}
                    className="text-[9px] font-semibold text-blue-600 hover:text-blue-700">
                    Clear
                  </button>
                )}
                <div className="border-l border-gray-300 h-4 mx-0.5" />
                <input
                  type="text"
                  value={liveEmbeddedSearch}
                  onChange={e => setLiveEmbeddedSearch(e.target.value)}
                  placeholder="Search…"
                  className="text-xs px-1.5 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 w-20"
                />
                {renderBillsFiltersBar()}
                <button type="button" onClick={() => setGlobalSearchOpen(true)} title="Global Search"
                  className="w-7 h-7 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center transition">
                  🔍
                </button>
                <label className="flex items-center gap-0.5 text-[10px] font-semibold text-gray-600 cursor-pointer select-none whitespace-nowrap">
                  <input type="radio" checked={liveBillsShowAnalytics} onClick={() => setLiveBillsShowAnalytics(a => !a)} onChange={() => {}}
                    className="cursor-pointer w-2.5 h-2.5" />
                  Analytics
                </label>
                <ColumnsPickerButton prefs={liveBillsColPrefs} radioStyle />
                <label className="flex items-center gap-0.5 text-[10px] font-semibold text-gray-600 cursor-pointer select-none whitespace-nowrap">
                  <input type="radio" checked={liveHelpModalOpen} onClick={() => setLiveHelpModalOpen(true)} onChange={() => {}}
                    className="cursor-pointer w-2.5 h-2.5" />
                  Help
                </label>
              </div>
              {/* Rows 2-3: one mutually-exclusive radio group -- All/New Bill/Bars
                  Only/History (black) first, then the violation filters (red, with
                  live counts, sorted by count descending). Same treatment as
                  Sales' row; see liveBillsRadioValue/selectLiveBillsRadio above. */}
              <div className="px-1.5 py-0.5 bg-white border-b border-gray-100 flex items-center gap-1.5 flex-wrap">
                <label className="flex items-center gap-0.5 cursor-pointer hover:underline whitespace-nowrap text-gray-700 text-[10px] shrink-0">
                  <input type="radio" name="liveBillsRadio" checked={liveBillsRadioValue === 'all'} onChange={() => selectLiveBillsRadio('all')} className="cursor-pointer w-2.5 h-2.5" />
                  <span>All</span>
                </label>
                <label className="shrink-0 flex items-center gap-0.5 text-[10px] font-semibold text-gray-600 cursor-pointer select-none">
                  <input type="radio" name="liveBillsRadio" checked={liveBillsRadioValue === 'new_bill'} onChange={() => selectLiveBillsRadio('new_bill')}
                    className="cursor-pointer w-2.5 h-2.5" />
                  + New Bill
                </label>
                <label title="Show only the date/vendor bars, hiding each bill's item lines"
                  className="shrink-0 flex items-center gap-0.5 text-[10px] font-semibold text-gray-600 cursor-pointer select-none">
                  <input type="radio" name="liveBillsRadio" checked={liveBillsRadioValue === 'bars_only'} onChange={() => selectLiveBillsRadio('bars_only')}
                    className="cursor-pointer w-2.5 h-2.5" />
                  Bars Only
                </label>
                <label className="shrink-0 flex items-center gap-0.5 text-[10px] font-semibold text-gray-600 cursor-pointer select-none">
                  <input type="radio" name="liveBillsRadio" checked={liveBillsRadioValue === 'history'} onChange={() => selectLiveBillsRadio('history')}
                    className="cursor-pointer w-2.5 h-2.5" />
                  History
                </label>
              </div>
              <div className="px-1.5 py-0.5 bg-white border-b border-gray-200 flex items-center gap-1 flex-wrap">
                {[
                  { key: 'no_vendor', label: 'No Vendor', count: globalFlags?.noVendorBills?.length ?? 0 },
                  { key: 'no_items_bills', label: 'No Item List', count: globalFlags?.noItemsBills?.length ?? 0 },
                  { key: 'bill_total_mismatch', label: 'Total Mismatch', count: globalFlags?.billTotalMismatch?.length ?? 0 },
                  { key: 'bill_no_attachment', label: 'No Attachment', count: globalFlags?.billNoAttachment?.length ?? 0 },
                ].sort((a, b) => b.count - a.count).map((v, i) => (
                  <Fragment key={v.key}>
                    {i > 0 && <span className="text-gray-300 text-[10px]">·</span>}
                    <label className="flex items-center gap-0.5 cursor-pointer hover:underline whitespace-nowrap text-red-600 text-[10px] shrink-0">
                      <input type="radio" name="liveBillsRadio" checked={liveBillsRadioValue === v.key} onChange={() => selectLiveBillsRadio(v.key)} className="cursor-pointer w-2.5 h-2.5" />
                      <span>{v.label} ({v.count})</span>
                    </label>
                  </Fragment>
                ))}
              </div>
              {liveBillsAddingNew ? (
                <div className="px-4 flex-1 overflow-auto">
                  <NewBillForm onSuccess={() => setLiveBillsAddingNew(false)} />
                </div>
              ) : liveBillsShowAnalytics ? (
                <div className="px-3 pt-3 flex-1 overflow-auto"><BillsAnalyticsSection /></div>
              ) : (
                <div className="flex-1 overflow-auto">
                  <BillsTab items={liveSalesBillsItems} groupFilter={liveGroupFilter} search={liveEmbeddedSearch} violation={liveBillsViolationFilter}
                    jumpToBillId={jumpToBillId} onJumpDone={() => setJumpToBillId(null)}
                    showHistory={liveBillsShowHistory} setShowHistory={setLiveBillsShowHistory}
                    barsOnly={liveBillsBarsOnly} setBarsOnly={setLiveBillsBarsOnly}
                    vendorFilter={liveBillsVendorFilter} setVendorFilter={setLiveBillsVendorFilter}
                    monthFilter={liveBillsMonthFilter} setMonthFilter={setLiveBillsMonthFilter}
                    yearFilter={liveBillsYearFilter} setYearFilter={setLiveBillsYearFilter}
                    colPrefs={liveBillsColPrefs}
                    onAvailableVendorsChange={setLiveBillsAvailableVendors}
                    onAvailableYearsChange={setLiveBillsAvailableYears} />
                </div>
              )}
            </div>
          )}

          {/* Expenses tab -- moved here from its own sidebar destination
              (Grony Cash's left pane), same "own liveMode tab" treatment
              Sales/Bills already got. ExpensesTab itself has no "add new" of
              its own either, same as Bills, reusing /expenses/new as a
              sibling. */}
          {liveMode === 'expenses' && (
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
              <div className="px-1.5 py-1 border-b border-gray-200 bg-gray-50 flex items-center justify-end gap-1 flex-wrap">
                <input
                  type="text"
                  value={liveEmbeddedSearch}
                  onChange={e => setLiveEmbeddedSearch(e.target.value)}
                  placeholder="Search…"
                  className="text-xs px-1.5 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 w-20"
                />
                <button type="button" onClick={() => setGlobalSearchOpen(true)} title="Global Search"
                  className="w-7 h-7 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center transition">
                  🔍
                </button>
                <label className="flex items-center gap-0.5 text-[10px] font-semibold text-gray-600 cursor-pointer select-none whitespace-nowrap">
                  <input type="radio" checked={liveExpensesShowAnalytics} onClick={() => setLiveExpensesShowAnalytics(a => !a)} onChange={() => {}}
                    className="cursor-pointer w-2.5 h-2.5" />
                  Analytics
                </label>
                <label className="flex items-center gap-0.5 text-[10px] font-semibold text-gray-600 cursor-pointer select-none whitespace-nowrap">
                  <input type="radio" checked={liveHelpModalOpen} onClick={() => setLiveHelpModalOpen(true)} onChange={() => {}}
                    className="cursor-pointer w-2.5 h-2.5" />
                  Help
                </label>
              </div>
              {/* Rows 2-3: one mutually-exclusive radio group -- All/New Expense/
                  History (black) first, then the four flag violations (red, with
                  live counts, sorted by count descending). No Bars Only here --
                  Expenses has no day-bar/item-line grouping like Sales/Bills. */}
              <div className="px-1.5 py-0.5 bg-white border-b border-gray-100 flex items-center gap-1.5 flex-wrap">
                <label className="flex items-center gap-0.5 cursor-pointer hover:underline whitespace-nowrap text-gray-700 text-[10px] shrink-0">
                  <input type="radio" name="liveExpensesRadio" checked={liveExpensesRadioValue === 'all'} onChange={() => selectLiveExpensesRadio('all')} className="cursor-pointer w-2.5 h-2.5" />
                  <span>All</span>
                </label>
                <label className="shrink-0 flex items-center gap-0.5 text-[10px] font-semibold text-gray-600 cursor-pointer select-none">
                  <input type="radio" name="liveExpensesRadio" checked={liveExpensesRadioValue === 'new_expense'} onChange={() => selectLiveExpensesRadio('new_expense')}
                    className="cursor-pointer w-2.5 h-2.5" />
                  + New Expense
                </label>
                <label className="shrink-0 flex items-center gap-0.5 text-[10px] font-semibold text-gray-600 cursor-pointer select-none">
                  <input type="radio" name="liveExpensesRadio" checked={liveExpensesRadioValue === 'history'} onChange={() => selectLiveExpensesRadio('history')}
                    className="cursor-pointer w-2.5 h-2.5" />
                  History
                </label>
              </div>
              <div className="px-1.5 py-0.5 bg-white border-b border-gray-200 flex items-center gap-1 flex-wrap">
                {[
                  { key: 'similar', label: 'Similar Accounts', count: liveExpensesFlagCounts.similar },
                  { key: 'bundled', label: 'Bundled', count: liveExpensesFlagCounts.bundled },
                  { key: 'no_vendor', label: 'No Vendor', count: liveExpensesFlagCounts.no_vendor },
                  { key: 'properties_no_location', label: 'No Location', count: liveExpensesFlagCounts.properties_no_location },
                ].sort((a, b) => b.count - a.count).map((v, i) => (
                  <Fragment key={v.key}>
                    {i > 0 && <span className="text-gray-300 text-[10px]">·</span>}
                    <label className="flex items-center gap-0.5 cursor-pointer hover:underline whitespace-nowrap text-red-600 text-[10px] shrink-0">
                      <input type="radio" name="liveExpensesRadio" checked={liveExpensesRadioValue === v.key} onChange={() => selectLiveExpensesRadio(v.key)} className="cursor-pointer w-2.5 h-2.5" />
                      <span>{v.label} ({v.count})</span>
                    </label>
                  </Fragment>
                ))}
              </div>
              {liveExpensesAddingNew ? (
                <div className="px-4 flex-1 overflow-auto">
                  <NewExpenseForm onSuccess={() => setLiveExpensesAddingNew(false)} />
                </div>
              ) : liveExpensesShowAnalytics ? (
                <div className="px-3 pt-3 flex-1 overflow-auto"><ExpensesAnalyticsSection /></div>
              ) : (
                <div className="flex-1 overflow-auto">
                  <ExpensesTab search={liveEmbeddedSearch} onFlagCountChange={setExpensesFlagsCount}
                    showHistory={liveExpensesShowHistory} setShowHistory={setLiveExpensesShowHistory}
                    activeFlag={liveExpensesActiveFlag} setActiveFlag={setLiveExpensesActiveFlag}
                    onFlagCountsChange={setLiveExpensesFlagCounts} />
                </div>
              )}
            </div>
          )}

          {/* Every count-related view that used to only be reachable through the
              laws panel (⚖️) on Sale mode: Daily/Every Nd/Dormant/etc
              (liveCountIntervalFlags), Count Records (the full all-time history
              table), and Count History (the audit log of who counted/edited/
              deleted what). Moved to its own tab since they're audit/browse
              views, not part of actually tapping a sale. */}
          {/* Sale mode (the default/landing mode) */}
          {liveMode === 'sale' && (<>
          {liveDebugLogs.length > 0 && (
            <div className="fixed top-4 right-4 bg-black text-white text-[11px] rounded px-3 py-2 max-w-xs z-50 shadow-lg">
              {liveDebugLogs.map((log, i) => <div key={i} className="whitespace-normal break-words">{log}</div>)}
            </div>
          )}
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
            <div className="bg-white border-b border-gray-200 -mx-0 px-1.5 py-0.5 flex flex-col gap-0.5">
                <div className="flex items-center justify-between gap-0.5 flex-wrap">
                  <div className="flex gap-0.5 items-center">
                    <select
                      value={liveProductTypeFilter}
                      onChange={e => setLiveProductTypeFilter(e.target.value as 'all' | 'goods' | 'services')}
                      className={`${COMPACT_SELECT_CLS} border-gray-300 bg-white text-gray-900 w-11`}
                      style={COMPACT_SELECT_STYLE}
                    >
                      <option value="all">All types</option>
                      <option value="goods">Goods</option>
                      <option value="services">Services</option>
                    </select>
                    <select
                      value={liveGroupFilter || ''}
                      onChange={e => setLiveGroupFilter(e.target.value || null)}
                      className={`${COMPACT_SELECT_CLS} border-gray-300 bg-white text-gray-900 w-14`}
                      style={COMPACT_SELECT_STYLE}
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
                        const selectEl = e.target as HTMLSelectElement
                        if (!v) {
                          setLiveCurrentView(null)
                        } else if (v.startsWith('violation:')) {
                          const violationKey = v.slice('violation:'.length)
                          setLiveCurrentView({ kind: 'violation' as const, key: violationKey })
                        } else if (v.startsWith('view:')) {
                          const viewKey = v.slice('view:'.length)
                          if (viewKey === 'lossByItem') setLiveCurrentView({ kind: 'lossByItem' as const })
                          else if (viewKey === 'dailySummary') setLiveCurrentView({ kind: 'dailySummary' as const })
                        } else if (v === 'help:help') {
                          setLiveHelpModalOpen(true)
                          selectEl.value = ''
                        } else if (v === 'help:laws') {
                          setLiveShowLawsTasksModal(true)
                          selectEl.value = ''
                        } else if (v === 'settings:sortorder') {
                          setLiveSortOrderModalOpen(true)
                          selectEl.value = ''
                        }
                      }}
                      title="Flags & Views"
                      className={`${COMPACT_SELECT_CLS} border-white text-gray-800 bg-white/80 hover:bg-white shrink-0 w-14`}
                      style={COMPACT_SELECT_STYLE}
                    >
                      <option value="">⚖️ Flags</option>
                      <optgroup label="Help">
                        <option value="help:help">❓ Help Guide</option>
                        <option value="help:laws">⚖️ Laws & Tasks</option>
                      </optgroup>
                      <optgroup label="Settings">
                        <option value="settings:sortorder">⇅ Arrange Item Order</option>
                      </optgroup>
                      <optgroup label={liveMode === 'sale' || liveMode === 'log' ? 'Items' : (liveMode === 'sales' ? 'Sales' : 'Bills')}>
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
                  </div>
                </div>
                {/* Due for Count filter + Items Violation Flags Filter */}
                <div className="flex gap-1 flex-wrap px-0 items-center">
                  <label className="flex items-center gap-2 px-2 py-1 rounded bg-amber-400 hover:bg-amber-500 text-amber-900 font-semibold text-xs cursor-pointer transition">
                    <input type="checkbox" checked={liveShowCountDue} onChange={() => setLiveShowCountDue(d => !d)} className="cursor-pointer" />
                    🔄 Due for Count
                  </label>
                  <div className="flex gap-1 flex-wrap px-0">
                    {renderLiveItemFlagsFilter()}
                  </div>
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

            {/* Count Records Inline Display - Full Height */}
            {liveShowCountFullPage && liveMode === 'sale' && liveSaleCountRecords.length > 0 && (!liveCountView || liveCountView?.kind === 'records') && (
              <div className="flex-1 overflow-y-auto flex flex-col">
                <div className="px-2 pt-2 pb-1 text-xs font-bold text-gray-600 sticky top-0 bg-gray-50 z-10 flex items-center justify-between">
                  <span>Count</span>
                  <button
                    type="button"
                    onClick={() => setLiveShowCountFullPage(false)}
                    className="text-gray-600 hover:text-gray-900 font-bold"
                  >
                    ✕
                  </button>
                </div>
                <div className="px-2 py-1 bg-white border-b border-gray-200 sticky top-7 z-9 flex gap-2 items-center">
                  <label className="flex items-center gap-1 cursor-pointer text-[9px] px-2 py-0.5 rounded hover:bg-gray-100">
                    <input
                      type="radio"
                      name="liveCountView"
                      checked={liveCountView?.kind === 'records' || (liveCountView === null || liveCountView === undefined)}
                      onChange={() => setLiveCountView({ kind: 'records' })}
                      className="cursor-pointer"
                    />
                    <span>Records</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer text-[9px] px-2 py-0.5 rounded hover:bg-gray-100">
                    <input
                      type="radio"
                      name="liveCountView"
                      checked={(liveCountView as any)?.kind === 'history'}
                      onChange={() => setLiveCountView({ kind: 'history' })}
                      className="cursor-pointer"
                    />
                    <span>History</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer text-[9px] px-2 py-0.5 rounded hover:bg-gray-100">
                    <input
                      type="radio"
                      name="liveCountView"
                      checked={(liveCountView as any)?.kind === 'intervals'}
                      onChange={() => setLiveCountView({ kind: 'intervals' })}
                      className="cursor-pointer"
                    />
                    <span>Intervals</span>
                  </label>
                </div>
                <div className="px-2 py-1.5 bg-gray-50 border-b border-gray-200 sticky top-[50px] z-9 flex gap-1 flex-wrap items-center" style={(liveCountView as any)?.kind === 'intervals' ? { display: 'none' } : undefined}>
                  <span className="text-[9px] font-semibold text-gray-600">Filter:</span>
                  <label className="flex items-center gap-0.5 cursor-pointer hover:bg-gray-200 px-1.5 py-0.5 rounded text-[9px]">
                    <input
                      type="radio"
                      name="liveCountsRecordStatusFilter"
                      checked={liveCountsRecordStatusFilter === 'all'}
                      onChange={() => setLiveCountsRecordStatusFilter('all')}
                      className="cursor-pointer"
                    />
                    All
                  </label>
                  <label className="flex items-center gap-0.5 cursor-pointer hover:bg-gray-200 px-1.5 py-0.5 rounded text-[9px]">
                    <input
                      type="radio"
                      name="liveCountsRecordStatusFilter"
                      checked={liveCountsRecordStatusFilter === 'loss'}
                      onChange={() => setLiveCountsRecordStatusFilter('loss')}
                      className="cursor-pointer"
                    />
                    📉 Loss
                  </label>
                  <label className="flex items-center gap-0.5 cursor-pointer hover:bg-gray-200 px-1.5 py-0.5 rounded text-[9px]">
                    <input
                      type="radio"
                      name="liveCountsRecordStatusFilter"
                      checked={liveCountsRecordStatusFilter === 'gain'}
                      onChange={() => setLiveCountsRecordStatusFilter('gain')}
                      className="cursor-pointer"
                    />
                    🚩 Gain
                  </label>
                  <label className="flex items-center gap-0.5 cursor-pointer hover:bg-gray-200 px-1.5 py-0.5 rounded text-[9px]">
                    <input
                      type="radio"
                      name="liveCountsRecordStatusFilter"
                      checked={liveCountsRecordStatusFilter === 'ok'}
                      onChange={() => setLiveCountsRecordStatusFilter('ok')}
                      className="cursor-pointer"
                    />
                    ✓ OK
                  </label>
                </div>
                <table className="w-full text-[10px] border-collapse flex-1">
                  <thead>
                    <tr className="bg-gray-100 sticky top-6 z-9 border-b border-gray-300">
                      <th className="text-left px-2 py-0.5 font-bold text-gray-700">Item</th>
                      <th className="text-center px-2 py-0.5 font-bold text-gray-700 whitespace-nowrap">Count Time</th>
                      <th className="text-center px-2 py-0.5 font-bold text-gray-700 whitespace-nowrap">Count Date</th>
                      <th className="text-center px-2 py-0.5 font-bold text-gray-700">Status</th>
                      <th className="text-center px-2 py-0.5 font-bold text-gray-700">Qty</th>
                      <th className="text-center px-2 py-0.5 font-bold text-gray-700">Trade Options</th>
                      <th className="text-center px-2 py-0.5 font-bold text-gray-700">Net After Trade</th>
                      <th className="text-center px-2 py-0.5 font-bold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveSaleCountRecords.filter((rec) => {
                      const recAny = rec as any
                      const isLoss = (recAny.loss_qty ?? 0) > 0
                      const isGain = (recAny.gain_qty ?? 0) > 0
                      const status = isLoss ? 'loss' : isGain ? 'gain' : 'ok'
                      return liveCountsRecordStatusFilter === 'all' || liveCountsRecordStatusFilter === status
                    }).map((rec) => {
                      const recAny = rec as any
                      const isLoss = (recAny.loss_qty ?? 0) > 0
                      const isGain = (recAny.gain_qty ?? 0) > 0
                      const tradeOff = rec.tradeOffWith
                      const qty = isLoss ? recAny.loss_qty : isGain ? recAny.gain_qty : rec.quantity_counted
                      const statusLabel = isLoss ? 'Loss' : isGain ? 'Gain' : 'OK'
                      const statusColor = isLoss ? 'bg-red-100 text-red-700' : isGain ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'
                      const netAfterTrade = tradeOff ? (isLoss ? Math.max(0, qty - tradeOff.qty) : 0) : qty
                      const netLabel = netAfterTrade === 0 ? 'Settled' : isLoss ? `${netAfterTrade} Loss` : `${netAfterTrade} Gain`
                      const netColor = netAfterTrade === 0 ? 'text-green-600 font-bold' : isLoss ? 'text-red-600' : 'text-amber-600'

                      return (
                        <tr key={rec.id} className="border-b border-gray-200 hover:bg-gray-50 transition">
                          <td className="px-2 py-0 text-gray-800 font-semibold max-w-sm truncate">{rec.item_name}</td>
                          <td className="px-2 py-0 text-center text-gray-600 whitespace-nowrap">{(rec as any).counted_at?.slice(11, 16) || '—'}</td>
                          <td className="px-2 py-0 text-center text-gray-600 whitespace-nowrap">{rec.count_date.slice(0, 10)}</td>
                          <td className="px-2 py-0 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold whitespace-nowrap inline-block ${statusColor}`}>
                              {statusLabel}
                            </span>
                          </td>
                          <td className="px-2 py-0 text-center font-semibold text-gray-800">{qty !== null ? Math.abs(qty).toFixed(2) : '—'}</td>
                          <td className="px-2 py-0 text-center">
                            {tradeOff ? (
                              <span className="text-blue-600 font-bold text-[9px]">
                                ↔ {tradeOff.kind === 'gain' ? '🚩' : '📉'} {tradeOff.qty.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-[9px]">—</span>
                            )}
                          </td>
                          <td className={`px-2 py-0 text-center font-bold text-[9px] ${netColor}`}>
                            {netLabel}
                          </td>
                          <td className="px-2 py-0 text-center flex gap-1 justify-center">
                            <button
                              onClick={() => {
                                setLiveEditingCountId(rec.id)
                                setLiveEditCountQty(String(recAny.loss_qty ?? recAny.gain_qty ?? rec.quantity_counted ?? ''))
                                setLiveEditCountNotes(rec.notes ?? '')
                              }}
                              className="px-1.5 py-0.5 text-blue-600 hover:bg-blue-50 rounded text-[9px] font-semibold"
                              title="Edit count"
                            >
                              ✎
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete count record for ${rec.item_name}?`)) {
                                  setLiveCountDeleteLoading(rec.id)
                                  fetch(`/api/stock/counts/${rec.id}`, {
                                    method: 'DELETE',
                                  }).then(async (res) => {
                                    setLiveCountDeleteLoading(null)
                                    if (res.ok) {
                                      window.location.reload()
                                    } else {
                                      const data = await res.json()
                                      alert(`Delete failed: ${data.error || 'Unknown error'}`)
                                    }
                                  }).catch(e => {
                                    console.error('Delete failed:', e)
                                    alert('Delete failed: ' + e.message)
                                    setLiveCountDeleteLoading(null)
                                  })
                                }
                              }}
                              disabled={liveCountDeleteLoading === rec.id}
                              className="px-1.5 py-0.5 text-red-600 hover:bg-red-50 rounded text-[9px] font-semibold disabled:opacity-50"
                              title="Delete count"
                            >
                              {liveCountDeleteLoading === rec.id ? '…' : '✕'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Count Intervals View */}
            {liveShowCountFullPage && liveMode === 'sale' && liveCountView?.kind === 'intervals' && (
              renderCountIntervalsView()
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
                  {liveCurrentView.kind === 'gmcPacks' && `Viewing: GMC Packs`}
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

            {/* GMC Packs View */}
            {liveCurrentView?.kind === 'gmcPacks' && (
              <div className="flex-1 overflow-y-auto">
                <GmcPacksPage />
              </div>
            )}

            {/* Daily Summary View */}
            {liveCurrentView?.kind === 'dailySummary' && (
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {(() => {
                  try {
                    const validTaps = (liveTaps || []).filter((t): t is Tap => t != null && !t.undone)
                    const todayTaps = validTaps.filter(t => t.tapped_at.startsWith(liveToday))
                    const totalRevenue = (todayTaps || []).reduce((sum, t) => t ? sum + Number(t.price) * t.quantity : sum, 0)
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


            {/* Edit Count Modal */}
            {liveEditingCountId !== null && (
              <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-3">
                <div className="bg-white rounded-lg w-full max-w-sm shadow-lg p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Edit Count Record</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Quantity</label>
                      <input
                        type="number"
                        value={liveEditCountQty}
                        onChange={(e) => setLiveEditCountQty(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Notes</label>
                      <textarea
                        value={liveEditCountNotes}
                        onChange={(e) => setLiveEditCountNotes(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Add notes…"
                        rows={3}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-6">
                    <button
                      onClick={() => {
                        setLiveEditingCountId(null)
                        setLiveEditCountQty('')
                        setLiveEditCountNotes('')
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-semibold text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setLiveEditCountSaving(true)
                        fetch(`/api/stock/counts/${liveEditingCountId}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            quantity_counted: liveEditCountQty,
                            notes: liveEditCountNotes
                          })
                        }).then(async (res) => {
                          setLiveEditCountSaving(false)
                          if (res.ok) {
                            const data = await res.json()
                            if (data.requires_loss_reason) {
                              alert(`${data.error}\n\nPlease confirm the loss reason separately.`)
                              setLiveEditingCountId(null)
                              setLiveEditCountQty('')
                              setLiveEditCountNotes('')
                            } else {
                              setLiveEditingCountId(null)
                              setLiveEditCountQty('')
                              setLiveEditCountNotes('')
                              // Refresh count records
                              window.location.reload()
                            }
                          } else {
                            const data = await res.json()
                            alert(`Update failed: ${data.error || 'Unknown error'}`)
                          }
                        }).catch(e => {
                          console.error('Edit failed:', e)
                          alert('Update failed: ' + e.message)
                          setLiveEditCountSaving(false)
                        })
                      }}
                      disabled={liveEditCountSaving}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold text-sm disabled:opacity-50"
                    >
                      {liveEditCountSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Items Grid or Loss Tables */}
            {liveCurrentView?.kind !== 'aliasWide' && liveCurrentView?.kind !== 'serviceMatches' && liveCurrentView?.kind !== 'newItem' && liveCurrentView?.kind !== 'dailySummary' && liveCurrentView?.kind !== 'gmcPacks' && !liveShowCountFullPage && (
            <>
              {liveSaleView?.kind === 'loss_by_date' ? (
                renderLossesByDateTable()
              ) : liveSaleView?.kind === 'loss_by_items' ? (
                renderLossesByItemsTable()
              ) : (
              <div className="flex-1 overflow-y-auto">
                {/* Violation Description Panel - scrolls with items */}
                {liveSaleViolationFilter !== 'all' && liveSaleViolationFilter !== 'noViolations' && (
                  (() => {
                    const violation = getViolationDescription(liveSaleViolationFilter)
                    return violation ? (
                      <div className="bg-white border-l-4 border-blue-400 p-4 mx-2 my-2 rounded text-sm">
                        <h3 className="font-semibold text-blue-900 mb-2">{violation.title}</h3>
                        <p className="text-blue-800 mb-3">{violation.description}</p>
                        <div className="text-blue-900">
                          <p className="font-semibold mb-2">How to fix:</p>
                          <ol className="list-decimal list-inside space-y-1">
                            {violation.steps.map((step, i) => (
                              <li key={i} className="text-blue-800 text-xs">{step}</li>
                            ))}
                          </ol>
                        </div>
                      </div>
                    ) : null
                  })()
                )}

                {liveItemsLoading ? (
                  <p className="text-xs text-gray-400 text-center py-8">Loading…</p>
                ) : liveCatalogueItems.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">
                    {liveCurrentView ? 'No items in this view' : 'No items found'}
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-0 p-0">
                  {liveSortedCatalogueItems.map((item, idx) => {
                    const count = liveSalesCounts.get(item.id) ?? 0
                    const due = liveCountStatus.get(item.id)
                    const overdue = due?.level === 'overdue'
                    // Being due for a count doesn't rule out having some
                    // other data-integrity problem too (negative stock, a
                    // gain, a duplicate...) -- surface those the same way
                    // regardless of whether this item is also due, instead
                    // of letting the COUNT NOW banner hide them.
                    const flags = itemAttentionFlags(item, liveDuplicateItemIds, liveUnlinkedNamedIds, liveServiceViolationIdSet, liveGainCountByItemId, liveEmptyRowCountByItemId, liveSoldBelowCostDatesByItemId, liveVcpJumpDatesByItemId)
                    // Darker, thicker borders than the *-100 shades used
                    // before -- those were nearly invisible against the
                    // white/near-white card backgrounds, so items ran
                    // together with no visible separation between them.
                    const cardBgCls = due
                      ? (overdue ? 'bg-red-50 border-red-300 hover:bg-red-100' : 'bg-amber-50 border-amber-300 hover:bg-amber-100')
                      : (flags.length > 0 ? 'bg-orange-50 border-orange-300 hover:bg-orange-100' : 'border-gray-300 hover:bg-gray-50')
                    return (
                      <Fragment key={item.id}>
                        {idx === 0 && liveDueCatalogueCount > 0 && (
                          <div className="col-span-3 px-2 py-1 bg-gray-800 text-[9px] font-bold text-white uppercase tracking-wide">
                            {liveDueCatalogueCount} item{liveDueCatalogueCount !== 1 ? 's' : ''} need{liveDueCatalogueCount === 1 ? 's' : ''} counting
                          </div>
                        )}
                        <div
                          onClick={() => openEditGridItem(item.id)}
                          className={`relative flex flex-col border-r-2 border-b-2 group cursor-pointer ${cardBgCls} transition`}
                        >
                          {liveSaleViolationFilter !== 'noViolations' && liveSaleViolationFilter === 'countDue' && due && (
                            <div className={`px-2 py-1 text-[8px] font-extrabold text-white tracking-wide flex items-center justify-between gap-2 whitespace-nowrap ${overdue ? 'bg-red-600' : 'bg-amber-500'}`}>
                              <span className="truncate">{due.label} {overdue ? 'OVERDUE' : 'DUE'}</span>
                            </div>
                          )}
                          {liveSaleViolationFilter !== 'noViolations' && liveSaleViolationFilter !== 'countDue' && liveSaleViolationFilter !== 'lossGain' && (() => {
                            let filteredFlags = flags
                            if (liveSaleViolationFilter === 'duplicates') filteredFlags = flags.filter(f => f.label.includes('DUPLICATE'))
                            else if (liveSaleViolationFilter === 'unlinked') filteredFlags = flags.filter(f => f.label.includes('UNLINKED'))
                            else if (liveSaleViolationFilter === 'service') filteredFlags = flags.filter(f => f.label.includes('SERVICE'))
                            else if (liveSaleViolationFilter === 'soldBelowCost') filteredFlags = flags.filter(f => f.label.includes('SOLD BELOW COST'))
                            else if (liveSaleViolationFilter === 'vcpJump') filteredFlags = flags.filter(f => f.label.includes('VCP JUMP'))
                            else if (liveSaleViolationFilter === 'emptyRow') filteredFlags = flags.filter(f => f.label.includes('EMPTY DATA'))
                            else if (liveSaleViolationFilter !== 'withViolations') filteredFlags = []
                            return filteredFlags.map((f, i) => {
                              let displayLabel = f.label
                              // Only strip violation name prefix when on a specific filter, not on All(V)
                              if (liveSaleViolationFilter !== 'withViolations') {
                                if (f.label.includes('DUPLICATE')) displayLabel = ''
                                else if (f.label.includes('UNLINKED')) displayLabel = ''
                                else if (f.label.includes('SERVICE')) displayLabel = ''
                                else if (f.label.includes('NEGATIVE STOCK')) displayLabel = ''
                                else if (f.label.includes('STOCK GAIN:')) displayLabel = f.label.replace('🔺 STOCK GAIN: ', '')
                                else if (f.label.includes('SOLD BELOW COST')) displayLabel = f.label.replace('⚠ SOLD BELOW COST (history): ', '')
                                else if (f.label.includes('VCP JUMP')) displayLabel = f.label.replace('⚠ VCP JUMP (history): ', '')
                                else if (f.label.includes('MISSING SELLING PRICE')) displayLabel = ''
                                else if (f.label.includes('MISSING COST PRICE')) displayLabel = ''
                                else if (f.label.includes('MISSING GROUP')) displayLabel = ''
                                else if (f.label.includes('EMPTY DATA')) displayLabel = f.label.replace('⚠ EMPTY DATA: ', '')
                              }
                              return displayLabel ? (
                                <div key={i} className={`px-2 py-0.5 text-[8px] font-extrabold text-white tracking-wide truncate ${f.bg}`}>
                                  {displayLabel}
                                </div>
                              ) : null
                            })
                          })()}
                          {liveSaleViolationFilter !== 'noViolations' && liveSaleViolationFilter === 'lossGain' && liveTradeOffByItemId.has(item.id) && (() => {
                            const tradeOff = liveTradeOffByItemId.get(item.id)!
                            const costPrice = Number(item.acp_price ?? item.cost_price ?? 0)
                            const netAmount = Math.abs(tradeOff.net) * costPrice
                            const isLoss = tradeOff.net > 0
                            return (
                              <div className={`px-2 py-1 text-[8px] font-extrabold text-white tracking-wide ${isLoss ? 'bg-red-600' : 'bg-amber-600'}`}>
                                <div className="text-[9px] font-bold">Current Status</div>
                                <div className="truncate">{isLoss ? 'Loss' : 'Gain'} of {Math.abs(tradeOff.net)} units · ₵{formatPrice(netAmount)}</div>
                                <div className="text-[9px] font-bold mt-0.5">Target Status</div>
                                <div className="truncate">{isLoss ? 'Loss' : 'Gain'} of 0 units (Resolved)</div>
                              </div>
                            )
                          })()}
                          <div className="px-1 py-0.5 flex flex-col">
                            {liveSaleViolationFilter === 'countDue' ? (
                              <>
                                <div className={`text-[11px] font-semibold leading-tight truncate text-left`}>
                                  {renderClickableItemName(item.name, `text-[11px] leading-tight truncate text-left text-blue-600`)}
                                </div>
                                <p className="text-[9px] text-gray-600 leading-tight mt-0.5">
                                  <span>Last ctd: </span>
                                  <span className="font-semibold text-gray-900">
                                    {liveLastCountDateByItemId.get(item.id) ? fmtDate(liveLastCountDateByItemId.get(item.id)!) : 'Never'}
                                  </span>
                                  {item.count_interval && (
                                    <>
                                      <span className="text-gray-400"> · </span>
                                      <span className="text-gray-500">Interval {shortCountInterval(item.count_interval)}</span>
                                    </>
                                  )}
                                </p>
                                <p className="text-[9px] text-gray-600 leading-tight">
                                  <span>SOH: </span>
                                  <span className="font-semibold text-gray-900">{Math.ceil(Number(item.soh))} pc</span>
                                </p>
                              </>
                            ) : (
                              <>
                                <div className={`text-[11px] font-semibold leading-tight truncate text-left ${item.product_type !== 'service' && Number(item.soh) === 0 ? 'line-through text-gray-400' : ''}`}>
                                  {renderClickableItemName(item.name, `text-[11px] leading-tight truncate text-left ${item.product_type !== 'service' && Number(item.soh) === 0 ? 'line-through text-gray-400' : 'text-blue-600'}`)}
                                </div>
                                {liveSaleViolationFilter === 'noViolations' ? (
                                  <p className="text-[9px] text-gray-600 leading-tight">
                                    <span className="text-blue-600 font-semibold">₵{formatPrice(item.selling_price)}</span>
                                    {item.product_type !== 'service' && (
                                      <>
                                        <span className="text-gray-400"> · </span>
                                        <span className="text-green-600 font-semibold">ACP ₵{formatPrice(item.acp_price ?? item.cost_price)}</span>
                                        <span className="text-gray-400"> · </span>
                                        <span className="text-slate-600 font-semibold">{Math.ceil(Number(item.soh))} pc</span>
                                      </>
                                    )}
                                  </p>
                                ) : (
                                  <p className="text-[9px] text-gray-600 leading-tight">
                                    <span className="text-blue-600 font-semibold">₵{formatPrice(item.selling_price)}</span>
                                    <span className="text-gray-400"> · </span>
                                    {item.product_type !== 'service' && (
                                      <>
                                        <span className="text-green-600 font-semibold">ACP ₵{formatPrice(item.acp_price ?? item.cost_price)}</span>
                                        <span className="text-gray-400"> · </span>
                                      </>
                                    )}
                                    {item.product_type !== 'service' && (
                                      <>
                                        <span className="text-slate-600 font-semibold">{Math.ceil(Number(item.soh))} pc</span>
                                        {item.count_interval && liveSaleViolationFilter !== 'lossGain' && (
                                          <>
                                            <span className="text-gray-400"> · </span>
                                            <span className="text-gray-500">{shortCountInterval(item.count_interval)}</span>
                                          </>
                                        )}
                                        {liveSaleViolationFilter !== 'lossGain' && (
                                          <span className="text-gray-400"> · </span>
                                        )}
                                      </>
                                    )}
                                    {item.product_type !== 'service' && liveSaleViolationFilter !== 'lossGain' && (
                                      <>
                                        <span className={formatLoss(liveLossByItemId.get(item.id)).cls}>{formatLoss(liveLossByItemId.get(item.id)).text}</span>
                                      </>
                                    )}
                                    {item.gmc_type && liveSaleViolationFilter !== 'lossGain' && (
                                      <>
                                        <span className="text-gray-400"> · </span>
                                        <span className="inline-block rounded bg-purple-100 px-1 py-0.5 text-[7px] font-bold text-purple-700">
                                          {item.gmc_type === 'gmc' ? 'GMC' : item.gmc_type === 'service_no_gmc' ? 'SVC only' : item.gmc_type === 'pack_to_gmc' ? 'PKG→GMC' : 'SVC/GMC'}
                                          {item.converts_to_name && ` → ${item.converts_to_name}`}
                                        </span>
                                      </>
                                    )}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                          {count > 0 && (
                            <span className="absolute top-1 right-1 inline-flex items-center justify-center min-w-3 h-3 px-0.5 rounded-full bg-blue-600 text-white text-[8px] font-bold">
                              {count}
                            </span>
                          )}
                        </div>
                        {liveDueCatalogueCount > 0 && idx === liveDueCatalogueCount - 1 && liveDueCatalogueCount < liveSortedCatalogueItems.length && (
                          <div className="col-span-3 border-b border-gray-200" />
                        )}
                      </Fragment>
                    )
                  })}
                  </div>
                )}
              </div>
              )}
            </>
            )}

            {/* Modal */}
            {liveSelectedItem && (() => {
              const due = liveCountStatus.get(liveSelectedItem.id)
              const flags = itemAttentionFlags(liveSelectedItem, liveDuplicateItemIds, liveUnlinkedNamedIds, liveServiceViolationIdSet, liveGainCountByItemId, liveEmptyRowCountByItemId, liveSoldBelowCostDatesByItemId, liveVcpJumpDatesByItemId)
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
                        <span>Cost (ACP): ₵{formatPrice(liveSelectedItem.acp_price ?? liveSelectedItem.cost_price)}</span>
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
                          acp={liveSelectedItem.acp_price}
                          onGmcTypeSave={saveGmcTypeOnly}
                          onConversionTargetSave={saveConversionTargetOnly}
                        />
                      )}
                      {liveEditError && (
                        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600 font-medium">
                          {liveEditError}
                        </div>
                      )}

                      {/* Quick tap while editing */}
                      {!liveEditLoading && liveSelectedItem && (
                        <div className="mt-4 rounded-xl border border-blue-200 overflow-hidden bg-blue-50">
                          <div className="px-3 py-1.5 text-xs font-extrabold text-white bg-blue-600">
                            QUICK TAP
                          </div>
                          <div className="p-3 space-y-2">
                            <div className="space-y-2">
                              <label className="block text-xs font-semibold text-gray-700">Quantity</label>
                              <input
                                type="number"
                                inputMode="decimal"
                                min="1"
                                step="1"
                                value={liveQty}
                                onChange={e => setLiveQty(e.target.value)}
                                placeholder="Enter quantity"
                                className="w-full text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-blue-400"
                                disabled={liveSaving}
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="block text-xs font-semibold text-gray-700">Price (optional)</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">₵</span>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min="0"
                                  step="0.01"
                                  value={livePrice}
                                  onChange={e => setLivePrice(e.target.value)}
                                  placeholder={formatPrice(liveSelectedItem?.selling_price || 0)}
                                  className="w-full text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded-lg pl-7 pr-3 py-2 outline-none focus:ring-1 focus:ring-blue-400"
                                  disabled={liveSaving}
                                />
                              </div>
                            </div>
                            {liveTapError && (
                              <div className="bg-red-50 border border-red-200 rounded-lg px-2 py-1 text-xs text-red-600 font-medium">
                                {liveTapError}
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                recordTap()
                                setLiveEditingSelectedItem(false)
                              }}
                              disabled={liveQty === '' || liveSaving}
                              className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
                            >
                              {liveSaving ? 'Recording…' : 'Tap Sale'}
                            </button>
                          </div>
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
                                onClick={() => {
                                  alert(`Button clicked. enteredCount=${enteredCount}, liveCountQty='${liveCountQty}'`)
                                  enteredCount !== null && submitCount(liveSelectedItem, enteredCount)
                                }}
                                disabled={liveCountQty === '' || liveCountSaving}
                                className={`shrink-0 px-3 py-2 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50 bg-purple-600 hover:bg-purple-700`}
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
                      banners the grid card shows (see itemAttentionFlags) -- shown
                      here too since the modal is reached directly from a search
                      pick as well as from a grid card, and a searched-and-picked
                      item skips the grid card entirely. Every flag gets its own
                      line (not just the worst one) so a genuinely broken item
                      doesn't read as having only one problem. */}
                  {flags.map((f, i) => (
                    <div key={i} className={`mx-4 ${i === 0 ? 'mt-4' : 'mt-1.5'} px-3 py-1.5 rounded-lg text-xs font-extrabold text-white ${f.bg}`}>
                      {f.label}
                    </div>
                  ))}

                  {/* This item is due for a count -- surfaced right inside the
                      sale sheet instead of requiring a separate mode-switch and
                      a separate tap. Still its own field and its own submit,
                      going to the count endpoint independently of the sale
                      below, so entering one never gets mistaken for the other. */}
                  {due && (
                    <div className={`mx-4 mt-4 rounded-xl border overflow-hidden ${due.level === 'overdue' ? 'border-red-300' : 'border-amber-300'}`}>
                      <div className={`px-3 py-1.5 text-xs font-extrabold text-white flex items-center justify-between gap-2 whitespace-nowrap ${due.level === 'overdue' ? 'bg-red-600' : 'bg-amber-500'}`}>
                        <span className="truncate">⚠ COUNT NOW · {due.label} {due.level === 'overdue' ? 'OVERDUE' : ''}</span>
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
                            onClick={() => {
                              alert(`Button clicked. enteredCount=${enteredCount}, liveCountQty='${liveCountQty}'`)
                              if (enteredCount !== null && !isNaN(enteredCount)) {
                                submitCount(liveSelectedItem, enteredCount)
                              }
                            }}
                            disabled={liveCountQty === '' || liveCountSaving}
                            className={`shrink-0 px-3 py-2 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50 bg-purple-600 hover:bg-purple-700`}
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

                    {liveGmcTargetItem && (
                      <div className="bg-blue-50 border border-blue-300 rounded-lg px-3 py-3">
                        <p className="text-xs font-semibold text-blue-900 mb-1">Material Tracking: {liveGmcTargetItem.name}</p>
                        <p className="text-sm font-bold text-blue-700 mb-2">
                          Current: <span className="text-blue-900">{liveGmcTargetItem.soh.toFixed(2)}</span> units
                        </p>
                        {liveQty && (
                          <p className="text-sm text-blue-700">
                            Remaining after sale: <span className="font-bold text-blue-900">{Math.max(0, liveGmcTargetItem.soh - Number(liveQty)).toFixed(2)}</span> units
                          </p>
                        )}
                      </div>
                    )}

                    {liveTapError && (
                      <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600 font-medium">
                        {liveTapError}
                      </div>
                    )}

                    <div className="flex flex-col gap-2 pt-2">
                      <div className="flex gap-2">
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
                            setLiveGmcTargetItem(null)
                          }}
                          disabled={liveSaving || liveGmcCountSaving}
                          className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold rounded-lg transition disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => recordTap()}
                          disabled={!liveQty || liveSaving || liveGmcCountSaving}
                          className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
                        >
                          {liveSaving ? 'Saving…' : 'Tap'}
                        </button>
                      </div>
                      {liveGmcTargetItem && (
                        <button
                          type="button"
                          onClick={() => recordCountAndSale()}
                          disabled={!liveQty || liveSaving || liveGmcCountSaving}
                          className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
                        >
                          {liveGmcCountSaving ? 'Saving…' : 'Count & Save'}
                        </button>
                      )}
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
                  <div className="px-2 py-1 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10 gap-2">
                    {liveGridEditRelationsOpen ? (
                      <input
                        value={liveEditForm.item_name}
                        onChange={e => setLiveEditForm({ ...liveEditForm, item_name: e.target.value })}
                        placeholder="Item name *"
                        className="min-w-0 flex-1 text-xs font-bold text-red-600 uppercase bg-red-50 border border-red-200 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-red-400"
                      />
                    ) : (
                      <h2 className="text-xs font-bold text-red-600 truncate">{editItem?.name.toUpperCase()}</h2>
                    )}
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
                    {editItem && !liveGridEditLoading && (
                      <div className="border-b border-gray-200 bg-gray-50 px-1.5 py-1">
                        {!liveGridEditRelationsOpen ? (
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex flex-wrap gap-1.5 flex-1 items-center text-[8px]">
                              <div className="flex items-center gap-1">
                                <span className="font-semibold text-gray-600">Aliases:</span>
                                {liveGridEditAliases.length === 0 ? (
                                  <span className="text-gray-400">—</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {liveGridEditAliases.map(a => (
                                      <span key={a.id} className="inline-block bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full text-[8px] font-semibold">
                                        {a.name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="font-semibold text-gray-600">
                                  {editItem.product_type === 'service' ? 'Goods used:' : 'Services used:'}
                                </span>
                                {liveGridEditMatches.length === 0 ? (
                                  <span className="text-gray-400">—</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {liveGridEditMatches.map(m => (
                                      <span key={m.id} className="inline-block bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded-full text-[8px] font-semibold">
                                        {m.name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => setLiveGridEditRelationsOpen(true)}
                              className="shrink-0 text-[8px] font-semibold px-1.5 py-0.5 rounded bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 transition whitespace-nowrap">
                              ✎ Edit
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-1.5">
                              <p className="text-[8px] font-bold text-blue-700 uppercase tracking-wide">Editing</p>
                              <button
                                onClick={saveGridEditItem}
                                disabled={liveEditSaving}
                                className="shrink-0 text-[8px] font-semibold px-1.5 py-0.5 rounded bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white transition whitespace-nowrap">
                                {liveEditSaving ? 'Saving…' : '✓ Save'}
                              </button>
                            </div>
                            <div className="grid grid-cols-3 gap-1">
                              <div className="min-w-0">
                                <p className="text-[7px] font-bold text-gray-600 mb-0.5 uppercase truncate">Aliases</p>
                                <AliasPicker itemId={editItem.id} current={liveGridEditAliases} onChange={setLiveGridEditAliases} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[7px] font-bold text-gray-600 mb-0.5 uppercase truncate">
                                  {editItem.product_type === 'service' ? 'Goods Used' : 'Services Used'}
                                </p>
                                <MatchPicker
                                  itemId={editItem.id}
                                  itemName={editItem.name}
                                  isService={editItem.product_type === 'service'}
                                  current={liveGridEditMatches}
                                  candidatePool={editItem.product_type === 'service' ? Array.from(liveGmcItemIds).map((id: number) => {
                                    const it = liveAllItems.find(i => i.id === id)
                                    return { item_id: id, item_name: it?.name ?? '', product_type: 'good' }
                                  }) : Array.from(liveGmcItemIds).map((id: number) => {
                                    const it = liveAllItems.find(i => i.id === id)
                                    return { item_id: id, item_name: it?.name ?? '', product_type: 'service' }
                                  })}
                                  onChange={setLiveGridEditMatches}
                                />
                              </div>
                              {isOwnerLevel(session?.user as any) && (
                                <div className="min-w-0">
                                  <p className="text-[7px] font-bold text-gray-600 mb-0.5 uppercase truncate">Merge</p>
                                  <MergeItemPicker
                                    itemId={editItem.id}
                                    itemName={editItem.name}
                                    typeLabel={editItem.product_type === 'service' ? 'service' : 'good'}
                                    mergePool={liveAllItems.filter(i => i.id !== editItem.id).map(i => ({
                                      item_id: i.id,
                                      item_name: i.name,
                                      product_type: i.product_type
                                    }))}
                                    onMerged={() => { setLiveGridEditRelationsOpen(false); setLiveEditingGridItemId(null) }} />
                                </div>
                              )}
                            </div>
                            {isOwnerLevel(session?.user as any) && (
                              <div className="flex justify-end">
                                {!liveGridEditConfirmDelete ? (
                                  <button
                                    onClick={() => setLiveGridEditConfirmDelete(true)}
                                    className="bg-gray-100 hover:bg-red-50 text-red-600 text-[8px] font-semibold rounded px-2 py-0.5 transition">
                                    Delete
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-1 flex-wrap justify-end">
                                    <p className="text-[8px] text-red-600">No sales/bills/counts?</p>
                                    <button
                                      onClick={deleteGridEditItem}
                                      disabled={liveGridEditDeleting}
                                      className="bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-[8px] font-semibold rounded px-2 py-0.5 transition">
                                      {liveGridEditDeleting ? 'Deleting…' : 'Confirm'}
                                    </button>
                                    <button
                                      onClick={() => { setLiveGridEditConfirmDelete(false); setLiveGridEditDeleteError('') }}
                                      className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[8px] font-semibold rounded">
                                      Cancel
                                    </button>
                                    {liveGridEditDeleteError && <p className="text-[8px] text-red-600 font-medium w-full text-right">{liveGridEditDeleteError}</p>}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="border-b border-gray-200">
                      {liveGridEditLoading ? (
                        <p className="text-center text-gray-500 text-xs py-2">Loading…</p>
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
                          acp={editItem.acp_price}
                          onConversionTargetSave={saveConversionTargetOnly}
                          hideGmcTick
                          editMode={liveGridEditRelationsOpen}
                          onEditModeChange={setLiveGridEditRelationsOpen}
                          hideEditButton
                        />
                      ) : (
                        <p className="text-center text-red-600 text-xs py-2">Item not found</p>
                      )}
                      {liveGridEditError && (
                        <div className="mx-1.5 mb-1.5 bg-red-50 border border-red-200 rounded px-2 py-1 text-xs text-red-600 font-medium">
                          {liveGridEditError}
                        </div>
                      )}
                    </div>
                    {editItem && !liveGridEditLoading && (() => {
                      const overdueItem = liveOverdueItems.find(i => i.item_id === editItem.id)
                      return (
                      <div ref={liveGridEditSaleTapRef} className="p-2 border-b border-gray-200">
                        <div className="bg-orange-100 border border-orange-300 rounded p-1.5 mb-1">
                          <p className="text-[10px] font-semibold text-orange-900">⚠ SALE TAP</p>
                        </div>
                        {liveTapStatus.length > 0 && (
                          <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-[8px] font-mono text-blue-900 max-h-24 overflow-y-auto">
                            {liveTapStatus.map((msg, i) => (
                              <div key={i}>{msg}</div>
                            ))}
                          </div>
                        )}
                        <div className="space-y-1">
                          <div className="flex gap-1.5 items-stretch">
                            <div className="flex-1 min-w-0 flex flex-col">
                              <p className="text-[9px] text-gray-700 font-medium mb-1">Qty</p>
                              <input
                                ref={liveGridEditQtyInputRef}
                                type="number"
                                inputMode="decimal"
                                min="1"
                                step="1"
                                value={liveQty}
                                onChange={e => setLiveQty(e.target.value)}
                                placeholder="Qty"
                                className="w-full flex-1 text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded-lg px-1 py-4 outline-none focus:ring-1 focus:ring-blue-400 text-center"
                              />
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col">
                              <p className="text-[9px] text-gray-700 font-medium mb-1">Price</p>
                              <div className="relative flex-1">
                                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-500 text-[9px]">₵</span>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min="0"
                                  step="0.01"
                                  value={livePrice}
                                  onChange={e => setLivePrice(e.target.value)}
                                  placeholder={editItem ? formatPrice(editItem.selling_price) : 'Price'}
                                  className="w-full h-full text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded-lg pl-4 pr-1 py-4 outline-none focus:ring-1 focus:ring-blue-400"
                                />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col">
                              <p className="text-[9px] text-gray-700 font-medium mb-1">Time</p>
                              <input
                                type="datetime-local"
                                value={liveTapTime}
                                onChange={e => setLiveTapTime(e.target.value)}
                                className="w-full flex-1 text-[9px] font-semibold text-gray-900 bg-white border border-gray-300 rounded-lg px-1 py-4 outline-none focus:ring-1 focus:ring-blue-400"
                              />
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col">
                              <p className="text-[9px] text-transparent font-medium mb-1 select-none">Tap</p>
                              <button
                                onClick={() => recordTap(editItem)}
                                disabled={!liveQty || liveSaving}
                                className="w-full flex-1 px-1 py-4 bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-semibold rounded-lg transition disabled:opacity-50">
                                {liveSaving ? '…' : 'Tap'}
                              </button>
                            </div>
                          </div>
                          <p className="text-[8px] text-gray-500">
                            Defaults to ₵{editItem ? formatPrice(editItem.selling_price) : '0'} · When was this sale made?
                          </p>
                        </div>
                      </div>
                    )})()}
                    {editItem && !liveGridEditLoading && (() => {
                      const overdueItem = liveOverdueItems.find(i => i.item_id === editItem.id)
                      const currentCount = overdueItem ? Math.ceil(Number(overdueItem.calculated_soh)) : null
                      return (
                      <div className="bg-gray-50">
                        <div className="px-2 py-1.5 space-y-2">
                          <div>
                            {overdueItem ? (
                              <div className="p-1.5 bg-red-100 border border-red-300 rounded space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <p className="text-[9px] font-bold text-red-900">
                                      ⚠ COUNT NOW{overdueItem.days_overdue != null ? ` – ${overdueItem.days_overdue}d overdue` : ' – never counted'}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[8px] text-red-800 font-semibold">System Count</p>
                                    <p className="text-xl font-bold text-red-900">{currentCount}</p>
                                  </div>
                                </div>
                                <p className="text-[8px] text-red-800">
                                  {Number(overdueItem.calculated_soh) < 0
                                    ? `System shows ${overdueItem.calculated_soh} -- there's no earlier count to check against, so just enter what's actually on the shelf.`
                                    : `System expects ${overdueItem.calculated_soh} on the shelf.`}
                                </p>
                                <div className="flex gap-1.5 items-stretch">
                                  <div className="flex-1 min-w-0 flex flex-col">
                                    <p className="text-[8px] text-red-800 font-medium mb-1">Quantity</p>
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      min="0"
                                      step="1"
                                      value={liveGridEditCountQty}
                                      onChange={e => setLiveGridEditCountQty(e.target.value)}
                                      placeholder="Qty"
                                      className="w-full flex-1 text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded-lg px-1 py-4 outline-none focus:ring-1 focus:ring-red-400 text-center"
                                      disabled={liveGridEditCountSaving}
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0 flex flex-col">
                                    <p className="text-[8px] text-transparent font-medium mb-1 select-none">Save</p>
                                    <button
                                      type="button"
                                      onClick={() => recordCountFromModal()}
                                      disabled={!liveGridEditCountQty || liveGridEditCountSaving}
                                      className="w-full flex-1 px-1 py-4 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-semibold rounded-lg transition disabled:opacity-50">
                                      {liveGridEditCountSaving ? 'Saving…' : 'Save Count'}
                                    </button>
                                  </div>
                                </div>
                                {liveGridEditCountError && (
                                  <div className="bg-red-50 border border-red-200 rounded px-1.5 py-0.5 text-[8px] text-red-600">
                                    {liveGridEditCountError}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <>
                                <div className="bg-blue-600 text-white rounded-lg px-4 py-3 mb-2">
                                  <div className="flex items-center justify-between gap-4">
                                    <h3 className="text-lg font-bold">Enter Count here</h3>
                                    <div className="text-right">
                                      <p className="text-sm opacity-90">Current Count</p>
                                      <p className="text-2xl font-bold">{currentCount ?? '—'}</p>
                                    </div>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <div className="flex gap-1.5 items-stretch">
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      min="0"
                                      step="1"
                                      value={liveGridEditCountQty}
                                      onChange={e => setLiveGridEditCountQty(e.target.value)}
                                      placeholder="Qty"
                                      className="flex-1 text-lg font-semibold text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-4 outline-none focus:ring-1 focus:ring-blue-400 text-center"
                                      disabled={liveGridEditCountSaving}
                                      autoFocus
                                    />
                                    <button
                                      type="button"
                                      onClick={() => recordCountFromModal()}
                                      disabled={!liveGridEditCountQty || liveGridEditCountSaving}
                                      className="shrink-0 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-semibold rounded-lg transition disabled:opacity-50">
                                      {liveGridEditCountSaving ? 'Recording…' : 'Record'}
                                    </button>
                                  </div>
                                  {liveGridEditCountError && (
                                    <div className="bg-red-50 border border-red-200 rounded px-1.5 py-0.5 text-[8px] text-red-600">
                                      {liveGridEditCountError}
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )})()}
                    {editItem && !liveGridEditLoading && (
                      <div className="bg-gray-50">
                        <h3 className="px-2 py-1 text-[9px] font-bold text-gray-900 border-b border-gray-200">Details</h3>
                        <ItemDetailPanel itemId={editItem.id} onItemGone={() => setLiveEditingGridItemId(null)} showRelationsEditor={false} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}

          {liveLossPrompt && <LossDialog prompt={liveLossPrompt} onClose={() => setLiveLossPrompt(null)} />}
          {liveGainPrompt && <GainDialog prompt={liveGainPrompt} onClose={() => setLiveGainPrompt(null)} />}
          {livePairingPrompt && <PairingDialog prompt={livePairingPrompt} onClose={() => setLivePairingPrompt(null)} />}
          </>)}

          <TrainingGuideModal isOpen={liveHelpModalOpen} onClose={() => setLiveHelpModalOpen(false)} />
          <LawsTasksModal isOpen={liveShowLawsTasksModal} onClose={() => setLiveShowLawsTasksModal(false)} lawsPanel={liveSaleLaws} scopeKey="Items" />
          <LawsTasksModal isOpen={liveSalesShowLawsTasksModal} onClose={() => setLiveSalesShowLawsTasksModal(false)} lawsPanel={salesLaws} scopeKey="Sales" />
          <LawsTasksModal isOpen={liveBillsShowLawsTasksModal} onClose={() => setLiveBillsShowLawsTasksModal(false)} lawsPanel={billsLaws} scopeKey="Bills" />

          {liveSortOrderModalOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setLiveSortOrderModalOpen(false)}>
              <div className="bg-white rounded-lg shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-gray-900">Arrange Item Order</h2>
                  <button type="button" onClick={() => setLiveSortOrderModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-xs text-gray-500">
                    Sets the priority order the Sale grid arranges items in -- top wins ties
                    against the ones below it. This is shared: whoever changes it changes
                    what every staff member's app shows, not just yours.
                  </p>
                  <div className="space-y-1.5">
                    {liveItemSortOrder.map((key, i) => (
                      <div key={key} className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                        <span className="text-sm text-gray-800">
                          <span className="text-gray-400 font-mono mr-2">{i + 1}.</span>
                          {ITEM_SORT_LABELS[key]}
                        </span>
                        <div className="flex gap-1 shrink-0">
                          <button type="button" disabled={i === 0} onClick={() => moveItemSortKey(key, -1)}
                            className="w-6 h-6 rounded bg-white border border-gray-300 text-gray-600 disabled:opacity-30 hover:bg-gray-100 flex items-center justify-center text-xs">▲</button>
                          <button type="button" disabled={i === liveItemSortOrder.length - 1} onClick={() => moveItemSortKey(key, 1)}
                            className="w-6 h-6 rounded bg-white border border-gray-300 text-gray-600 disabled:opacity-30 hover:bg-gray-100 flex items-center justify-center text-xs">▼</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </> ) : null}
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
        {outerTab === 'loss' && lossView === 'items' && itemsExtraView === 'gmcPacks' && (
          <TabErrorBoundary>
            <GmcPacksPage />
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
                        <button key={i.id} onClick={() => { setLiveViewingItemId(i.id); closeGlobalSearch() }}
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

      {/* Global toast notifications */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-lg pointer-events-auto animate-in fade-in slide-in-from-right-4 duration-300 ${
              toast.type === 'success' ? 'bg-green-600' :
              toast.type === 'error' ? 'bg-red-600' :
              'bg-blue-600'
            }`}
          >
            {toast.type === 'success' && '✓ '}
            {toast.type === 'error' && '✗ '}
            {toast.message}
          </div>
        ))}
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
