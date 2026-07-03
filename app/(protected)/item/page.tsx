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
const AnalyticsPanel = dynamic(() => import('./_components/AnalyticsPanel'),  { ssr: false, loading: () => loading('Loading analytics…') })
const StaffClient    = dynamic(() => import('../staff/StaffClient'),          { ssr: false, loading: () => loading('Loading…') })
const NoStaffTimesList = dynamic(() => import('../staff/StaffClient').then(m => ({ default: m.NoStaffTimesList })), { ssr: false, loading: () => loading('Loading…') })
const LossTab        = dynamic(() => import('./_components/LossTab'),         { ssr: false, loading: () => loading('Loading…') })

type OuterTab = 'today' | 'loss' | 'errors' | 'data' | 'sales' | 'bills' | 'expenses' | 'cab' | 'staff'

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
const ERROR_VIOLATIONS: { key: string; label: string; category: ErrorCategory }[] = [
  { key: 'neg_soh',    label: 'Neg SOH',    category: 'loss' },
  { key: 'no_sp',      label: 'No SP',      category: 'loss' },
  { key: 'no_cp',      label: 'No CP',      category: 'loss' },
  { key: 'no_group',   label: 'No Group',   category: 'loss' },
  { key: 'duplicates', label: 'Duplicates', category: 'loss' },
  { key: 'aliases',    label: 'Aliases',    category: 'loss' },
  { key: 'service_violation', label: 'Service', category: 'loss' },
  { key: 'daily',      label: 'Daily Count',   category: 'loss' },
  { key: '15day',      label: '15-Day Count',  category: 'loss' },
  { key: 'no_cash',      label: 'No Cash',      category: 'sales' },
  { key: 'missing_days', label: 'Missing Days', category: 'sales' },
  { key: 'cost_price',   label: 'Cost Price',   category: 'sales' },
  { key: 'dup_receipt',  label: 'Dup Receipts', category: 'sales' },
  { key: 'unchecked_cab',  label: 'Unchecked CAB',  category: 'cab' },
  { key: 'no_staff_times', label: 'No Staff Times', category: 'staff' },
]

const VIOLATIONS: Record<OuterTab, { key: string; label: string; category?: ErrorCategory }[]> = {
  today: [],
  loss: [],
  errors: ERROR_VIOLATIONS,
  data: [],
  sales: [],
  bills: [],
  expenses: [],
  cab: [],
  staff: [],
}

const COUNTS_VIOLATIONS = new Set(['daily', '15day'])

const HAMBURGER_LINKS = [
  { href: '/analysis', label: 'Analysis' },
  { href: '/logs',     label: 'Logs'     },
  { href: '/users',    label: 'Users'    },
  { href: '/profile',  label: 'Profile'  },
]

function tabCls(active: boolean) {
  return `relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-0.5 py-2 rounded-lg transition
    ${active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`
}

function TabIcon({ icon, label, active, onClick, count }: { icon: string; label: string; active: boolean; onClick: () => void; count?: number }) {
  return (
    <button onClick={onClick} className={tabCls(active)}
      title={count ? `${count} violation${count !== 1 ? 's' : ''} need attention` : undefined}>
      <span className="relative text-sm leading-none">
        {icon}
        {!!count && (
          <span className="absolute -top-1.5 -right-2.5 min-w-[14px] h-[14px] px-[3px] rounded-full bg-red-600 text-white text-[8px] font-bold flex items-center justify-center leading-none">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </span>
      <span className="text-[9px] font-semibold leading-none truncate max-w-full">{label}</span>
    </button>
  )
}

const VALID_TABS: OuterTab[] = ['today', 'loss', 'errors', 'data', 'sales', 'bills', 'expenses', 'cab', 'staff']

function ItemHubPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') as OuterTab | null
  const [outerTab, setOuterTab] = useState<OuterTab>(
    initialTab && VALID_TABS.includes(initialTab) ? initialTab : 'today'
  )
  const [group, setGroup]               = useState<string | null>(null)
  const [productType, setProductType]   = useState<'all' | 'goods' | 'services'>('all')
  const [search, setSearch]             = useState('')
  const [violation, setViolation]       = useState<string | null>(searchParams.get('violation'))
  const [violationOpen, setViolationOpen] = useState(!!searchParams.get('violation'))
  const [groupOpen, setGroupOpen]       = useState(false)
  const [hamburgerOpen, setHamburgerOpen] = useState(false)
  const [addForm, setAddForm]             = useState<'item' | 'sale' | 'bill' | 'expense' | null>(null)
  const [jumpToItemId, setJumpToItemId]   = useState<number | null>(null)
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
  const [pendingCounts, setPendingCounts] = useState<{ daily: number; overdue: number }>({ daily: 0, overdue: 0 })
  const [serviceViolationCount, setServiceViolationCount] = useState(0)

  function loadBadgeData() {
    fetch('/api/flags').then(r => r.ok ? r.json() : null).then(d => { if (d) setGlobalFlags(d) }).catch(() => {})
    Promise.all([
      fetch('/api/stock/daily').then(r => r.json()).catch(() => []),
      fetch('/api/stock/overdue').then(r => r.json()).catch(() => []),
    ]).then(([daily, overdue]) => {
      setPendingCounts({
        daily: Array.isArray(daily) ? daily.length : 0,
        overdue: Array.isArray(overdue) ? overdue.length : 0,
      })
    }).catch(() => {})
    fetch('/api/losses/summary').then(r => r.ok ? r.json() : []).then(d => {
      const list = Array.isArray(d) ? d : []
      setServiceViolationCount(list.filter((r: any) =>
        r.product_type === 'service' && (Number(r.cnt) !== 0 || Number(r.gmc) !== 0 || Number(r.bl) !== 0)
      ).length)
    }).catch(() => {})
  }

  useEffect(() => { loadBadgeData() }, [])
  usePolling(loadBadgeData, 20000)

  const violationCounts: Record<string, number> = useMemo(() => {
    const negSoh = items.filter(i => Number(i.calculated_soh) <= 0).length
    const noSp = items.filter(i => !i.selling_rate || parseFloat(i.selling_rate) === 0).length
    const noCp = items.filter(i => !i.purchase_rate || parseFloat(i.purchase_rate) === 0).length
    const f = globalFlags
    return {
      neg_soh: negSoh,
      no_sp: noSp,
      no_cp: noCp,
      no_group: f?.noGroup?.length ?? 0,
      duplicates: f?.duplicates?.length ?? 0,
      no_cash: f?.noCash?.length ?? 0,
      missing_days: f?.missingDays?.length ?? 0,
      cost_price: f?.costGteSell?.length ?? 0,
      dup_receipt: f?.dupReceipts?.length ?? 0,
      daily: pendingCounts.daily,
      '15day': pendingCounts.overdue,
      service_violation: serviceViolationCount,
      unchecked_cab: f?.uncheckedCab?.length ?? 0,
      no_staff_times: f?.noStaffTimes?.length ?? 0,
    }
  }, [items, globalFlags, pendingCounts, serviceViolationCount])

  const badgeCounts: Partial<Record<OuterTab, number>> = useMemo(() => {
    const v = violationCounts
    return {
      errors: v.neg_soh + v.no_sp + v.no_cp + v.no_group + v.duplicates + v.service_violation + v.daily + v['15day']
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

  function changeTab(t: OuterTab) {
    setOuterTab(t)
    setViolation(t === 'errors' ? ERROR_VIOLATIONS[0].key : null)
    setViolationOpen(t === 'errors')
    setAddForm(null)
    if (t !== 'loss') setProductType('all')
    router.replace(t === 'today' ? '/item' : `/item?tab=${t}`, { scroll: false })
  }

  const groups = ['All', ...Array.from(new Set(items.map(i => i.cf_group ?? 'Ungrouped'))).sort()]
  const currentViolations = VIOLATIONS[outerTab]
  const activeViolationLabel = currentViolations.find(v => v.key === violation)?.label ?? null

  const groupLabel = [
    group ?? 'All',
    productType !== 'all' ? (productType === 'goods' ? 'Goods' : 'Services') : null,
  ].filter(Boolean).join(' · ')

  const showControls = outerTab !== 'today' && outerTab !== 'staff' && outerTab !== 'data'
  const { data: session } = useSession()
  const role = (session?.user as any)?.role ?? 'staff'
  const username = (session?.user as any)?.username ?? session?.user?.name ?? ''
  const hamburgerLinks = HAMBURGER_LINKS

  return (
    <div className="-mx-4 -mt-4 flex flex-col h-[100dvh] md:h-[calc(100dvh-56px)]">

      {/* ── Header ── */}
      <div className="shrink-0 bg-white border-b border-gray-200">

        {/* Row 1: scrollable tabs + hamburger (hamburger outside scroll area to avoid clip) */}
        <div className="flex items-center pr-1.5">
          {/* Home — fixed, outside the scrollable flex area */}
          <button onClick={() => changeTab('today')}
            className={`shrink-0 flex flex-col items-center justify-center gap-0.5 px-2 pt-1.5 pb-1 rounded-lg transition
              ${outerTab === 'today' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>
            <span className="text-lg leading-none">🏠</span>
          </button>
          <div className="flex items-center gap-0.5 px-1 pt-1.5 pb-1 flex-1 min-w-0">
            <TabIcon icon="📉" label="Loss"     active={outerTab === 'loss'}     onClick={() => changeTab('loss')} />
            <TabIcon icon="⚠️" label="Errors"   active={outerTab === 'errors'}   onClick={() => changeTab('errors')}   count={badgeCounts.errors} />
            <TabIcon icon="🔢" label="Data"     active={outerTab === 'data'}     onClick={() => changeTab('data')} />
            <TabIcon icon="💰" label="Sales"    active={outerTab === 'sales'}    onClick={() => changeTab('sales')} />
            <TabIcon icon="🧾" label="Bills"    active={outerTab === 'bills'}    onClick={() => changeTab('bills')} />
            <TabIcon icon="💸" label="Exp."     active={outerTab === 'expenses'} onClick={() => changeTab('expenses')} />
            <TabIcon icon="🏦" label="CAB"      active={outerTab === 'cab'}      onClick={() => changeTab('cab')} />
            <TabIcon icon="👤" label="Staff"    active={outerTab === 'staff'}    onClick={() => changeTab('staff')} />
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

            {/* New button — Loss/Items, Sales, Bills, Expenses only */}
            {(['loss', 'sales', 'bills', 'expenses'] as OuterTab[]).includes(outerTab) && (() => {
              const formKey = outerTab === 'loss' ? 'item' : outerTab === 'sales' ? 'sale' : outerTab === 'bills' ? 'bill' : 'expense'
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
        {addForm === 'sale'    && outerTab === 'sales'    && <div className="px-4"><NewSaleForm    onSuccess={() => { setAddForm(null); changeTab('sales') }} /></div>}
        {addForm === 'bill'    && outerTab === 'bills'    && <div className="px-4"><NewBillForm    onSuccess={() => { setAddForm(null); changeTab('bills') }} /></div>}
        {addForm === 'expense' && outerTab === 'expenses' && <div className="px-4"><NewExpenseForm onSuccess={() => { setAddForm(null); changeTab('expenses') }} /></div>}
        {outerTab === 'data' && (
          <TabErrorBoundary>
            <AnalyticsPanel />
          </TabErrorBoundary>
        )}
        {outerTab === 'today' && !(addForm === 'sale' || addForm === 'bill' || addForm === 'expense') && (
          <TabErrorBoundary>
            <div className="h-full overflow-y-auto px-4">
              <TodayContent />
            </div>
          </TabErrorBoundary>
        )}
        {addForm !== 'sale'    && outerTab === 'sales'    && <SalesTab items={items} groupFilter={group} search={search} violation={violation} />}
        {addForm !== 'bill'    && outerTab === 'bills'    && <BillsTab items={items} groupFilter={group} search={search} />}
        {addForm !== 'expense' && outerTab === 'expenses' && <ExpensesTab search={search} />}
        {outerTab === 'cab'      && <CABTab />}
        {outerTab === 'staff'    && (
          <TabErrorBoundary>
            <StaffClient role={role} username={username} embedded />
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && (
          <TabErrorBoundary>
            <LossTab onOpenItem={() => {}} search={search} group={group} productType={productType} />
          </TabErrorBoundary>
        )}
        {outerTab === 'errors' && violation && (() => {
          const category = ERROR_VIOLATIONS.find(v => v.key === violation)?.category
          if (category === 'loss') {
            if (COUNTS_VIOLATIONS.has(violation)) {
              return <CountsTab items={items} groupFilter={group} search={search} violation={violation} />
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
