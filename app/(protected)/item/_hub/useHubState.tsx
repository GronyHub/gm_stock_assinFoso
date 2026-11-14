'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useNavSlotEl } from '@/lib/navSlot'
import { useNavHeightPx } from '@/lib/navHeight'
import { useIsDesktop } from '@/lib/useIsDesktop'
import { useSession } from 'next-auth/react'
import { hasFeature, DEFAULT_ON_FEATURES, type FeatureKey, type RolePermissionsMap } from '@/lib/permissionsShared'
import { usePresenceReporter } from '@/lib/usePresenceReporter'
import { isOwnerLevel } from '@/lib/roles'
import { fmtDate, fmtTime } from '@/lib/fmtDate'
import { type LossExtra, type LossPrompt, type GainExtra, type GainPrompt, type PairingPrompt } from '../_components/CountDialogs'
import { ItemEditForm, EMPTY_ITEM_EDIT_FORM } from '../_components/ItemEditForm'
import ClockInGateModal from '../_components/ClockInGateModal'
import GmcOverageGateModal from '../_components/GmcOverageGateModal'
import type { GmcOpenOverage } from '@/lib/gmcStock'
import type { AliasRecord, MatchRecord } from '../_components/LossTab'
import { usePolling } from '@/lib/usePolling'
import { useViolations } from '../_components/useViolations'
import AddShortcutButton, { type ShortcutKey } from '../_components/AddShortcutButton'
import type { Attachment } from '../_components/attachmentsShared'
import PresentStaffBar from '../_components/PresentStaffBar'
import type { Dest } from '@/lib/voiceCommands'
import { nextAfterSaleHint } from '@/lib/customerServiceCode'
import AssignWidget from '../_components/AssignWidget'
import { COLUMNS, type ColKey } from '../_components/lossTabColumns'
import { SALES_COLUMNS, type ColKey as SalesColKey } from '../_components/salesTabColumns'
import { COLUMNS as BILLS_COLUMNS, type ColKey as BillsColKey } from '../_components/billsTabColumns'
import { COLUMNS as EXPENSES_COLUMNS, type ColKey as ExpensesColKey } from '../_components/expensesTabColumns'
import { useColumnPrefs, ColumnsPickerButton } from '../_components/columnPrefs'
import { MANAGE_LIST_ITEMS, useFixedCategoryIds, type ManageView } from '../_components/manageViewData'
import { STAFF_PERSONAL_ITEMS, STAFF_TEAM_ITEMS, STAFF_ADMIN_TEAM_ITEMS } from '../_components/staffViewData'
import { isManagerName } from '@/lib/signers'
import { type BasketLine } from '../_components/MIBasket'
import { useFitWidth } from '@/lib/useFitWidth'
import { CH_ITEMS, CH_CHILD_PERSON, CH_PERSON_VIEW, type CHView } from '../_components/chViewData'
import { useUKData, UK_PEOPLE } from '../_components/ukViewData'
import { SidePaneToggle, useSidePaneDisplayMode } from '../_components/SidePane'
import { applyPaneOrder, flattenPaneRuns, type PaneOrderMap } from '../_components/paneOrder'
import { loading, ExpenseOrdersPanel, ItemDetailPanel, ExpensesTab, CABTab, LossTab, ProfitLossTab, GronyManageContent, VendorsPage, CustomersPage, PurchaseOrdersPage, StaffContent, UKTab, CHTab, ReorderListsPanel, SalesTab, BillsTab, CountsTab, NewBillForm, STAFF_ROSTER, OLD_LOSSVIEW_TO_EXTRA, MANAGE_VIEW_KEYS, CH_VIEW_KEYS, OLD_TAB_TO_VIEW, REPORT_VIEWS, CASH_ITEMS, CASH_VIEW_KEYS, CASH_LABEL, ERROR_VIOLATIONS, VIOLATION_HOME, LOSSVIEW_PILL_KEYS, SALES_FLAG_TYPES, ITEMS_FLAG_TYPES, BILLS_FLAG_TYPES, VALID_TABS, VALID_ADD_FORMS, PANE_ACCENT, fmtN, formatPrice, DEFAULT_ITEM_SORT_ORDER, itemAttentionFlags, type OuterTab, type LossView, type ItemsExtraView, type Item, type LiveItem, type Tap, type ViolationType, type DueItem, type CountRecord, type ItemSortKey, type ItemsInlineExtra, type ShopTab, type LogRec, type LogRecLine } from './hubShared'
import { useFeatures } from '@/lib/useFeatures'

// All of the Items hub's state, effects and handlers (they used to sit at the top of the page component). The page and its view blocks read them from the returned object.
export function useHubState() {

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
  // Old ?tab=today / ?tab=staff links open the Shop on Done (see the ?open= effect below).
  const doneTabLink = rawInitialTab === 'today' || rawInitialTab === 'staff'
  const initialTab = (rawInitialTab === 'losses' || rawInitialTab === 'expenses' || oldTabView || doneTabLink ? 'loss' : rawInitialTab) as OuterTab | null
  // A fresh login lands on a bare /item with no ?tab= at all -- that used to
  // default to Today, whose own pane is intentionally empty (same treatment
  // as UK/C&H), so the very first thing anyone saw was a near-blank screen.
  // Defaulting to Grony Cash's Items view instead means the full pane is
  // there immediately. Today's own feed is still one tap away, via
  // PresentStaffBar's Total chip or the Staff Members section's Home row.
  const features = useFeatures()   // Settings > Switches
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
  // ?view=teamTimes opens the Shop's Times tab instead (see the searchParams sync effect).
  const initialView = (initialExtraView ? 'items' : rawInitialView === 'teamTimes' ? null : rawInitialView) as LossView | null
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
      : (doneTabLink ? null : oldTabView) ?? initialView ?? (outerTab === 'ch' ? CH_ITEMS[0].key : 'sales')
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
  // Seeded from ?jumpReceiptId= -- Item 360's WIC/GMC columns (see
  // LossTab.tsx's onReceiptClick), same pattern as jumpToBillId above, but
  // going straight to one receipt instead of a date+item-name guess.
  // Client-side only flag: prevents Live Sale mode from being rendered on
  // the server, dramatically reducing initial SSR time. Live Sale only renders
  // after hydration, loading in 2-3s instead of waiting for 12+s of SSR.
  const [liveSaleMounted, setLiveSaleMounted] = useState(false)
  useEffect(() => {
    setLiveSaleMounted(true)
  }, [])
  const [jumpToReceiptId, setJumpToReceiptId] = useState<number | null>(
    searchParams.get('jumpReceiptId') ? Number(searchParams.get('jumpReceiptId')) : null
  )
  // Seeded from ?jumpCountId= -- Item 360's CNT column (see LossTab.tsx's
  // CntCell, tapped rather than long-pressed) opens this in a new tab via
  // /item?tab=loss&view=counts&jumpCountId=..., same pattern as
  // jumpToReceiptId above, landing straight on CountsTab's own list view.
  const [jumpToCountId, setJumpToCountId] = useState<number | null>(
    searchParams.get('jumpCountId') ? Number(searchParams.get('jumpCountId')) : null
  )
  const [showItemsLaws, setShowItemsLaws] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('showItemsLaws') === 'true'
  })
  const [liveExpanded, setLiveExpanded] = useState(false)
  const rawLiveProductType = searchParams.get('liveType')
  const initialLiveProductType = (rawLiveProductType === 'goods' || rawLiveProductType === 'services') ? rawLiveProductType : 'all'
  const [liveProductTypeFilter, setLiveProductTypeFilter] = useState<'all' | 'goods' | 'services'>(initialLiveProductType)
  const rawLiveGroup = searchParams.get('liveGroup')
  const [liveGroupFilter, setLiveGroupFilter] = useState<string | null>(rawLiveGroup ?? null)
  const rawLiveGmcType = searchParams.get('liveGmcType')
  const [liveGmcTypeFilter, setLiveGmcTypeFilter] = useState<string | null>(rawLiveGmcType ?? null)
  // Priority order the Sale-mode grid arranges items in -- shared across
  // every staff member via /api/item-sort-order (any staff can change it,
  // not just owner), so a reorder here changes what everyone else's app
  // shows too, next time they load it. Starts at the same default the grid
  // always used (count status first, then violations, then today's sales)
  // until the real value loads.
  const [liveItemSortOrder, setLiveItemSortOrder] = useState<ItemSortKey[]>(DEFAULT_ITEM_SORT_ORDER)
  const [liveSortOrderModalOpen, setLiveSortOrderModalOpen] = useState(false)
  const rawLiveMode = searchParams.get('mode')
  // 'sales' was Sales Rec / Summary, now retired: old links open the Sales Log instead.
  const initialLiveMode = ((rawLiveMode === 'sales' ? 'log' : rawLiveMode) as 'sale' | 'sales' | 'bills' | 'log' | 'expenses' | 'manage' | 'advert' | 'gronyChecks' | null) ?? 'sale'
  const [liveMode, setLiveMode] = useState<'sale' | 'sales' | 'bills' | 'log' | 'expenses' | 'manage' | 'advert' | 'gronyChecks'>(initialLiveMode)
  const [itemsPageMode, setItemsPageMode] = useState<'sale' | 'sales' | 'bills' | 'log' | 'expenses' | 'manage' | 'advert' | 'gronyChecks'>(initialLiveMode)
  // Manage tab -- folds the old "Manage"/"Team" left-pane sections into one
  // radio-list here (see MANAGE_LIST_ITEMS/STAFF_TEAM_ITEMS below), same
  // "own liveMode tab" treatment Vendors/Customers/Purchase Orders/P&L/CAB
  // already got. Holds whichever key (a ManageView or a STAFF_TEAM_ITEMS
  // key) is currently selected; GronyManageContent/StaffContent are the
  // exact same content components the old lossView-driven routes still use
  // (kept intact for pickLossView-based quick actions/search results and
  // the permission-bounce guard) -- this just drives them from local state
  // instead of lossView so switching stays inside the Manage tab. Advert and
  // Grony Checks ("Grony 1-10 checks") split off into their own tabs (see
  // liveMode === 'advert'/'gronyChecks' below), so both are excluded from
  // this list -- see MANAGE_LIST_ITEMS.filter below.
  const [liveManageSection, setLiveManageSection] = useState<LossView>(MANAGE_LIST_ITEMS[0].key)
  // The Manage options (Opener, Closer, ... and the Team ones), listed on the left sidebar under a "Manage" heading.
  // Logging pages that staff now answer from Waiting for team instead (tiles for them are in the checklist). Staff no
  // longer see these rows; the owner and manager keep them, and the checklist's History shows who logged what.
  const CHECKLIST_LOGGED_KEYS = new Set<string>(['unfortunate_events', 'staff_dress', 'team_behaviour'])
  function manageSideOptions() {
    const hideForStaff = (key: string) => !isOwnerLevel(session?.user as any) && CHECKLIST_LOGGED_KEYS.has(key)
    return [
      ...(canSeeManage ? applyPaneOrder(MANAGE_LIST_ITEMS, paneOrder.manage).filter(item => !paneHidden[item.key] && !hideForStaff(item.key) && item.key !== 'advert' && item.key !== 'grony_checks').map(item => ({
        key: item.key as LossView,
        label: item.label,
        badge: item.key === 'opener' ? openerBadgeCount
          : item.key === 'closer' ? (globalFlags?.missingClosingReports?.length ?? 0)
          : 0,
      })) : []),
      // Team Times is the Shop's Times tab, not a Manage section.
      ...(canSeeTeam ? STAFF_TEAM_ITEMS.filter(t => t.key !== 'teamTimes' && !paneHidden[t.key] && !hideForStaff(t.key)).map(t => ({
        key: t.key as LossView,
        label: t.label,
        badge: t.key === 'staff_dress' ? dressFlagsCount : 0,
      })) : []),
    ]
  }
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
  const initialLiveSaleView: { kind: 'grid' } | { kind: 'loss_by_date' } | { kind: 'loss_by_items' } | { kind: 'net_loss' } | { kind: 'least_sales_services' } | { kind: 'least_sales_goods' } | { kind: 'least_sales_groups' } | { kind: 'count_due_chart' } | { kind: 'negative_soh_chart' } | { kind: 'least_purchased' } | null =
    rawLiveSaleView === 'loss_by_date' ? { kind: 'loss_by_date' } :
    rawLiveSaleView === 'loss_by_items' ? { kind: 'loss_by_items' } :
    rawLiveSaleView === 'net_loss' ? { kind: 'net_loss' } :
    rawLiveSaleView === 'least_sales_services' ? { kind: 'least_sales_services' } :
    rawLiveSaleView === 'least_sales_goods' ? { kind: 'least_sales_goods' } :
    rawLiveSaleView === 'least_sales_groups' ? { kind: 'least_sales_groups' } :
    rawLiveSaleView === 'count_due_chart' ? { kind: 'count_due_chart' } :
    rawLiveSaleView === 'negative_soh_chart' ? { kind: 'negative_soh_chart' } :
    rawLiveSaleView === 'least_purchased' ? { kind: 'least_purchased' } :
    null
  const [liveSaleView, setLiveSaleView] = useState<{ kind: 'grid' } | { kind: 'loss_by_date' } | { kind: 'loss_by_items' } | { kind: 'net_loss' } | { kind: 'least_sales_services' } | { kind: 'least_sales_goods' } | { kind: 'least_sales_groups' } | { kind: 'count_due_chart' } | { kind: 'negative_soh_chart' } | { kind: 'least_purchased' } | null>(initialLiveSaleView)
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
  // Which of P&L's own sub-views is showing (see lossView === 'pl' further
  // down) -- Loss by Date/Loss by Items/Net Loss moved here from the Count
  // tab since they're a financial-loss concern, not a counting one, reusing
  // the same renderLossesByDateTable/renderLossesByItemsTable this
  // component already has rather than building new ones.
  const [plSubView, setPlSubView] = useState<'pl' | 'loss_by_date' | 'loss_by_items' | 'net_loss' | 'cost_gte_sp' | 'sold_below_cost'>('pl')
  // Sidebar's expandable Losses / Analytics rows.
  const [lossesOpen, setLossesOpen] = useState(false)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  // 'pl'/'cab' are dead values now -- P&L/CAB moved to their own top-level
  // tabs (see pickLossView/canSeePL in renderTabSwitcher), so nothing sets
  // this to either any more. Left in the type rather than torn out, since
  // the one remaining read of them (the ProfitLossTab/CABTab ternary,
  // search "now unreachable") is otherwise unreachable dead code too and
  // safer left alone than unwound in a file this size. 'counts'/
  // 'lossbydate'/'lossbyitems' are the three "replace the tap-to-sell grid
  // entirely" values that DO still fire, now via the Count tab's own small
  // sub-nav instead of a radio in this row -- see inCountTab below and
  // pickCountMode.
  const [liveSaleViolationFilter, setLiveSaleViolationFilter] = useState<'countDue' | 'counts' | 'netLoss' | 'netGain' | 'duplicates' | 'unlinked' | 'service' | 'soldBelowCost' | 'vcpJump' | 'emptyRow' | 'negSoh' | 'acpGteSp' | 'noSp' | 'noCp' | 'noGroup' | 'needsReview' | 'lowConfidenceAlias' | 'prezohoNotes' | 'unknownQty' | 'gmcOverage' | 'noViolations' | 'lossbydate' | 'lossbyitems' | 'leastSalesServices' | 'leastSalesGoods' | 'leastSalesGroups' | 'leastPurchased' | 'pl' | 'cab'>('noViolations')
  const [liveCountsRecordStatusFilter, setLiveCountsRecordStatusFilter] = useState<'all' | 'loss' | 'gain' | 'ok'>('all')
  const [liveCountDeleteLoading, setLiveCountDeleteLoading] = useState<number | null>(null)
  const [liveEditingItemIntervalId, setLiveEditingItemIntervalId] = useState<number | null>(null)
  const [liveEditingItemIntervalDays, setLiveEditingItemIntervalDays] = useState<string>('')
  const [liveEditingItemIntervalSaving, setLiveEditingItemIntervalSaving] = useState(false)
  const initialSidePaneHidden = false // the left sidebar is never hidden any more (the signed-in person's button lives at its top)
  const sidePaneHidden = initialSidePaneHidden
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
    setLiveSaleJumpTab(tab === 'sales' ? 'log' : tab) // Summary retired: its flags / links land on the Sales Log
    setLiveSaleJumpViolation(violation)
    setLiveSaleJumpSearch(search)
    setLiveSaleJumpSeq(s => s + 1)
  }
  // Customers is one page (no tabs): receipts are found in each customer's details and on the Sales Log,
  // and new customers are registered from Live Sale's GM box.
  function jumpToCustomersTab() {
    pickLossView('customers')
  }
  // Finishes the old ?tab=losses/?tab=expenses deep links (see the lossView
  // initializer above) -- can't call jumpToLiveSaleTab directly from that
  // initializer since it isn't defined yet that early in the component.
  useEffect(() => {
    if (rawInitialTab === 'losses') jumpToLiveSaleTab('sale')
    else if (rawInitialTab === 'expenses') jumpToLiveSaleTab('expenses')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
  const [activeStaff, setActiveStaff] = useState<{ username: string; active: boolean; photo_url?: string | null }[]>([])
  const fetchStaff = () => {
    fetch('/api/staff/status').then(r => r.ok ? r.json() : [])
      .then(d => {
        if (!Array.isArray(d)) return
        const bizStaff = d.filter((s: any) => s.active && STAFF_ROSTER.some(name => name.toLowerCase() === s.username.toLowerCase()))
        setActiveStaff(bizStaff)
      })
      .catch(() => {})
  }
  // Defer staff loading - only used for sidebar staff pages, not critical for main grid
  useEffect(() => {
    const t = setTimeout(() => fetchStaff(), 1200)
    return () => clearTimeout(t)
  }, [])
  // Was under Neon's 5-minute auto-suspend window; bumped to match the
  // 10-minute "background data" tier used elsewhere so a quiet moment can
  // actually let the database sleep.
  usePolling(fetchStaff, 600000)

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
  const [itemsInlineExtra, setItemsInlineExtra] = useState<ItemsInlineExtra | null>(null)

  function loadItems() {
    fetch('/api/items/all').then(r => r.json()).then(d => {
      // Transform /api/items/all response to Item type format
      const transformed = Array.isArray(d) ? d.map((item: any) => ({
        id: item.id,
        item_name: item.name,
        cf_group: item.group,
        selling_rate: String(item.selling_price || 0),
        purchase_rate: String(item.cost_price || 0),
        units_per_pack: item.units_per_pack ? String(item.units_per_pack) : null,
        unit_name: null,
        product_type: item.product_type || 'goods',
        calculated_soh: Number(item.soh ?? 0),
      })) : []
      setItems(transformed)
      setItemsLoading(false)
    })
  }

  function loadCountIntervals() {
    fetch('/api/items/count-intervals').then(r => r.json()).then(d => {
      if (d && typeof d === 'object') {
        setItems(prev => prev.map(item => ({
          ...item,
          count_interval: d[item.id] ?? null
        })))
      }
    }).catch(() => {})
  }

  useEffect(() => { loadItems() }, [])
  useEffect(() => {
    const t = setTimeout(() => loadCountIntervals(), 1500)
    return () => clearTimeout(t)
  }, [])
  usePolling(loadItems, 600000)

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
  // Defer loss groups loading - only used for Loss tab filtering, not critical for initial grid
  useEffect(() => {
    const t = setTimeout(() => loadLossGroups(), 1200)
    return () => clearTimeout(t)
  }, [])
  usePolling(loadLossGroups, 600000)

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
    fetch('/api/aliases/leaks').then(r => r.ok ? r.json() : []).then(d => {
      setNameConflictsCount(Array.isArray(d) ? d.length : 0)
    }).catch(() => {})
  }

  // Defer badge loading until after page is interactive. These are counts
  // in the left sidebar, not needed for the main Live Sale grid to render.
  useEffect(() => {
    const t = setTimeout(() => loadBadgeData(), 1000)
    return () => clearTimeout(t)
  }, [])
  usePolling(loadBadgeData, 600000)

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
      sold_below_cost: f?.costGteSell?.length ?? 0,
      no_vendor: f?.noVendorBills?.length ?? 0,
      no_items_bills: f?.noItemsBills?.length ?? 0,
      bill_total_mismatch: f?.billTotalMismatch?.length ?? 0,
      bill_no_attachment: f?.billNoAttachment?.length ?? 0,
      bill_no_expense: f?.billNoExpense?.length ?? 0,
      vcp_jump: f?.vcpJumps?.length ?? 0,
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
  // No photo ('no_attachment') isn't counted: photos stopped being required once sales were tapped in.
  const salesFlagsCount = violationCountByType(['no_cash', 'missing_days', 'dup_receipts', 'high_wnw'])
  const itemsFlagsCount = violationCountByType([
    'no_group', 'duplicates', 'not_in_inventory', 'no_sp', 'no_cp', 'unlinked_named', 'service_violation',
    'alias_prezoho_sales', 'alias_prezoho_bills', 'alias_prezoho_receipts', 'alias_flagged', 'alias_ambiguous',
  ]) + nameConflictsCount
  const billsFlagsCount = violationCountByType(['no_vendor', 'no_items_bills', 'bill_total_mismatch', 'bill_no_attachment', 'bill_no_expense'])
  const cabFlagsCount = violationCountByType(['unchecked_cab'])
  const staffTimesFlagsCount = violationCountByType(['no_staff_times'])
  const dressFlagsCount = violationCountByType(['shirt_not_worn', 'shirt_overdue'])
  const countsFlagsCount = violationCountByType(['daily', '7day', '15day'])
  const lossByDateFlagsCount = violationCountByType(['gains', 'cost_gte_sell'])
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
  // Gates a Sale tap behind a clock-in reminder (see recordTap/
  // ClockInGateModal below) -- null means "not loaded yet", so recordTap
  // never blocks on a slow/failed fetch, only on a confirmed "no".
  const [myClockedInToday, setMyClockedInToday] = useState<boolean | null>(null)
  useEffect(() => {
    fetch('/api/staff-times/today')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        setOpenerToday({ opener: d.opener ?? null, openerConfirmed: d.openerConfirmed ?? null })
        setMyClockedInToday(!!d.mine?.actual_in)
      })
      .catch(() => {})
  }, [])
  const [clockGateOpen, setClockGateOpen] = useState(false)
  // Once true (clocked in, or explicitly skipped), the reminder doesn't
  // nag again for the rest of this session -- it's a one-time check, not a
  // per-tap interruption.
  const [clockGateDismissed, setClockGateDismissed] = useState(false)
  const pendingTapItemRef = useRef<LiveItem | undefined>(undefined)
  // Carried alongside pendingTapItemRef so a tap made straight from the
  // card's own Qty/Price boxes (see liveInlineQtyByItemId below) survives
  // the clock-in gate too -- recordTap's overrideQty/overridePrice params
  // aren't in React state, so without this the gate's resume call would
  // have nothing to fall back to and silently do nothing.
  const pendingTapQtyRef = useRef<string | undefined>(undefined)
  const pendingTapPriceRef = useRef<string | undefined>(undefined)
  // A second, independent gate from the clock-in one above -- re-checked on
  // EVERY tap attempt (not a one-time-per-session dismiss), since the whole
  // point is to keep surfacing this until a new pack is tapped in or a
  // count settles it (see GmcOverageGateModal). Reuses the same pending-tap
  // refs above (they're just a "what to resume" slot, not gate-specific).
  // After a sale takes an item's stock below zero the sale stays recorded, and the staff member is told to count the shelf now.
  const [negPrompt, setNegPrompt] = useState<{ name: string; soh: number } | null>(null)
  const [gmcOverageGate, setGmcOverageGate] = useState<{ itemName: string; targetName: string; given: number; used: number; exhaustedOnDate: string } | null>(null)
  // Staff-triggered follow-up shown right after a GMC tap succeeds -- lets
  // staff mark that specific draw from stock as a business property (a
  // stapler grabbed off the shelf for internal use, say) without it ever
  // becoming an expense: the properties table links straight to this tap
  // (source_live_sale_tap_id), so nothing needs a fabricated expense row
  // just to carry the property/availability/location fields. Only offered
  // for goods (a service tap has nothing physical to track as a property).
  const [gmcPropertyPrompt, setGmcPropertyPrompt] = useState<{ tapId: number; itemId: number; itemName: string; amount: number } | null>(null)
  const [gmcPropertySaving, setGmcPropertySaving] = useState(false)
  // Per-card quantity/price typed directly into the grid (the "tap straight
  // into a card" flow) -- keyed by item id since many cards can be mid-entry
  // at once. Price is seeded from the item's own selling_price only once the
  // user actually edits it; until then the input just displays that default.
  const [liveInlineQtyByItemId, setLiveInlineQtyByItemId] = useState<Record<number, string>>({})
  const [liveInlinePriceByItemId, setLiveInlinePriceByItemId] = useState<Record<number, string>>({})
  const [liveInlineCIDByItemId, setLiveInlineCIDByItemId] = useState<Record<number, string>>({})
  // A typed description ("Girl in yellow shirt") that only names who did the work: no customer, no message, no receipt.
  // Keyed by item card id, or 'main' for the main Live Sale form.
  const [liveLabelByKey, setLiveLabelByKey] = useState<Record<string, string>>({})
  const [justTappedItemIds, setJustTappedItemIds] = useState<Set<number>>(new Set())
  // Same idea, own map -- the Count Due chart's per-row qty box (see
  // renderCountDueChart/recordInlineCount below). Kept separate from
  // liveInlineQtyByItemId (a sale qty) rather than shared, since the same
  // item could in principle be mid-entry in both places and a shared map
  // would let one silently clobber the other.
  const [liveInlineCountQtyByItemId, setLiveInlineCountQtyByItemId] = useState<Record<number, string>>({})
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
  usePolling(loadTaskCounts, 600000)
  const taskCountFor = (scopeKey: string) => taskCounts[scopeKey] ?? 0
  // A few pane rows' PageToolIcons scopeKey differs from their own pane
  // label (because the content page hardcodes its own scopeKey independent
  // of CASH_LABEL) -- see each page's own <PageToolIcons scopeKey=.../> call
  // for the authoritative string. Empty now that Purchase Orders (the one
  // row that needed this) dropped out of CASH_ITEMS -- kept as a mechanism
  // in case a future row needs it again.
  const CASH_TASK_SCOPE_OVERRIDES: Partial<Record<LossView, string>> = {}
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
  }

  // The one navigation primitive every Cash/Manage/Staff row (and every
  // deep link into one) goes through -- unlike changeTab('loss') above,
  // this jumps straight to a specific row regardless of which outer tab is
  // currently showing, so callers don't need their own changeTab-then-
  // override two-step any more.
  // Pages that are not part of the hub (Company Laws, Waiting for team, How To...) and a person's own page open INSIDE the right pane, so the left
  // sidebar and the top staff bar never leave the screen. (See components/FrameFlag.tsx for the page side.)
  const [voiceSaleSignal, setVoiceSaleSignal] = useState(0)
  const [myDayBadge, setMyDayBadge] = useState(0)
  const [pendingJobsBadge, setPendingJobsBadge] = useState(0)
  useEffect(() => {
    let live = true
    const load = () => fetch('/api/pending-jobs?count=1', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (live && d) setPendingJobsBadge(Number(d.open ?? 0)) }).catch(() => {})
    void load(); const t = setInterval(load, 10 * 60 * 1000)
    return () => { live = false; clearInterval(t) }
  }, [])
  const [waitingBy, setWaitingBy] = useState<Record<string, { total: number; now: number }>>({})
  useEffect(() => {
    let live = true
    const load = () => fetch('/api/my-day?counts=1', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (live && d?.counts) setWaitingBy(d.counts) }).catch(() => {})
    void load(); const t = setInterval(load, 5 * 60 * 1000)
    return () => { live = false; clearInterval(t) }
  }, [])
  useEffect(() => {
    let live = true
    const load = () => fetch('/api/my-day?count=1', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (live && d) setMyDayBadge(Number(d.total ?? 0)) }).catch(() => {})
    void load(); const t = setInterval(load, 5 * 60 * 1000)
    return () => { live = false; clearInterval(t) }
  }, [])
  const [voiceSaleText, setVoiceSaleText] = useState('')
  const [scanItem, setScanItem] = useState<{ id: number; name: string; selling_price: number; soh: number } | null>(null)
  const [scanSignal, setScanSignal] = useState(0)
  const embedRef = useRef<HTMLIFrameElement>(null)
  const [embedUrl, setEmbedUrl] = useState<string | null>(null)
  const [personal, setPersonal] = useState<{ name: string; tab: string } | null>(null)
  const [barH, setBarH] = useState(0)
  const barRef = useRef<HTMLDivElement>(null)
  const [shop, setShop] = useState<{ tab: ShopTab; src?: string } | null>(null)
  const shopRoute = (path: string): { tab: ShopTab; src: string } | null => {
    // Waiting for team is the Shop's first tab (/todo); old links keep their ?tile= and ?closing=
    if (path === '/todo' || path.startsWith('/todo?')) return { tab: 'todo', src: path }
    if (path === '/standards' || path.startsWith('/standards?')) { const q = path.split('?')[1]; return { tab: 'todo', src: '/todo' + (q ? '?' + q : '') } }
    if (path.startsWith('/laws')) { const q = new URLSearchParams(path.split('?')[1] ?? ''); if (q.get('view') === 'today') { q.delete('view'); return { tab: 'todo', src: '/todo' + (q.toString() ? '?' + q.toString() : '') } } return { tab: 'laws', src: path } }
    if (path === '/penalties') return { tab: 'penalties', src: path }
    if (path === '/staff-times') return { tab: 'times', src: path }
    return path === '/owner-guide' ? { tab: 'guide', src: path } : path === '/handbook-announcements' ? { tab: 'tasks', src: path } : path === '/integrity' ? { tab: 'checks', src: path } : null
  }
  // Old standalone pages that are now a tab of the signed-in person's own page (they redirect to /item?me=<tab>).
  const MINE_PATHS: Record<string, string> = { '/my-day': 'waiting', '/profile': 'profile', '/payslips': 'payslips', '/personal': 'payslips', '/staff': 'times' }
  const usernameRef = useRef('')
  const wantMine = useRef<string | null>(null)
  // Opens my own page on a tab; before the signed-in name is known it waits (see the [username] effect below).
  const openMine = (tab: string) => { setEmbedUrl(null); setShop(null); if (usernameRef.current) setPersonal({ name: usernameRef.current, tab }); else wantMine.current = tab }
  const openEmbed = (path: string) => { setPersonal(null); const mine = MINE_PATHS[path.split('?')[0]]; if (mine) { openMine(mine); return } const r = shopRoute(path); if (r) { setEmbedUrl(null); setShop(r) } else { setShop(null); setEmbedUrl(path) } }
  const openShop = (tab: ShopTab = 'todo') => { setEmbedUrl(null); setPersonal(null); setShop({ tab }) }
  const openPersonal = (name: string, tab = 'waiting') => { setEmbedUrl(null); setShop(null); setPersonal({ name, tab }) }
  useEffect(() => { setEmbedUrl(null); setPersonal(null); setShop(null) }, [lossView, outerTab])
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search)
    const open = qs.get('open'), me = qs.get('me')
    if (doneTabLink) setShop({ tab: 'home' })
    // ?me=<tab> opens my own page on that tab (e.g. /item?me=payslips), once the signed-in name is known.
    if (me) wantMine.current = me
    else if (open && MINE_PATHS[open]) wantMine.current = MINE_PATHS[open]
    else if (open && open.startsWith('/') && !open.startsWith('//')) { const r = shopRoute(open); if (r) setShop(r); else setEmbedUrl(open) }
    const msg = (e: MessageEvent) => { if (e.origin !== window.location.origin) return; if (e.data?.type === 'close-embed') { setEmbedUrl(null); setShop(null) }; if (e.data?.type === 'open-path' && typeof e.data.path === 'string' && e.data.path.startsWith('/') && !e.data.path.startsWith('//')) openEmbed(e.data.path); if (e.data?.type === 'open-personal') { setEmbedUrl(null); setShop(null); setPersonal({ name: typeof e.data.name === 'string' && e.data.name ? e.data.name : usernameRef.current, tab: String(e.data.tab ?? 'times') }) } }
    const own = (e: Event) => { const d = (e as CustomEvent).detail as { name: string; tab?: string; handled: boolean }; d.handled = true; setEmbedUrl(null); setShop(null); setPersonal({ name: d.name, tab: d.tab ?? 'times' }) }
    const hubOpen = (e: Event) => { const d = (e as CustomEvent).detail as { path: string; handled: boolean }; d.handled = true; openEmbed(d.path) }
    window.addEventListener('message', msg); window.addEventListener('open-staff-member', own); window.addEventListener('hub-open', hubOpen)
    return () => { window.removeEventListener('message', msg); window.removeEventListener('open-staff-member', own); window.removeEventListener('hub-open', hubOpen) }
  }, [])

  function pickLossView(view: LossView) {
    // The team's times live in one place: the Shop's Times tab.
    if (view === 'teamTimes') { openShop('times'); return }
    setOuterTab('loss')
    setLossView(view)
    setViolation(null)
    setAddForm(null)
    setShowAnalytics(false)
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
  // Where "open ..." can take you by voice (see lib/voiceCommands.ts). The same actions as the sidebar buttons.
  const voiceDests: Dest[] = [
    { label: 'Shop', names: ['shop', 'the shop', 'total'], run: () => openShop('home') },
    { label: 'Company Laws', names: ['company laws', 'laws'], run: () => openEmbed('/laws') },
    { label: 'Waiting for team', names: ['waiting for team', 'team', 'daily checklist', 'checklist'], run: () => openShop('todo') },
    { label: 'How To', names: ['how to', 'help'], run: () => openEmbed('/how-to') },
    { label: 'Owner Guide', names: ['owner guide'], run: () => openEmbed('/owner-guide') },
    { label: 'Announcements', names: ['announcements'], run: () => openEmbed('/handbook-announcements') },
    { label: 'Penalty Points', names: ['penalties', 'penalty points'], run: () => (isOwnerOrJoe ? openShop('penalties') : openPersonal(username, 'violations')) },
    { label: 'Waiting for me', names: ['my day', 'waiting for me', 'my tasks', 'to do', 'what is waiting'], run: () => openPersonal(username, 'waiting') },
    { label: 'CCTV review', names: ['cctv review', 'cctv'], run: () => openEmbed('/cctv-review') },
    { label: 'System check', names: ['system check', 'integrity', 'health check'], run: () => openEmbed('/integrity') },
    { label: 'Barcode labels', names: ['barcode labels', 'labels', 'barcodes'], run: () => openEmbed('/barcode-labels') },
    { label: 'Live', names: ['live', 'live sale', 'items'], run: () => jumpToLiveSaleTab('sale') },
    { label: 'Sales Log', names: ['sales log', 'sales'], run: () => goItemsMode('log') },
    { label: 'Customers', names: ['customers'], run: () => jumpToCustomersTab() },
    { label: 'Counts', names: ['counts', 'counting'], run: () => goCountMode() },
    { label: 'Times', names: ['times', 'staff times'], run: () => openShop('times') },
    { label: 'Flags', names: ['flags'], run: () => pickLossView('flags') },
    { label: 'Item 360', names: ['item 360', 'item three sixty'], run: () => pickLossView('item360') },
    { label: 'Bills', names: ['bills'], run: () => goItemsMode('bills') },
    { label: 'Expenses', names: ['expenses'], run: () => goItemsMode('expenses') },
    { label: 'Purchase Orders', names: ['purchase orders', 'orders'], run: () => pickLossView('purchaseOrders') },
    { label: 'Vendors', names: ['vendors', 'suppliers'], run: () => pickLossView('vendors') },
    { label: 'Done', names: ['done', 'home', 'today'], run: () => openShop('home') },
    { label: 'my page', names: ['my profile', 'profile', 'my times'], run: () => openPersonal(username, 'times') },
    { label: 'my payslips', names: ['payslips', 'my payslips', 'payslip'], run: () => openPersonal(username, 'payslips') },
  ]
  // Opens my own page (the one behind my photo) on a tab; falls back to the old full-page view when the staff bar is not on screen.
  function openMyPage(tab: string, _fallback: LossView) { void _fallback; openPersonal(username, tab) }
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
  // equivalent. Staff Time opens the Shop's Times tab.
  function handleShortcut(key: ShortcutKey) {
    switch (key) {
      case 'sale':       jumpToLiveSaleTab('sale'); break
      case 'bill':       jumpToLiveSaleTab('bills'); break
      case 'item':       pickLossView('items');     setAddForm('item'); break
      case 'expense':    jumpToLiveSaleTab('expenses'); break
      case 'cabConfirm': pickLossView('cab');       setCabConfirmSignal(n => n + 1); break
      case 'vendor':     pickLossView('vendors');   setVendorSignal(n => n + 1); break
      case 'staffTime': openShop('times'); break
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
    params.delete('me')   // ?me= is a one-time "open my page" link
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
    // A side-pane button was right-clicked > "Open in new tab": open what this click led to in a
    // new tab, then put this tab back where it was.
    const nt = window.__gmNewTab
    if (nt) {
      window.__gmNewTab = null
      window.open(target, '_blank')
      router.replace(nt.prev, { scroll: false })
      return
    }
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
    const urlDone = urlTab === 'today' || urlTab === 'staff'
    const nextTab: OuterTab = !urlDone && urlTab && VALID_TABS.includes(urlTab as OuterTab) ? (urlTab as OuterTab) : 'loss'
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (nextTab !== outerTab) setOuterTab(nextTab)
    if (nextTab === 'loss') {
      const rawUrlView0 = searchParams.get('view')
      // Team Times is the Shop's Times tab now.
      const urlTeamTimes = rawUrlView0 === 'teamTimes'
      const rawUrlView = urlTeamTimes ? null : rawUrlView0
      if (urlTeamTimes) openShop('times')
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
  // True while Count Due or Negative SOH owns the screen, replacing the
  // tap-to-sell grid entirely (see the count_due_chart/negative_soh_chart
  // branches further down). Each is its own full page now -- no shared
  // sub-nav between them (see renderCriticalBar) and no "Records" landing
  // page either; the full history/edit list lives on its own sidebar page
  // instead (lossView 'counts', CountsTab.tsx). Negative SOH is the same
  // enter-a-count list Count Due uses (renderNegativeSohChart), just
  // without the "Same as X, no loss" shortcut -- there's no valid
  // "expected" number to match when the system's own figure is negative.
  // Loss by Date/Items/Net Loss used to live here too, but moved to P&L
  // instead (see plSubView) -- they're a financial-loss concern, not a
  // counting one. Count is just a different way in rather than a new
  // lossView (which would mean pulling all this rendering out of Sale
  // mode's own scope, a much bigger change than this file's size makes
  // worth it for what's otherwise a UI relabeling).
  const inCountTab = liveMode === 'sale' && (liveSaleView?.kind === 'count_due_chart' || liveSaleView?.kind === 'negative_soh_chart')
  const [cashDisplayMode, changeCashDisplayMode] = useSidePaneDisplayMode()
  // Left-pane section headers that don't open a page of their own (Loss,
  // Properties, Manage, Team, Personal, a UK/C&H person's "Submenus", ...)
  // toggle their own sub-rows open/shut when tapped instead of just sitting
  // there as decoration -- self-titled headers (Sales/Expenses/Customers/
  // Services, whose own row IS the header and already navigates somewhere)
  // are left alone, since they already do something useful on tap.
  const { data: session } = useSession()
  // Desktop-only: portals the staff bar + tab switcher (below) into Nav's
  // own top strip instead of their usual spot under it -- see
  // lib/navSlot.ts/lib/useIsDesktop.ts. navSlotEl is non-null on every
  // protected page once Nav mounts (its slot div exists in the DOM
  // regardless of viewport, just visually hidden on mobile via Nav's own
  // `hidden md:block`), so isDesktop is what actually decides which layout
  // renders -- not just whether the slot happens to exist.
  const navSlotEl = useNavSlotEl()
  const isDesktop = useIsDesktop()
  // The staff bar loads after the page (its people arrive later), so its height is watched, not read once: the right-pane page always starts BELOW it.
  useEffect(() => {
    const el = barRef.current
    setBarH(el?.offsetHeight ?? 0)
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setBarH(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [embedUrl, personal, isDesktop, outerTab, sidePaneHidden])
  // Nav's real rendered height (see lib/navHeight.ts) -- used below to size
  // this page's own content area to "the rest of the viewport", instead of
  // a hardcoded assumption that goes stale the moment Nav grows a second
  // stacked row (e.g. the Critical bar) on desktop.
  const navHeightPx = useNavHeightPx()
  const role = (session?.user as any)?.role ?? 'staff'
  const username = (session?.user as any)?.username ?? session?.user?.name ?? ''
  usernameRef.current = username
  // "Open my page" requested before the session had loaded (a link to /item?open=/my-day): open it as soon as the name is known, never with an empty name
  useEffect(() => { if (wantMine.current && username) { const tab = wantMine.current; wantMine.current = null; setEmbedUrl(null); setShop(null); setPersonal({ name: username, tab }) } }, [username])
  const isOwnerOrJoe = role === 'owner' || username.toLowerCase() === 'joe'
  // The Shop's Penalty Points tab is the owner's and Joe's list; anyone else sees their own points on their page.
  useEffect(() => { if (shop?.tab === 'penalties' && session?.user && username && !isOwnerOrJoe) openPersonal(username, 'violations') }, [shop, session, username, isOwnerOrJoe]) // eslint-disable-line react-hooks/exhaustive-deps
  // Flags are for managers only: the owners and Bino. Everyone else never sees a flag (except Negative Stock on Live Sale).
  const showFlags = isOwnerOrJoe || isManagerName(username)
  const fl = (n: number) => showFlags ? n : undefined
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
  // Defer permissions loading - not critical for initial render
  useEffect(() => {
    const t = setTimeout(() => {
      fetch('/api/user-permissions').then(r => r.ok ? r.json() : {}).then(d => { setRolePermissions(d); setPermsLoaded(true) }).catch(() => setPermsLoaded(true))
    }, 600)
    return () => clearTimeout(t)
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
  // Defer pane config loading - cosmetic sidebar settings not needed for initial render
  useEffect(() => {
    const t = setTimeout(() => fetchPaneOrder(), 800)
    return () => clearTimeout(t)
  }, [])
  usePolling(fetchPaneOrder, 600000)
  // Same shared-with-everyone pattern as paneOrder above, but for display
  // labels instead of row order -- see ReorderListsPanel.tsx and
  // /api/pane-labels. Purely cosmetic: a row's `key` (used for routing,
  // PageToolIcons scopeKey, and every task/notes/laws/flag lookup) never
  // changes, so this can't orphan any of that data.
  const [paneLabels, setPaneLabels] = useState<Record<string, string>>({})
  const fetchPaneLabels = () => fetch('/api/pane-labels').then(r => r.ok ? r.json() : {}).then(setPaneLabels).catch(() => {})
  // Defer pane config loading - cosmetic sidebar settings not needed for initial render
  useEffect(() => {
    const t = setTimeout(() => fetchPaneLabels(), 800)
    return () => clearTimeout(t)
  }, [])
  usePolling(fetchPaneLabels, 600000)
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
  // Defer pane config loading - cosmetic sidebar settings not needed for initial render
  useEffect(() => {
    const t = setTimeout(() => fetchPaneGroups(), 800)
    return () => clearTimeout(t)
  }, [])
  usePolling(fetchPaneGroups, 600000)
  // Same shared-with-everyone pattern again, but for which rows are hidden
  // from the sidebar entirely -- see /api/pane-hidden and
  // ReorderListsPanel.tsx. Purely a visibility override, same guarantee as
  // paneLabels/paneGroups above: a hidden row's key, routing, and every
  // task/notes/laws/flag lookup keyed off it are untouched, so un-hiding it
  // later brings it straight back with everything intact.
  const [paneHidden, setPaneHidden] = useState<Record<string, boolean>>({})
  const fetchPaneHidden = () => fetch('/api/pane-hidden').then(r => r.ok ? r.json() : {}).then(setPaneHidden).catch(() => {})
  // Defer pane config loading - cosmetic sidebar settings not needed for initial render
  useEffect(() => {
    const t = setTimeout(() => fetchPaneHidden(), 800)
    return () => clearTimeout(t)
  }, [])
  usePolling(fetchPaneHidden, 600000)
  // New Sale/Live Sale/Log used to be hardcoded sub-buttons nested under
  // the Sales row, then their own standalone rows. Now Sales, Bills, and
  // Loss by Date have all folded into Live Sale's own mode switcher
  // (Sale/Sales/Bills/Loss by Date/Log) the same way Count 2 and Log did
  // before them, so the 'sales' CASH_ITEMS row (now labeled "Live Sale") is
  // a plain row again like any other -- no more addForm-based sub-item
  // special-casing needed.
  function cashItemActive(key: string) {
    if (key === 'counts') return lossView === 'counts' || inCountTab
    return lossView === key
  }
  function cashItemClick(key: string) {
    if (key === 'pl') { pickPL(); return }
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
      pickLossView(canSeeManage ? MANAGE_LIST_ITEMS[0].key : 'home')
    } else if (!canSeeManage && MANAGE_VIEW_KEYS.has(lossView)) {
      pickLossView(canSeeCash ? 'items' : 'home')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permsLoaded, canSeeCash, canSeeManage, lossView, outerTab])
  // Staff (anyone who is not the owner or Joe) only ever see Items / Live Sale / Sales Log, Counts, Item 360, Losses,
  // Analytics, their own Payslips and Profile. A typed link or an old shortcut to anything else lands on Items.
  useEffect(() => {
    if (isOwnerOrJoe || outerTab !== 'loss') return
    const lossesOnly = lossView === 'pl' && plSubView !== 'pl'
    const ok = lossView === 'items' || lossView === 'sales' || lossView === 'counts' || lossView === 'item360' || lossesOnly
      || lossView === 'staffPayslips' || lossView === 'staffProfile' || lossView === 'home' || lossView === 'customers' || lossView === 'teamTimes' || (lossView === 'flags' && showFlags)
    const stuckOnMode = (lossView === 'items' || lossView === 'sales') && ['bills', 'expenses', 'manage', 'advert', 'gronyChecks'].includes(itemsPageMode)
    if (!ok || stuckOnMode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (lossView !== 'items') pickLossView('items')
      if (stuckOnMode) pickItemsMode('sale')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwnerOrJoe, lossView, plSubView, itemsPageMode, outerTab])
  // The caretaker (role children_manager) works only in C&H: always bring her
  // back to it, including after a typed ?tab= link, and hide the other areas.
  const isCaretakerOnly = role === 'children_manager'
  useEffect(() => {
    if (isCaretakerOnly && outerTab !== 'ch') changeTab('ch')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCaretakerOnly, outerTab])
  const canSeePL = perm('pl')
  const canSeeTeam = perm('team')
  const canSeeUsers = perm('users')
  const canViewPortalAs = perm('view_portal_as')
  const canSeeUK = isGrony || perm('uk')
  const canSeeCaretake = perm('caretaker')
  const canSeeCH = isOwnerOrJoe || perm('ch')
  // The C&H tab shows for full C&H access OR just the caretaker permission
  // (then only the Care rows, see the pane below).
  const canSeeCHTab = canSeeCH || canSeeCaretake || perm('care_log')
  // Settings is worth opening if there's anything at all inside it --
  // Roles & Permissions itself stays canManage-only regardless (root config
  // shouldn't be grantable through the system it configures). Team no
  // longer counts here -- it moved out into its own main-pane section (see
  // below), so canSeeTeam alone no longer needs a reason to open Settings.
  const canOpenSettings = canManage || canSeeUsers || canViewPortalAs
  // UK's own Settings (add a menu/add a column) is a content-area toggle,
  // separate from Biz/C&H's Settings rows below (which are always inline,
  // no toggle needed) -- gated to isGrony, not canOpenSettings.
  const canOpenUkSettings = outerTab === 'uk' && isGrony
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
    ...(myStaffName ? ['Payslips', 'Penalty Points'] : []),
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
    { label: 'Done', action: () => openShop('home') },
    ...(canSeeCash ? [
      // Items is listed as "Live" by hand below (one entry for the sale screen).
      ...CASH_ITEMS.filter(v => v.key !== 'items').map(v => ({ label: v.label, action: () => pickLossView(v.key) })),
      { label: 'Daily', action: () => pickLossView('dailySummary') },
      { label: 'Alias Wide Table', action: () => { pickLossView('items'); setItemsExtraView('aliasWide') } },
      { label: 'Service Matches', action: () => { pickLossView('items'); setItemsExtraView('serviceMatches') } },
      { label: 'GMC Packs', action: () => { pickLossView('items'); setItemsExtraView('gmcPacks') } },
      // Live Sale's own tabs aren't their own CASH_ITEMS entries, so the
      // map above never picks them up -- listed by hand here instead, same
      // as every other page search already jumps straight to. New Sale is
      // gone (dropped in favor of Sale mode's own tap-a-sale flow), so
      // there's no entry for it any more.
      { label: 'Live', action: () => jumpToLiveSaleTab('sale') },
      { label: 'Sales Log', action: () => jumpToLiveSaleTab('log') },
      // Vendors/Customers/Purchase Orders/P&L/CAB aren't CASH_ITEMS entries
      // either any more (each folded into a tab/radio of its own inside
      // Items -- see CASH_ITEMS' own comment above), so the map above never
      // picks them up either -- listed by hand here for the same reason as
      // Live Sale/Sale Log just above. Each still jumps to its own standalone
      // lossView destination (kept alive for exactly this) rather than the
      // new radio button, same as Expense Orders below already did.
      { label: 'Vendors', action: () => pickLossView('vendors') },
      { label: 'Customers', action: () => jumpToCustomersTab() },
      { label: 'Purchase Orders', action: () => pickLossView('purchaseOrders') },
      ...(canSeePL ? [
        { label: 'P&L', action: () => pickPL() },
        { label: 'CAB', action: () => pickLossView('cab') },
      ] : []),
      { label: 'Expense Orders', action: () => pickLossView('expenseOrders') },
      { label: 'Properties at Shop', action: () => { pickLossView('properties'); setPropertiesInitialTab('available') } },
      { label: 'Properties not at Shop', action: () => { pickLossView('properties'); setPropertiesInitialTab('away') } },
      ...serviceGroups.map(g => ({ label: `Services — ${g}`, action: () => { pickLossView('items'); setItemsInlineExtra({ kind: 'serviceGroup', group: g }) } })),
    ] : []),
    ...(canSeeManage ? MANAGE_LIST_ITEMS.map(v => ({ label: v.label, action: () => pickLossView(v.key) })) : []),
    ...(myStaffName ? [
      { label: 'Payslips', action: () => openMyPage('payslips', 'staffPayslips') },
      { label: 'Profile', action: () => openMyPage('profile', 'staffProfile') },
    ] : []),
    ...(canSeeTeam ? STAFF_TEAM_ITEMS.map(t => ({ label: t.label, action: () => pickLossView(t.key) })) : []),
    ...(canManage ? STAFF_ADMIN_TEAM_ITEMS.map(t => ({ label: t.label, action: () => pickLossView(t.key) })) : []),
    ...(canSeeUsers || canManage ? [{ label: 'Users & Roles', action: () => pickLossView('users') }] : []),
    ...(canViewPortalAs ? [{ label: 'View Portal As', action: () => pickLossView('viewPortalAs') }] : []),
    ...(canManage ? [{ label: 'Reorder Lists', action: () => pickLossView('reorderLists') }] : []),
    ...(canManage ? [{ label: 'Activity Times', action: () => pickLossView('activityDurations') }] : []),
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
  // While a page or a person's page is open in the right pane, only that page's button is lit.
  const paneActive = (cond: boolean) => cond && !settingsOpen && !embedUrl && !personal && !shop
  const embedActive = (path: string) => !!embedUrl && (embedUrl === path || embedUrl.startsWith(path + '/') || embedUrl.startsWith(path + '?'))
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
  const liveAllItemsRef = useRef<LiveItem[]>([])
  const [liveItemsLoading, setLiveItemsLoading] = useState(true)
  const [liveTaps, setLiveTaps] = useState<Tap[]>([])
  // Whether the Sales Log's sales have arrived yet: until they do, the Log says "Loading sales…" and the total
  // shows ₵… (both used to read "No sales recorded" / ₵0 while the data was still on its way, after every refresh).
  const [liveTapsStatus, setLiveTapsStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  // Shop opening/last-sign-out clock times per date -- backs the Log tab's
  // Gap column for the first/last tap of each day (see liveDayBounds effect
  // below and /api/staff-times/day-bounds).
  const [liveDayBounds, setLiveDayBounds] = useState<Record<string, { openTime: string | null; closeTime: string | null }>>({})
  const [liveSaleType, setLiveSaleType] = useState<'WIC' | 'GMC'>('WIC')
  const [liveTapError, setLiveTapError] = useState('')
  // Tapping an item's name used to open a lightweight, view-only Item 360
  // popup (aliases + loss/gain history, no cost price/group/count entry) --
  // now redirected to openEditGridItem below, the same full editor every
  // other item-opening path already uses, so there's one consistent
  // "Item 360" experience regardless of what was tapped to get there.
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
  const [liveCID, setLiveCID] = useState('')
  // The inline GM box value for the tap being recorded (state set just before recordTap would still be stale).
  const inlineCidRef = useRef<string | null>(null)
  const curLabelRef = useRef('')
  // Name typed for a phone number that is not a saved customer (used in the WhatsApp greeting).
  const custNameRef = useRef('')
  // Batch sale (one customer, several item cards): hold back the per-item WhatsApp offer and collect buyer ids.
  const skipWaRef = useRef(false)
  const [tapCustomerSheet, setTapCustomerSheet] = useState<Tap | null>(null)
  // Sales Log: tick already-recorded sales to put them on one receipt.
  const [rcptSelect, setRcptSelect] = useState(false)
  const [rcptSel, setRcptSel] = useState<Set<number>>(new Set())
  const [rcptSheet, setRcptSheet] = useState(false)
  const { wrapRef: logWrapRef, zoomFor: logZoomFor } = useFitWidth()
  // MI (multiple items): a basket of items for one customer, issued together as one receipt.
  const [miOn, setMiOn] = useState(false)
  const [miLines, setMiLines] = useState<BasketLine[]>([])
  const [miCustomer, setMiCustomer] = useState('')
  const [miDate, setMiDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [miBusy, setMiBusy] = useState(false)
  const [miError, setMiError] = useState('')
  const lastTapIdRef = useRef<number | null>(null)
  const tapTimeOverrideRef = useRef<string | null>(null)
  // Full registration form opened from the GM box for a phone number that is not a saved customer.
  const [registerFor, setRegisterFor] = useState<{ phone: string; done: (code: string) => void } | null>(null)
  const lastBuyerIdRef = useRef<number | null>(null)
  // After a sale tapped with a customer phone number: offer to send the purchase message on WhatsApp.
  const [waPrompt, setWaPrompt] = useState<{ url: string; label: string; printUrl?: string; buyerIds?: number[]; invoiceId?: number } | null>(null)
  const [liveSaving, setLiveSaving] = useState(false)
  const [liveGmcTargetItem, setLiveGmcTargetItem] = useState<{ id: number; name: string; soh: number } | null>(null)
  const [liveGmcCountSaving, setLiveGmcCountSaving] = useState(false)
  const [liveTapStatus, setLiveTapStatus] = useState<string[]>([])
  const [liveTapTime, setLiveTapTime] = useState(() => {
    const now = new Date()
    return now.toISOString().slice(0, 16)
  })
  // Whether the staff member has actually opened the datetime picker and
  // changed it (a deliberate backdate) -- liveTapTime itself is only ever
  // set once, at page load, and nothing refreshes it after that, so every
  // tap sent while this stays false used to silently submit that frozen
  // page-load minute as tapTime instead of the tap's real time. Live Sale
  // taps often span hours in one browser session (no reload in between),
  // so this was recording every one of them -- across the whole session,
  // any item, any staff member -- at the exact same minute, second-
  // truncated on top (see /api/sales/live-tap's `tapTime + ':00Z'`),
  // corrupting tap ordering (the "Gap" column), the GMC pack-cycle
  // before/after split, and the exact overage-exhaustion date. Only send
  // tapTime at all once this is true; recordTap otherwise omits it so the
  // server's own `new Date()` fallback records the real, current instant.
  const [liveTapTimeTouched, setLiveTapTimeTouched] = useState(false)
  // A deliberate backdate is meant for the tap(s) made right then, not
  // every tap for the rest of the browser session -- reset both the moment
  // the sheet closes (covers every one of its 3 close sites at once) so
  // reopening it starts clean at the real current time again.
  useEffect(() => {
    if (!liveSelectedItem) {
      setLiveTapTime(new Date().toISOString().slice(0, 16))
      setLiveTapTimeTouched(false)
    }
  }, [liveSelectedItem])
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
  const [liveEditingFullTapId, setLiveEditingFullTapId] = useState<number | null>(null)
  const [liveEditingCurrentDate, setLiveEditingCurrentDate] = useState<string | null>(null)
  const [liveEditingFullTapForm, setLiveEditingFullTapForm] = useState({ quantity: '', customPrice: '', tappedAt: '' })
  const [liveEditingFullTapSaving, setLiveEditingFullTapSaving] = useState(false)
  const [liveEditingCountTimeSaving, setLiveEditingCountTimeSaving] = useState(false)
  const [liveReconcilingTaps, setLiveReconcilingTaps] = useState(false)
  const [liveNewEntryOpen, setLiveNewEntryOpen] = useState(false)
  const [liveNewEntryForm, setLiveNewEntryForm] = useState({ itemId: '', quantity: '', customPrice: '', tappedAt: '', isGMC: false })
  const [liveNewEntrySaving, setLiveNewEntrySaving] = useState(false)
  const [liveEditingAddingNewInModal, setLiveEditingAddingNewInModal] = useState(false)
  const [liveNewEntryItemSearch, setLiveNewEntryItemSearch] = useState('')
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
        onClick={() => openEditGridItem(item.id)}
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
    // Sales record flags (Sales Rec's, now the Log's): open the Log on that flag.
    if (liveSaleJumpTab === 'log' && liveSaleJumpViolation) {
      setLogFlag(liveSaleJumpViolation === 'dup_receipts' ? 'dup_receipt' : liveSaleJumpViolation)
      setLogBarsOnly(false); setLogShowW(true); setLogShowG(true)
    }
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
  // Purchase Orders radio -- swaps Bills' own content area for the same
  // <PurchaseOrdersPage> the sidebar's "Purchase Ord" menu item opens full-
  // screen, but rendered inline here instead of navigating away (so the
  // Bills tab underneath isn't unmounted/lost).
  const [liveBillsShowPurchaseOrders, setLiveBillsShowPurchaseOrders] = useState(false)
  // Vendors radio -- same treatment as Purchase Orders just above. Vendors
  // no longer has its own Cash pane row (see CASH_ITEMS) since bills are
  // what vendors are actually for; this + Purchase Orders together are its
  // only two entry points now.
  const [liveBillsShowVendors, setLiveBillsShowVendors] = useState(false)
  // Expenses has no internal "add new" of its own either -- same pattern as
  // Bills, reusing the standalone /expenses/new form as a sibling.
  const [liveExpensesAddingNew, setLiveExpensesAddingNew] = useState(false)
  // Expense Orders radio -- swaps Expenses' own content area for the same
  // <ExpenseOrdersPanel> the sidebar's menu item opens full-screen, but
  // rendered inline here instead of navigating away.
  const [liveExpensesShowOrders, setLiveExpensesShowOrders] = useState(false)
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
  const [liveBillsGmcFilter, setLiveBillsGmcFilter] = useState<'all' | 'gmc' | 'vendor'>('all')
  const [liveBillsAvailableVendors, setLiveBillsAvailableVendors] = useState<string[]>([])
  const [liveBillsAvailableYears, setLiveBillsAvailableYears] = useState<number[]>([])
  const liveBillsColPrefs = useColumnPrefs<BillsColKey>('billsTab', BILLS_COLUMNS)
  // Expenses tab's own History/flag-violation/groupBy/property-filter/
  // colPrefs state -- same lift-up treatment as Sales/Bills, so every one
  // of its view buttons (previously the embedded Laws & Tasks panel's
  // `flags` list) renders as one mutually-exclusive radio row here instead.
  const [liveExpensesShowHistory, setLiveExpensesShowHistory] = useState(false)
  const [liveExpensesActiveFlag, setLiveExpensesActiveFlag] = useState<'similar' | 'bundled' | 'no_vendor' | 'properties_no_location' | 'delivery_unresolved' | null>(null)
  const [liveExpensesFlagCounts, setLiveExpensesFlagCounts] = useState<Record<'similar' | 'bundled' | 'no_vendor' | 'properties_no_location' | 'delivery_unresolved', number>>({
    similar: 0, bundled: 0, no_vendor: 0, properties_no_location: 0, delivery_unresolved: 0,
  })
  const [liveExpensesGroupBy, setLiveExpensesGroupBy] = useState<'none' | 'account' | 'vendor' | 'property_type' | 'related_property'>('none')
  const [liveExpensesShowProperties, setLiveExpensesShowProperties] = useState(true)
  const [liveExpensesShowNonProperties, setLiveExpensesShowNonProperties] = useState(true)
  const [liveExpensesPropertyAvailabilityFilter, setLiveExpensesPropertyAvailabilityFilter] = useState<'all' | 'available' | 'not_available'>('all')
  const [liveExpensesPropertyTypeFilter, setLiveExpensesPropertyTypeFilter] = useState<string | null>(null)
  const [liveExpensesViewCounts, setLiveExpensesViewCounts] = useState({
    all_expenses: 0, by_account: 0, by_vendor: 0, by_property_type: 0, by_related_property: 0, show_properties: 0, show_non_properties: 0,
    prop_available: 0, prop_not_available: 0, printers: 0, computers: 0,
  })
  // Account/Type toolbar filters -- Account is genuine expenses data
  // (reported up via onAccountOptionsChange since only ExpensesTab knows
  // the distinct account names), Type reuses the same
  // liveExpensesPropertyTypeFilter the Printers/Computers radio shortcuts
  // already drive, just widened to the full property-type list instead of
  // only those two.
  const [liveExpensesAccountFilter, setLiveExpensesAccountFilter] = useState<string | null>(null)
  const [liveExpensesAccountOptions, setLiveExpensesAccountOptions] = useState<string[]>([])
  const [liveExpensesShowAccountsManager, setLiveExpensesShowAccountsManager] = useState(false)
  // Columns moved into the Filter dropdown (see renderExpensesFiltersBar) --
  // this just tracks whether that panel is open, since ColumnsPickerButton
  // no longer renders its own trigger for Expenses (hideTrigger + controlled
  // open/onOpenChange instead).
  const [liveExpensesColumnsOpen, setLiveExpensesColumnsOpen] = useState(false)
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
  // consume), so a service's cost is instead however many units of its
  // converts_to_item_id material one tap uses (units_per_pack) times THAT
  // item's own cost price.
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
    () => liveAllItems.map(i => ({ id: i.id, item_name: i.name, cf_group: i.group, selling_price: i.selling_price, cost_price: i.cost_price })),
    [liveAllItems]
  )
  // For the Counts pane row (lossView 'counts') -- product_type is needed
  // (unlike liveSalesBillsItems above) since CountsTab uses it to tell
  // countable goods from services.
  const liveCountsItems = useMemo(
    () => liveAllItems.map(i => ({ id: i.id, item_name: i.name, cf_group: i.group, product_type: i.product_type })),
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
    const violationKeys = ['no_cash', 'missing_days', 'dup_receipt', 'high_wnw', 'no_attachment', 'sold_below_cost']
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
    : liveBillsShowPurchaseOrders ? 'purchase_orders'
    : liveBillsShowVendors ? 'vendors'
    : liveBillsBarsOnly ? 'bars_only'
    : liveBillsViolationFilter ? liveBillsViolationFilter
    : liveBillsGmcFilter === 'gmc' ? 'gmc_only'
    : liveBillsGmcFilter === 'vendor' ? 'vendor_only'
    : 'all'
  function selectLiveBillsRadio(value: string) {
    const violationKeys = ['no_vendor', 'no_items_bills', 'bill_total_mismatch', 'bill_no_attachment', 'bill_no_expense', 'vcp_jump']
    setLiveBillsShowHistory(value === 'history')
    setLiveBillsAddingNew(value === 'new_bill')
    setLiveBillsShowPurchaseOrders(value === 'purchase_orders')
    setLiveBillsShowVendors(value === 'vendors')
    setLiveBillsBarsOnly(value === 'bars_only')
    setLiveBillsViolationFilter(violationKeys.includes(value) ? value : null)
    setLiveBillsGmcFilter(value === 'gmc_only' ? 'gmc' : value === 'vendor_only' ? 'vendor' : 'all')
  }

  // Same treatment for Expenses: All/New Expense/History/the four flag
  // violations, plus every view the old embedded Laws & Tasks panel's
  // `flags` list used to offer (By Account/By Vendor/All Properties/
  // Non-Properties/Properties Available/Properties Not Available/
  // Printers/Computers) -- all one mutually-exclusive radio group now. No
  // Bars Only equivalent -- Expenses' list has no day-bar/item-line
  // grouping like Sales/Bills' receipts do.
  const EXPENSES_FLAG_KEYS = ['similar', 'bundled', 'no_vendor', 'properties_no_location', 'delivery_unresolved'] as const
  const liveExpensesRadioValue = liveExpensesShowOrders ? 'expense_orders'
    : liveExpensesShowHistory ? 'history'
    : liveExpensesAddingNew ? 'new_expense'
    : liveExpensesActiveFlag ? liveExpensesActiveFlag
    : liveExpensesGroupBy === 'account' ? 'by_account'
    : liveExpensesGroupBy === 'vendor' ? 'by_vendor'
    : liveExpensesGroupBy === 'property_type' ? 'by_property_type'
    : liveExpensesGroupBy === 'related_property' ? 'by_related_property'
    : (liveExpensesShowProperties && !liveExpensesShowNonProperties) ? 'all_properties'
    : (!liveExpensesShowProperties && liveExpensesShowNonProperties) ? 'non_properties'
    : liveExpensesPropertyAvailabilityFilter === 'available' ? 'properties_available'
    : liveExpensesPropertyAvailabilityFilter === 'not_available' ? 'properties_not_available'
    : liveExpensesPropertyTypeFilter === 'Printer' ? 'printers'
    : liveExpensesPropertyTypeFilter === 'Computer' ? 'computers'
    : 'all'
  function selectLiveExpensesRadio(value: string) {
    if (value === 'expense_orders') { setLiveExpensesShowOrders(true); return }
    setLiveExpensesShowHistory(value === 'history')
    setLiveExpensesAddingNew(value === 'new_expense')
    setLiveExpensesShowOrders(false)
    setLiveExpensesActiveFlag((EXPENSES_FLAG_KEYS as readonly string[]).includes(value) ? value as typeof EXPENSES_FLAG_KEYS[number] : null)
    setLiveExpensesGroupBy(value === 'by_account' ? 'account' : value === 'by_vendor' ? 'vendor' : value === 'by_property_type' ? 'property_type' : value === 'by_related_property' ? 'related_property' : 'none')
    // By Property Type only makes sense scoped to property expenses (non-
    // properties have no property_type at all), same narrowing All
    // Properties already does -- so it gets the same showNonProperties:false.
    setLiveExpensesShowProperties(value !== 'non_properties')
    setLiveExpensesShowNonProperties(value !== 'all_properties' && value !== 'by_property_type')
    setLiveExpensesPropertyAvailabilityFilter(value === 'properties_available' ? 'available' : value === 'properties_not_available' ? 'not_available' : 'all')
    setLiveExpensesPropertyTypeFilter(value === 'printers' ? 'Printer' : value === 'computers' ? 'Computer' : null)
  }
  // Mirrors ExpensesTab's old local getPrefsKey() -- same key scheme, now
  // derived from the radio value that owns all its inputs.
  function getExpensesPrefsKey(radioValue: string): string {
    if ((EXPENSES_FLAG_KEYS as readonly string[]).includes(radioValue)) return `expensesTable_flag_${radioValue}`
    if (radioValue === 'by_account') return 'expensesTable_groupBy_account'
    if (radioValue === 'by_vendor') return 'expensesTable_groupBy_vendor'
    if (radioValue === 'by_property_type') return 'expensesTable_groupBy_propertyType'
    if (radioValue === 'by_related_property') return 'expensesTable_groupBy_relatedProperty'
    if (radioValue === 'all_properties') return 'expensesTable_propertiesOnly'
    if (radioValue === 'non_properties') return 'expensesTable_nonPropertiesOnly'
    if (radioValue === 'properties_available') return 'expensesTable_propFilter_available'
    if (radioValue === 'properties_not_available') return 'expensesTable_propFilter_not_available'
    if (radioValue === 'printers') return 'expensesTable_propType_Printer'
    if (radioValue === 'computers') return 'expensesTable_propType_Computer'
    return 'expensesTable_all'
  }
  const liveExpensesColPrefs = useColumnPrefs<ExpensesColKey>(getExpensesPrefsKey(liveExpensesRadioValue), EXPENSES_COLUMNS)

  // All/All Properties/Non-Properties/the four flag violations used to be
  // three separate rows (one nearly empty, since "All" had no company).
  // Flattened into one list and split across exactly two rows instead, so
  // every row fills up with flex-1 items before spilling to the next --
  // color/weight is driven by `variant`, not which row an item lands on.
  const liveExpensesMainRadios: { key: string; label: string; count: number | null; variant: 'all' | 'view' | 'flag' | 'nav'; description?: string }[] = [
    { key: 'all', label: 'All', count: null, variant: 'all' },
    { key: 'by_account', label: 'By Account', count: liveExpensesViewCounts.by_account, variant: 'view' },
    { key: 'by_vendor', label: 'By Vendor', count: liveExpensesViewCounts.by_vendor, variant: 'view' },
    { key: 'by_property_type', label: 'By Property Type', count: liveExpensesViewCounts.by_property_type, variant: 'view' },
    { key: 'by_related_property', label: 'By Related Property', count: liveExpensesViewCounts.by_related_property, variant: 'view' },
    { key: 'all_properties', label: 'All Properties', count: liveExpensesViewCounts.show_properties, variant: 'view' },
    { key: 'non_properties', label: 'Non-Properties', count: liveExpensesViewCounts.show_non_properties, variant: 'view' },
    // Opens the Expense Orders view inline in this tab.
    { key: 'expense_orders', label: 'Expense Orders', count: null, variant: 'view', description: 'View the running wishlist of future purchases.' },
    ...([
      { key: 'similar', label: 'Similar Accounts', count: liveExpensesFlagCounts.similar, description: 'Account names within a couple letters of another account -- likely the same account entered two different ways.' },
      { key: 'bundled', label: 'Bundled', count: liveExpensesFlagCounts.bundled, description: 'Description mentions "and"/"etc" or has a comma -- likely covers more than one item bundled into one expense.' },
      { key: 'no_vendor', label: 'No Vendor', count: liveExpensesFlagCounts.no_vendor, description: 'No vendor name recorded for this expense.' },
      { key: 'properties_no_location', label: 'No Location', count: liveExpensesFlagCounts.properties_no_location, description: 'Property is marked available but has no location set.' },
      { key: 'delivery_unresolved', label: 'Delivery Unresolved', count: liveExpensesFlagCounts.delivery_unresolved, description: 'Mentions "delivery" but isn\'t marked as a related expense -- either migrate it to the bill it was for, or mark it related to the property it delivered.' },
    ].sort((a, b) => b.count - a.count).map(f => ({ ...f, variant: 'flag' as const }))),
  ]
  // Wraps as one tightly-packed group instead of stretching to fill fixed
  // rows -- each radio sizes to its own label instead of a shared flex-1
  // slot, so items sit close together (whether red flags or black views)
  // regardless of how many total radios there are or how a wrap falls.
  function renderLiveExpensesRadio(v: typeof liveExpensesMainRadios[number]) {
    return (
      <label key={v.key} title={v.description}
        className={`shrink-0 flex items-center gap-0.5 cursor-pointer hover:underline select-none text-[9px] whitespace-nowrap ${
          v.variant === 'flag' ? 'text-red-600' : v.variant === 'nav' ? 'font-semibold text-blue-600' : v.variant === 'view' ? 'font-semibold text-gray-600' : 'text-gray-700'
        }`}>
        <input type="radio" name="liveExpensesRadio" checked={liveExpensesRadioValue === v.key} onChange={() => selectLiveExpensesRadio(v.key)} className="cursor-pointer w-2.5 h-2.5 shrink-0" />
        <span>{v.label}{v.count !== null ? ` (${v.count})` : ''}</span>
      </label>
    )
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
  // no_sp/no_cp match itemAttentionFlags' own rule exactly (ACP-aware,
  // catches negative values too, not just falsy/exact-zero) -- these two
  // used to disagree with the on-card badge, so an item could count as
  // flagged in one place but not the other.
  const liveItemsWithViolations = useMemo(() => ({
    neg_soh: liveAllItems.filter(i => Number(i.soh) < 0 && i.product_type !== 'service').map(i => i.id),
    no_sp: liveAllItems.filter(i => (parseFloat(String(i.selling_price)) || 0) <= 0).map(i => i.id),
    no_cp: liveAllItems.filter(i => i.product_type !== 'service' && (parseFloat(String(i.acp_price ?? i.cost_price)) || 0) <= 0).map(i => i.id),
    no_group: liveAllItems.filter(i => !i.group).map(i => i.id),
    // Unidentified pre-Zoho stub items (see /api/aliases/wide) -- a plain
    // boolean, independent of cf_group (which holds the item's real
    // category), so this filter is reachable regardless of the "Live" (no
    // banners at all) view, same reasoning as every other row here.
    needs_review: liveAllItems.filter(i => i.needs_review).map(i => i.id),
    // Both sides of every non-dismissed duplicate pair -- ids only, same as
    // the other four keys here.
    duplicates: [...new Set((globalFlags?.duplicates ?? []).flatMap((d: any) => [d.id1, d.id2]))] as number[],
    unlinked_named: (globalFlags?.unlinkedNamed ?? []).map((r: any) => r.item_id) as number[],
    service_violation: serviceViolationIds,
    // Items whose pre-Zoho alias was resolved by best-guess heuristics
    // (price/name matching between 2+ candidates) rather than a confident
    // match -- see /api/flags' lowConfidenceAlias. Worth a manual check;
    // wrong picks are fixed the same way as any other item, via Merge.
    low_confidence_alias: (globalFlags?.lowConfidenceAlias ?? []).map((r: any) => r.item_id) as number[],
    // Items with at least one unreviewed pre-Zoho ledger note (see
    // /api/prezoho-notes) -- historical context, not a data error, just
    // worth a reviewer's eyes at some point.
    prezoho_notes: (globalFlags?.prezohoNotes ?? []).map((r: any) => r.item_id) as number[],
    // Items with at least one sale line whose quantity is still unknown
    // (real item_total, but the original bizims_historical import never
    // recorded how many units) -- see /api/flags' unknownQty. Worth a
    // manual per-item price-consistency call, the same way Passport and the
    // 19-item medium-consistency batch were resolved (2026-09-14).
    unknown_qty: (globalFlags?.unknownQty ?? []).map((r: any) => r.item_id) as number[],
    // GMC targets whose current pack cycle has already used more than it
    // was given, with no newer pack tapped in yet -- see /api/flags'
    // gmcOverage (same condition as the passive Item 360 "USAGE EXCEEDS
    // PACK" card badge, just also surfaced here as a reviewable violation).
    gmc_overage: (globalFlags?.gmcOverage ?? []).map((r: any) => r.item_id) as number[],
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
  // Deferred to 1500ms to avoid duplicating the same request the Items tab makes
  // Retries a few times and only ever REPLACES the list with a real, non-empty
  // array. It used to treat any failed/non-array response (Neon cold start,
  // a restarting server, a dropped connection) as "zero items" -- the grid
  // then showed "No items found" until a manual refresh happened to succeed.
  const [liveItemsError, setLiveItemsError] = useState(false)
  async function loadLiveItems(retries = 3): Promise<boolean> {
    for (let i = 0; i <= retries; i++) {
      try {
        const r = await fetch('/api/items/all')
        if (r.ok) {
          const d = await r.json()
          // A degraded answer (the server's stock query failed, so every stock figure is a placeholder 0) is never
          // shown over good data: retry, and only accept it if there is nothing else to show.
          const degraded = r.headers.get('X-Degraded') === '1'
          if (degraded && (liveAllItemsRef.current.length > 0 || i < retries)) { if (i < retries) await new Promise(res => setTimeout(res, 1500 * (i + 1))); continue }
          if (Array.isArray(d) && d.length > 0) {
            liveAllItemsRef.current = d
            setLiveAllItems(d); setLiveItemsError(false); setLiveItemsLoading(false)
            return true
          }
        }
      } catch {}
      if (i < retries) await new Promise(res => setTimeout(res, 1000 * (i + 1)))
    }
    setLiveItemsError(true); setLiveItemsLoading(false)
    return false
  }
  useEffect(() => {
    const t = setTimeout(() => { void loadLiveItems() }, 1500)
    return () => clearTimeout(t)
  }, [])

  // Items with at least one past GMC (internal-use) sale on record, and how
  // many -- the only existing definition of "GMC items" anywhere in the app
  // (see /api/items/gmc-ids). Fetched once. liveGmcItemIds still feeds the
  // couple of spots that only need membership (BillsTab's gmcFilter, the
  // service/GMC match picker); liveGmcUsageCounts is what ranks the GMC-mode
  // grid by how often each item has actually been GMC'd before (see the
  // liveFilteredSortedItems memo below) -- it no longer limits which items
  // are pickable at all, just their order.
  const [liveGmcItemIds, setLiveGmcItemIds] = useState<Set<number>>(new Set())
  const [liveGmcUsageCounts, setLiveGmcUsageCounts] = useState<Map<number, number>>(new Map())
  useEffect(() => {
    const t = setTimeout(() => {
      fetch('/api/items/gmc-ids')
        .then(r => r.json())
        .then(d => {
          const rows: { item_id: number; count: number }[] = Array.isArray(d) ? d : []
          setLiveGmcItemIds(new Set(rows.map(r => r.item_id)))
          setLiveGmcUsageCounts(new Map(rows.map(r => [r.item_id, r.count])))
        })
        .catch(() => {})
    }, 1800)
    return () => clearTimeout(t)
  }, [])

  // Current stock of every GMC conversion target, and (see open_overage
  // below) whether its currently-open cycle has already used more than
  // its own pack gave -- both from /api/items/gmc-target-stock, what
  // itemAttentionFlags reads to warn on a pack_to_gmc item ("buy a new
  // one" / "count the packs") or a service_using_gmc item ("about to run
  // out"). Not tied to any single tap the way targetSohAfterReduction is
  // (recordTap's own post-tap toast, ~3699) -- this is what makes the
  // warning show up proactively, before anyone taps anything, from the
  // item card / tap sheet alone. Polled the same 60s cadence as everything
  // else in this file that needs to react to teammates' actions (see
  // usePolling's own comment), not just fetched once like liveGmcItemIds
  // -- a pack reset (or a fresh overage) from another staff member's tap
  // should show up without a full page reload.
  const [liveGmcTargetStock, setLiveGmcTargetStock] = useState<Map<number, number>>(new Map())
  const [liveGmcOpenOverage, setLiveGmcOpenOverage] = useState<Map<number, GmcOpenOverage>>(new Map())
  const applyGmcTargetStock = (d: unknown) => {
    const rows: { item_id: number; calculated_soh: number; open_overage: GmcOpenOverage | null }[] = Array.isArray(d) ? d : []
    setLiveGmcTargetStock(new Map(rows.map(r => [r.item_id, r.calculated_soh])))
    setLiveGmcOpenOverage(new Map(rows.filter(r => r.open_overage).map(r => [r.item_id, r.open_overage!])))
  }
  useEffect(() => {
    const t = setTimeout(() => {
      fetch('/api/items/gmc-target-stock').then(r => r.json()).then(applyGmcTargetStock).catch(() => {})
    }, 1800)
    return () => clearTimeout(t)
  }, [])
  usePolling(() => {
    fetch('/api/items/gmc-target-stock').then(r => r.json()).then(applyGmcTargetStock).catch(() => {})
  }, 60000)

  // Shared across every staff member -- see /api/item-sort-order.
  // Deferred since not critical for initial render
  useEffect(() => {
    const t = setTimeout(() => {
      fetch('/api/item-sort-order')
        .then(r => r.json())
        .then((d: { order?: ItemSortKey[] }) => {
          if (Array.isArray(d?.order) && d.order.length === DEFAULT_ITEM_SORT_ORDER.length) setLiveItemSortOrder(d.order)
        })
        .catch(() => {})
    }, 1600)
    return () => clearTimeout(t)
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
  // Deferred to avoid blocking on expensive aggregation query.
  const [liveLossByItemId, setLiveLossByItemId] = useState<Map<number, { lossCount: number; lgAmt: number; lgQty: number; gainCount: number; emptyRowCount: number }>>(new Map())
  useEffect(() => {
    const t = setTimeout(() => {
      fetch('/api/losses/summary')
        .then(r => r.json())
        .then((d: { item_id: number; lossCount: number; lgAmt: number; lgQty: number; gainCount: number; emptyRowCount: number }[]) => {
          setLiveLossByItemId(new Map(Array.isArray(d) ? d.map(r => [r.item_id, { lossCount: r.lossCount, lgAmt: r.lgAmt, lgQty: r.lgQty, gainCount: r.gainCount, emptyRowCount: r.emptyRowCount }]) : []))
        })
        .catch(() => {})
    }, 2000)
    return () => clearTimeout(t)
  }, [])

  // First/last recorded sale date and average monthly quantity per item --
  // off the item's full sales_receipt_lines history (see
  // /api/items/sale-history), shown next to CP/SP/SOH same as the loss
  // figures above. Fetched once, same pattern.
  // Deferred to avoid blocking on expensive history aggregation query.
  const [liveSaleHistoryByItemId, setLiveSaleHistoryByItemId] = useState<Map<number, { firstSaleDate: string; lastSaleDate: string; avgMonthlyQty: number }>>(new Map())
  useEffect(() => {
    const t = setTimeout(() => {
      fetch('/api/items/sale-history')
        .then(r => r.json())
        .then((d: { item_id: number; first_sale_date: string; last_sale_date: string; avg_monthly_qty: number }[]) => {
          setLiveSaleHistoryByItemId(new Map(Array.isArray(d) ? d.map(r => [r.item_id, { firstSaleDate: r.first_sale_date, lastSaleDate: r.last_sale_date, avgMonthlyQty: r.avg_monthly_qty }]) : []))
        })
        .catch(() => {})
    }, 2000)
    return () => clearTimeout(t)
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
  // Negative Stock/Missing Selling Price/Missing Cost Price/Missing Group --
  // same source (liveItemsWithViolations) as the three above, just Set-ified
  // for O(1) membership tests in the grid filter below. Cost>=Selling Price
  // has no equivalent in liveItemsWithViolations (it's specific to Sale
  // mode's own pricing checks), so it's built directly here instead.
  const liveNegSohIds = useMemo(() => new Set<number>(liveItemsWithViolations.neg_soh ?? []), [liveItemsWithViolations])
  const liveNoSpIds = useMemo(() => new Set<number>(liveItemsWithViolations.no_sp ?? []), [liveItemsWithViolations])
  const liveNoCpIds = useMemo(() => new Set<number>(liveItemsWithViolations.no_cp ?? []), [liveItemsWithViolations])
  const liveNoGroupIds = useMemo(() => new Set<number>(liveItemsWithViolations.no_group ?? []), [liveItemsWithViolations])
  const liveNeedsReviewIds = useMemo(() => new Set<number>(liveItemsWithViolations.needs_review ?? []), [liveItemsWithViolations])
  const liveLowConfidenceAliasIds = useMemo(() => new Set<number>(liveItemsWithViolations.low_confidence_alias ?? []), [liveItemsWithViolations])
  const livePrezohoNotesIds = useMemo(() => new Set<number>(liveItemsWithViolations.prezoho_notes ?? []), [liveItemsWithViolations])
  const liveUnknownQtyIds = useMemo(() => new Set<number>(liveItemsWithViolations.unknown_qty ?? []), [liveItemsWithViolations])
  const liveGmcOverageIds = useMemo(() => new Set<number>(liveItemsWithViolations.gmc_overage ?? []), [liveItemsWithViolations])
  const liveAcpGteSpIds = useMemo(() => new Set<number>(liveAllItems.filter(item => {
    const sp = parseFloat(String(item.selling_price)) || 0
    const cp = parseFloat(String(item.acp_price ?? item.cost_price)) || 0
    return item.product_type !== 'service' && sp > 0 && cp > 0 && cp >= sp
  }).map(item => item.id)), [liveAllItems])
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
  // Fourth cross-item check: net gain, i.e. an item whose TOTAL counted
  // gains actually outweigh its total losses (lgAmt < 0 -- see
  // /api/losses/summary's signed net figure). This is the one direction
  // that should never happen under normal operation, so it's the only one
  // of the two that's a real violation -- the opposite direction (Net
  // Loss, lgAmt > 0) is just ordinary shrinkage/wastage, browsable as its
  // own plain view further down, not something needing a fix.
  const liveNetGainByItemId = useMemo(() => {
    const m = new Map<number, { qty: number; amt: number }>()
    liveLossByItemId.forEach((v, id) => { if (v.lgAmt < -0.005) m.set(id, { qty: -v.lgQty, amt: -v.lgAmt }) })
    return m
  }, [liveLossByItemId])
  const liveNetLossIds = useMemo(() => {
    const s = new Set<number>()
    liveLossByItemId.forEach((v, id) => { if (v.lgAmt > 0.005) s.add(id) })
    return s
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
  const liveNetGainCount = liveNetGainByItemId.size
  const liveNetLossCount = liveNetLossIds.size
  const liveSoldBelowCostCount = liveSoldBelowCostDatesByItemId.size
  const liveVcpJumpCount = liveVcpJumpDatesByItemId.size
  const liveEmptyRowCount = liveEmptyRowCountByItemId.size
  // Negative Stock/Cost>=Selling Price/Missing Selling Price/Missing Cost
  // Price/Missing Group used to only be visible via the retired All(V)
  // filter -- now each is its own dedicated radio (see liveItemsWithViolations
  // above for no_sp/no_cp/no_group/neg_soh's own consistent definitions,
  // matched to itemAttentionFlags' rule), same "count > 0, count-gated"
  // treatment as Duplicates/Service/Unlinked/Empty Row already got.
  const liveNegSohCount = liveNegSohIds.size
  const liveAcpGteSpCount = liveAcpGteSpIds.size
  const liveNoSpCount = liveNoSpIds.size
  const liveNoCpCount = liveNoCpIds.size
  const liveNoGroupCount = liveNoGroupIds.size
  const liveNeedsReviewCount = liveNeedsReviewIds.size
  const liveLowConfidenceAliasCount = liveLowConfidenceAliasIds.size
  const livePrezohoNotesCount = livePrezohoNotesIds.size
  const liveUnknownQtyCount = liveUnknownQtyIds.size
  const liveGmcOverageCount = liveGmcOverageIds.size

  // Fetch taps. The last 7 days come first (small and quick, so today's sales show straight away), then the
  // full 90 days. A failed request is retried a few times and never replaces sales already on screen with an
  // empty list -- that used to show "No sales recorded" whenever the server or the connection hiccuped.
  async function fetchTaps(days: number): Promise<Tap[]> {
    for (let attempt = 0; ; attempt++) {
      try {
        const r = await fetch(`/api/sales/live-taps?days=${days}`)
        const d = await r.json()
        if (r.ok && Array.isArray(d)) return d.filter((t): t is Tap => t != null)
        throw new Error(`status ${r.status}`)
      } catch (e) {
        if (attempt >= 3) throw e
        await new Promise(res => setTimeout(res, 1000 * (attempt + 1) * (attempt + 1)))
      }
    }
  }
  // The Log loads the last 90 days; "Show older sales" loads every sale ever tapped (Sales Log records start
  // 9 Aug 2026; anything older is in the analytics' Days & months).
  const [liveTapsAll, setLiveTapsAll] = useState<'no' | 'loading' | 'yes'>('no')
  const [logPeriod, setLogPeriod] = useState<{ y: number | null; m: number | null }>({ y: null, m: null })
  const [logRecs, setLogRecs] = useState<{ receipts: LogRec[]; lines: LogRecLine[] } | null>(null)
  const [logRecsStatus, setLogRecsStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [logPeriodTaps, setLogPeriodTaps] = useState<Tap[] | null>(null)
  const [logShowW, setLogShowW] = useState(true)
  const [logShowG, setLogShowG] = useState(true)
  const [logBarsOnly, setLogBarsOnly] = useState(false)
  const [logFlag, setLogFlag] = useState('')
  const [logFlagsData, setLogFlagsData] = useState<Record<string, unknown> | null>(null)
  const logYears = useMemo(() => { const now = new Date().getUTCFullYear(); return Array.from({ length: now - 2023 + 1 }, (_, i) => now - i) }, [])
  function logRange(p: { y: number | null; m: number | null }, all: boolean): [string, string] {
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    if (!p.y) return [all ? '2026-08-01' : iso(new Date(Date.now() - 90 * 86400000)), iso(new Date())]
    if (!p.m) return [`${p.y}-01-01`, `${p.y}-12-31`]
    const last = new Date(Date.UTC(p.y, p.m, 0)).getUTCDate()
    return [`${p.y}-${String(p.m).padStart(2, '0')}-01`, `${p.y}-${String(p.m).padStart(2, '0')}-${String(last).padStart(2, '0')}`]
  }
  function loadAllLiveTaps() {
    setLiveTapsAll('loading')
    fetchTaps(3650).then(taps => { setLiveTaps(taps); setLiveTapsAll('yes') }).catch(() => setLiveTapsAll('no'))
  }
  function reloadLiveTaps() {
    fetchTaps(liveTapsAll === 'yes' ? 3650 : 90).then(taps => { setLiveTaps(taps); setLiveTapsStatus('ok') }).catch(() => { /* keep what is on screen */ })
  }
  function loadLiveTapsFresh() {
    setLiveTapsStatus(prev => (prev === 'ok' ? 'ok' : 'loading'))
    let gotFull = false
    fetchTaps(7).then(taps => { if (!gotFull) { setLiveTaps(taps); setLiveTapsStatus('ok') } }).catch(() => {})
    fetchTaps(90)
      .then(taps => { gotFull = true; setLiveTaps(taps); setLiveTapsStatus('ok') })
      .catch(() => setLiveTapsStatus(prev => (prev === 'ok' ? 'ok' : 'error')))
  }
  useEffect(() => {
    loadLiveTapsFresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // Was exactly at Neon's 5-minute auto-suspend threshold (300000ms), close
  // enough to still occasionally prevent a quiet moment from suspending;
  // bumped to the same 10-minute tier as the other background pollers.
  usePolling(loadCountProgress, 600000)

  // Count Records -- fetched when viewing the Count Records view, showing full-page
  // count display in Sale mode, or viewing Loss by Date/Items views. Unlike the queues
  // above, this is the full all-time history, not a small due-today list.
  const liveViewingCountRecords = liveCountView?.kind === 'records' || liveShowCountFullPage || (lossView === 'pl' && plSubView !== 'pl')
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
  // Today's running sales total (cedis), shown boldly on the desktop Nav bar
  // (see the navSlotEl portal below) so it's visible while staff are working,
  // not just from a report. Same liveTaps.filter(!undone && today).reduce
  // pattern the Log tab's per-date totals and the Daily Summary view already
  // compute inline -- hoisted into one memo since this is now a third,
  // always-visible consumer of the same figure. liveTaps is fetched
  // unconditionally on mount, so this stays accurate regardless of which tab
  // is open.
  // Money taken for pending jobs (deposits, later payments, refunds as negatives): only what was actually taken counts in the sales total.
  const [jobPayments, setJobPayments] = useState<{ day: string; staff: string; amount: number }[]>([])
  useEffect(() => {
    let live = true
    const load = () => fetch('/api/pending-jobs/payments?days=60', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (live && Array.isArray(d?.payments)) setJobPayments(d.payments) }).catch(() => {})
    void load(); const t = setInterval(load, 5 * 60 * 1000)
    return () => { live = false; clearInterval(t) }
  }, [])
  const jobMoneyOn = (day: string) => jobPayments.filter(p => p.day === day).reduce((a, p) => a + Number(p.amount), 0)
  const liveTodaySalesTotal = useMemo(() => {
    return (liveTaps || [])
      .filter((t): t is Tap => t != null && !t.undone && t.tapped_at.startsWith(liveToday))
      .reduce((sum, t) => sum + Number(t.price) * t.quantity, 0) + jobPayments.filter(p => p.day === liveToday).reduce((a, p) => a + Number(p.amount), 0)
  }, [liveTaps, liveToday, jobPayments])
  // What each person has actually recorded today (not-undone Live Sale taps), shown in their button.
  const salesByStaff = useMemo(() => {
    const m: Record<string, number> = {}
    for (const t of (liveTaps || [])) if (t && !t.undone && t.tapped_at.startsWith(liveToday)) { const k = String(t.staff_name ?? '').toLowerCase(); m[k] = (m[k] ?? 0) + Number(t.price) * t.quantity }
    for (const p of jobPayments) if (p.day === liveToday && p.staff) m[p.staff] = (m[p.staff] ?? 0) + Number(p.amount)
    return m
  }, [liveTaps, liveToday, jobPayments])
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

    // GMC (internal use) used to only ever show items with a GMC history
    // (liveGmcItemIds) -- kept the browse grid from offering a normal
    // walk-in item under an internal-use receipt, but also meant an item
    // that hadn't been GMC'd yet simply couldn't be found here at all.
    // Every eligible good is offered now (GMC usage only decides order, see
    // the sort below); still excludes services (never physically pulled
    // for internal use the way a good is) and anything with no stock to
    // actually take.
    if (liveMode === 'sale' && liveSaleType === 'GMC') {
      filtered = filtered.filter(item => item.product_type !== 'service' && Number(item.soh) > 0)
      // GMC cannot tap "GMC only, no service" items -- they can only be
      // credited from a pack conversion, never directly purchased.
      filtered = filtered.filter(item => item.gmc_type !== 'gmc')
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

    // GMC mode: items GMC'd more often before come first (most likely to be
    // wanted again), with the sales-count order below as the tiebreaker for
    // everything else -- rather than sorting only within the old
    // GMC-history-only list, this now also orders every other eligible good
    // that's simply never been GMC'd yet.
    if (liveMode === 'sale' && liveSaleType === 'GMC') {
      return filtered.sort((a, b) => {
        const gmcDiff = (liveGmcUsageCounts.get(b.id) ?? 0) - (liveGmcUsageCounts.get(a.id) ?? 0)
        if (gmcDiff !== 0) return gmcDiff
        return (liveSalesCounts.get(b.id) ?? 0) - (liveSalesCounts.get(a.id) ?? 0)
      })
    }

    // Sort by sales count (highest to lowest)
    return filtered.sort((a, b) => (liveSalesCounts.get(b.id) ?? 0) - (liveSalesCounts.get(a.id) ?? 0))
  }, [liveAllItems, liveSalesCounts, liveCurrentView, liveProductTypeFilter, liveGroupFilter, liveGmcTypeFilter, livePickedItemId, liveSaleType, liveGmcItemIds, liveGmcUsageCounts, liveMode, liveSaleFilter, liveLossByItemId, liveItemsWithViolations, liveDuplicateItemIds, liveServiceViolationIdSet, liveUnlinkedNamedIds, liveItemPickerQuery, liveSaleViolationFilter, liveCountStatus])

  // Log tab's two histories, grouped by date -- computed unconditionally
  // (not inside an `if (liveMode === 'log')` branch) since every mode
  // renders from the same mounted component instance, switched by
  // liveMode; a useMemo that only ran while liveMode==='log' would change
  // the hook count the moment you switched tabs and crash the page.

  // The Sales Log's days: every day with tapped sales or a day receipt in the loaded period, each with its taps,
  // receipts and record lines, after the W / G and Flags filters.
  const logFlagDates = useMemo(() => {
    if (!logFlag || !logFlagsData) return null
    const key = ({ no_cash: 'noCash', high_wnw: 'highWnw', no_attachment: 'noAttachment', sold_below_cost: 'costGteSell' } as Record<string, string>)[logFlag]
    if (!key) return null
    const rows = (logFlagsData[key] as { receipt_date?: string }[] | undefined) ?? []
    return new Set(rows.map(r => String(r.receipt_date ?? '').slice(0, 10)))
  }, [logFlag, logFlagsData])
  const logDays = useMemo(() => {
    const keep = (g: boolean | null | undefined) => (g ? logShowG : logShowW)
    const map = new Map<string, { taps: Tap[]; receipts: LogRec[]; lines: LogRecLine[] }>()
    const get = (d: string) => { let v = map.get(d); if (!v) { v = { taps: [], receipts: [], lines: [] }; map.set(d, v) } return v }
    for (const t of (logPeriod.y ? logPeriodTaps : liveTaps) ?? []) {
      if (!t || !t.tapped_at || !keep(t.is_gmc)) continue
      get(t.tapped_at.slice(0, 10)).taps.push(t)
    }
    for (const r of logRecs?.receipts ?? []) get(r.day).receipts.push(r)
    for (const l of logRecs?.lines ?? []) if (keep(l.is_gmc)) get(l.day).lines.push(l)
    let days = Array.from(map.entries())
      .filter(([, v]) => v.taps.length > 0 || v.lines.length > 0 || v.receipts.some(r => keep(r.is_gmc)))
      .sort(([a], [b]) => b.localeCompare(a))
    if (logFlagDates) days = days.filter(([d]) => logFlagDates.has(d))
    return days
  }, [liveTaps, logPeriodTaps, logPeriod.y, logRecs, logShowW, logShowG, logFlagDates])

  // Records (and, for a picked Period, that period's taps) load when the Log is open and the period changes.
  useEffect(() => {
    if (liveMode !== 'log') return
    const [from, to] = logRange(logPeriod, liveTapsAll === 'yes')
    let off = false
    setLogRecsStatus('loading')
    fetch(`/api/sales/log-records?from=${from}&to=${to}`).then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if (!off) { setLogRecs({ receipts: d.receipts ?? [], lines: d.lines ?? [] }); setLogRecsStatus('ok') } })
      .catch(() => { if (!off) setLogRecsStatus('error') })
    setLogPeriodTaps(null)
    if (logPeriod.y) {
      fetch(`/api/sales/live-taps?from=${from}&to=${to}`).then(r => r.ok ? r.json() : Promise.reject())
        .then(d => { if (!off) setLogPeriodTaps(Array.isArray(d) ? d.filter((t: Tap | null): t is Tap => t != null) : []) })
        .catch(() => { if (!off) setLogPeriodTaps([]) })
    }
    return () => { off = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveMode, logPeriod.y, logPeriod.m, liveTapsAll])
  // Flags (no cash counted, high WNW, no photo, sold below cost, missing days, duplicate receipts) load once, when used.
  useEffect(() => {
    if (liveMode !== 'log' || !logFlag || logFlagsData || logFlag === 'history') return
    fetch('/api/flags').then(r => r.ok ? r.json() : Promise.reject()).then(d => setLogFlagsData(d ?? {})).catch(() => setLogFlagsData({}))
  }, [liveMode, logFlag, logFlagsData])

  // Shop open/close bounds for the Log tab's Gap column -- only fetched
  // while Log is actually being looked at (same "not until it's viewed"
  // treatment as Count Records below), and only for dates not already
  // fetched, so switching back to Log after the first time doesn't refetch
  // every date again.
  useEffect(() => {
    if (liveMode !== 'log') return
    const dates = logDays.filter(([, v]) => v.taps.length > 0).map(([date]) => date).filter(d => !(d in liveDayBounds))
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
  }, [liveMode, logDays])

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
      if (liveSaleViolationFilter === 'netLoss' || liveSaleViolationFilter === 'netGain') {
        // Net Loss/Net Gain: show only loss/gain records
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
      m.set(item.id, itemAttentionFlags(item, liveDuplicateItemIds, liveUnlinkedNamedIds, liveServiceViolationIdSet, liveNetGainByItemId, liveEmptyRowCountByItemId, liveSoldBelowCostDatesByItemId, liveVcpJumpDatesByItemId, liveGmcTargetStock, liveGmcOpenOverage, liveLowConfidenceAliasIds, livePrezohoNotesIds).length)
    }
    return m
  }, [liveCatalogueItems, liveDuplicateItemIds, liveUnlinkedNamedIds, liveServiceViolationIdSet, liveNetGainByItemId, liveEmptyRowCountByItemId, liveSoldBelowCostDatesByItemId, liveVcpJumpDatesByItemId, liveGmcTargetStock, liveGmcOpenOverage, liveLowConfidenceAliasIds, livePrezohoNotesIds])

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
    } else if (liveSaleViolationFilter === 'netLoss') {
      itemsToSort = liveCatalogueItems.filter(item => liveNetLossIds.has(item.id))
    } else if (liveSaleViolationFilter === 'netGain') {
      itemsToSort = liveCatalogueItems.filter(item => liveNetGainByItemId.has(item.id))
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
    } else if (liveSaleViolationFilter === 'negSoh') {
      itemsToSort = liveCatalogueItems.filter(item => liveNegSohIds.has(item.id))
    } else if (liveSaleViolationFilter === 'acpGteSp') {
      itemsToSort = liveCatalogueItems.filter(item => liveAcpGteSpIds.has(item.id))
    } else if (liveSaleViolationFilter === 'noSp') {
      itemsToSort = liveCatalogueItems.filter(item => liveNoSpIds.has(item.id))
    } else if (liveSaleViolationFilter === 'noCp') {
      itemsToSort = liveCatalogueItems.filter(item => liveNoCpIds.has(item.id))
    } else if (liveSaleViolationFilter === 'noGroup') {
      itemsToSort = liveCatalogueItems.filter(item => liveNoGroupIds.has(item.id))
    } else if (liveSaleViolationFilter === 'needsReview') {
      itemsToSort = liveCatalogueItems.filter(item => liveNeedsReviewIds.has(item.id))
    } else if (liveSaleViolationFilter === 'lowConfidenceAlias') {
      itemsToSort = liveCatalogueItems.filter(item => liveLowConfidenceAliasIds.has(item.id))
    } else if (liveSaleViolationFilter === 'prezohoNotes') {
      itemsToSort = liveCatalogueItems.filter(item => livePrezohoNotesIds.has(item.id))
    } else if (liveSaleViolationFilter === 'unknownQty') {
      itemsToSort = liveCatalogueItems.filter(item => liveUnknownQtyIds.has(item.id))
    } else if (liveSaleViolationFilter === 'gmcOverage') {
      itemsToSort = liveCatalogueItems.filter(item => liveGmcOverageIds.has(item.id))
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
  }, [liveCatalogueItems, liveCountStatus, liveMode, liveViolationCountByItemId, liveSalesCounts, liveItemSortOrder, liveSaleViolationFilter, liveNetLossIds, liveNetGainByItemId, liveDuplicateItemIds, liveUnlinkedNamedIds, liveServiceViolationIdSet, liveSoldBelowCostDatesByItemId, liveVcpJumpDatesByItemId, liveEmptyRowCountByItemId, liveNegSohIds, liveAcpGteSpIds, liveNoSpIds, liveNoCpIds, liveNoGroupIds, liveNeedsReviewIds, liveLowConfidenceAliasIds, livePrezohoNotesIds, liveUnknownQtyIds, liveGmcOverageIds])

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

  // Fires when ClockInGateModal resolves (clocked in, or "continue without
  // clocking in") -- marks the gate dismissed for the rest of this session
  // and retries whichever tap was blocked. Passes bypassGate=true rather
  // than relying on clockGateDismissed here: setClockGateDismissed(true)
  // only takes effect on the next render, so recordTap's own closure would
  // still read the old (false) value if this called it the normal way,
  // re-opening the gate right back up.
  function resolveClockGate(clockedIn: boolean) {
    if (clockedIn) setMyClockedInToday(true)
    setClockGateDismissed(true)
    setClockGateOpen(false)
    recordTap(pendingTapItemRef.current, true, pendingTapQtyRef.current, pendingTapPriceRef.current)
  }

  // Fires when GmcOverageGateModal resolves. Unlike resolveClockGate, this
  // isn't a "dismissed for the session" flag -- "Continue anyway" only
  // bypasses THIS one retry (bypassOverageGate=true on the single re-
  // invocation below), so the very next tap attempt on the same chain
  // checks liveGmcOpenOverage again and can show it right back up.
  // bypassGate=true here is safe, not a shortcut around the clock-in gate:
  // this modal can only ever open after that one already resolved (see
  // recordTap's check order), so the retry is just re-affirming that.
  function resolveOverageGate(action: 'continue' | 'count' | 'gmc') {
    setGmcOverageGate(null)
    if (action === 'continue') {
      recordTap(pendingTapItemRef.current, true, pendingTapQtyRef.current, pendingTapPriceRef.current, true)
    } else if (action === 'count') {
      pickCountMode()
    } else {
      setLiveSaleType('GMC')
      jumpToLiveSaleTab('sale')
    }
  }

  async function recordTap(item?: LiveItem, bypassGate = false, overrideQty?: string, overridePrice?: string, bypassOverageGate = false) {
    if (!session) {
      showToast('You must be logged in to record a sale', 'error')
      return
    }
    if (!bypassGate && !clockGateDismissed && myClockedInToday === false) {
      pendingTapItemRef.current = item
      pendingTapQtyRef.current = overrideQty
      pendingTapPriceRef.current = overridePrice
      setClockGateOpen(true)
      return
    }
    // Covers all three chain roles in one lookup: the target itself
    // (gmc_type 'gmc'), a pack_to_gmc item about to credit it, or a
    // service_using_gmc item about to draw it down -- both of the latter
    // carry converts_to_item_id pointing at the same target (same
    // resolution itemAttentionFlags already uses for the card badge).
    const gateItem = item || liveSelectedItem
    if (!bypassOverageGate && gateItem) {
      const targetId = gateItem.gmc_type === 'gmc' ? gateItem.id : (gateItem.converts_to_item_id ?? null)
      const overage = targetId != null ? liveGmcOpenOverage.get(targetId) : undefined
      if (overage) {
        pendingTapItemRef.current = item
        pendingTapQtyRef.current = overrideQty
        pendingTapPriceRef.current = overridePrice
        setGmcOverageGate({
          itemName: gateItem.name,
          targetName: gateItem.gmc_type === 'gmc' ? gateItem.name : (gateItem.converts_to_name ?? 'the target'),
          given: overage.given, used: overage.used, exhaustedOnDate: overage.exhaustedOnDate,
        })
        return
      }
    }
    addTapStatus('STARTED - checking item & quantity')
    const tapItem = item || liveSelectedItem
    const qtyStr = overrideQty ?? liveQty
    if (!tapItem || !qtyStr) {
      const missing = !tapItem ? 'item' : 'quantity'
      addTapStatus(`ERROR: Missing ${missing}`)
      showToast(`Missing: ${missing}`, 'error')
      return
    }
    addTapStatus(`✓ Item: ${tapItem.name}, Qty: ${qtyStr}`)
    setLiveSaving(true)
    setLiveTapError('')

    const qtyNum = Number(qtyStr)
    const priceStr = overridePrice ?? livePrice
    const priceNum = priceStr ? Number(priceStr) : Number(tapItem.selling_price)

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

    const cidValue = inlineCidRef.current ?? liveCID
    const labelText = (inlineCidRef.current !== null ? curLabelRef.current : (liveLabelByKey.main ?? '')).trim()
    // Every Live Sale must say who it is for: a customer (GM number, phone or name) or a label.
    if (liveSaleType !== 'GMC' && !cidValue && !labelText) {
      const msg = 'Say who this sale is for: a customer (GM number, phone or name) or a label such as "Man on motor" or "Policeman".'
      setLiveTapError(msg); showToast(msg, 'error'); setLiveSaving(false)
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
          customPrice: priceStr ? priceNum : undefined,
          isGMC: liveSaleType === 'GMC',
          tapTime: tapTimeOverrideRef.current ?? (liveTapTimeTouched ? liveTapTime : undefined),
          // The GM box takes either a customer ID (e.g. 123) or a phone number: exactly 10 digits
          // starting with 0. A phone number texts the customer what they bought.
          customerIdCode: cidValue && !/^0\d{9}$/.test(cidValue) ? `GM${cidValue}` : undefined,
          customerPhone: /^0\d{9}$/.test(cidValue) ? cidValue : undefined,
          customerName: /^0\d{9}$/.test(cidValue) && custNameRef.current ? custNameRef.current : undefined,
          customerLabel: !cidValue && labelText ? labelText : undefined,
          requireWho: liveSaleType !== 'GMC' && features.live_who ? true : undefined,
          skipWhatsapp: skipWaRef.current || undefined,
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

      if (data.debugDuration) {
        const dd = data.debugDuration
        addTapStatus(`Duration: ${dd.itemName} (type=${dd.productType}) qty=${dd.qty} → ${dd.estimatedDurationSeconds}s`)
      }
      addTapStatus(`✓✓✓ SUCCESS - Tap recorded!`)
      setLiveTaps(prev => [data.tap, ...prev])
      if (!item) setLiveSelectedItem(null)
      setLiveQty('')
      setLivePrice('')
      setLiveCID('')
      setLiveLabelByKey(prev => (prev.main ? { ...prev, main: '' } : prev))
      setTimeout(() => setLiveTapStatus([]), 2000)
      showToast(`✓ ${tapItem.name} × ${qtyNum} recorded`, 'success')
      setTimeout(() => showToast(nextAfterSaleHint(), 'info'), 1500)
      lastBuyerIdRef.current = typeof data.buyerId === 'number' ? data.buyerId : null
      lastTapIdRef.current = typeof data.tap?.id === 'number' ? data.tap.id : null
      if (data.whatsappUrl) setWaPrompt({ url: data.whatsappUrl, label: 'purchase message', buyerIds: typeof data.buyerId === 'number' ? [data.buyerId] : undefined })

      {
        const sohAfter = Number(data.tap?.soh)
        if (liveSaleType !== 'GMC' && tapItem.product_type !== 'service' && Number.isFinite(sohAfter) && sohAfter < -0.001) setNegPrompt({ name: tapItem.name, soh: sohAfter })
      }

      // Offer to mark this specific draw as a property -- only makes sense
      // for a real GMC stock draw of a physical good, not a service tap.
      if (liveSaleType === 'GMC' && tapItem.product_type !== 'service' && data.tap?.id) {
        setGmcPropertyPrompt({ tapId: data.tap.id, itemId: tapItem.id, itemName: tapItem.name, amount: priceNum * qtyNum })
      }

      // Check if target GMC item SOH reached 0
      if (data.targetSohAfterReduction !== undefined && data.targetSohAfterReduction !== null) {
        const gmcItemName = data.targetItemName || tapItem.name
        if (Math.abs(data.targetSohAfterReduction) < 0.001) {
          showToast(`⚠ Stock depleted! Restock "${gmcItemName}" now`, 'error')
        } else if (data.targetSohAfterReduction < 5) {
          showToast(`⚠ Low stock: "${gmcItemName}" (${data.targetSohAfterReduction} left)`, 'info')
        }
      }

      // Only the modal-driven tap (Qty/Price typed into the sheet) gets this
      // extra blocking confirmation on top of the toast above -- a card
      // tapped straight from the grid is meant to be a single quick action,
      // and a native "OK" dialog on every sale would defeat that.
      if (overrideQty === undefined) alert(`✓ Tap Recorded!\n${tapItem.name} × ${qtyNum}`)
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

  // The card's own Qty/Price boxes (Live tab, default view) -- tap the
  // checkmark to record straight from the grid, no sheet needed. Reuses
  // recordTap's existing guards (clock-in gate, qty/price validation, count-
  // overdue block from the API) so this isn't a second, divergent code path.
  // MI: put the card's item (with its quantity and price) in the basket instead of recording it at once.
  function addToBasket(item: LiveItem) {
    const qty = liveInlineQtyByItemId[item.id] ?? '1'
    const price = liveInlinePriceByItemId[item.id] ?? formatPrice(item.selling_price)
    setMiLines(prev => {
      const at = prev.findIndex(l => l.itemId === item.id)
      if (at >= 0) return prev.map((l, i) => i === at ? { ...l, qty: String((Number(l.qty) || 0) + (Number(qty) || 1)), price } : l)
      return [...prev, { itemId: item.id, name: item.name, qty: qty || '1', price }]
    })
    setLiveInlineQtyByItemId(prev => { if (!(item.id in prev)) return prev; const next = { ...prev }; delete next[item.id]; return next })
    setLiveInlinePriceByItemId(prev => { if (!(item.id in prev)) return prev; const next = { ...prev }; delete next[item.id]; return next })
    setJustTappedItemIds(prev => new Set(prev).add(item.id))
    setTimeout(() => setJustTappedItemIds(prev => { const next = new Set(prev); next.delete(item.id); return next }), 900)
  }

  // MI: record every basket item for the customer, then issue ONE receipt for them.
  async function miComplete() {
    if (!miLines.length || miBusy) return
    if (!miCustomer) { setMiError('Enter the customer first (GM number, phone number or name).'); return }
    setMiBusy(true); setMiError('')
    // A new phone number needs a name (or the full registration) first, otherwise there is no customer to issue the receipt to.
    if (/^0\d{9}$/.test(miCustomer) && !custNameRef.current.trim()) {
      try {
        const r = await fetch(`/api/customers/search?phone=${miCustomer}`)
        const d = await r.json()
        if (r.ok && Array.isArray(d) && d.length === 0) {
          setMiError('This number is not a saved customer. Type their name in the box that drops down (or use Full registration), or clear the number to record without a receipt.')
          setMiBusy(false)
          return
        }
      } catch { /* let the sale go ahead; the receipt step will say if something is missing */ }
    }
    const today = new Date().toISOString().slice(0, 10)
    tapTimeOverrideRef.current = miDate !== today ? `${miDate}T${new Date().toISOString().slice(11, 16)}` : null
    const tapIds: number[] = []
    const doneItemIds: number[] = []
    let failedName = ''
    for (const l of miLines) {
      const item = liveAllItems.find(i => i.id === l.itemId)
      if (!item) { failedName = l.name; break }
      inlineCidRef.current = miCustomer
      skipWaRef.current = true
      lastTapIdRef.current = null
      try { await recordTap(item, false, l.qty, l.price) } finally { inlineCidRef.current = null; skipWaRef.current = false }
      if (lastTapIdRef.current == null) { failedName = l.name; break }
      tapIds.push(lastTapIdRef.current)
      doneItemIds.push(l.itemId)
    }
    tapTimeOverrideRef.current = null
    // Items already recorded leave the basket; any that failed stay so it can be tried again.
    if (doneItemIds.length) setMiLines(prev => prev.filter(l => !doneItemIds.includes(l.itemId)))
    if (failedName) setMiError(`"${failedName}" was not recorded (see the message above). The items before it were saved; fix it and press the button again.`)
    if (tapIds.length && miCustomer && !failedName) {
      try {
        const r = await fetch('/api/sales/live-receipt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tapIds }) })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error ?? 'Could not issue the receipt')
        showToast(`Receipt ${d.invoiceNumber} issued · ₵${Number(d.total).toFixed(2)}`, 'success')
        setWaPrompt({ url: d.whatsappUrl ?? '', label: `receipt ${d.invoiceNumber}`, printUrl: d.printUrl, invoiceId: d.invoiceId })
        setMiCustomer(''); custNameRef.current = ''
      } catch (e) { setMiError(`The items were recorded, but the receipt was not issued: ${(e as Error).message}`) }
    } else if (tapIds.length && !failedName) {
      showToast(`${tapIds.length} item${tapIds.length === 1 ? '' : 's'} recorded (no customer, so no receipt)`, 'success')
    }
    setMiBusy(false)
  }

  async function recordInlineTap(item: LiveItem) {
    if (!session) {
      showToast('You must be logged in to record a sale', 'error')
      return
    }
    if (miOn && liveSaleType !== 'GMC') { addToBasket(item); return }
    // A customer buying several items: when the clicked card has a GM entry, every item card that has
    // a GM entry is recorded together (each with its own quantity and price), and the customer gets
    // ONE WhatsApp message for all of them. Without a GM entry it records just this card, as before.
    const clickedCid = liveInlineCIDByItemId[item.id] ?? ''
    const targets: LiveItem[] = clickedCid
      ? Object.entries(liveInlineCIDByItemId).filter(([, v]) => v).map(([id]) => (id === String(item.id) ? item : liveAllItems.find(i => i.id === Number(id)))).filter((i): i is LiveItem => !!i)
      : [item]
    if (!targets.some(t => t.id === item.id)) targets.unshift(item)
    const batch = targets.length > 1
    const buyerIds: number[] = []
    const doneIds: number[] = []
    for (const t of targets) {
      const qty = liveInlineQtyByItemId[t.id] ?? '1'
      if (!qty) continue
      const price = liveInlinePriceByItemId[t.id] ?? formatPrice(t.selling_price)
      const cidNum = liveInlineCIDByItemId[t.id] ?? ''
      setLiveCID(cidNum)
      inlineCidRef.current = cidNum
      curLabelRef.current = cidNum ? '' : (liveLabelByKey[String(t.id)] ?? '')
      skipWaRef.current = batch
      lastBuyerIdRef.current = null
      try { await recordTap(t, false, qty, price) } finally { inlineCidRef.current = null; curLabelRef.current = ''; skipWaRef.current = false }
      if (lastBuyerIdRef.current != null) buyerIds.push(lastBuyerIdRef.current)
      doneIds.push(t.id)
      // Clear inline state for this item
      setLiveInlineQtyByItemId(prev => { if (!(t.id in prev)) return prev; const next = { ...prev }; delete next[t.id]; return next })
      setLiveInlinePriceByItemId(prev => { if (!(t.id in prev)) return prev; const next = { ...prev }; delete next[t.id]; return next })
      setLiveInlineCIDByItemId(prev => { if (!(t.id in prev)) return prev; const next = { ...prev }; delete next[t.id]; return next })
      setLiveLabelByKey(prev => (prev[String(t.id)] ? { ...prev, [String(t.id)]: '' } : prev))
    }
    setLiveCID('')
    if (batch && buyerIds.length) {
      try {
        const r = await fetch(`/api/sales/buyers/whatsapp?ids=${buyerIds.join(',')}`)
        const d = await r.json()
        if (r.ok && d.url) setWaPrompt({ url: d.url, label: `purchase message (${buyerIds.length} items)`, buyerIds })
      } catch { /* the Sales Log can send it later */ }
    }

    // Show green checkmark briefly after successful tap
    setJustTappedItemIds(prev => { const next = new Set(prev); doneIds.forEach(id => next.add(id)); return next })
    setTimeout(() => {
      setJustTappedItemIds(prev => {
        const next = new Set(prev)
        doneIds.forEach(id => next.delete(id))
        return next
      })
    }, 1500)
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
          tapTime: liveTapTimeTouched ? liveTapTime : undefined,
        }),
      })

      const tapData = await tapRes.json()
      if (!tapRes.ok) {
        setLiveTapError(tapData.error || 'Failed to record sale')
        showToast(tapData.error || 'Failed to record sale', 'error')
        setLiveGmcCountSaving(false)
        return
      }

      if (tapData.debugDuration) {
        const dd = tapData.debugDuration
        showToast(`Duration: ${dd.itemName} (type=${dd.productType}) qty=${dd.qty} → ${dd.estimatedDurationSeconds}s`, 'info')
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

  async function saveEditingFullTap() {
    if (!liveEditingFullTapId || liveEditingFullTapId === -1) return
    setLiveEditingFullTapSaving(true)
    try {
      const tapDateTime = liveEditingFullTapForm.tappedAt ? new Date(liveEditingFullTapForm.tappedAt + ':00Z').toISOString() : null
      const res = await fetch(`/api/sales/live-taps/${liveEditingFullTapId}?action=update-full`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: liveEditingFullTapForm.quantity ? Number(liveEditingFullTapForm.quantity) : null,
          customPrice: liveEditingFullTapForm.customPrice ? Number(liveEditingFullTapForm.customPrice) : null,
          tappedAt: tapDateTime
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setLiveTaps(prev => prev.map(t => t.id === liveEditingFullTapId ? { ...t, ...data.tap } : t))
        setLiveEditingFullTapId(null)
        setLiveEditingCurrentDate(null)
        setLiveEditingFullTapForm({ quantity: '', customPrice: '', tappedAt: '' })
        showToast(data.message || 'Log entry updated', 'success')
      } else {
        const errData = await res.json()
        showToast(errData.error || 'Could not save log entry', 'error')
      }
    } catch (e) {
      showToast('Could not save log entry', 'error')
    } finally {
      setLiveEditingFullTapSaving(false)
    }
  }

  async function createNewLogEntry() {
    if (!liveNewEntryForm.itemId || !liveNewEntryForm.quantity || !liveNewEntryForm.customPrice || !liveNewEntryForm.tappedAt) {
      showToast('Please fill in all fields', 'error')
      return
    }
    setLiveNewEntrySaving(true)
    try {
      const tapDateTime = new Date(liveNewEntryForm.tappedAt + ':00Z').toISOString()
      const res = await fetch('/api/sales/live-tap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: Number(liveNewEntryForm.itemId),
          quantity: Number(liveNewEntryForm.quantity),
          customPrice: Number(liveNewEntryForm.customPrice),
          isGMC: liveNewEntryForm.isGMC,
          tapTime: liveNewEntryForm.tappedAt
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setLiveTaps(prev => [data.tap, ...prev])
        setLiveNewEntryOpen(false)
        setLiveNewEntryForm({ itemId: '', quantity: '', customPrice: '', tappedAt: '', isGMC: false })
        showToast(`Added: ${data.tap.item_name}`, 'success')
      } else {
        const errData = await res.json()
        showToast(errData.error || 'Could not create log entry', 'error')
      }
    } catch (e) {
      showToast('Could not create log entry', 'error')
    } finally {
      setLiveNewEntrySaving(false)
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
        void loadLiveItems(1) // cards show the new stock on hand straight away
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

  // The Count Due chart's own per-row qty box (see renderCountDueChart) --
  // thin wrapper around submitCount so the row's onKeyDown/onClick share one
  // validation path. Doesn't clear liveInlineCountQtyByItemId itself: on
  // success the item drops out of liveDailyItems/liveGmcWeeklyItems/
  // liveOverdueItems (see submitCount above), so the whole row -- and its
  // input -- disappears anyway; on failure (a pack-pairing/loss-reason
  // prompt, or a plain error) the typed value is exactly what should stay
  // on screen, not get silently wiped.
  function recordInlineCount(item: LiveItem) {
    const raw = liveInlineCountQtyByItemId[item.id]
    const qty = Number(raw)
    if (!raw || isNaN(qty)) return
    submitCount(item, qty)
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
        derived_from_item_id: d?.derived_from_item_id ? String(d.derived_from_item_id) : '',
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
        derived_from_item_id: d?.derived_from_item_id ? String(d.derived_from_item_id) : '',
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
      void loadLiveItems(1)
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
    void loadLiveItems(1)
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
      void loadLiveItems(1)
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
      void loadLiveItems(1)
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
    void loadLiveItems(1)
    setLiveEditingGridItemId(null)
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
  // P&L/CAB (own buttons below) replace this whole tab row's content with
  // their own full-screen report by switching lossView away from
  // 'items'/'sales' entirely -- stepping back to any of the modes below
  // from there needs to undo that (lossView otherwise never returns to
  // 'items'/'sales' on its own), or the tab row would stay lit up on the
  // clicked button while the content underneath keeps showing the P&L/CAB
  // report instead. A no-op when already on 'items'/'sales'.
  function pickItemsMode(mode: 'sale' | 'sales' | 'bills' | 'log' | 'expenses' | 'manage' | 'advert' | 'gronyChecks') {
    if (lossView === 'pl' || lossView === 'cab' || lossView === 'customers') pickLossView('sales')
    // Same problem, Count's own flavor -- inCountTab's three full-page
    // states (see its own comment above) don't clear themselves either, so
    // leaving the Count tab needs to undo them explicitly too or the grid
    // stays hidden underneath whichever button just lit up.
    if (inCountTab) {
      setLiveShowCountFullPage(false)
      setLiveSaleView(null)
      setLiveSaleViolationFilter('noViolations')
    }
    // 'sales' (Sales Rec / Summary) is retired -- the Sales Log replaces it.
    const m = mode === 'sales' ? 'log' : mode
    setItemsPageMode(m)
    setLiveMode(m)
  }

  // Landing view for Count mode -- straight to the Count Due list (the
  // Records list and its own Records/History/Intervals sub-nav were
  // retired; the full history/edit list now lives on its own sidebar page,
  // lossView 'counts', CountsTab.tsx). Used by the Critical bar's Count Due
  // radio and the GMC overage gate's "Go to Count" button -- Negative SOH
  // overrides the view kind right after calling this, same shared setup
  // (lossView/itemsPageMode/liveMode) either way.
  function pickCountMode() {
    if (lossView === 'pl' || lossView === 'cab' || lossView === 'customers') pickLossView('sales')
    setItemsPageMode('sale')
    setLiveMode('sale')
    setLiveSaleViolationFilter('countDue')
    setLiveShowCountFullPage(false)
    setLiveSaleView({ kind: 'count_due_chart' })
    setLiveCountView(null)
  }

  // "Critical, Do Now" bar -- a permanent shortcut, shown above the staff
  // bar/tab switcher, into the two things worth interrupting a shift for: a
  // physical count that's overdue, or stock that's gone negative. Count Due
  // and Negative SOH are each their own full page now -- no shared sub-nav
  // between them and no way to embed one inside the other, so picking
  // either here is the only way in besides the GMC overage gate's own
  // "Go to Count" button (which lands on Count Due the same way).
  // Every flag on Live Sale in one list (the 🚩 Flags dropdown): the ones that open the item grid, plus the data flags that open
  // their own fix view. Same counts the old radio row and Critical bar used.
  const aliasFlagKeys = ['alias_prezoho_sales', 'alias_prezoho_bills', 'alias_prezoho_receipts', 'alias_flagged', 'alias_ambiguous', 'alias_name_conflicts']
  const liveSaleFlagList: { value: string; key: string; label: string; n: number }[] = [
    { value: 'sale:noSp', key: 'noSp', label: 'No Selling Price', n: liveNoSpCount },
    { value: 'sale:noCp', key: 'noCp', label: 'No Cost Price', n: liveNoCpCount },
    { value: 'sale:noGroup', key: 'noGroup', label: 'No Group', n: violationCounts.no_group || 0 },
    { value: 'sale:emptyRow', key: 'emptyRow', label: 'Empty Row', n: liveEmptyRowCount },
    { value: 'sale:duplicates', key: 'duplicates', label: 'Duplicate Items', n: liveDuplicateCount },
    { value: 'sale:unlinked', key: 'unlinked', label: 'Unlinked Sales', n: liveUnlinkedCount },
    { value: 'sale:service', key: 'service', label: 'Service Violations', n: liveServiceViolationCount },
    { value: 'sale:unknownQty', key: 'unknownQty', label: 'Unknown Quantity', n: liveUnknownQtyCount },
    { value: 'sale:gmcOverage', key: 'gmcOverage', label: 'GMC Pack Overage', n: liveGmcOverageCount },
    { value: 'sale:netGain', key: 'netGain', label: 'Net Gain', n: liveNetGainCount },
    { value: 'sale:needsReview', key: 'needsReview', label: 'Needs Review', n: liveNeedsReviewCount },
    { value: 'sale:lowConfidenceAlias', key: 'lowConfidenceAlias', label: 'Alias Needs Check', n: liveLowConfidenceAliasCount },
    { value: 'sale:prezohoNotes', key: 'prezohoNotes', label: 'Ledger Notes', n: livePrezohoNotesCount },
    { value: 'violation:neg_soh', key: 'neg_soh', label: 'Negative Stock', n: (liveItemsWithViolations as Record<string, number[]>)['neg_soh']?.length ?? 0 },
    ...ITEMS_FLAG_TYPES.filter(f => aliasFlagKeys.includes(f.key)).map(f => ({ value: `violation:${f.key}`, key: f.key, label: f.label, n: (liveItemsWithViolations as Record<string, number[]>)[f.key]?.length ?? 0 })),
  ]
  const liveSaleFlagTotal = liveSaleFlagList.reduce((a, f) => a + f.n, 0)
  const activeFlagValue = itemsPageMode === 'sale' && liveSaleFlagList.some(f => f.value === `sale:${liveSaleViolationFilter}`) ? `sale:${liveSaleViolationFilter}`
    : liveCurrentView?.kind === 'violation' && liveSaleFlagList.some(f => f.value === `violation:${liveCurrentView.key}`) ? `violation:${liveCurrentView.key}` : ''
  function pickLiveFlag(v: string) {
    setLiveSaleFilter(null); setLiveGmcTypeFilter(null)
    if (!v) { setLiveCurrentView(null); pickSaleFilter('noViolations'); return }
    if (v.startsWith('sale:')) { setLiveCurrentView(null); pickSaleFilter(v.slice(5) as typeof liveSaleViolationFilter); return }
    setLiveCurrentView({ kind: 'violation' as const, key: v.slice('violation:'.length) })
  }
  function renderCriticalBar(only?: 'counts' | 'items' | 'receipts' | 'bills') {
    const show = (k: 'counts' | 'items' | 'receipts' | 'bills') => !only || only === k
    const violationButton = (label: string, count: number, onClick: () => void, textColor: string = 'text-gray-700') => {
      if (count <= 0) return null
      return (
        <button onClick={onClick}
          className={`${textColor} hover:underline whitespace-nowrap shrink-0 text-[9px] font-medium`}>
          {label}({count})
        </button>
      )
    }

    const divider = <span className="text-red-300 shrink-0">·</span>
    if (only === 'items' && !(liveEmptyRowCount > 0 || liveNoSpCount > 0 || liveNoCpCount > 0 || violationCounts.no_group > 0)) return null
    if (only === 'receipts' && !((violationCounts.no_cash || violationCounts.missing_days || violationCounts.dup_receipt || violationCounts.no_attachment || violationCounts.high_wnw) > 0)) return null
    if (only === 'bills' && !(violationCounts.no_vendor || violationCounts.no_items_bills || violationCounts.bill_total_mismatch || violationCounts.bill_no_attachment || violationCounts.bill_no_expense || violationCounts.vcp_jump)) return null

    return (
      <div className="flex items-center gap-1 px-2 py-0.5 bg-red-50 border-b border-red-200 text-[9px] whitespace-nowrap overflow-x-auto">
        <span className="font-extrabold text-red-700 uppercase tracking-wide shrink-0">{only ? 'Flags' : 'Critical, Do Now'}</span>
        {show('counts') && (<>
        {divider}
        <label className="flex items-center gap-0.5 cursor-pointer hover:underline whitespace-nowrap text-gray-700 shrink-0">
          <input type="radio" name="criticalBar" checked={inCountTab && liveSaleView?.kind === 'count_due_chart'}
            onChange={goCountMode}
            className="cursor-pointer w-3 h-3" />
          <span>Count Due{liveCountStatus.size > 0 && ` (${liveCountStatus.size})`}</span>
        </label>
        {liveNegSohCount > 0 && (<>{divider}
        <label className="flex items-center gap-0.5 cursor-pointer hover:underline whitespace-nowrap text-red-700 font-semibold shrink-0">
          <input type="radio" name="criticalBar" checked={inCountTab && liveSaleView?.kind === 'negative_soh_chart'}
            onChange={() => { goCountMode(); setLiveSaleViolationFilter('negSoh'); setLiveSaleView({ kind: 'negative_soh_chart' }) }}
            className="cursor-pointer w-3 h-3" />
          <span>Negative SOH ({liveNegSohCount})</span>
        </label></>)}
        </>)}

        {/* Items violations */}
        {show('items') && (liveEmptyRowCount > 0 || liveNoSpCount > 0 || liveNoCpCount > 0 || violationCounts.no_group > 0) && (
          <>
            {divider}
            <span className="text-gray-600 font-semibold shrink-0">Items;</span>
            {violationButton('Empty Row', liveEmptyRowCount, () => pickSaleFilter('emptyRow'), 'text-orange-600')}
            {violationButton('No SP', liveNoSpCount, () => pickSaleFilter('noSp'), 'text-orange-600')}
            {violationButton('No CP', liveNoCpCount, () => pickSaleFilter('noCp'), 'text-orange-600')}
            {violationButton('No Group', violationCounts.no_group || 0, () => pickSaleFilter('noGroup'), 'text-orange-600')}
          </>
        )}

        {/* Receipts violations */}
        {show('receipts') && (violationCounts.no_cash || violationCounts.missing_days || violationCounts.dup_receipt || violationCounts.no_attachment || violationCounts.high_wnw) > 0 && (
          <>
            {divider}
            <span className="text-gray-600 font-semibold shrink-0">Receipts;</span>
            {violationButton('No Cash', violationCounts.no_cash || 0, () => pickSalesView('no_cash'), 'text-orange-600')}
            {violationButton('Missing Days', violationCounts.missing_days || 0, () => pickSalesView('missing_days'), 'text-orange-600')}
            {violationButton('Dup Receipt', violationCounts.dup_receipt || 0, () => pickSalesView('dup_receipt'), 'text-orange-600')}
            {violationButton('No Attachment', violationCounts.no_attachment || 0, () => pickSalesView('no_attachment'), 'text-orange-600')}
            {violationButton('High WNW', violationCounts.high_wnw || 0, () => pickSalesView('high_wnw'), 'text-red-600')}
          </>
        )}

        {/* Bills violations */}
        {show('bills') && (violationCounts.no_vendor || violationCounts.no_items_bills || violationCounts.bill_total_mismatch || violationCounts.bill_no_attachment || violationCounts.bill_no_expense || violationCounts.vcp_jump) > 0 && (
          <>
            {divider}
            <span className="text-gray-600 font-semibold shrink-0">Bills;</span>
            {violationButton('No Vendor', violationCounts.no_vendor || 0, () => jumpToLiveSaleTab('bills', 'no_vendor'), 'text-orange-600')}
            {violationButton('No Items', violationCounts.no_items_bills || 0, () => jumpToLiveSaleTab('bills', 'no_items_bills'), 'text-orange-600')}
            {violationButton('Total Mismatch', violationCounts.bill_total_mismatch || 0, () => jumpToLiveSaleTab('bills', 'bill_total_mismatch'), 'text-orange-600')}
            {violationButton('No Attachment', violationCounts.bill_no_attachment || 0, () => jumpToLiveSaleTab('bills', 'bill_no_attachment'), 'text-orange-600')}
            {violationButton('No Expense', violationCounts.bill_no_expense || 0, () => jumpToLiveSaleTab('bills', 'bill_no_expense'), 'text-orange-600')}
            {violationButton('VCP Jump', violationCounts.vcp_jump || 0, () => jumpToLiveSaleTab('bills', 'vcp_jump'), 'text-red-600')}
          </>
        )}
      </div>
    )
  }

  // Flags now sit on the tab they belong to instead of one bar at the top of
  // every page.
  function renderSectionFlags() {
    if (outerTab !== 'loss' || !showFlags) return null
    let section: 'counts' | 'items' | 'receipts' | 'bills' | null = null
    if (lossView === 'counts' || inCountTab) section = 'counts'
    else if (lossView === 'items' || lossView === 'sales') {
      if (itemsPageMode === 'bills') section = 'bills'
      else if (itemsPageMode === 'sales') section = 'receipts'
      // Live Sale's flags are all in its 🚩 Flags dropdown (see renderFlagHelp), so no separate bar for them.
    }
    return section ? renderCriticalBar(section) : null
  }

  // Analytics row -- decision-making metrics organized by tab. Currently
  // contains Sales analytics (Least Sales charts for Services/Goods/Groups,
  // Longest Unbought). Separate from the violation/filter row to keep
  // decision tools distinct from action-required flags.
  function renderAnalyticsRow() {
    return (
      <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 border-b border-blue-200 text-[9px] whitespace-nowrap overflow-x-auto">
        <span className="font-extrabold text-blue-700 uppercase tracking-wide shrink-0">Analytics</span>
        <span className="text-blue-300 shrink-0">·</span>
        <span className="text-gray-600 font-semibold shrink-0">Sales;</span>
        <label className="flex items-center gap-0.5 cursor-pointer hover:underline whitespace-nowrap text-gray-700 shrink-0">
          <input type="radio" name="analyticsRow" checked={itemsPageMode === 'sale' && liveSaleViolationFilter === 'leastSalesServices'} onChange={() => pickSaleFilter('leastSalesServices', { kind: 'least_sales_services' })} className="cursor-pointer w-3 h-3" />
          <span>Services: Least Sales</span>
        </label>
        <span className="text-blue-300 shrink-0">·</span>
        <label className="flex items-center gap-0.5 cursor-pointer hover:underline whitespace-nowrap text-gray-700 shrink-0">
          <input type="radio" name="analyticsRow" checked={itemsPageMode === 'sale' && liveSaleViolationFilter === 'leastSalesGoods'} onChange={() => pickSaleFilter('leastSalesGoods', { kind: 'least_sales_goods' })} className="cursor-pointer w-3 h-3" />
          <span>Goods: Least Sales</span>
        </label>
        <span className="text-blue-300 shrink-0">·</span>
        <label className="flex items-center gap-0.5 cursor-pointer hover:underline whitespace-nowrap text-gray-700 shrink-0">
          <input type="radio" name="analyticsRow" checked={itemsPageMode === 'sale' && liveSaleViolationFilter === 'leastSalesGroups'} onChange={() => pickSaleFilter('leastSalesGroups', { kind: 'least_sales_groups' })} className="cursor-pointer w-3 h-3" />
          <span>Groups: Least Sales</span>
        </label>
        <span className="text-blue-300 shrink-0">·</span>
        <label className="flex items-center gap-0.5 cursor-pointer hover:underline whitespace-nowrap text-gray-700 shrink-0">
          <input type="radio" name="analyticsRow" checked={itemsPageMode === 'sale' && liveSaleViolationFilter === 'leastPurchased'} onChange={() => pickSaleFilter('leastPurchased', { kind: 'least_purchased' })} className="cursor-pointer w-3 h-3" />
          <span>Goods: Longest Unbought</span>
        </label>
      </div>
    )
  }

  // Sale mode's own violation-filter radios (Live/Least Sales/Duplicates/
  // etc, further down) now share their row with Log/Receipts -- picking one
  // of these needs to also jump back to the grid itself (itemsPageMode
  // 'sale') in case Log/Receipts was showing, or the row would light up on
  // a filter whose grid isn't the one actually on screen.
  function pickSaleFilter(filter: typeof liveSaleViolationFilter, view: typeof liveSaleView = null) {
    setItemsPageMode('sale')
    setLiveMode('sale')
    setLiveSaleViolationFilter(filter)
    setLiveShowCountFullPage(false)
    setLiveSaleView(view)
  }

  // Receipts' own radios -- its violations (No Cash/Missing Days/Dup
  // Receipt/High WNW/No Attachment/Sold Below Cost) and its RC History/RC
  // Bars Only/RC WIC/RC GMC view toggles -- used to live only in Receipts'
  // own dedicated rows, rendered here in the shared row instead. Same
  // reasoning as pickSaleFilter above: jump to itemsPageMode 'sales'
  // (rather than 'sale') so the receipts list these actually affect is the
  // one on screen, then hand off to the existing selectLiveSalesRadio
  // (unchanged -- still the one source of truth for liveSalesRadioValue).
  function pickSalesView(_key: string) {
    // Summary (Sales Rec) is retired; its views now live in the Sales Log and its analytics.
    setItemsPageMode('log')
    setLiveMode('log')
  }

  // Always lands on the actual P&L report by default -- plSubView doesn't
  // reset itself just because lossView left 'pl' and came back (e.g. via
  // Manage then back to P&L), so without this a stale Loss by Date/Items/
  // Net Loss selection would silently keep showing instead.
  function pickPL() {
    pickLossView('pl')
    setPlSubView('pl')
  }

  // Sidebar rows for the Items hub's former top tabs. Each lands on the same
  // grid/mode the old tab switcher buttons did; from any other full-page
  // view (Vendors, Counts, P&L, ...) they first step back to the grid.
  function toGrid() {
    if (lossView !== 'items' && lossView !== 'sales') pickLossView('sales')
  }
  function goItemsMode(mode: 'sale' | 'log' | 'sales' | 'bills' | 'expenses' | 'manage' | 'advert' | 'gronyChecks') {
    toGrid()
    pickItemsMode(mode)
  }
  function goSaleFilter(filter: typeof liveSaleViolationFilter, view: typeof liveSaleView = null) {
    toGrid()
    pickSaleFilter(filter, view)
  }
  function goCountMode() {
    toGrid()
    pickCountMode()
  }
  function modeActive(mode: string) {
    return (lossView === 'items' || lossView === 'sales') && !inCountTab && itemsPageMode === mode
  }
  function goLossSubView(v: typeof plSubView) {
    pickLossView('pl')
    setPlSubView(v)
  }

  function renderTabSwitcher(compact: boolean) {
    // Each tab is its own standalone button (own background/border) rather
    // than a segment inside one shared pill -- an inactive tab used to be
    // just plain text sitting on the container's own gray-200 background,
    // which read as one continuous switch instead of separate buttons.
    const btnCls = (active: boolean, color: string) =>
      `font-bold rounded-md border transition whitespace-nowrap shrink-0 ${compact ? 'px-1.5 py-1 text-[10px]' : 'px-2 py-1 text-xs'} ${
        active ? `${color} text-white border-transparent` : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
      }`
    // itemsPageMode itself doesn't change when P&L/CAB/Customers take over
    // (see pickItemsMode above) -- without this, whichever mode was open
    // right before would stay lit up underneath the button that's actually
    // showing.
    const onItemsGrid = lossView !== 'pl' && lossView !== 'cab' && lossView !== 'customers'
    // Always one line -- scrolls horizontally rather than wrapping onto a
    // second row when there isn't room for all buttons.
    return (
      <div className="flex gap-6 overflow-x-auto max-w-full">
        {/* The sale screen is "Live". Bills, Expenses, CAB and Customers live in the
            left sidebar; Manage, Advert and Shop checks in the Shop's Manage tab. */}
        <button type="button" onClick={() => pickItemsMode('sale')} title="Live" className={btnCls(onItemsGrid && !inCountTab && (itemsPageMode === 'sale' || itemsPageMode === 'log' || itemsPageMode === 'sales'), 'bg-blue-600')}>Live</button>
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
        <span className={`font-semibold ${dark ? 'text-white/90' : 'text-gray-700'}`}>Counted today</span>
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

  // Expenses' Filter dropdown -- houses everything except the radios kept
  // standalone (All Expenses/By Account/By Vendor/By Property Type/All
  // Properties/Non-Properties and the four flag violations) and "+ New
  // Expense" (its own visible button next to Search, not buried here since a
  // dropdown is a bad discovery path for "create new"). Three kinds of
  // options share this one select: persistent views that plug straight into
  // the same liveExpensesRadioValue mutex (History/property splits -- shown
  // as "selected" when active), momentary triggers (Analytics/Accounts/Laws
  // & Tasks/Help) that just fire their own setter, and "columns" which opens
  // ColumnsPickerButton's panel via its controlled open/onOpenChange (that
  // component renders with hideTrigger, right below this select, so its
  // floating panel still anchors somewhere sensible without a second visible
  // trigger of its own).
  const EXPENSES_FILTER_BAR_KEYS = ['history', 'properties_available', 'properties_not_available', 'printers', 'computers']
  function renderExpensesFiltersBar() {
    return (
      <select
        value={EXPENSES_FILTER_BAR_KEYS.includes(liveExpensesRadioValue) ? liveExpensesRadioValue : ''}
        onChange={e => {
          const v = e.target.value
          if (v === 'analytics') { setLiveExpensesShowAnalytics(a => !a); return }
          if (v === 'accounts') { setLiveExpensesShowAccountsManager(true); return }
          if (v === 'columns') { setLiveExpensesColumnsOpen(true); return }
          if (v === 'help:guide') { openEmbed('/how-to'); return }
          selectLiveExpensesRadio(v || 'all')
        }}
        className="text-xs px-1.5 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white w-16 shrink-0"
      >
        <option value="">Filter</option>
        <option value="history">History</option>
        <option value="properties_available">Properties Available ({liveExpensesViewCounts.prop_available})</option>
        <option value="properties_not_available">Properties Not Available ({liveExpensesViewCounts.prop_not_available})</option>
        <option value="printers">Printers ({liveExpensesViewCounts.printers})</option>
        <option value="computers">Computers ({liveExpensesViewCounts.computers})</option>
        <option value="analytics">Analytics</option>
        <option value="accounts">Accounts</option>
        <option value="columns">Columns</option>
        <option value="help:guide">❓ Help</option>
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

  // Count Due as a chart-styled list rather than the usual card grid --
  // recharts can't host a real, tappable <input> per bar (it's all SVG), so
  // this builds the same visual language (a colored bar whose length shows
  // severity, tiered Critical/High/Watch) out of plain HTML instead, with a
  // real qty box beside each row for entering the count right there. Pulls
  // straight from liveCatalogueItems + liveCountStatus rather than
  // liveSortedCatalogueItems, since that memo's own 'countDue' branch only
  // keeps items already at 'overdue' level -- this wants every due item,
  // same as the "N items need counting" header already promises.
  function renderCountDueChart() {
    // An item already flagged Negative SOH gets counted through that list
    // instead (see renderNegativeSohChart) -- it needs a count regardless
    // of its due date, so showing it here too would just be the same
    // to-do twice under two different names.
    const scored = liveCatalogueItems
      .filter(item => liveCountStatus.has(item.id) && !liveNegSohIds.has(item.id))
      .map(item => {
        const status = liveCountStatus.get(item.id)!
        // Never-counted items (no baseline to measure a day count from) are
        // the worst case -- worse than any item merely N days overdue --
        // same ranking submitCount/scoreFns.count_status already use.
        const severity = status.days_overdue === null ? 2000 : (status.level === 'overdue' ? 1000 + status.days_overdue : status.days_overdue ?? 0)
        return { item, status, severity }
      })
      .sort((a, b) => b.severity - a.severity || a.item.name.localeCompare(b.item.name))

    if (scored.length === 0) {
      return <div className="flex-1 flex items-center justify-center text-xs text-gray-400 py-10">Nothing due for counting right now.</div>
    }

    const maxSeverity = Math.max(...scored.map(s => s.severity), 1)

    return (
      <div className="flex-1 overflow-y-auto">
        <div className="px-2 py-1 bg-gray-800 text-[9px] font-bold text-white uppercase tracking-wide">
          {scored.length} item{scored.length !== 1 ? 's' : ''} need{scored.length === 1 ? 's' : ''} counting
        </div>
        <div className="divide-y divide-gray-100">
          {scored.map(({ item, status, severity }, i) => {
            const pct = scored.length <= 1 ? 0 : i / (scored.length - 1)
            const tier: 'Critical' | 'High' | 'Watch' = pct < 1 / 3 ? 'Critical' : pct < 2 / 3 ? 'High' : 'Watch'
            const tierColor = tier === 'Critical' ? '#ef4444' : tier === 'High' ? '#f97316' : '#eab308'
            const barPct = Math.max(8, Math.round((severity / maxSeverity) * 100))
            let expectedLabel = 'Never counted'
            if (status.days_overdue !== null) {
              const d = new Date()
              if (status.days_overdue > 0) d.setDate(d.getDate() - status.days_overdue)
              expectedLabel = `Expected ${fmtDate(d.toISOString())}`
            }
            const lastCounted = liveLastCountDateByItemId.get(item.id)
            const qty = liveInlineCountQtyByItemId[item.id] ?? ''
            return (
              <div key={item.id} className="relative flex items-center gap-2 px-2 py-1.5">
                <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: tierColor }} />
                <div className="flex-1 min-w-0 pl-2">
                  <div className="flex items-center gap-1.5">
                    {renderClickableItemName(item.name, 'text-[11px] font-semibold truncate')}
                    <span className="shrink-0 text-[7px] font-extrabold uppercase tracking-wide px-1 py-0.5 rounded text-white" style={{ background: tierColor }}>{tier}</span>
                  </div>
                  <p className="text-[9px] text-gray-500 truncate">
                    {expectedLabel}
                    <span className="text-gray-400"> · </span>
                    {status.label}{status.level === 'overdue' ? ' overdue' : ''}
                    <span className="text-gray-400"> · </span>
                    Last ctd: {lastCounted ? fmtDate(lastCounted) : 'Never'}
                    <span className="text-gray-400"> · </span>
                    SOH: {Math.ceil(Number(item.soh))}
                  </p>
                  <div className="mt-1 h-1.5 w-full max-w-[160px] bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: tierColor }} />
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-1">
                  {/* One tap for the common case -- the physical count
                      matches what the system already expects, so there's no
                      loss/gain to explain. Submits that exact expected
                      figure through the same submitCount path as the manual
                      qty box, so a genuine mismatch still goes through the
                      usual loss-reason gate -- this is just a shortcut for
                      when there isn't one, not a bypass of it. */}
                  <button
                    type="button"
                    disabled={liveCountSaving}
                    onClick={() => submitCount(item, Math.ceil(Number(item.soh)))}
                    className="shrink-0 px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold whitespace-nowrap disabled:opacity-30"
                  >
                    Same as {Math.ceil(Number(item.soh))}, no loss
                  </button>
                  <input
                    type="number" inputMode="decimal" placeholder="Qty"
                    value={qty}
                    onChange={e => setLiveInlineCountQtyByItemId(prev => ({ ...prev, [item.id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') recordInlineCount(item) }}
                    className="w-14 text-[11px] font-semibold text-gray-900 text-right rounded-md border border-gray-300 px-1.5 py-1 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                  />
                  <button
                    type="button"
                    disabled={!qty || liveCountSaving}
                    onClick={() => recordInlineCount(item)}
                    aria-label={`Record count for ${item.name}`}
                    className="shrink-0 w-6 h-6 rounded-full bg-green-600 text-white text-[11px] font-bold flex items-center justify-center disabled:opacity-30"
                  >
                    ✓
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Same enter-a-count list Count Due uses (renderCountDueChart), for items
  // whose calculated stock has gone negative -- a data-integrity problem
  // that only a physical count can resolve, not just an overdue-cadence
  // one. Deliberately NO "Same as X, no loss" shortcut here: the system's
  // own figure is already known-wrong (negative), so there's no valid
  // "expected" number to one-tap match against -- whatever's actually on
  // the shelf has to be typed in.
  function renderNegativeSohChart() {
    const items = liveCatalogueItems.filter(item => liveNegSohIds.has(item.id))
    if (items.length === 0) {
      return <div className="flex-1 flex items-center justify-center text-xs text-gray-400 py-10">No items with negative stock right now.</div>
    }
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="px-2 py-1 bg-red-700 text-[9px] font-bold text-white uppercase tracking-wide">
          {items.length} item{items.length !== 1 ? 's' : ''} with negative stock -- count to correct
        </div>
        <div className="divide-y divide-gray-100">
          {items.map(item => {
            const qty = liveInlineCountQtyByItemId[item.id] ?? ''
            return (
              <div key={item.id} className="relative flex items-center gap-2 px-2 py-1.5">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600" />
                <div className="flex-1 min-w-0 pl-2">
                  {renderClickableItemName(item.name, 'text-[11px] font-semibold truncate')}
                  <p className="text-[9px] text-red-600 font-semibold">
                    System shows {Math.ceil(Number(item.soh))} -- count what's actually on the shelf.
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-1">
                  <input
                    type="number" inputMode="decimal" placeholder="Qty"
                    value={qty}
                    onChange={e => setLiveInlineCountQtyByItemId(prev => ({ ...prev, [item.id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') recordInlineCount(item) }}
                    className="w-14 text-[11px] font-semibold text-gray-900 text-right rounded-md border border-gray-300 px-1.5 py-1 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-200"
                  />
                  <button
                    type="button"
                    disabled={!qty || liveCountSaving}
                    onClick={() => recordInlineCount(item)}
                    aria-label={`Record count for ${item.name}`}
                    className="shrink-0 w-6 h-6 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center disabled:opacity-30"
                  >
                    ✓
                  </button>
                </div>
              </div>
            )
          })}
        </div>
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

  // netLossOnly narrows this same per-record loss list down to just the
  // items in liveNetLossIds (total counted losses outweigh total gains) --
  // Net Loss's own full-page view in the Count tab (see inCountTab), reusing
  // this table rather than building a separate summary one from scratch.
  function renderLossesByItemsTable(netLossOnly: boolean = false) {
    const COUNT_RECORDS_GRID = 'grid-cols-[minmax(7rem,1.4fr)_5rem_3rem_4rem_4rem_4rem_5rem_4rem_minmax(6rem,1fr)]'
    const groups = netLossOnly
      ? liveLossesByItem
          .map(([itemName, recs]) => [itemName, recs.filter(rec => rec.item_id != null && liveNetLossIds.has(rec.item_id))] as const)
          .filter(([, recs]) => recs.length > 0)
      : liveLossesByItem
    return (
      <div className="flex-1 overflow-auto">
        {groups.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            {liveCountRecords.length === 0 ? 'No counts recorded' : netLossOnly ? 'No items with a net loss' : 'No losses found'}
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
            {groups.map(([itemName, itemRecs]) => (
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

  // Cost >= Selling Price and Sold Below Cost both mean actual money lost on
  // every sale, not a data-hygiene issue -- unlike Duplicates/Empty Row/
  // Missing SP/Missing CP, which only create the conditions for a loss. So
  // they live in P&L's sub-nav (see plSubView) instead of the general Sales
  // violations row.
  function renderCostGteSpTable() {
    const GRID = 'grid-cols-[minmax(10rem,2fr)_minmax(6rem,1fr)_5rem_5rem]'
    const items = liveAllItems.filter(item => liveAcpGteSpIds.has(item.id))
    return (
      <div className="flex-1 overflow-auto">
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No items priced below cost</p>
        ) : (
          <div className="inline-block min-w-full">
            <div className={`grid ${GRID} gap-0 bg-gray-50 border-b border-gray-200 sticky top-0 z-10`}>
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase">Item</div>
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase">Group</div>
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase text-right">ACP</div>
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase text-right">SP</div>
            </div>
            {items.map(item => {
              const sp = parseFloat(String(item.selling_price)) || 0
              const acp = parseFloat(String(item.acp_price ?? item.cost_price)) || 0
              return (
                <div key={item.id} className={`grid ${GRID} gap-0 border-b border-gray-100 items-center hover:bg-gray-50 transition`}>
                  <div className="px-2 py-1">
                    <button type="button" onClick={() => openEditGridItem(item.id)} className="text-xs font-semibold text-gray-900 hover:underline truncate text-left">{item.name}</button>
                  </div>
                  <div className="px-2 py-1"><p className="text-xs text-gray-600 truncate">{item.group ?? '—'}</p></div>
                  <div className="px-2 py-1 text-right"><p className="text-xs font-bold text-red-600">₵{formatPrice(acp)}</p></div>
                  <div className="px-2 py-1 text-right"><p className="text-xs text-gray-900">₵{formatPrice(sp)}</p></div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Sold Below Cost is really about past sale lines (globalFlags.costGteSell),
  // not the item catalogue, so this reuses SalesTab's own violation filter
  // directly -- same component/props as the plain Sales tab call further
  // down, just with the violation fixed rather than driven by
  // liveSalesViolationFilter.
  function renderSoldBelowCostTable() {
    return (
      <div className="flex-1 overflow-auto">
        <SalesTab items={liveSalesBillsItems} groupFilter={liveGroupFilter} search={liveEmbeddedSearch}
          violation="sold_below_cost"
          jumpToDate={jumpToReceiptDate} jumpToItemName={jumpToReceiptItemName} jumpToReceiptId={jumpToReceiptId}
          onJumpDone={() => { setJumpToReceiptDate(null); setJumpToReceiptItemName(null); setJumpToReceiptId(null) }}
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
      netLoss: {
        title: '📉 Net Loss',
        description: 'Items whose total losses across all counts outweigh their total gains. This is not a violation to fix one-by-one — it\'s simply how the item\'s stock has trended overall, kept here as a view so it\'s easy to see which items are worth watching.',
        steps: []
      },
      netGain: {
        title: '🔺 Net Gain',
        description: 'Items whose total gains across all counts outweigh their total losses. Gains should never legitimately exceed losses — this points to a miscount, an unrecorded receipt, or a data entry error, and is the one case in this list that genuinely needs someone to look into it.',
        steps: [
          '1. Open the item and review its recent count history',
          '2. Compare counted quantity vs expected quantity on each date',
          '3. Look for a miscount, an unrecorded receipt, or a duplicate/incorrect entry',
          '4. Correct the record that caused the gain (a fresh count, or fixing the wrong one)',
          '5. The item drops off this list once its net gain is resolved'
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
      negSoh: {
        title: '🔻 Negative Stock',
        description: 'Items whose stock-on-hand has gone below zero, usually from a sale or bill being recorded against the wrong item, or a count that was never reconciled.',
        steps: [
          '1. Open the item and review recent sales/bills/counts',
          '2. Look for a sale or bill that should have gone against a different item',
          '3. Fix or reassign the wrong record, or enter a correcting count',
          '4. The item drops off this list once its stock is zero or positive'
        ]
      },
      acpGteSp: {
        title: '⚖️ Cost ≥ Selling Price',
        description: 'Items whose average cost price is the same as or higher than their selling price, meaning every sale of that item currently loses money.',
        steps: [
          '1. Open the item and check its ACP (Average Cost Price) and Selling Price',
          '2. Decide whether the selling price needs raising, or the cost is wrong',
          '3. Update the selling price (or fix the bill that set the cost)',
          '4. The item drops off this list once its selling price is above cost'
        ]
      },
      noSp: {
        title: '💲 Missing Selling Price',
        description: 'Items with no selling price set (or a price of zero), so they can\'t be sold correctly.',
        steps: [
          '1. Open the item',
          '2. Set a selling price for the item',
          '3. Save changes - the item drops off this list once a price is set'
        ]
      },
      noCp: {
        title: '💰 Missing Cost Price',
        description: 'Items with no cost price set (or a price of zero), so margin and loss figures for it can\'t be trusted.',
        steps: [
          '1. Open the item',
          '2. Set a cost price for the item, or record a bill that establishes one',
          '3. Save changes - the item drops off this list once a cost is set'
        ]
      },
      noGroup: {
        title: '📁 Missing Group',
        description: 'Items with no group assigned, making them harder to find and excluded from group-based reporting.',
        steps: [
          '1. Open the item',
          '2. Assign it to the correct group',
          '3. Save changes - the item drops off this list once a group is set'
        ]
      },
      noViolations: {
        title: '✓ Live - No Violation Banners',
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
          disabled={liveSaleType === 'GMC'}
          onClick={() => setMiOn(v => !v)}
          title="MI: record several items for one customer and issue one receipt"
          className={`font-bold transition shrink-0 disabled:opacity-40 ${compact ? 'px-2 py-1 text-[10px] rounded-md' : 'px-3 py-1.5 text-sm rounded'} ${miOn ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          MI{miOn && miLines.length ? ` ${miLines.length}` : ''}
        </button>
        <button
          type="button"
          onClick={() => openEmbed('/pending-jobs?new=1')}
          title="Pending job: a customer leaves a job (a deposit, or nothing paid yet)"
          className={`font-bold transition shrink-0 bg-amber-100 text-amber-900 hover:bg-amber-200 ${compact ? 'px-2 py-1 text-[10px] rounded-md' : 'px-3 py-1.5 text-sm rounded'}`}
        >
          🧾 Job
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
  return {
    router,
    searchParams,
    rawInitialTab,
    oldTabView,
    initialTab,
    outerTab,
    setOuterTab,
    group,
    setGroup,
    rawInitialProductType,
    productType,
    setProductType,
    rawInitialView,
    initialExtraView,
    initialView,
    lossView,
    setLossView,
    itemsExtraView,
    setItemsExtraView,
    search,
    setSearch,
    violation,
    setViolation,
    infoOpenFor,
    setInfoOpenFor,
    groupOpen,
    setGroupOpen,
    searchOpen,
    setSearchOpen,
    settingsOpen,
    setSettingsOpen,
    rawInitialForm,
    addForm,
    setAddForm,
    cabConfirmSignal,
    setCabConfirmSignal,
    staffTimeSignal,
    setStaffTimeSignal,
    vendorSignal,
    setVendorSignal,
    propertiesInitialTab,
    setPropertiesInitialTab,
    jumpToItemId,
    setJumpToItemId,
    jumpToReceiptDate,
    setJumpToReceiptDate,
    jumpToReceiptItemName,
    setJumpToReceiptItemName,
    jumpToBillId,
    setJumpToBillId,
    liveSaleMounted,
    setLiveSaleMounted,
    jumpToReceiptId,
    setJumpToReceiptId,
    jumpToCountId,
    setJumpToCountId,
    showItemsLaws,
    setShowItemsLaws,
    liveExpanded,
    setLiveExpanded,
    rawLiveProductType,
    initialLiveProductType,
    liveProductTypeFilter,
    setLiveProductTypeFilter,
    rawLiveGroup,
    liveGroupFilter,
    setLiveGroupFilter,
    rawLiveGmcType,
    liveGmcTypeFilter,
    setLiveGmcTypeFilter,
    liveItemSortOrder,
    setLiveItemSortOrder,
    liveSortOrderModalOpen,
    setLiveSortOrderModalOpen,
    rawLiveMode,
    initialLiveMode,
    liveMode,
    setLiveMode,
    itemsPageMode,
    setItemsPageMode,
    liveManageSection,
    setLiveManageSection,
    CHECKLIST_LOGGED_KEYS,
    manageSideOptions,
    rawLiveSalesViolation,
    rawLiveBillsViolation,
    liveSalesViolationFilter,
    setLiveSalesViolationFilter,
    liveBillsViolationFilter,
    setLiveBillsViolationFilter,
    rawLiveSaleFilter,
    initialLiveSaleFilter,
    liveSaleFilter,
    setLiveSaleFilter,
    rawLiveSaleView,
    initialLiveSaleView,
    liveSaleView,
    setLiveSaleView,
    rawLiveCountView,
    initialLiveCountView,
    liveCountView,
    setLiveCountView,
    rawLiveEmbeddedSearch,
    liveEmbeddedSearch,
    setLiveEmbeddedSearch,
    liveShowCountFullPage,
    setLiveShowCountFullPage,
    plSubView,
    setPlSubView,
    lossesOpen,
    setLossesOpen,
    analyticsOpen,
    setAnalyticsOpen,
    liveSaleViolationFilter,
    setLiveSaleViolationFilter,
    liveCountsRecordStatusFilter,
    setLiveCountsRecordStatusFilter,
    liveCountDeleteLoading,
    setLiveCountDeleteLoading,
    liveEditingItemIntervalId,
    setLiveEditingItemIntervalId,
    liveEditingItemIntervalDays,
    setLiveEditingItemIntervalDays,
    liveEditingItemIntervalSaving,
    setLiveEditingItemIntervalSaving,
    initialSidePaneHidden,
    sidePaneHidden,
    liveSaleJumpSeq,
    setLiveSaleJumpSeq,
    liveSaleJumpTab,
    setLiveSaleJumpTab,
    liveSaleJumpViolation,
    setLiveSaleJumpViolation,
    liveSaleJumpSearch,
    setLiveSaleJumpSearch,
    jumpToLiveSaleTab,
    jumpToCustomersTab,
    groupRef,
    searchRef,
    globalSearchOpen,
    setGlobalSearchOpen,
    globalSearchQuery,
    setGlobalSearchQuery,
    globalSearchLoading,
    setGlobalSearchLoading,
    globalSearchResults,
    setGlobalSearchResults,
    customerSearchText,
    setCustomerSearchText,
    vendorSearchText,
    setVendorSearchText,
    fixedCategoryIds,
    viewingNameOverride,
    setViewingNameOverride,
    activeStaff,
    setActiveStaff,
    fetchStaff,
    uk,
    ukAllSubmenus,
    setUkAllSubmenus,
    ukGeneralSubmenus,
    setUkGeneralSubmenus,
    ukPaneRefresh,
    setUkPaneRefresh,
    ch,
    closeGlobalSearch,
    itemsColPrefs,
    showAnalytics,
    setShowAnalytics,
    items,
    setItems,
    itemsLoading,
    setItemsLoading,
    liveGroups,
    serviceGroups,
    itemsInlineExtra,
    setItemsInlineExtra,
    loadItems,
    loadCountIntervals,
    lossGroups,
    setLossGroups,
    loadLossGroups,
    renamingGroup,
    setRenamingGroup,
    renameGroupValue,
    setRenameGroupValue,
    renameGroupBusy,
    setRenameGroupBusy,
    submitGroupRename,
    globalFlags,
    setGlobalFlags,
    pendingCounts,
    setPendingCounts,
    serviceViolationCount,
    setServiceViolationCount,
    serviceViolationIds,
    setServiceViolationIds,
    prezohoSalesCount,
    setPrezohoSalesCount,
    prezohoBillsCount,
    setPrezohoBillsCount,
    prezohoReceiptsCount,
    setPrezohoReceiptsCount,
    aliasFlaggedCount,
    setAliasFlaggedCount,
    aliasAmbiguousCount,
    setAliasAmbiguousCount,
    nameConflictsCount,
    setNameConflictsCount,
    gainsCount,
    setGainsCount,
    loadBadgeData,
    violationCounts,
    cashViolations,
    openerViolations,
    openerViolationCount,
    assignments,
    deadlines,
    assignedBy,
    assignedOn,
    vSettings,
    violationCountByType,
    salesFlagsCount,
    itemsFlagsCount,
    billsFlagsCount,
    cabFlagsCount,
    staffTimesFlagsCount,
    dressFlagsCount,
    countsFlagsCount,
    lossByDateFlagsCount,
    expensesFlagsCount,
    setExpensesFlagsCount,
    customersFlagsCount,
    setCustomersFlagsCount,
    vendorsFlagsCount,
    setVendorsFlagsCount,
    openerToday,
    setOpenerToday,
    myClockedInToday,
    setMyClockedInToday,
    clockGateOpen,
    setClockGateOpen,
    clockGateDismissed,
    setClockGateDismissed,
    pendingTapItemRef,
    pendingTapQtyRef,
    pendingTapPriceRef,
    negPrompt,
    setNegPrompt,
    gmcOverageGate,
    setGmcOverageGate,
    gmcPropertyPrompt,
    setGmcPropertyPrompt,
    gmcPropertySaving,
    setGmcPropertySaving,
    liveInlineQtyByItemId,
    setLiveInlineQtyByItemId,
    liveInlinePriceByItemId,
    setLiveInlinePriceByItemId,
    liveInlineCIDByItemId,
    setLiveInlineCIDByItemId,
    liveLabelByKey,
    setLiveLabelByKey,
    justTappedItemIds,
    setJustTappedItemIds,
    liveInlineCountQtyByItemId,
    setLiveInlineCountQtyByItemId,
    openerBadgeCount,
    taskCounts,
    setTaskCounts,
    loadTaskCounts,
    taskCountFor,
    CASH_TASK_SCOPE_OVERRIDES,
    cashTaskScopeKey,
    changeTab,
    voiceSaleSignal,
    setVoiceSaleSignal,
    myDayBadge,
    setMyDayBadge,
    pendingJobsBadge,
    setPendingJobsBadge,
    waitingBy,
    setWaitingBy,
    voiceSaleText,
    setVoiceSaleText,
    scanItem,
    setScanItem,
    scanSignal,
    setScanSignal,
    embedRef,
    embedUrl,
    setEmbedUrl,
    personal,
    setPersonal,
    barH,
    setBarH,
    barRef,
    shop,
    setShop,
    shopRoute,
    openEmbed,
    openShop,
    openPersonal,
    pickLossView,
    pickCHView,
    openPersonSubmenu,
    voiceDests,
    openMyPage,
    pickViewing,
    goFixRecords,
    handleShortcut,
    goToViolation,
    lawsKeys,
    areAllLawsShown,
    toggleAllLaws,
    groups,
    searchMatches,
    pillKeys,
    groupLabel,
    showControls,
    inCountTab,
    cashDisplayMode,
    changeCashDisplayMode,
    session,
    navSlotEl,
    isDesktop,
    navHeightPx,
    role,
    username,
    isOwnerOrJoe,
    showFlags,
    fl,
    isGrony,
    canManage,
    rolePermissions,
    setRolePermissions,
    permsLoaded,
    setPermsLoaded,
    paneOrder,
    setPaneOrder,
    fetchPaneOrder,
    paneLabels,
    setPaneLabels,
    fetchPaneLabels,
    paneLabel,
    paneGroups,
    setPaneGroups,
    fetchPaneGroups,
    paneHidden,
    setPaneHidden,
    fetchPaneHidden,
    cashItemActive,
    cashItemClick,
    cashItemTaskScope,
    combinedCashItems,
    effectiveCashItems,
    selfTitledGroups,
    perm,
    canSeeCash,
    canSeeManage,
    isCaretakerOnly,
    canSeePL,
    canSeeTeam,
    canSeeUsers,
    canViewPortalAs,
    canSeeUK,
    canSeeCaretake,
    canSeeCH,
    canSeeCHTab,
    canOpenSettings,
    canOpenUkSettings,
    myStaffName,
    viewingName,
    viewingSelf,
    routablePages,
    navDestinations,
    navQuery,
    navMatches,
    paneActive,
    embedActive,
    paneAccent,
    salesFormOpen,
    liveCanDeleteCounts,
    liveAllItems,
    setLiveAllItems,
    liveAllItemsRef,
    liveItemsLoading,
    setLiveItemsLoading,
    liveTaps,
    setLiveTaps,
    liveTapsStatus,
    setLiveTapsStatus,
    liveDayBounds,
    setLiveDayBounds,
    liveSaleType,
    setLiveSaleType,
    liveTapError,
    setLiveTapError,
    liveEditingGridItemId,
    setLiveEditingGridItemId,
    liveGridEditSaleTapRef,
    liveGridEditQtyInputRef,
    liveGridEditLoading,
    setLiveGridEditLoading,
    liveGridEditError,
    setLiveGridEditError,
    liveGridEditAliases,
    setLiveGridEditAliases,
    liveGridEditMatches,
    setLiveGridEditMatches,
    liveGridEditRelationsOpen,
    setLiveGridEditRelationsOpen,
    liveGridEditConfirmDelete,
    setLiveGridEditConfirmDelete,
    liveGridEditDeleting,
    setLiveGridEditDeleting,
    liveGridEditDeleteError,
    setLiveGridEditDeleteError,
    liveGridEditSaving,
    setLiveGridEditSaving,
    liveGridEditCountQty,
    setLiveGridEditCountQty,
    liveGridEditCountError,
    setLiveGridEditCountError,
    liveGridEditCountSaving,
    setLiveGridEditCountSaving,
    liveSelectedItem,
    setLiveSelectedItem,
    liveDueWhenOpened,
    setLiveDueWhenOpened,
    liveQty,
    setLiveQty,
    livePrice,
    setLivePrice,
    liveCID,
    setLiveCID,
    inlineCidRef,
    curLabelRef,
    custNameRef,
    skipWaRef,
    tapCustomerSheet,
    setTapCustomerSheet,
    rcptSelect,
    setRcptSelect,
    rcptSel,
    setRcptSel,
    rcptSheet,
    setRcptSheet,
    logWrapRef,
    logZoomFor,
    miOn,
    setMiOn,
    miLines,
    setMiLines,
    miCustomer,
    setMiCustomer,
    miDate,
    setMiDate,
    miBusy,
    setMiBusy,
    miError,
    setMiError,
    lastTapIdRef,
    tapTimeOverrideRef,
    registerFor,
    setRegisterFor,
    lastBuyerIdRef,
    waPrompt,
    setWaPrompt,
    liveSaving,
    setLiveSaving,
    liveGmcTargetItem,
    setLiveGmcTargetItem,
    liveGmcCountSaving,
    setLiveGmcCountSaving,
    liveTapStatus,
    setLiveTapStatus,
    liveTapTime,
    setLiveTapTime,
    liveTapTimeTouched,
    setLiveTapTimeTouched,
    liveEditingSelectedItem,
    setLiveEditingSelectedItem,
    liveEditForm,
    setLiveEditForm,
    liveEditCurrentCountInterval,
    setLiveEditCurrentCountInterval,
    liveEditCurrentSoh,
    setLiveEditCurrentSoh,
    liveEditLoading,
    setLiveEditLoading,
    liveEditSaving,
    setLiveEditSaving,
    liveEditError,
    setLiveEditError,
    liveEditingTapId,
    setLiveEditingTapId,
    liveEditingTapTime,
    setLiveEditingTapTime,
    liveEditingTapSaving,
    setLiveEditingTapSaving,
    liveEditingCountTime,
    setLiveEditingCountTime,
    liveEditingFullTapId,
    setLiveEditingFullTapId,
    liveEditingCurrentDate,
    setLiveEditingCurrentDate,
    liveEditingFullTapForm,
    setLiveEditingFullTapForm,
    liveEditingFullTapSaving,
    setLiveEditingFullTapSaving,
    liveEditingCountTimeSaving,
    setLiveEditingCountTimeSaving,
    liveReconcilingTaps,
    setLiveReconcilingTaps,
    liveNewEntryOpen,
    setLiveNewEntryOpen,
    liveNewEntryForm,
    setLiveNewEntryForm,
    liveNewEntrySaving,
    setLiveNewEntrySaving,
    liveEditingAddingNewInModal,
    setLiveEditingAddingNewInModal,
    liveNewEntryItemSearch,
    setLiveNewEntryItemSearch,
    toasts,
    setToasts,
    showToast,
    renderClickableItemName,
    liveRootClassName,
    liveCurrentView,
    setLiveCurrentView,
    liveItemPickerQuery,
    setLiveItemPickerQuery,
    liveItemPickerResults,
    setLiveItemPickerResults,
    liveShowItemPicker,
    setLiveShowItemPicker,
    livePickedItemId,
    setLivePickedItemId,
    liveDailyItems,
    setLiveDailyItems,
    liveGmcWeeklyItems,
    setLiveGmcWeeklyItems,
    liveOverdueItems,
    setLiveOverdueItems,
    liveCountProgress,
    setLiveCountProgress,
    liveCountQty,
    setLiveCountQty,
    liveCountSaving,
    setLiveCountSaving,
    liveCountError,
    setLiveCountError,
    liveDebugLogs,
    setLiveDebugLogs,
    addCountLog,
    liveLossPrompt,
    setLiveLossPrompt,
    liveGainPrompt,
    setLiveGainPrompt,
    livePairingPrompt,
    setLivePairingPrompt,
    liveCountRecords,
    setLiveCountRecords,
    liveEditingCountId,
    setLiveEditingCountId,
    liveEditCountQty,
    setLiveEditCountQty,
    liveEditCountNotes,
    setLiveEditCountNotes,
    liveEditCountSaving,
    setLiveEditCountSaving,
    liveCountRecordFilter,
    setLiveCountRecordFilter,
    liveShowCountDue,
    setLiveShowCountDue,
    liveBillsAddingNew,
    setLiveBillsAddingNew,
    liveBillsShowPurchaseOrders,
    setLiveBillsShowPurchaseOrders,
    liveBillsShowVendors,
    setLiveBillsShowVendors,
    liveExpensesAddingNew,
    setLiveExpensesAddingNew,
    liveExpensesShowOrders,
    setLiveExpensesShowOrders,
    liveSalesShowAnalytics,
    setLiveSalesShowAnalytics,
    liveBillsShowAnalytics,
    setLiveBillsShowAnalytics,
    liveExpensesShowAnalytics,
    setLiveExpensesShowAnalytics,
    liveSalesShowHistory,
    setLiveSalesShowHistory,
    liveSalesBarsOnly,
    setLiveSalesBarsOnly,
    liveSalesShowW,
    setLiveSalesShowW,
    liveSalesShowG,
    setLiveSalesShowG,
    liveSalesMonthFilter,
    setLiveSalesMonthFilter,
    liveSalesYearFilter,
    setLiveSalesYearFilter,
    liveSalesShowBulkAttach,
    setLiveSalesShowBulkAttach,
    liveSalesAvailableYears,
    setLiveSalesAvailableYears,
    liveSalesColPrefs,
    liveBillsShowHistory,
    setLiveBillsShowHistory,
    liveBillsBarsOnly,
    setLiveBillsBarsOnly,
    liveBillsVendorFilter,
    setLiveBillsVendorFilter,
    liveBillsMonthFilter,
    setLiveBillsMonthFilter,
    liveBillsYearFilter,
    setLiveBillsYearFilter,
    liveBillsGmcFilter,
    setLiveBillsGmcFilter,
    liveBillsAvailableVendors,
    setLiveBillsAvailableVendors,
    liveBillsAvailableYears,
    setLiveBillsAvailableYears,
    liveBillsColPrefs,
    liveExpensesShowHistory,
    setLiveExpensesShowHistory,
    liveExpensesActiveFlag,
    setLiveExpensesActiveFlag,
    liveExpensesFlagCounts,
    setLiveExpensesFlagCounts,
    liveExpensesGroupBy,
    setLiveExpensesGroupBy,
    liveExpensesShowProperties,
    setLiveExpensesShowProperties,
    liveExpensesShowNonProperties,
    setLiveExpensesShowNonProperties,
    liveExpensesPropertyAvailabilityFilter,
    setLiveExpensesPropertyAvailabilityFilter,
    liveExpensesPropertyTypeFilter,
    setLiveExpensesPropertyTypeFilter,
    liveExpensesViewCounts,
    setLiveExpensesViewCounts,
    liveExpensesAccountFilter,
    setLiveExpensesAccountFilter,
    liveExpensesAccountOptions,
    setLiveExpensesAccountOptions,
    liveExpensesShowAccountsManager,
    setLiveExpensesShowAccountsManager,
    liveExpensesColumnsOpen,
    setLiveExpensesColumnsOpen,
    saleModeShowAnalytics,
    setSaleModeShowAnalytics,
    liveLogShowAnalytics,
    setLiveLogShowAnalytics,
    liveCountShowAnalytics,
    setLiveCountShowAnalytics,
    liveCatalogueGroups,
    liveCostPriceByItemId,
    liveSalesBillsItems,
    liveCountsItems,
    liveSalesRadioValue,
    selectLiveSalesRadio,
    liveBillsRadioValue,
    selectLiveBillsRadio,
    EXPENSES_FLAG_KEYS,
    liveExpensesRadioValue,
    selectLiveExpensesRadio,
    getExpensesPrefsKey,
    liveExpensesColPrefs,
    liveExpensesMainRadios,
    renderLiveExpensesRadio,
    liveCountStatus,
    liveLastCountDateByItemId,
    liveCountIntervalFlags,
    liveViolationTypes,
    liveSalesViolationTypes,
    liveBillsViolationTypes,
    liveItemsWithViolations,
    liveComputedFlags,
    liveAllViews,
    liveItemsError,
    setLiveItemsError,
    loadLiveItems,
    liveGmcItemIds,
    setLiveGmcItemIds,
    liveGmcUsageCounts,
    setLiveGmcUsageCounts,
    liveGmcTargetStock,
    setLiveGmcTargetStock,
    liveGmcOpenOverage,
    setLiveGmcOpenOverage,
    applyGmcTargetStock,
    moveItemSortKey,
    liveLossByItemId,
    setLiveLossByItemId,
    liveSaleHistoryByItemId,
    setLiveSaleHistoryByItemId,
    liveDuplicateItemIds,
    liveUnlinkedNamedIds,
    liveServiceViolationIdSet,
    liveNegSohIds,
    liveNoSpIds,
    liveNoCpIds,
    liveNoGroupIds,
    liveNeedsReviewIds,
    liveLowConfidenceAliasIds,
    livePrezohoNotesIds,
    liveUnknownQtyIds,
    liveGmcOverageIds,
    liveAcpGteSpIds,
    liveSoldBelowCostDatesByItemId,
    liveVcpJumpDatesByItemId,
    liveNetGainByItemId,
    liveNetLossIds,
    liveEmptyRowCountByItemId,
    liveDuplicateCount,
    liveUnlinkedCount,
    liveServiceViolationCount,
    liveNetGainCount,
    liveNetLossCount,
    liveSoldBelowCostCount,
    liveVcpJumpCount,
    liveEmptyRowCount,
    liveNegSohCount,
    liveAcpGteSpCount,
    liveNoSpCount,
    liveNoCpCount,
    liveNoGroupCount,
    liveNeedsReviewCount,
    liveLowConfidenceAliasCount,
    livePrezohoNotesCount,
    liveUnknownQtyCount,
    liveGmcOverageCount,
    fetchTaps,
    liveTapsAll,
    setLiveTapsAll,
    logPeriod,
    setLogPeriod,
    logRecs,
    setLogRecs,
    logRecsStatus,
    setLogRecsStatus,
    logPeriodTaps,
    setLogPeriodTaps,
    logShowW,
    setLogShowW,
    logShowG,
    setLogShowG,
    logBarsOnly,
    setLogBarsOnly,
    logFlag,
    setLogFlag,
    logFlagsData,
    setLogFlagsData,
    logYears,
    logRange,
    loadAllLiveTaps,
    reloadLiveTaps,
    loadLiveTapsFresh,
    loadCountProgress,
    liveViewingCountRecords,
    liveToday,
    jobPayments,
    setJobPayments,
    jobMoneyOn,
    liveTodaySalesTotal,
    salesByStaff,
    liveSalesCounts,
    liveSaleFilterFlags,
    liveCatalogueItems,
    logFlagDates,
    logDays,
    liveCountsByDate,
    liveLossesByItem,
    liveLossesByDate,
    liveSaleCountRecords,
    liveCountLossSummary,
    liveViolationCountByItemId,
    liveSortedCatalogueItems,
    liveDueCatalogueCount,
    addTapStatus,
    resolveClockGate,
    resolveOverageGate,
    recordTap,
    addToBasket,
    miComplete,
    recordInlineTap,
    recordCountAndSale,
    undoTap,
    reconcileUndoneTaps,
    saveEditingTapTime,
    saveEditingFullTap,
    createNewLogEntry,
    submitCount,
    recordInlineCount,
    liveEditGroups,
    liveEditAllItemsList,
    startEditSelectedItem,
    openEditGridItem,
    deleteGridEditItem,
    recordCountFromModal,
    saveEditSelectedItem,
    saveGmcTypeOnly,
    saveConversionTargetOnly,
    saveGridEditItem,
    startEditCount,
    saveEditCount,
    deleteCountRecord,
    saveEditingCountTime,
    pickItemsMode,
    pickCountMode,
    aliasFlagKeys,
    liveSaleFlagList,
    liveSaleFlagTotal,
    activeFlagValue,
    pickLiveFlag,
    renderCriticalBar,
    renderSectionFlags,
    renderAnalyticsRow,
    pickSaleFilter,
    pickSalesView,
    pickPL,
    toGrid,
    goItemsMode,
    goSaleFilter,
    goCountMode,
    modeActive,
    goLossSubView,
    renderTabSwitcher,
    renderModeToggle,
    renderModeProgressSummary,
    renderModeToggleRow,
    renderAllFiltersBar,
    EXPENSES_FILTER_BAR_KEYS,
    renderExpensesFiltersBar,
    renderCountRecordsTable,
    renderCountDueChart,
    renderNegativeSohChart,
    renderLossesByDateTable,
    renderLossesByItemsTable,
    renderCostGteSpTable,
    renderSoldBelowCostTable,
    renderCountIntervalsView,
    getViolationDescription,
    renderLiveSearchControls,
    renderLiveSaleFilterSelect,
    renderLiveItemFlagsFilter,
  }
}
export type HubCtx = ReturnType<typeof useHubState>
