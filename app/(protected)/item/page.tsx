'use client'
import { useState, useEffect, useRef, Component, type ReactNode } from 'react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'

class TabErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false }
  static getDerivedStateFromError() { return { error: true } }
  render() {
    if (this.state.error) return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
        <p className="text-sm">This tab failed to load.</p>
        <button onClick={() => this.setState({ error: false })}
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

type OuterTab = 'today' | 'items' | 'sales' | 'bills' | 'counts' | 'expenses' | 'cab'

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
  ],
  bills: [],
  counts: [
    { key: 'daily', label: 'Daily' },
    { key: '15day', label: '15-Day' },
  ],
  expenses: [],
  cab: [],
}

const HAMBURGER_LINKS = [
  { href: '/aliases',  label: 'Aliases'  },
  { href: '/analysis', label: 'Analysis' },
  { href: '/staff',    label: 'Staff'    },
  { href: '/logs',     label: 'Logs'     },
  { href: '/users',    label: 'Users'    },
  { href: '/profile',  label: 'Profile'  },
]

function tabCls(active: boolean) {
  return `shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition whitespace-nowrap
    ${active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`
}

export default function ItemHubPage() {
  const [outerTab, setOuterTab] = useState<OuterTab>('items')
  const [group, setGroup]               = useState<string | null>(null)
  const [productType, setProductType]   = useState<'all' | 'goods' | 'services'>('all')
  const [search, setSearch]             = useState('')
  const [violation, setViolation]       = useState<string | null>(null)
  const [groupOpen, setGroupOpen]       = useState(false)
  const [violationOpen, setViolationOpen] = useState(false)
  const [hamburgerOpen, setHamburgerOpen] = useState(false)
  const [addForm, setAddForm]             = useState<'sale' | 'bill' | 'expense' | null>(null)
  const groupRef     = useRef<HTMLDivElement>(null)
  const violRef      = useRef<HTMLDivElement>(null)
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

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (groupRef.current && !groupRef.current.contains(e.target as Node)) setGroupOpen(false)
      if (violRef.current && !violRef.current.contains(e.target as Node)) setViolationOpen(false)
      if (hamburgerRef.current && !hamburgerRef.current.contains(e.target as Node)) setHamburgerOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function changeTab(t: OuterTab) {
    setOuterTab(t)
    setViolation(null)
    setAddForm(null)
    if (t !== 'items') setProductType('all')
  }

  const groups = ['All', ...Array.from(new Set(items.map(i => i.cf_group ?? 'Ungrouped'))).sort()]
  const currentViolations = VIOLATIONS[outerTab]
  const activeViolationLabel = currentViolations.find(v => v.key === violation)?.label ?? null

  const groupLabel = [
    group ?? 'All',
    productType !== 'all' ? (productType === 'goods' ? 'Goods' : 'Services') : null,
  ].filter(Boolean).join(' · ')

  const showControls = outerTab !== 'today'
  const hamburgerLinks = HAMBURGER_LINKS

  return (
    <div className="-mx-4 -mt-4 flex flex-col h-[100dvh] md:h-[calc(100dvh-56px)]">

      {/* ── Header ── */}
      <div className="shrink-0 bg-white border-b border-gray-200">

        {/* Row 1: scrollable tabs + hamburger (hamburger outside scroll area to avoid clip) */}
        <div className="flex items-center pr-2">
          <div className="flex items-center gap-1 px-2 pt-1.5 pb-1 overflow-x-auto flex-1 min-w-0">
            <button onClick={() => changeTab('today')}    className={tabCls(outerTab === 'today')}>Today</button>
            <button onClick={() => changeTab('items')}    className={tabCls(outerTab === 'items')}>Items</button>
            <button onClick={() => changeTab('sales')}    className={tabCls(outerTab === 'sales')}>Sales</button>
            <button onClick={() => changeTab('bills')}    className={tabCls(outerTab === 'bills')}>Bills</button>
            <button onClick={() => changeTab('counts')}   className={tabCls(outerTab === 'counts')}>Counts</button>
            <button onClick={() => changeTab('expenses')} className={tabCls(outerTab === 'expenses')}>Exp.</button>
            <button onClick={() => changeTab('cab')}      className={tabCls(outerTab === 'cab')}>CAB</button>
          </div>

          {/* Hamburger — outside overflow-x-auto so dropdown isn't clipped */}
          <div className="relative shrink-0 pt-1.5 pb-1" ref={hamburgerRef}>
            <button onClick={() => setHamburgerOpen(o => !o)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition font-bold text-lg leading-none">
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

            {/* Violations dropdown */}
            {currentViolations.length > 0 && (
              <>
                <div className="w-px h-4 bg-gray-200 shrink-0" />
                <div className="relative shrink-0" ref={violRef}>
                  <button onClick={() => setViolationOpen(o => !o)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap flex items-center gap-1 transition
                      ${violation ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    {activeViolationLabel ?? 'Violations'} <span className="text-[10px]">▾</span>
                  </button>
                  {violationOpen && (
                    <div className="absolute top-full left-0 mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg z-30 min-w-[150px]">
                      {currentViolations.map(v => (
                        <button key={v.key} onClick={() => { setViolation(violation === v.key ? null : v.key); setViolationOpen(false) }}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-red-50 transition
                            ${violation === v.key ? 'text-red-600 font-semibold' : 'text-gray-700'}`}>
                          {v.label}
                        </button>
                      ))}
                      {violation && (
                        <button onClick={() => { setViolation(null); setViolationOpen(false) }}
                          className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50 border-t border-gray-100 transition">
                          Clear filter
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Search */}
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="min-w-0 w-24 flex-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400" />

            {/* New button — Sales, Bills, Expenses only */}
            {(['sales', 'bills', 'expenses'] as OuterTab[]).includes(outerTab) && (() => {
              const formKey = outerTab === 'sales' ? 'sale' : outerTab === 'bills' ? 'bill' : 'expense'
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
      </div>

      {/* ── Content ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {addForm === 'sale'    && <div className="px-4"><NewSaleForm    onSuccess={() => { setAddForm(null); changeTab('sales') }} /></div>}
        {addForm === 'bill'    && <div className="px-4"><NewBillForm    onSuccess={() => { setAddForm(null); changeTab('bills') }} /></div>}
        {addForm === 'expense' && <div className="px-4"><NewExpenseForm onSuccess={() => { setAddForm(null); changeTab('expenses') }} /></div>}
        {!addForm && outerTab === 'today' && (
          <TabErrorBoundary>
            <div className="h-full overflow-y-auto px-4">
              <TodayContent />
            </div>
          </TabErrorBoundary>
        )}
        {!addForm && outerTab === 'items' && (
          itemsLoading
            ? <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>
            : <ItemsTab
                items={items}
                group={group}
                productType={productType}
                search={search}
                violation={violation}
                onItemsChanged={setItems}
              />
        )}
        {!addForm && outerTab === 'sales'    && <SalesTab items={items} groupFilter={group} search={search} violation={violation} />}
        {!addForm && outerTab === 'bills'    && <BillsTab items={items} groupFilter={group} search={search} />}
        {!addForm && outerTab === 'counts'   && <CountsTab items={items} groupFilter={group} search={search} violation={violation} />}
        {!addForm && outerTab === 'expenses' && <ExpensesTab search={search} />}
        {!addForm && outerTab === 'cab'      && <CABTab />}
      </div>
    </div>
  )
}
