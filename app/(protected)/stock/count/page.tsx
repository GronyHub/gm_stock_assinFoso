'use client'
import { useState, useEffect, useRef } from 'react'
import { fmtDate } from '@/lib/fmtDate'

// ── Types ─────────────────────────────────────────────────────────────────────

type Item = {
  item_id: number; item_name: string; cf_group: string | null
  calculated_soh: number; last_count_date: string | null; days_overdue: number | null
}

type Flags = {
  noCash: any[]; missingDays: any[]; duplicates: any[]
  costGteSell: any[]; notInInventory: any[]; noGroup: any[]; noStaffTimes: any[]
}

type InvItem = { id: number; canonical_name: string }
type NameRes = {
  unmatched: { name: string; line_count: number }[]
  matched: { name: string; canonical_name: string; line_count: number }[]
  items: InvItem[]
}

const ALL_TABS = ['Daily', '15-Day', 'No Cash', 'Missing Days', 'No Times', 'Duplicates', 'Cost≥Price', 'Not in Inv.', 'No Group', 'Inv. Done', 'Inv. Todo'] as const
type Tab = typeof ALL_TABS[number]
const STAFF = ['joe', 'bino', 'james', 'rawlings']

// ── Shared UI ─────────────────────────────────────────────────────────────────

function Badge({ n }: { n: number }) {
  if (!n) return null
  return <span className="ml-1 bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{n}</span>
}

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400'

// ── Count cards ───────────────────────────────────────────────────────────────

function CountCard({ item, onSaved }: { item: Item; onSaved: (id: number) => void }) {
  const [customQty, setCustomQty] = useState('')
  const [saving, setSaving] = useState(false)
  const soh = Number(item.calculated_soh)

  async function submit(qty: number) {
    setSaving(true)
    const res = await fetch('/api/stock/count', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.item_id, qty, notes: '' }),
    })
    setSaving(false)
    if (res.ok) onSaved(item.item_id)
  }

  const overdue = item.days_overdue
  const badgeClass = overdue === null || overdue === 0 ? 'bg-orange-100 text-orange-600'
    : overdue <= 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'
  const badgeLabel = overdue === null ? 'Never counted' : overdue === 0 ? 'Not today' : `${overdue}d overdue`

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-gray-900 font-medium leading-snug">{item.item_name}</p>
          {item.cf_group && <p className="text-gray-400 text-xs mt-0.5">{item.cf_group}</p>}
        </div>
        <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${badgeClass}`}>{badgeLabel}</span>
      </div>
      <p className="text-sm text-gray-600">Stock on hand: <span className="text-gray-900 font-semibold text-base">{soh}</span></p>
      <div className="flex items-center gap-2">
        <button onClick={() => submit(soh)} disabled={saving}
          className="flex-1 bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-3 transition">
          {saving ? 'Saving…' : `Same (${soh})`}
        </button>
        <input type="number" min="0" step="any" value={customQty} onChange={e => setCustomQty(e.target.value)}
          placeholder="New qty" inputMode="decimal"
          className="w-24 bg-gray-100 border border-gray-300 rounded-xl px-2 py-3 text-base text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400 text-center" />
        <button onClick={() => { if (customQty !== '') submit(Number(customQty)) }}
          disabled={customQty === '' || saving}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white text-sm font-semibold rounded-xl px-4 py-3 transition">
          Save
        </button>
      </div>
    </div>
  )
}

// ── Flag fix row wrappers ─────────────────────────────────────────────────────

function FixRow({ label, sub, onFixed, children }: {
  label: string; sub?: string; onFixed?: () => void; children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 gap-2">
        <div className="min-w-0">
          <p className="text-sm text-gray-900 font-medium truncate">{label}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <button onClick={() => setOpen(o => !o)}
          className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition">
          {open ? 'Close' : 'Fix'}
        </button>
      </div>
      {open && <div className="px-3 pb-3 pt-1 border-t border-gray-100 space-y-2">{children}</div>}
    </div>
  )
}

// No Cash — enter cash counted
function NoCashFix({ r, onFixed }: { r: any; onFixed: (id: number) => void }) {
  const [cash, setCash] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!cash) return
    setSaving(true)
    await fetch(`/api/sales/${r.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cash_counted: Number(cash) }),
    })
    setSaving(false)
    onFixed(r.id)
  }

  return (
    <FixRow label={r.receipt_number} sub={`${fmtDate(r.receipt_date)} · ₵${Number(r.invoice_amount).toFixed(2)}`}>
      <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="Cash counted (₵)"
        value={cash} onChange={e => setCash(e.target.value)} className={inputCls} />
      <button onClick={save} disabled={!cash || saving}
        className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2.5 transition">
        {saving ? 'Saving…' : 'Save Cash Counted'}
      </button>
    </FixRow>
  )
}

// Missing Days — create a minimal receipt for that date
function MissingDayFix({ date, onFixed }: { date: string; onFixed: (d: string) => void }) {
  const [total, setTotal] = useState('')
  const [cash, setCash] = useState('')
  const [saving, setSaving] = useState(false)

  async function markNoSales() {
    setSaving(true)
    await fetch('/api/sales/receipt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, total: 0, customerName: 'No Sales Day' }),
    })
    setSaving(false)
    onFixed(date)
  }

  async function addReceipt() {
    if (!total) return
    setSaving(true)
    await fetch('/api/sales/receipt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, total: Number(total), cashCounted: cash ? Number(cash) : null, customerName: 'Walk In Customer' }),
    })
    setSaving(false)
    onFixed(date)
  }

  return (
    <FixRow label={fmtDate(date)} sub="No sales receipt on this day">
      <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="Sales total (₵) — leave blank if no sales"
        value={total} onChange={e => setTotal(e.target.value)} className={inputCls} />
      {total && (
        <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="Cash counted (₵, optional)"
          value={cash} onChange={e => setCash(e.target.value)} className={inputCls} />
      )}
      <div className="flex gap-2">
        {total ? (
          <button onClick={addReceipt} disabled={saving}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2.5 transition">
            {saving ? 'Saving…' : 'Create Receipt'}
          </button>
        ) : (
          <button onClick={markNoSales} disabled={saving}
            className="flex-1 bg-gray-500 hover:bg-gray-400 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2.5 transition">
            {saving ? 'Saving…' : 'Mark as No Sales Day'}
          </button>
        )}
      </div>
    </FixRow>
  )
}

// No Times — add staff times for a past date
function NoTimesFix({ date, onFixed }: { date: string; onFixed: (d: string) => void }) {
  const [staff, setStaff] = useState(STAFF[0])
  const [timeIn, setTimeIn] = useState('')
  const [timeOut, setTimeOut] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!timeIn) return
    setSaving(true)
    await fetch('/api/staff-times/entry', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_name: staff, work_date: date, actual_in: timeIn, actual_out: timeOut || null }),
    })
    setSaving(false)
    onFixed(date)
  }

  return (
    <FixRow label={fmtDate(date)} sub="No staff times recorded">
      <select value={staff} onChange={e => setStaff(e.target.value)} className={inputCls}>
        {STAFF.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <input placeholder="Time In (e.g. 8:30am)" value={timeIn} onChange={e => setTimeIn(e.target.value)} className={inputCls} />
        <input placeholder="Time Out (optional)" value={timeOut} onChange={e => setTimeOut(e.target.value)} className={inputCls} />
      </div>
      <button onClick={save} disabled={!timeIn || saving}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2.5 transition">
        {saving ? 'Saving…' : 'Save Times'}
      </button>
    </FixRow>
  )
}

// Duplicates — dismiss pair as not a duplicate
function DuplicateFix({ r, onFixed }: { r: any; onFixed: (key: string) => void }) {
  const key = `${r.id1}-${r.id2}`
  return (
    <FixRow label={r.name1} sub={`vs. ${r.name2}`}>
      <p className="text-xs text-gray-500">If these are genuinely different items, dismiss this pair. If one is a real duplicate, delete it from Inventory.</p>
      <button onClick={() => onFixed(key)}
        className="w-full bg-gray-600 hover:bg-gray-500 text-white text-sm font-semibold rounded-xl py-2.5 transition">
        Dismiss — Not a Duplicate
      </button>
    </FixRow>
  )
}

// Cost >= Price — fix the item's cost price
function CostPriceFix({ r, onFixed }: { r: any; onFixed: (itemId: number) => void }) {
  const [cost, setCost] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!cost) return
    setSaving(true)
    await fetch(`/api/items/${r.item_id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purchase_rate: Number(cost) }),
    })
    setSaving(false)
    onFixed(r.item_id)
  }

  return (
    <FixRow label={r.item_name}
      sub={`${r.receipt_number} · Sold ₵${Number(r.selling_price).toFixed(2)} · Cost ₵${Number(r.cost_price).toFixed(2)}`}>
      <input type="number" min="0" step="0.01" inputMode="decimal"
        placeholder={`New cost price (currently ₵${Number(r.cost_price).toFixed(2)})`}
        value={cost} onChange={e => setCost(e.target.value)} className={inputCls} />
      <button onClick={save} disabled={!cost || saving}
        className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2.5 transition">
        {saving ? 'Saving…' : 'Update Cost Price'}
      </button>
    </FixRow>
  )
}

// Not in Inv. — redirect to Inv. Todo tab
function NotInInvRow({ r, onSwitchTab }: { r: any; onSwitchTab: () => void }) {
  return (
    <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-3 py-2.5 gap-2">
      <div className="min-w-0">
        <p className="text-sm text-gray-900 font-medium truncate">{r.item_name}</p>
        <p className="text-xs text-gray-400 mt-0.5">{r.source}</p>
      </div>
      <button onClick={onSwitchTab}
        className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition">
        Resolve →
      </button>
    </div>
  )
}

// No Group — assign a group
function NoGroupFix({ r, onFixed }: { r: any; onFixed: (id: number) => void }) {
  const [group, setGroup] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!group.trim()) return
    setSaving(true)
    await fetch(`/api/items/${r.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cf_group: group.trim() }),
    })
    setSaving(false)
    onFixed(r.id)
  }

  return (
    <FixRow label={r.item_name} sub={`Status: ${r.status}`}>
      <input placeholder="Group name (e.g. Photo Papers)" value={group}
        onChange={e => setGroup(e.target.value)} className={inputCls} />
      <button onClick={save} disabled={!group.trim() || saving}
        className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2.5 transition">
        {saving ? 'Saving…' : 'Assign Group'}
      </button>
    </FixRow>
  )
}

// ── Name resolution components ────────────────────────────────────────────────

function NameResolveRow({
  name, count, items, onResolved,
}: {
  name: string; count: number; items: InvItem[]
  onResolved: (name: string, canonical: string, itemId: number) => void
}) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<InvItem | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const filtered = search.length >= 1
    ? items.filter(i => i.canonical_name.toLowerCase().includes(search.toLowerCase())).slice(0, 25)
    : []

  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [])

  async function save() {
    if (!selected) return
    setSaving(true)
    await fetch('/api/flags/name-resolution', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_name: name, item_id: selected.id, canonical_name: selected.canonical_name }),
    })
    setSaving(false)
    onResolved(name, selected.canonical_name, selected.id)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-900 leading-snug">{name}</p>
        <span className="shrink-0 text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{count} line{count !== 1 ? 's' : ''}</span>
      </div>
      <div ref={ref} className="relative">
        <input value={search}
          onChange={e => { setSearch(e.target.value); setSelected(null); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search inventory to match…"
          className={inputCls} />
        {open && filtered.length > 0 && (
          <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
            {filtered.map(item => (
              <button key={item.id} onMouseDown={e => e.preventDefault()}
                onClick={() => { setSelected(item); setSearch(item.canonical_name); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-sm text-gray-800 hover:bg-blue-50 border-b border-gray-100 last:border-0">
                {item.canonical_name}
              </button>
            ))}
          </div>
        )}
        {open && search.length >= 1 && filtered.length === 0 && (
          <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 text-sm text-gray-400">
            No match found
          </div>
        )}
      </div>
      {selected && (
        <button onClick={save} disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2.5 transition">
          {saving ? 'Saving…' : `Map → ${selected.canonical_name}`}
        </button>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function StockCountPage() {
  const [tab, setTab] = useState<Tab>('Daily')
  const [dailyItems, setDailyItems] = useState<Item[]>([])
  const [overdueItems, setOverdueItems] = useState<Item[]>([])
  const [flags, setFlags] = useState<Flags | null>(null)
  const [loading, setLoading] = useState(true)
  const [flagsLoading, setFlagsLoading] = useState(false)
  const [nameRes, setNameRes] = useState<NameRes | null>(null)
  const [nameResLoading, setNameResLoading] = useState(false)
  // Dismissed duplicate keys stored in state (persisted to localStorage)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    const stored = localStorage.getItem('dismissed_duplicates')
    if (stored) setDismissed(new Set(JSON.parse(stored)))
  }, [])

  useEffect(() => {
    Promise.all([
      fetch('/api/stock/daily').then(r => r.json()),
      fetch('/api/stock/overdue').then(r => r.json()),
    ]).then(([daily, overdue]) => {
      setDailyItems(daily); setOverdueItems(overdue); setLoading(false)
    })
  }, [])

  useEffect(() => {
    const flagTabs: Tab[] = ['No Cash', 'Missing Days', 'No Times', 'Duplicates', 'Cost≥Price', 'Not in Inv.', 'No Group']
    if (flagTabs.includes(tab) && !flags && !flagsLoading) {
      setFlagsLoading(true)
      fetch('/api/flags')
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(d => { setFlags(d); setFlagsLoading(false) })
        .catch(() => {
          setFlags({ noCash: [], missingDays: [], duplicates: [], costGteSell: [], notInInventory: [], noGroup: [], noStaffTimes: [] })
          setFlagsLoading(false)
        })
    }
  }, [tab, flags, flagsLoading])

  useEffect(() => {
    const nameResTabs: Tab[] = ['Inv. Done', 'Inv. Todo']
    if (nameResTabs.includes(tab) && !nameRes && !nameResLoading) {
      setNameResLoading(true)
      fetch('/api/flags/name-resolution')
        .then(r => r.json())
        .then(d => { setNameRes(d); setNameResLoading(false) })
        .catch(() => { setNameRes({ unmatched: [], matched: [], items: [] }); setNameResLoading(false) })
    }
  }, [tab, nameRes, nameResLoading])

  function removeDaily(id: number) { setDailyItems(prev => prev.filter(i => i.item_id !== id)) }
  function removeOverdue(id: number) { setOverdueItems(prev => prev.filter(i => i.item_id !== id)) }

  function dismissDuplicate(key: string) {
    setDismissed(prev => {
      const next = new Set(prev).add(key)
      localStorage.setItem('dismissed_duplicates', JSON.stringify([...next]))
      return next
    })
  }

  function handleResolved(rawName: string, canonical: string, itemId: number) {
    setNameRes(prev => {
      if (!prev) return prev
      const row = prev.unmatched.find(u => u.name === rawName)
      return {
        ...prev,
        unmatched: prev.unmatched.filter(u => u.name !== rawName),
        matched: [{ name: rawName, canonical_name: canonical, line_count: row?.line_count ?? 1 }, ...prev.matched],
      }
    })
  }

  if (loading) return <div className="py-20 text-center text-gray-600">Loading…</div>

  const countItems = tab === 'Daily' ? dailyItems : overdueItems
  const isCountTab = tab === 'Daily' || tab === '15-Day'
  const isNameResTab = tab === 'Inv. Done' || tab === 'Inv. Todo'

  const activeDups = flags ? flags.duplicates.filter((r: any) => !dismissed.has(`${r.id1}-${r.id2}`)) : []

  function renderFlags() {
    if (flagsLoading || !flags) return <div className="py-10 text-center text-gray-400">Loading…</div>

    if (tab === 'No Cash') return (
      <div className="space-y-2">
        <p className="text-xs text-gray-400">{flags.noCash.length} walk-in receipt{flags.noCash.length !== 1 ? 's' : ''} missing cash counted</p>
        {flags.noCash.length === 0
          ? <p className="py-10 text-center text-gray-400 text-sm">All walk-in receipts have cash counted recorded.</p>
          : flags.noCash.map((r: any) => (
            <NoCashFix key={r.id} r={r} onFixed={id =>
              setFlags(f => f ? { ...f, noCash: f.noCash.filter((x: any) => x.id !== id) } : f)
            } />
          ))
        }
      </div>
    )

    if (tab === 'Missing Days') return (
      <div className="space-y-2">
        <p className="text-xs text-gray-400">{flags.missingDays.length} day{flags.missingDays.length !== 1 ? 's' : ''} with no sales receipts (excluding Sundays)</p>
        {flags.missingDays.length === 0
          ? <p className="py-10 text-center text-gray-400 text-sm">No missing days found.</p>
          : flags.missingDays.map((r: any) => (
            <MissingDayFix key={r.missing_date} date={r.missing_date} onFixed={d =>
              setFlags(f => f ? { ...f, missingDays: f.missingDays.filter((x: any) => x.missing_date !== d) } : f)
            } />
          ))
        }
      </div>
    )

    if (tab === 'No Times') return (
      <div className="space-y-2">
        <p className="text-xs text-gray-400">{flags.noStaffTimes.length} day{flags.noStaffTimes.length !== 1 ? 's' : ''} with no staff times recorded (excluding Sundays)</p>
        {flags.noStaffTimes.length === 0
          ? <p className="py-10 text-center text-gray-400 text-sm">All working days have staff times recorded.</p>
          : flags.noStaffTimes.map((r: any) => (
            <NoTimesFix key={r.missing_date} date={r.missing_date} onFixed={d =>
              setFlags(f => f ? { ...f, noStaffTimes: f.noStaffTimes.filter((x: any) => x.missing_date !== d) } : f)
            } />
          ))
        }
      </div>
    )

    if (tab === 'Duplicates') return (
      <div className="space-y-2">
        <p className="text-xs text-gray-400">{activeDups.length} possible duplicate pair{activeDups.length !== 1 ? 's' : ''} (similarity &gt; 65%)</p>
        {activeDups.length === 0
          ? <p className="py-10 text-center text-gray-400 text-sm">No duplicate or similar item names found.</p>
          : activeDups.map((r: any) => (
            <DuplicateFix key={`${r.id1}-${r.id2}`} r={r} onFixed={dismissDuplicate} />
          ))
        }
      </div>
    )

    if (tab === 'Cost≥Price') return (
      <div className="space-y-2">
        <p className="text-xs text-gray-400">{flags.costGteSell.length} line{flags.costGteSell.length !== 1 ? 's' : ''} where cost price ≥ selling price</p>
        {flags.costGteSell.length === 0
          ? <p className="py-10 text-center text-gray-400 text-sm">No items sold at or below cost price.</p>
          : flags.costGteSell.map((r: any, i: number) => (
            <CostPriceFix key={`${r.item_id}-${i}`} r={r} onFixed={itemId =>
              setFlags(f => f ? { ...f, costGteSell: f.costGteSell.filter((x: any) => x.item_id !== itemId) } : f)
            } />
          ))
        }
      </div>
    )

    if (tab === 'Not in Inv.') return (
      <div className="space-y-2">
        <p className="text-xs text-gray-400">{flags.notInInventory.length} item name{flags.notInInventory.length !== 1 ? 's' : ''} not found in inventory — use Resolve to match them</p>
        {flags.notInInventory.length === 0
          ? <p className="py-10 text-center text-gray-400 text-sm">All items in receipts and counts are in inventory.</p>
          : flags.notInInventory.map((r: any, i: number) => (
            <NotInInvRow key={i} r={r} onSwitchTab={() => setTab('Inv. Todo')} />
          ))
        }
      </div>
    )

    if (tab === 'No Group') return (
      <div className="space-y-2">
        <p className="text-xs text-gray-400">{flags.noGroup.length} item{flags.noGroup.length !== 1 ? 's' : ''} with no group assigned</p>
        {flags.noGroup.length === 0
          ? <p className="py-10 text-center text-gray-400 text-sm">All items have a group assigned.</p>
          : flags.noGroup.map((r: any) => (
            <NoGroupFix key={r.id} r={r} onFixed={id =>
              setFlags(f => f ? { ...f, noGroup: f.noGroup.filter((x: any) => x.id !== id) } : f)
            } />
          ))
        }
      </div>
    )

    return null
  }

  function renderNameRes() {
    if (nameResLoading || !nameRes) return <div className="py-10 text-center text-gray-400">Loading…</div>

    if (tab === 'Inv. Todo') return (
      <div className="space-y-2">
        <p className="text-xs text-gray-400">{nameRes.unmatched.length} receipt line name{nameRes.unmatched.length !== 1 ? 's' : ''} not matched — search and select the correct inventory item</p>
        {nameRes.unmatched.length === 0
          ? <p className="py-10 text-center text-gray-400 text-sm">All names matched.</p>
          : nameRes.unmatched.map(u => (
            <NameResolveRow key={u.name} name={u.name} count={u.line_count}
              items={nameRes.items} onResolved={handleResolved} />
          ))
        }
      </div>
    )

    if (tab === 'Inv. Done') return (
      <div className="space-y-2">
        <p className="text-xs text-gray-400">{nameRes.matched.length} receipt line name{nameRes.matched.length !== 1 ? 's' : ''} matched to inventory</p>
        {nameRes.matched.length === 0
          ? <p className="py-10 text-center text-gray-400 text-sm">No matched names yet.</p>
          : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Receipt Name</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Matched To</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Lines</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {nameRes.matched.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-800">{r.name}</td>
                      <td className="px-3 py-2 text-blue-700 font-medium">{r.canonical_name}</td>
                      <td className="px-3 py-2 text-gray-500">{r.line_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
    )

    return null
  }

  const flagCounts: Partial<Record<Tab, number>> = flags ? {
    'No Cash': flags.noCash.length,
    'Missing Days': flags.missingDays.length,
    'No Times': flags.noStaffTimes.length,
    'Duplicates': activeDups.length,
    'Cost≥Price': flags.costGteSell.length,
    'Not in Inv.': flags.notInInventory.length,
    'No Group': flags.noGroup.length,
  } : {}

  const nameResCounts: Partial<Record<Tab, number>> = nameRes ? {
    'Inv. Todo': nameRes.unmatched.length,
    'Inv. Done': nameRes.matched.length,
  } : {}

  return (
    <div className="py-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Stock Count & Flags</h1>
        <p className="text-sm text-gray-400 mt-0.5">{dailyItems.length + overdueItems.length} count{dailyItems.length + overdueItems.length !== 1 ? 's' : ''} pending</p>
      </div>

      {/* Tabs — scrollable on mobile */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 min-w-max">
          {ALL_TABS.map(t => {
            const cnt = t === 'Daily' ? dailyItems.length
              : t === '15-Day' ? overdueItems.length
              : (flagCounts[t] ?? nameResCounts[t] ?? 0)
            return (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition
                  ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {t}<Badge n={cnt} />
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      {isCountTab ? (
        countItems.length === 0 ? (
          <p className="py-10 text-center text-gray-400 text-sm">
            {tab === 'Daily' ? 'All daily items counted!' : 'All items up to date!'}
          </p>
        ) : (
          <div className="space-y-3">
            {countItems.map(item => (
              <CountCard key={item.item_id} item={item} onSaved={tab === 'Daily' ? removeDaily : removeOverdue} />
            ))}
          </div>
        )
      ) : isNameResTab ? renderNameRes() : renderFlags()}
    </div>
  )
}
