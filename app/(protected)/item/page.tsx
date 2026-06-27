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
import ItemsTab from './_components/ItemsTab'
import SalesTab from './_components/SalesTab'
import BillsTab from './_components/BillsTab'
import CountsTab from './_components/CountsTab'
import ExpensesTab from './_components/ExpensesTab'
import CABTab from './_components/CABTab'
import dynamic from 'next/dynamic'
const TodayContent    = dynamic(() => import('./_components/TodayContent'), { ssr: false, loading: () => <div className="py-10 text-center text-gray-400 text-sm">Loading…</div> })
const NewSaleForm     = dynamic(() => import('../sales/new/page'),     { ssr: false, loading: () => <div className="py-10 text-center text-gray-400 text-sm">Loading…</div> })
const NewBillForm     = dynamic(() => import('../bills/new/page'),     { ssr: false, loading: () => <div className="py-10 text-center text-gray-400 text-sm">Loading…</div> })
const NewExpenseForm  = dynamic(() => import('../expenses/new/page'),  { ssr: false, loading: () => <div className="py-10 text-center text-gray-400 text-sm">Loading…</div> })
const AnalyticsPanel  = dynamic(() => import('./_components/AnalyticsPanel'), { ssr: false, loading: () => <div className="py-10 text-center text-gray-400 text-xs">Loading analytics…</div> })
const StaffClient     = dynamic(() => import('../staff/StaffClient'), { ssr: false, loading: () => <div className="py-10 text-center text-gray-400 text-sm">Loading…</div> })

// Defined locally (not imported from AnalyticsPanel.tsx) -- a cross-file type
// import here previously caused the analytics/recharts bundle to get pulled
// into the server bundle and crash the page on Vercel with a black screen.
type AnaSection = 'Items' | 'Sales' | 'Bills' | 'Counts' | 'Expenses'
const ANA_SECTION: Partial<Record<OuterTab, AnaSection>> = {
  items: 'Items', sales: 'Sales', bills: 'Bills', counts: 'Counts', expenses: 'Expenses',
}

type OuterTab = 'today' | 'items' | 'sales' | 'bills' | 'counts' | 'expenses' | 'cab' | 'staff'

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

const VIOLATIONS: Record<OuterTab, { key: string; label: string }[]> = {
  today: [],
  items: [
    { key: 'neg_soh',    label: 'Neg SOH' },
    { key: 'no_sp',      label: 'No SP' },
    { key: 'no_cp',      label: 'No CP' },
    { key: 'no_group',   label: 'No Group' },
    { key: 'duplicates', label: 'Duplicates' },
  ],
  sales: [
    { key: 'no_cash',      label: 'No Cash' },
    { key: 'missing_days', label: 'Missing Days' },
    { key: 'cost_price',   label: 'Cost Price' },
    { key: 'dup_receipt',  label: 'Dup Receipts' },
  ],
  bills: [],
  counts: [
    { key: 'daily', label: 'Daily' },
    { key: '15day', label: '15-Day' },
  ],
  expenses: [],
  cab: [],
  staff: [],
}

const HAMBURGER_LINKS = [
  { href: '/aliases',  label: 'Aliases'  },
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

const VALID_TABS: OuterTab[] = ['today', 'items', 'sales', 'bills', 'counts', 'expenses', 'cab', 'staff']

function ItemHubPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') as OuterTab | null
  const [outerTab, setOuterTab] = useState<OuterTab>(
    initialTab && VALID_TABS.includes(initialTab) ? initialTab : 'today'
  )
  const prevTabRef = useRef<OuterTab>('items')
  const [group, setGroup]               = useState<string | null>(null)
  const [productType, setProductType]   = useState<'all' | 'goods' | 'services'>('all')
  const [search, setSearch]             = useState('')
  const [violation, setViolation]       = useState<string | null>(null)
  const [groupOpen, setGroupOpen]       = useState(false)
  const [violationOpen, setViolationOpen] = useState(false)
  const [anaOpen, setAnaOpen]           = useState(false)
  const [hamburgerOpen, setHamburgerOpen] = useState(false)
  const [addForm, setAddForm]             = useState<'item' | 'sale' | 'bill' | 'expense' | null>(null)
  const groupRef     = useRef<HTMLDivElement>(null)
  const hamburgerRef = useRef<HTMLDivElement>(null)
  const swipeRef     = useRef<{ x: number; y: number } | null>(null)

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
  }

  useEffect(() => { loadBadgeData() }, [])
  usePolling(loadBadgeData, 20000)

  const badgeCounts: Partial<Record<OuterTab, number>> = useMemo(() => {
    const negSoh = items.filter(i => Number(i.calculated_soh) <= 0).length
    const noSp = items.filter(i => !i.selling_rate || parseFloat(i.selling_rate) === 0).length
    const noCp = items.filter(i => !i.purchase_rate || parseFloat(i.purchase_rate) === 0).length
    const f = globalFlags
    return {
      items: negSoh + noSp + noCp + (f?.noGroup?.length ?? 0) + (f?.duplicates?.length ?? 0),
      sales: (f?.noCash?.length ?? 0) + (f?.missingDays?.length ?? 0) + (f?.costGteSell?.length ?? 0) + (f?.dupReceipts?.length ?? 0),
      counts: pendingCounts.daily + pendingCounts.overdue,
      cab: f?.uncheckedCab?.length ?? 0,
      staff: f?.noStaffTimes?.length ?? 0,
    }
  }, [items, globalFlags, pendingCounts])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (groupRef.current && !groupRef.current.contains(e.target as Node)) setGroupOpen(false)
      if (hamburgerRef.current && !hamburgerRef.current.contains(e.target as Node)) setHamburgerOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function changeTab(t: OuterTab) {
    if (outerTab !== t) prevTabRef.current = outerTab
    setOuterTab(t)
    setViolation(null)
    setViolationOpen(false)
    setAnaOpen(false)
    setAddForm(null)
    if (t !== 'items') setProductType('all')
    router.replace(t === 'today' ? '/item' : `/item?tab=${t}`, { scroll: false })
  }

  const groups = ['All', ...Array.from(new Set(items.map(i => i.cf_group ?? 'Ungrouped'))).sort()]
  const currentViolations = VIOLATIONS[outerTab]
  const activeViolationLabel = currentViolations.find(v => v.key === violation)?.label ?? null

  const groupLabel = [
    group ?? 'All',
    productType !== 'all' ? (productType === 'goods' ? 'Goods' : 'Services') : null,
  ].filter(Boolean).join(' · ')

  const showControls = outerTab !== 'today' && outerTab !== 'staff'
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
          <div className="flex items-center gap-0.5 px-1 pt-1.5 pb-1 flex-1 min-w-0">
            <TabIcon icon="📦" label="Items"    active={outerTab === 'items'}    onClick={() => changeTab('items')}    count={badgeCounts.items} />
            <TabIcon icon="💰" label="Sales"    active={outerTab === 'sales'}    onClick={() => changeTab('sales')}    count={badgeCounts.sales} />
            <TabIcon icon="🧾" label="Bills"    active={outerTab === 'bills'}    onClick={() => changeTab('bills')} />
            <TabIcon icon="🔢" label="CNT"      active={outerTab === 'counts'}   onClick={() => changeTab('counts')}   count={badgeCounts.counts} />
            <TabIcon icon="💸" label="Exp."     active={outerTab === 'expenses'} onClick={() => changeTab('expenses')} />
            <TabIcon icon="🏦" label="CAB"      active={outerTab === 'cab'}      onClick={() => changeTab('cab')}      count={badgeCounts.cab} />
            <TabIcon icon="👤" label="Staff"    active={outerTab === 'staff'}    onClick={() => changeTab('staff')}    count={badgeCounts.staff} />
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

            {/* Violations toggle */}
            {currentViolations.length > 0 && (
              <>
                <div className="w-px h-4 bg-gray-200 shrink-0" />
                <button onClick={() => {
                    const opening = !violationOpen
                    setViolationOpen(opening)
                    if (opening) { setViolation(currentViolations[0].key); setAnaOpen(false) }
                    else setViolation(null)
                  }}
                  className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap flex items-center gap-1 transition
                    ${violationOpen ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  Violations <span className="text-[10px]">{violationOpen ? '▴' : '▾'}</span>
                </button>
              </>
            )}

            {/* Analytics toggle */}
            {ANA_SECTION[outerTab] && (
              <>
                <div className="w-px h-4 bg-gray-200 shrink-0" />
                <button onClick={() => setAnaOpen(o => {
                    const opening = !o
                    if (opening) { setViolationOpen(false); setViolation(null) }
                    return opening
                  })}
                  className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap flex items-center gap-1 transition
                    ${anaOpen ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  Ana
                </button>
              </>
            )}

            {/* Search */}
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="min-w-0 w-24 flex-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400" />

            {/* New button — Items, Sales, Bills, Expenses only */}
            {(['items', 'sales', 'bills', 'expenses'] as OuterTab[]).includes(outerTab) && (() => {
              const formKey = outerTab === 'items' ? 'item' : outerTab === 'sales' ? 'sale' : outerTab === 'bills' ? 'bill' : 'expense'
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
        {violationOpen && currentViolations.length > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 bg-red-50 border-t border-red-100 overflow-x-auto">
            {currentViolations.map(v => (
              <button key={v.key} onClick={() => setViolation(v.key)}
                className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg transition whitespace-nowrap
                  ${violation === v.key ? 'bg-red-600 text-white' : 'bg-white border border-red-200 text-red-700 hover:bg-red-100'}`}>
                {v.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 min-h-0 overflow-y-auto"
        onTouchStart={e => { const t = e.touches[0]; swipeRef.current = { x: t.clientX, y: t.clientY } }}
        onTouchEnd={e => {
          if (!swipeRef.current) return
          const dx = e.changedTouches[0].clientX - swipeRef.current.x
          const dy = e.changedTouches[0].clientY - swipeRef.current.y
          swipeRef.current = null
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) changeTab(outerTab === 'today' ? prevTabRef.current : 'today')
        }}>
        {addForm === 'sale'    && outerTab === 'sales'    && <div className="px-4"><NewSaleForm    onSuccess={() => { setAddForm(null); changeTab('sales') }} /></div>}
        {addForm === 'bill'    && outerTab === 'bills'    && <div className="px-4"><NewBillForm    onSuccess={() => { setAddForm(null); changeTab('bills') }} /></div>}
        {addForm === 'expense' && outerTab === 'expenses' && <div className="px-4"><NewExpenseForm onSuccess={() => { setAddForm(null); changeTab('expenses') }} /></div>}
        {anaOpen && ANA_SECTION[outerTab] && !addForm && (
          <TabErrorBoundary>
            <AnalyticsPanel section={ANA_SECTION[outerTab]!} />
          </TabErrorBoundary>
        )}
        {!anaOpen && outerTab === 'today' && !(addForm === 'sale' || addForm === 'bill' || addForm === 'expense') && (
          <TabErrorBoundary>
            <div className="h-full overflow-y-auto px-4">
              <TodayContent />
            </div>
          </TabErrorBoundary>
        )}
        {!anaOpen && outerTab === 'items' && (
          itemsLoading
            ? <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>
            : <ItemsTab
                items={items}
                group={group}
                productType={productType}
                search={search}
                violation={violation}
                onItemsChanged={setItems}
                showAdd={addForm === 'item'}
                onCloseAdd={() => setAddForm(null)}
              />
        )}
        {!anaOpen && addForm !== 'sale'    && outerTab === 'sales'    && <SalesTab items={items} groupFilter={group} search={search} violation={violation} />}
        {!anaOpen && addForm !== 'bill'    && outerTab === 'bills'    && <BillsTab items={items} groupFilter={group} search={search} />}
        {!anaOpen && outerTab === 'counts'   && <CountsTab items={items} groupFilter={group} search={search} violation={violation} />}
        {!anaOpen && addForm !== 'expense' && outerTab === 'expenses' && <ExpensesTab search={search} />}
        {!anaOpen && outerTab === 'cab'      && <CABTab />}
        {!anaOpen && outerTab === 'staff'    && (
          <TabErrorBoundary>
            <StaffClient role={role} username={username} embedded />
          </TabErrorBoundary>
        )}
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
