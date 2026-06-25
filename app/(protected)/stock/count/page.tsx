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
  costGteSell: any[]; notInInventory: any[]; noGroup: any[]; noStaffTimes: any[]; uncheckedCab: any[]
  groupNames: string[]
}

type InvItem = { id: number; canonical_name: string }
type NameRes = {
  unmatched: { name: string; line_count: number }[]
  matched: { name: string; canonical_name: string; line_count: number }[]
  items: InvItem[]
}

const ALL_TABS = ['Daily', '15-Day', 'No Cash', 'Missing Days', 'No Times', 'Duplicates', 'Cost≥Price', 'Not in Inv.', 'No Group', 'CAB Weekly', 'Inv. Done', 'Inv. Todo'] as const
type Tab = typeof ALL_TABS[number]
const STAFF = ['joe', 'bino', 'james', 'rawlings']

// ── Shared UI ─────────────────────────────────────────────────────────────────

function Badge({ n }: { n: number }) {
  if (!n) return null
  return <span className="ml-1 bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{n}</span>
}

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 placeholder-gray-400 outline-none focus:ring-1 focus:ring-blue-400'

// ── Count table row ───────────────────────────────────────────────────────────

function CountRow({ item, onSaved }: { item: Item; onSaved: (id: number) => void }) {
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
  const badgeLabel = overdue === null ? 'Never' : overdue === 0 ? 'Today' : `${overdue}d`

  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="px-2 py-1.5 min-w-0">
        <p className="text-[11px] text-gray-900 font-semibold leading-tight truncate max-w-[120px]">{item.item_name}</p>
        {item.cf_group && <p className="text-[9px] text-gray-400 leading-tight truncate">{item.cf_group}</p>}
      </td>
      <td className="px-1 py-1.5 text-center text-[11px] font-bold text-gray-900 whitespace-nowrap">{soh}</td>
      <td className="px-1 py-1.5">
        <span className={`text-[9px] font-semibold px-1 py-0.5 rounded-full whitespace-nowrap ${badgeClass}`}>{badgeLabel}</span>
      </td>
      <td className="px-1 py-1.5">
        <div className="flex items-center gap-1">
          <button onClick={() => submit(soh)} disabled={saving}
            className="bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white text-[10px] font-semibold rounded px-1.5 py-1 whitespace-nowrap transition">
            {saving ? '…' : `=${soh}`}
          </button>
          <input type="number" min="0" step="any" value={customQty} onChange={e => setCustomQty(e.target.value)}
            placeholder="qty" inputMode="decimal"
            className="w-12 bg-gray-100 border border-gray-200 rounded px-1 py-1 text-[11px] text-center outline-none focus:ring-1 focus:ring-blue-400" />
          <button onClick={() => { if (customQty !== '') submit(Number(customQty)) }}
            disabled={customQty === '' || saving}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white text-[10px] font-semibold rounded px-1.5 py-1 transition">
            Save
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Flag fix row wrappers ─────────────────────────────────────────────────────

function FixRow({ label, sub, children }: {
  label: string; sub?: string; children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <div className="flex items-center justify-between px-3 py-1.5 gap-2">
        <div className="min-w-0 flex-1">
          <span className="text-[11px] text-gray-900 font-semibold">{label}</span>
          {sub && <span className="ml-2 text-[10px] text-gray-400">{sub}</span>}
        </div>
        <button onClick={() => setOpen(o => !o)}
          className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition">
          {open ? 'Close' : 'Fix'}
        </button>
      </div>
      {open && <div className="px-3 pb-2 border-t border-gray-50 space-y-1.5 pt-1.5">{children}</div>}
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
        className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg py-1.5 transition">
        {saving ? 'Saving…' : 'Save Cash Counted'}
      </button>
    </FixRow>
  )
}

const NO_WORK_REASONS = [
  'No work — Public Holiday',
  'No work — Christmas Day',
  'No work — Good Friday',
  'No work — Easter Monday',
  'No work — Independence Day',
  'No work — Special Assignment',
  'No work — Shop Closed',
  'No work — Staff Training',
  'No work — Other',
]

// Missing Days — create a minimal receipt for that date
function MissingDayFix({ date, onFixed }: { date: string; onFixed: (d: string) => void }) {
  const [total, setTotal] = useState('')
  const [cash, setCash] = useState('')
  const [saving, setSaving] = useState(false)
  const [showNoWork, setShowNoWork] = useState(false)
  const [noWorkReason, setNoWorkReason] = useState(NO_WORK_REASONS[0])

  async function markNoWork() {
    setSaving(true)
    await fetch('/api/flags/no-work', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ work_date: date, reason: noWorkReason }),
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
      {showNoWork ? (
        <div className="space-y-2">
          <select value={noWorkReason} onChange={e => setNoWorkReason(e.target.value)} className={inputCls}>
            {NO_WORK_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={markNoWork} disabled={saving}
              className="flex-1 bg-red-500 hover:bg-red-400 disabled:opacity-40 text-white text-xs font-semibold rounded-lg py-1.5 transition">
              {saving ? 'Saving…' : 'Confirm No Work'}
            </button>
            <button onClick={() => setShowNoWork(false)} disabled={saving}
              className="px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
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
              <button onClick={() => setShowNoWork(true)}
                className="flex-1 bg-orange-500 hover:bg-orange-400 text-white text-xs font-semibold rounded-lg py-1.5 transition">
                No Work
              </button>
            )}
          </div>
        </>
      )}
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
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg py-1.5 transition">
        {saving ? 'Saving…' : 'Save Times'}
      </button>
    </FixRow>
  )
}

// Duplicates — mark as different items
function DuplicateFix({ r, onFixed }: { r: any; onFixed: (id1: number, id2: number) => void }) {
  const [saving, setSaving] = useState(false)

  async function markDifferent() {
    setSaving(true)
    await fetch('/api/flags/dismiss-duplicate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id1: r.id1, id2: r.id2, name1: r.name1, name2: r.name2 }),
    })
    setSaving(false)
    onFixed(r.id1, r.id2)
  }

  return (
    <FixRow label={r.name1} sub={`vs. ${r.name2}`}>
      <p className="text-xs text-gray-500">Tap <strong>Different</strong> if these are genuinely separate items. To remove a real duplicate, delete it from Items.</p>
      <button onClick={markDifferent} disabled={saving}
        className="w-full bg-gray-600 hover:bg-gray-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg py-1.5 transition">
        {saving ? 'Saving…' : 'Different — Not a Duplicate'}
      </button>
    </FixRow>
  )
}

// Cost >= Price — fix the item's cost price
function CostPriceFix({ r, onFixed }: { r: any; onFixed: (itemId: number) => void }) {
  const [cost, setCost] = useState('')
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(false)

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
    <div>
      <button onClick={() => setExpanded(e => !e)}
        className="w-full text-left px-3 py-1.5 hover:bg-gray-50 transition">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-semibold text-gray-900 truncate block">{r.item_name}</span>
            <span className="text-[9px] text-gray-400">{fmtDate(r.receipt_date)} · </span>
            <span className="text-[9px] text-red-500">₵{Number(r.selling_price).toFixed(2)} sell · ₵{Number(r.cost_price).toFixed(2)} cost</span>
          </div>
          <span className="shrink-0 text-[10px] text-blue-600 font-semibold">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>
      {expanded && (
        <div className="px-3 pb-2 border-t border-gray-50 space-y-1.5 pt-1.5">
          <a href={`/sales?receipt=${r.receipt_id}`} target="_blank" rel="noreferrer"
            className="text-[10px] text-blue-600 font-semibold hover:underline">
            Open receipt {r.receipt_number} →
          </a>
          <input type="number" min="0" step="0.01" inputMode="decimal"
            placeholder={`New cost price (currently ₵${Number(r.cost_price).toFixed(2)})`}
            value={cost} onChange={e => setCost(e.target.value)} className={inputCls} />
          <button onClick={save} disabled={!cost || saving}
            className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white text-xs font-semibold rounded-lg py-1.5 transition">
            {saving ? 'Saving…' : 'Update Cost Price'}
          </button>
        </div>
      )}
    </div>
  )
}

// Not in Inv. — redirect to Inv. Todo tab
function NotInInvRow({ r, onSwitchTab }: { r: any; onSwitchTab: () => void }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 gap-2">
      <div className="min-w-0 flex-1">
        <span className="text-[11px] text-gray-900 font-semibold truncate block">{r.item_name}</span>
        <span className="text-[9px] text-gray-400">{r.source}</span>
      </div>
      <button onClick={onSwitchTab}
        className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition">
        Resolve →
      </button>
    </div>
  )
}

// No Group — assign a group from populated dropdown + free text fallback
function NoGroupFix({ r, groupNames, onFixed }: { r: any; groupNames: string[]; onFixed: (id: number) => void }) {
  const [selected, setSelected] = useState('')
  const [custom, setCustom] = useState('')
  const [saving, setSaving] = useState(false)

  const group = selected === '__custom__' ? custom.trim() : selected

  async function save() {
    if (!group) return
    setSaving(true)
    await fetch(`/api/items/${r.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cf_group: group }),
    })
    setSaving(false)
    onFixed(r.id)
  }

  return (
    <FixRow label={r.item_name} sub={`Status: ${r.status}`}>
      <select value={selected} onChange={e => setSelected(e.target.value)} className={inputCls}>
        <option value="">— Select a group —</option>
        {groupNames.map(g => <option key={g} value={g}>{g}</option>)}
        <option value="__custom__">+ New group name…</option>
      </select>
      {selected === '__custom__' && (
        <input placeholder="Type new group name" value={custom}
          onChange={e => setCustom(e.target.value)} className={inputCls} />
      )}
      <button onClick={save} disabled={!group || saving}
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
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg py-1.5 transition">
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
  // Dismissed duplicate pairs — loaded from DB, keyed as "id1-id2"
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    // Clear any legacy localStorage dismissals and load from DB
    localStorage.removeItem('dismissed_duplicates')
    fetch('/api/flags/dismiss-duplicate')
      .then(r => r.json())
      .then((rows: { item_id1: number; item_id2: number }[]) => {
        if (Array.isArray(rows)) setDismissed(new Set(rows.map(r => `${r.item_id1}-${r.item_id2}`)))
      })
      .catch(() => {})
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
    const flagTabs: Tab[] = ['No Cash', 'Missing Days', 'No Times', 'Duplicates', 'Cost≥Price', 'Not in Inv.', 'No Group', 'CAB Weekly']
    if (flagTabs.includes(tab) && !flags && !flagsLoading) {
      setFlagsLoading(true)
      fetch('/api/flags')
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(d => { setFlags(d); setFlagsLoading(false) })
        .catch(() => {
          setFlags({ noCash: [], missingDays: [], duplicates: [], costGteSell: [], notInInventory: [], noGroup: [], noStaffTimes: [], uncheckedCab: [], groupNames: [] })
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

  function dismissDuplicate(id1: number, id2: number) {
    const lo = Math.min(id1, id2), hi = Math.max(id1, id2)
    setDismissed(prev => new Set(prev).add(`${lo}-${hi}`))
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

  const activeDups = flags ? flags.duplicates.filter((r: any) => {
    const lo = Math.min(r.id1, r.id2), hi = Math.max(r.id1, r.id2)
    return !dismissed.has(`${lo}-${hi}`)
  }) : []

  function renderFlags() {
    if (flagsLoading || !flags) return <div className="py-10 text-center text-gray-400">Loading…</div>

    if (tab === 'No Cash') return (
      <div>
        <p className="text-[10px] text-gray-400 px-1 mb-1">{flags.noCash.length} walk-in receipt{flags.noCash.length !== 1 ? 's' : ''} missing cash counted</p>
        {flags.noCash.length === 0
          ? <p className="py-4 text-center text-gray-400 text-xs">All walk-in receipts have cash counted recorded.</p>
          : <div className="bg-white border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
              {flags.noCash.map((r: any) => (
                <NoCashFix key={r.id} r={r} onFixed={id =>
                  setFlags(f => f ? { ...f, noCash: f.noCash.filter((x: any) => x.id !== id) } : f)
                } />
              ))}
            </div>
        }
      </div>
    )

    if (tab === 'Missing Days') return (
      <div>
        <p className="text-[10px] text-gray-400 px-1 mb-1">{flags.missingDays.length} day{flags.missingDays.length !== 1 ? 's' : ''} with no sales receipts (excluding Sundays)</p>
        {flags.missingDays.length === 0
          ? <p className="py-4 text-center text-gray-400 text-xs">No missing days found.</p>
          : <div className="bg-white border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
              {flags.missingDays.map((r: any) => (
                <MissingDayFix key={r.missing_date} date={r.missing_date} onFixed={d =>
                  setFlags(f => f ? { ...f, missingDays: f.missingDays.filter((x: any) => x.missing_date !== d) } : f)
                } />
              ))}
            </div>
        }
      </div>
    )

    if (tab === 'No Times') return (
      <div>
        <p className="text-[10px] text-gray-400 px-1 mb-1">{flags.noStaffTimes.length} day{flags.noStaffTimes.length !== 1 ? 's' : ''} with no staff times recorded (excluding Sundays)</p>
        {flags.noStaffTimes.length === 0
          ? <p className="py-4 text-center text-gray-400 text-xs">All working days have staff times recorded.</p>
          : <div className="bg-white border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
              {flags.noStaffTimes.map((r: any) => (
                <NoTimesFix key={r.missing_date} date={r.missing_date} onFixed={d =>
                  setFlags(f => f ? { ...f, noStaffTimes: f.noStaffTimes.filter((x: any) => x.missing_date !== d) } : f)
                } />
              ))}
            </div>
        }
      </div>
    )

    if (tab === 'Duplicates') return (
      <div>
        <p className="text-[10px] text-gray-400 px-1 mb-1">{activeDups.length} possible duplicate pair{activeDups.length !== 1 ? 's' : ''} (similarity &gt; 65%)</p>
        {activeDups.length === 0
          ? <p className="py-4 text-center text-gray-400 text-xs">No duplicate or similar item names found.</p>
          : <div className="bg-white border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
              {activeDups.map((r: any) => (
                <DuplicateFix key={`${r.id1}-${r.id2}`} r={r} onFixed={(id1, id2) => dismissDuplicate(id1, id2)} />
              ))}
            </div>
        }
      </div>
    )

    if (tab === 'Cost≥Price') return (
      <div>
        <p className="text-[10px] text-gray-400 px-1 mb-1">{flags.costGteSell.length} line{flags.costGteSell.length !== 1 ? 's' : ''} where cost price ≥ selling price</p>
        {flags.costGteSell.length === 0
          ? <p className="py-4 text-center text-gray-400 text-xs">No items sold at or below cost price.</p>
          : <div className="bg-white border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
              {flags.costGteSell.map((r: any, i: number) => (
                <CostPriceFix key={`${r.item_id}-${i}`} r={r} onFixed={itemId =>
                  setFlags(f => f ? { ...f, costGteSell: f.costGteSell.filter((x: any) => x.item_id !== itemId) } : f)
                } />
              ))}
            </div>
        }
      </div>
    )

    if (tab === 'Not in Inv.') return (
      <div>
        <p className="text-[10px] text-gray-400 px-1 mb-1">{flags.notInInventory.length} item name{flags.notInInventory.length !== 1 ? 's' : ''} not found in inventory</p>
        {flags.notInInventory.length === 0
          ? <p className="py-4 text-center text-gray-400 text-xs">All items in receipts and counts are in inventory.</p>
          : <div className="bg-white border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
              {flags.notInInventory.map((r: any, i: number) => (
                <NotInInvRow key={i} r={r} onSwitchTab={() => setTab('Inv. Todo')} />
              ))}
            </div>
        }
      </div>
    )

    if (tab === 'No Group') return (
      <div>
        <p className="text-[10px] text-gray-400 px-1 mb-1">{flags.noGroup.length} item{flags.noGroup.length !== 1 ? 's' : ''} with no group assigned</p>
        {flags.noGroup.length === 0
          ? <p className="py-4 text-center text-gray-400 text-xs">All items have a group assigned.</p>
          : <div className="bg-white border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
              {flags.noGroup.map((r: any) => (
                <NoGroupFix key={r.id} r={r} groupNames={flags.groupNames ?? []} onFixed={id =>
                  setFlags(f => f ? { ...f, noGroup: f.noGroup.filter((x: any) => x.id !== id) } : f)
                } />
              ))}
            </div>
        }
      </div>
    )

    if (tab === 'CAB Weekly') return (
      <div>
        <p className="text-[10px] text-gray-400 px-1 mb-1">{flags.uncheckedCab.length} week{flags.uncheckedCab.length !== 1 ? 's' : ''} with no Cash at Bank confirmation</p>
        {flags.uncheckedCab.length === 0
          ? <p className="py-4 text-center text-gray-400 text-xs">All weeks have a cash-at-bank confirmation.</p>
          : <div className="bg-white border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
              {flags.uncheckedCab.map((r: any) => (
                <div key={r.week_start} className="flex items-center justify-between px-3 py-1.5 gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-semibold text-gray-900">{fmtDate(r.week_start)} – {fmtDate(r.week_end)}</span>
                  </div>
                  <a href="/cash-at-bank"
                    className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition">
                    Go to CAB →
                  </a>
                </div>
              ))}
            </div>
        }
      </div>
    )

    return null
  }

  function renderNameRes() {
    if (nameResLoading || !nameRes) return <div className="py-10 text-center text-gray-400">Loading…</div>

    if (tab === 'Inv. Todo') return (
      <div>
        <p className="text-[10px] text-gray-400 px-1 mb-1">{nameRes.unmatched.length} receipt line name{nameRes.unmatched.length !== 1 ? 's' : ''} not matched</p>
        {nameRes.unmatched.length === 0
          ? <p className="py-4 text-center text-gray-400 text-xs">All names matched.</p>
          : <div className="space-y-1.5">
              {nameRes.unmatched.map(u => (
                <NameResolveRow key={u.name} name={u.name} count={u.line_count}
                  items={nameRes.items} onResolved={handleResolved} />
              ))}
            </div>
        }
      </div>
    )

    if (tab === 'Inv. Done') return (
      <div>
        <p className="text-[10px] text-gray-400 px-1 mb-1">{nameRes.matched.length} receipt line name{nameRes.matched.length !== 1 ? 's' : ''} matched to inventory</p>
        {nameRes.matched.length === 0
          ? <p className="py-4 text-center text-gray-400 text-xs">No matched names yet.</p>
          : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-3 py-1.5 text-[10px] font-semibold text-gray-500">Receipt Name</th>
                    <th className="text-left px-3 py-1.5 text-[10px] font-semibold text-gray-500">Matched To</th>
                    <th className="text-left px-3 py-1.5 text-[10px] font-semibold text-gray-500">Lines</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {nameRes.matched.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5 text-[11px] text-gray-800">{r.name}</td>
                      <td className="px-3 py-1.5 text-[11px] text-blue-700 font-medium">{r.canonical_name}</td>
                      <td className="px-3 py-1.5 text-[11px] text-gray-500">{r.line_count}</td>
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
    'CAB Weekly': flags.uncheckedCab.length,
  } : {}

  const nameResCounts: Partial<Record<Tab, number>> = nameRes ? {
    'Inv. Todo': nameRes.unmatched.length,
    'Inv. Done': nameRes.matched.length,
  } : {}

  return (
    <div className="py-2 space-y-2">
      <div className="flex items-baseline gap-2">
        <h1 className="text-sm font-bold text-gray-900">Stock Count & Flags</h1>
        <p className="text-[10px] text-gray-400">{dailyItems.length + overdueItems.length} pending</p>
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
          <p className="py-4 text-center text-gray-400 text-xs">
            {tab === 'Daily' ? 'All daily items counted!' : 'All items up to date!'}
          </p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-2 py-1.5 text-[10px] font-semibold text-gray-500">Item</th>
                  <th className="text-center px-1 py-1.5 text-[10px] font-semibold text-gray-500">SOH</th>
                  <th className="px-1 py-1.5 text-[10px] font-semibold text-gray-500">Status</th>
                  <th className="px-1 py-1.5 text-[10px] font-semibold text-gray-500">Count</th>
                </tr>
              </thead>
              <tbody>
                {countItems.map(item => (
                  <CountRow key={item.item_id} item={item} onSaved={tab === 'Daily' ? removeDaily : removeOverdue} />
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : isNameResTab ? renderNameRes() : renderFlags()}
    </div>
  )
}
