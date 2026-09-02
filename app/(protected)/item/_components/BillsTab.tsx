'use client'
import { Fragment, useState, useEffect, useMemo, memo } from 'react'
import { useSession } from 'next-auth/react'
import { isOwnerLevel } from '@/lib/roles'
import { usePolling } from '@/lib/usePolling'
import HistoryPanel from './HistoryPanel'
import { type ColumnPrefs, ResizableTh } from './columnPrefs'
import { type ColKey, COLUMNS } from './billsTabColumns'
import { useAttachments, AttachmentPicker, type Attachment } from './attachmentsShared'
import ItemDetailModal from './ItemDetailModal'

type Item = { id: number; item_name: string; cf_group: string | null; selling_price?: string | number | null; cost_price?: string | number | null; converts_to_item_id?: number | null; gmc_type?: string | null }

const BILLS_COL_DEFAULTS: Record<string, number> = {
  item: 200, quantity: 70, unitPrice: 90, sharedExpenses: 90, adjustedCost: 90, itemTotal: 100, currentCost: 100, costDiff: 80, newSp: 110,
}

type BillExpense = { id: number; bill_id: number; description: string | null; amount: string; migrated_from_expense_id?: number | null; source?: string | null; created_at?: string }

type Bill = {
  id: number
  bill_number: string
  bill_date: string
  vendor_name: string | null
  total: string
  status: string
  entered_by: string | null
  attachments: Attachment[]
}

type BillLine = {
  id: number
  bill_id: number
  item_id: number | null
  item_name: string
  quantity: string
  unit_price: string
  item_total: string
  usage_unit: string | null
  unresolved: boolean
  converts_to_item_id?: number | null
  gmc_type?: string | null
}

// One row per item line (not per bill) -- date/vendor come from the line's
// parent bill, so the same vendor repeats across every line it supplied
// that day instead of being a single group header hiding the items below it.
type FlatRow = {
  key: string
  lineId: number
  billId: number
  billNumber: string
  billDate: string
  vendorName: string | null
  status: string
  itemId: number | null
  itemName: string
  quantity: string
  unitPrice: string
  itemTotal: string
  unresolved: boolean
  convertsToItemId?: number | null
  gmcType?: string | null
}

const MONTHS = ['Ja','Fe','Mr','Ap','My','Ju','Jl','Au','Se','Oc','No','De']
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa']

function fmtShort(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(-2)}-${DAYS[d.getUTCDay()]}`
}

function fmt(val: string | null) {
  if (!val) return '—'
  const n = parseFloat(val)
  return isNaN(n) ? '—' : n.toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded px-2 py-1 text-[10px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400'

const BILLS_FLAG_VIOLATIONS = new Set(['no_vendor', 'no_items_bills', 'bill_total_mismatch', 'bill_no_attachment', 'bill_no_expense'])

type NoVendorRow = { id: number; bill_number: string; bill_date: string; total: string }
type NoItemsRow = { id: number; bill_number: string; vendor_name: string | null; bill_date: string; total: string }
type MismatchRow = { id: number; bill_number: string; vendor_name: string | null; bill_date: string; total: string; lines_total: string }
type NoAttachmentRow = { id: number; bill_number: string; vendor_name: string | null; bill_date: string; total: string }

// Fix view for the "no_vendor" flag -- one row per bill missing a vendor,
// with an inline input to set it (same PUT /api/bills/[id] the group bar's
// ✏️ edit form already uses).
function NoVendorFix({ b, onFixed }: { b: NoVendorRow; onFixed: (id: number) => void }) {
  const [vendor, setVendor] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!vendor.trim()) { setError('Enter a vendor name.'); return }
    setSaving(true)
    setError('')
    const res = await fetch(`/api/bills/${b.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendor_name: vendor.trim() }),
    })
    setSaving(false)
    if (res.ok) onFixed(b.id)
    else setError('Could not save. Try again.')
  }

  return (
    <div className="px-2 py-2 space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-gray-700 truncate">{b.bill_number} · {fmtShort(b.bill_date)}</p>
          <p className="text-[9px] text-gray-400">₵{fmt(b.total)}</p>
        </div>
        <input value={vendor} onChange={e => setVendor(e.target.value)} placeholder="Vendor name" autoComplete="off"
          className="w-32 bg-gray-100 border border-gray-200 rounded px-2 py-1 text-[10px] outline-none focus:ring-1 focus:ring-blue-400" />
        <button onClick={save} disabled={saving}
          className="shrink-0 text-[9px] font-bold px-2 py-1 rounded bg-green-600 text-white disabled:opacity-40">
          {saving ? '…' : 'Save'}
        </button>
      </div>
      {error && <p className="text-[9px] text-red-600">{error}</p>}
    </div>
  )
}

// Fix view for the "bill_no_attachment" flag -- one row per bill with no
// receipt/scan attached, with an inline upload button (same shared
// AttachmentPicker/useAttachments Sales already uses, pointed at
// /api/bills/upload instead).
function NoAttachmentFix({ b, onFixed }: { b: NoAttachmentRow; onFixed: (id: number) => void }) {
  const att = useAttachments([], '/api/bills/upload')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (att.saved.length === 0) { setError('Attach at least one file first.'); return }
    setSaving(true)
    setError('')
    const res = await fetch(`/api/bills/${b.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attachments: att.saved }),
    })
    setSaving(false)
    if (res.ok) onFixed(b.id)
    else setError('Could not save. Try again.')
  }

  return (
    <div className="px-2 py-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-gray-700 truncate">{b.bill_number} · {fmtShort(b.bill_date)}</p>
          <p className="text-[9px] text-gray-400">{b.vendor_name ?? 'No vendor'} · ₵{fmt(b.total)}</p>
        </div>
      </div>
      <AttachmentPicker items={att.items} onAdd={att.addFiles} onRemove={att.remove} disabled={saving} />
      <button onClick={save} disabled={saving || att.isUploading || att.saved.length === 0}
        className="text-[9px] font-bold px-2 py-1 rounded bg-green-600 text-white disabled:opacity-40">
        {saving ? 'Saving…' : 'Save'}
      </button>
      {error && <p className="text-[9px] text-red-600">{error}</p>}
    </div>
  )
}

// Adds one shared extra-cost line (transport, bank charges, ...) against a
// group's representative bill id -- lives right on the group bar next to
// ✏️, since that's the same "one id stands for the whole (date, vendor)
// group" convention edit already uses.
function AddBillExpenseButton({ billId, onAdded }: { billId: number; onAdded: (e: BillExpense) => void }) {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    const amt = Number(amount)
    if (!amt || amt <= 0) { setError('Enter a positive amount.'); return }
    setSaving(true)
    setError('')
    const res = await fetch('/api/bills/expenses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ billId, description: description.trim() || null, amount: amt }),
    })
    setSaving(false)
    if (res.ok) {
      const row = await res.json()
      onAdded(row)
      setOpen(false)
      setDescription('')
      setAmount('')
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Could not add expense.')
    }
  }

  if (!open) {
    return (
      <button onClick={e => { e.stopPropagation(); setOpen(true) }}
        title="Add a shared extra cost (transport, bank charges, ...)"
        className="leading-none text-gray-400 hover:text-gray-700">
        ＋💰
      </button>
    )
  }
  return (
    <span onClick={e => e.stopPropagation()} className="flex items-center gap-1 bg-white/90 rounded px-1 py-0.5">
      <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Transport, bank charges…"
        className="text-[9px] text-gray-900 bg-gray-100 border border-gray-200 rounded px-1 py-0.5 w-24 outline-none" />
      <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="₵"
        className="text-[9px] text-gray-900 bg-gray-100 border border-gray-200 rounded px-1 py-0.5 w-14 outline-none" />
      <button onClick={save} disabled={saving}
        className="text-[9px] font-bold px-1.5 py-0.5 bg-purple-600 text-white rounded disabled:opacity-40">
        {saving ? '…' : 'Add'}
      </button>
      <button onClick={() => setOpen(false)}
        className="text-[9px] font-semibold px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">✕</button>
      {error && <span className="text-[8px] text-red-600 font-semibold">{error}</span>}
    </span>
  )
}

// The one editable cell in this table -- typing a new selling price here
// writes straight to the item's live selling_rate (the same field Sales
// reads from), since this is meant to be the moment a fresh delivery's cost
// gets translated into a decided selling price.
function NewSpCell({ itemId, currentSp, onSaved }: { itemId: number | null; currentSp: string | number | null | undefined; onSaved: (itemId: number, sp: string) => void }) {
  const [value, setValue] = useState(currentSp != null ? String(currentSp) : '')
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => { setValue(currentSp != null ? String(currentSp) : '') }, [currentSp])

  if (!itemId) return <span className="text-gray-300">—</span>
  const validItemId = itemId

  async function save() {
    const n = parseFloat(value)
    if (!value || isNaN(n) || n < 0) return
    if (currentSp != null && n === parseFloat(String(currentSp))) return
    setSaving(true)
    const res = await fetch(`/api/items/${validItemId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selling_rate: n }),
    })
    setSaving(false)
    if (res.ok) {
      onSaved(validItemId, String(n))
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1200)
    }
  }

  return (
    <input type="number" min="0" step="0.01" value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      onClick={e => e.stopPropagation()}
      title="Type a new selling price to update this item's live selling price"
      className={`w-full text-right text-[10px] rounded px-1 py-0.5 border outline-none ${savedFlash ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white'} ${saving ? 'opacity-50' : ''}`}
    />
  )
}

type EditedBillLine = { id: number; bill_id: number; item_id: number | null; quantity: string; unit_price: string; item_total: string }

// Click-to-edit QTY/VCP -- bills previously had no way to correct a line
// after saving (only date/vendor/attachments), which meant a mistyped unit
// price behind a VCP JUMP flag could only be fixed by deleting and
// re-entering the whole bill. Saves via /api/bill-lines/[id], which also
// resyncs the item's VCP/ACP so the jump flag re-evaluates against the
// corrected price.
function EditableLineCell({ lineId, field, value, display, onSaved }: {
  lineId: number
  field: 'quantity' | 'unit_price'
  value: string
  display: (v: string) => React.ReactNode
  onSaved: (updated: EditedBillLine) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { setDraft(value) }, [value])

  if (!editing) {
    return (
      <button onClick={e => { e.stopPropagation(); setEditing(true) }} title="Click to edit" className="hover:underline decoration-dotted underline-offset-2">
        {value ? display(value) : '—'}
      </button>
    )
  }

  async function save() {
    const n = parseFloat(draft)
    if (!draft || isNaN(n) || n < 0 || (field === 'quantity' && n <= 0)) { setError('Invalid value'); return }
    setSaving(true)
    setError('')
    const res = await fetch(`/api/bill-lines/${lineId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: n }),
    })
    setSaving(false)
    if (res.ok) {
      onSaved(await res.json())
      setEditing(false)
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Could not save.')
    }
  }

  return (
    <span onClick={e => e.stopPropagation()} className="inline-flex flex-col items-end gap-0.5">
      <input type="number" min="0" step="0.01" autoFocus value={draft} disabled={saving}
        onChange={e => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(false) }}
        className="w-16 text-right text-[10px] bg-white border border-blue-300 rounded px-1 py-0.5 outline-none disabled:opacity-50" />
      {error && <span className="text-[8px] text-red-600 font-semibold whitespace-nowrap">{error}</span>}
    </span>
  )
}

type Props = {
  items: Item[]
  groupFilter: string | null
  search: string
  violation?: string | null
  jumpToBillId?: number | null
  onJumpDone?: () => void
  // History/Bars Only/Vendor/Month/Year/colPrefs moved up to the parent's
  // own header row (so they render alongside the violation radios there,
  // not a second row of their own) -- same treatment SalesTab already got.
  // Optional (defaulting to no-ops below) for ViolationFixPanel's bare
  // embed, which has no header row of its own to host these controls in.
  // colPrefs is required though -- there's no harmless no-op default for a
  // hook result, so every caller creates its own useColumnPrefs() now.
  showHistory?: boolean
  setShowHistory?: (v: boolean | ((prev: boolean) => boolean)) => void
  barsOnly?: boolean
  setBarsOnly?: (v: boolean | ((prev: boolean) => boolean)) => void
  vendorFilter?: string | null
  setVendorFilter?: (v: string | null) => void
  monthFilter?: number | null
  setMonthFilter?: (v: number | null) => void
  yearFilter?: number | null
  setYearFilter?: (v: number | null) => void
  gmcFilter?: 'all' | 'gmc' | 'vendor'
  gmcItemIds?: Set<number>
  colPrefs: ColumnPrefs<ColKey>
  onAvailableVendorsChange?: (vendors: string[]) => void
  onAvailableYearsChange?: (years: number[]) => void
}

function BillsTab({
  items, groupFilter, search, violation = null, jumpToBillId, onJumpDone,
  showHistory = false, setShowHistory = () => {}, barsOnly = false, setBarsOnly = () => {},
  vendorFilter = null, setVendorFilter = () => {}, monthFilter = null, setMonthFilter = () => {},
  yearFilter = null, setYearFilter = () => {}, gmcFilter = 'all', gmcItemIds = new Set(), colPrefs, onAvailableVendorsChange, onAvailableYearsChange,
}: Props) {
  const { data: session } = useSession()
  const isOwnerLevelUser = isOwnerLevel(session?.user as any)
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [viewingItemId, setViewingItemId] = useState<number | null>(null)
  const [linesMap, setLinesMap] = useState<Record<number, BillLine[]>>({})
  const [billExpenses, setBillExpenses] = useState<BillExpense[]>([])
  const [expenseSourceFilter, setExpenseSourceFilter] = useState<'all' | 'sales' | 'manual'>('all')
  // Overrides the item's own selling_price prop the moment a New SP save
  // succeeds -- so every row for that same item (it can appear on more than
  // one bill) reflects it immediately, without waiting on a full refetch.
  const [sellingPriceOverrides, setSellingPriceOverrides] = useState<Record<number, string>>({})
  // Editing is bill-level now, triggered from the ✏️ on a group's bar
  // rather than by clicking any line -- keyed by bill id directly.
  const [editingBillId, setEditingBillId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ bill_date: '', vendor_name: '' })
  const editAttachments = useAttachments([], '/api/bills/upload')
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  // null doubles as "loading" -- no separate loading flag needed since
  // there's nothing to distinguish "not fetched yet" from "fetching".
  const [flags, setFlags] = useState<{
    noVendorBills: NoVendorRow[]; noItemsBills: NoItemsRow[]
    billTotalMismatch: MismatchRow[]; billNoAttachment: NoAttachmentRow[]; billNoExpense: NoAttachmentRow[]
  } | null>(null)

  useEffect(() => {
    if (violation && BILLS_FLAG_VIOLATIONS.has(violation) && !flags) {
      fetch('/api/flags').then(r => r.ok ? r.json() : null).then(d => { if (d) setFlags(d) })
    }
  }, [violation, flags])

  function loadBills() {
    Promise.all([
      fetch('/api/bills').then(r => r.json()),
      fetch('/api/bills/all-lines').then(r => r.json()),
      fetch('/api/bills/expenses').then(r => r.json()),
    ]).then(([billsData, linesData, expensesData]) => {
      setBills(Array.isArray(billsData) ? billsData : [])
      const map: Record<number, BillLine[]> = {}
      if (Array.isArray(linesData)) {
        for (const l of linesData) {
          if (!map[l.bill_id]) map[l.bill_id] = []
          map[l.bill_id].push(l)
        }
      }
      setLinesMap(map)
      setBillExpenses(Array.isArray(expensesData) ? expensesData : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { loadBills() }, [])
  usePolling(loadBills, 600000, editingBillId === null)

  const billsById = useMemo(() => {
    const m: Record<number, Bill> = {}
    for (const b of bills) m[b.id] = b
    return m
  }, [bills])

  const flatRows = useMemo(() => {
    const rows: FlatRow[] = []
    for (const b of bills) {
      const lines = linesMap[b.id] ?? []
      lines.forEach((l, i) => {
        rows.push({
          key: `${b.id}:${i}`,
          lineId: l.id,
          billId: b.id,
          billNumber: b.bill_number,
          billDate: b.bill_date,
          vendorName: b.vendor_name,
          status: b.status,
          itemId: l.item_id,
          itemName: l.item_name,
          quantity: l.quantity,
          unitPrice: l.unit_price,
          itemTotal: l.item_total,
          unresolved: l.item_id == null || l.unresolved,
          convertsToItemId: l.converts_to_item_id,
          gmcType: l.gmc_type,
        })
      })
    }
    // Grouped by date, then vendor, so every line a vendor supplied on a
    // given day sits together as one contiguous block (needed for the
    // vendor/day total column, which only labels the first row of a block).
    rows.sort((a, b) =>
      b.billDate.localeCompare(a.billDate) ||
      (a.vendorName ?? '').localeCompare(b.vendorName ?? '') ||
      b.billId - a.billId
    )
    return rows
  }, [bills, linesMap])

  // Incoming jump from Item 360's VCP cell (see LossTab.tsx's VcpCell /
  // ItemDetailPanel's onBillClick) -- same pattern as SalesTab's own
  // jumpToDate: expand the group if it's currently collapsed, then scroll
  // that exact bill row into view.
  useEffect(() => {
    if (jumpToBillId == null || loading) return
    const target = flatRows.find(r => r.billId === jumpToBillId)
    if (target) {
      const key = `${target.billDate}|${target.vendorName ?? ''}`
      if (barsOnly) setExpandedIds(prev => new Set(prev).add(key))
      setTimeout(() => document.getElementById(`billrow-${jumpToBillId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    }
    onJumpDone?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpToBillId, loading])

  // Total extra cost entered against each representative bill id (see
  // bill_expenses' own comment on why one id stands in for a whole
  // (date, vendor) group).
  const expensesByBillId = useMemo(() => {
    const totals: Record<number, number> = {}
    for (const e of billExpenses) {
      if (expenseSourceFilter === 'all' || e.source === expenseSourceFilter) {
        totals[e.bill_id] = (totals[e.bill_id] ?? 0) + (Number(e.amount) || 0)
      }
    }
    return totals
  }, [billExpenses, expenseSourceFilter])

  // Same grouping as expensesByBillId, but keeping each individual row --
  // needed to actually list them under "Related Expenses" (whether they got
  // there via AddBillExpenseButton or migrated wholesale from the Expenses
  // tab, see /api/expenses/[id]/migrate-to-bill) rather than just their sum.
  // Before this, a migrated expense had no home anywhere in the UI at all.
  const expenseRowsByBillId = useMemo(() => {
    const m: Record<number, BillExpense[]> = {}
    for (const e of billExpenses) {
      if (expenseSourceFilter === 'all' || e.source === expenseSourceFilter) {
        if (!m[e.bill_id]) m[e.bill_id] = []
        m[e.bill_id].push(e)
      }
    }
    return m
  }, [billExpenses, expenseSourceFilter])

  const itemsById = useMemo(() => {
    const m = new Map<number, Item>()
    for (const it of items) m.set(it.id, it)
    return m
  }, [items])

  // Vendor/day totals are computed from the full, unfiltered set so the sum
  // always reflects every item bought from that vendor that day -- filtering
  // (search/group) only changes which rows are visible, not what they add up to.
  const vendorDayTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const r of flatRows) {
      const key = `${r.billDate}|${r.vendorName ?? ''}`
      totals[key] = (totals[key] ?? 0) + Number(r.itemTotal)
    }
    return totals
  }, [flatRows])

  const groupItemNames = useMemo(() => {
    if (!groupFilter || groupFilter === 'All') return null
    return new Set(items.filter(i => (i.cf_group ?? 'Ungrouped') === groupFilter).map(i => i.item_name))
  }, [items, groupFilter])

  // Vendor names and years derived from the data itself (not a hardcoded
  // list), so the dropdowns only ever offer options that actually occur.
  const availableVendors = useMemo(() => {
    const names = new Set<string>()
    for (const b of bills) if (b.vendor_name) names.add(b.vendor_name)
    return Array.from(names).sort()
  }, [bills])

  const availableYears = useMemo(() => {
    const years = new Set<number>()
    for (const b of bills) {
      const y = b.bill_date ? Number(b.bill_date.slice(0, 4)) : NaN
      if (!isNaN(y)) years.add(y)
    }
    return Array.from(years).sort((a, b) => b - a)
  }, [bills])

  useEffect(() => {
    onAvailableVendorsChange?.(availableVendors)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableVendors])

  useEffect(() => {
    onAvailableYearsChange?.(availableYears)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableYears])

  const filtered = useMemo(() => {
    let list = flatRows
    if (gmcFilter === 'gmc' && gmcItemIds.size > 0) {
      list = list.filter(r => r.itemId !== null && gmcItemIds.has(r.itemId))
    } else if (gmcFilter === 'vendor' && gmcItemIds.size > 0) {
      list = list.filter(r => r.itemId === null || !gmcItemIds.has(r.itemId))
    }
    if (groupItemNames) {
      list = list.filter(r => groupItemNames.has(r.itemName))
    }
    if (vendorFilter) {
      list = list.filter(r => r.vendorName === vendorFilter)
    }
    if (monthFilter || yearFilter) {
      list = list.filter(r => {
        const d = r.billDate?.slice(0, 10)
        if (!d) return false
        const [y, m] = d.split('-').map(Number)
        if (yearFilter && y !== yearFilter) return false
        if (monthFilter && m !== monthFilter) return false
        return true
      })
    }
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        (r.vendorName ?? '').toLowerCase().includes(q) ||
        r.billNumber.toLowerCase().includes(q) ||
        r.itemName.toLowerCase().includes(q)
      )
    }
    return list
  }, [flatRows, groupItemNames, vendorFilter, monthFilter, yearFilter, gmcFilter, gmcItemIds, search])

  // Per-group (date, vendor) total quantity and "representative" bill id --
  // computed from the full, unfiltered flatRows same as vendorDayTotals, so
  // Shared Expenses always divides by every item actually on the bill, not
  // just whatever a search/group filter currently shows. flatRows is
  // already sorted with the highest bill id first within a group (see its
  // own sort comment), so the first row seen per key here is that same
  // "representative" id the group bar's ✏️ edit has always used.
  const groupAggregates = useMemo(() => {
    const map: Record<string, { qty: number; representativeBillId: number }> = {}
    for (const r of flatRows) {
      const key = `${r.billDate}|${r.vendorName ?? ''}`
      if (!map[key]) map[key] = { qty: 0, representativeBillId: r.billId }
      map[key].qty += Number(r.quantity) || 0
    }
    return map
  }, [flatRows])

  // One group per (date, vendor) block -- a bar (Date/Vendor/Total) above
  // its item lines, same pattern as Sales' receipt bar. isDayHead marks the
  // first group of each new day (blue bar); any other vendor billing the
  // shop that same day gets the smaller gray bar. A group can technically
  // span more than one actual bill record (same vendor, same day, entered
  // twice) -- rare enough that the bar's ✏️ just edits the first one.
  const groupedList = useMemo(() => {
    const map = new Map<string, { billDate: string; vendorName: string | null; rows: FlatRow[] }>()
    for (const r of filtered) {
      const gk = `${r.billDate}|${r.vendorName ?? ''}`
      if (!map.has(gk)) map.set(gk, { billDate: r.billDate, vendorName: r.vendorName, rows: [] })
      map.get(gk)!.rows.push(r)
    }
    let prevDate: string | null = null
    const list: { key: string; billDate: string; vendorName: string | null; total: number; editBillId: number; isDayHead: boolean; rows: FlatRow[]; sharedExpensesTotal: number; sharedPerUnit: number; billNumbers: string[]; expenseRows: BillExpense[] }[] = []
    for (const [key, g] of map) {
      const date10 = g.billDate.slice(0, 10)
      const agg = groupAggregates[key]
      const repBillId = agg?.representativeBillId ?? g.rows[0].billId
      const sharedExpensesTotal = expensesByBillId[repBillId] ?? 0
      const qty = agg?.qty ?? 0
      list.push({
        key, billDate: g.billDate, vendorName: g.vendorName,
        // Includes the related expenses' own total now that they're listed
        // as rows right below -- previously this only summed bill_lines, so
        // the Total column silently excluded them (the +₵ badge next to the
        // date was the only place their amount showed up at all).
        total: (vendorDayTotals[key] ?? 0) + sharedExpensesTotal,
        editBillId: repBillId,
        isDayHead: date10 !== prevDate,
        rows: g.rows,
        sharedExpensesTotal,
        sharedPerUnit: qty > 0 ? sharedExpensesTotal / qty : 0,
        billNumbers: Array.from(new Set(g.rows.map(r => r.billNumber).filter(Boolean))),
        expenseRows: expenseRowsByBillId[repBillId] ?? [],
      })
      prevDate = date10
    }
    return list
  }, [filtered, vendorDayTotals, groupAggregates, expensesByBillId, expenseRowsByBillId])

  // Check if an expense description mentions a pack item (has converts_to_item_id)
  function isExpenseMentioningPack(expense: BillExpense): boolean {
    if (!expense.description) return false
    const desc = expense.description.toLowerCase()
    // Check if any pack item's name appears in the description
    for (const item of items) {
      if (item.converts_to_item_id && item.item_name) {
        if (desc.includes(item.item_name.toLowerCase())) return true
      }
    }
    return false
  }

  function toggleEdit(billId: number) {
    if (editingBillId === billId) { setEditingBillId(null); return }
    const b = billsById[billId]
    setEditForm({ bill_date: b?.bill_date?.slice(0, 10) ?? '', vendor_name: b?.vendor_name ?? '' })
    editAttachments.reset(b?.attachments ?? [])
    setEditError('')
    setEditingBillId(billId)
  }

  function toggleExpanded(key: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  // Patches just the edited line in linesMap -- flatRows/groupAggregates/
  // groupedList all derive from it, so the group's total, Shared Expenses,
  // and ACP recompute automatically without a full refetch.
  async function removeBillExpense(id: number) {
    if (!confirm('Remove this related expense from the bill?')) return
    const res = await fetch(`/api/bills/expenses/${id}`, { method: 'DELETE' })
    if (res.ok) setBillExpenses(prev => prev.filter(e => e.id !== id))
  }

  function handleLineSaved(updated: EditedBillLine) {
    setLinesMap(prev => {
      const lines = prev[updated.bill_id]
      if (!lines) return prev
      return {
        ...prev,
        [updated.bill_id]: lines.map(l => l.id === updated.id
          ? { ...l, quantity: updated.quantity, unit_price: updated.unit_price, item_total: updated.item_total }
          : l),
      }
    })
  }

  async function saveEdit(billId: number) {
    setSaving(true)
    setEditError('')
    const res = await fetch(`/api/bills/${billId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bill_date: editForm.bill_date || undefined, vendor_name: editForm.vendor_name || null,
        attachments: editAttachments.saved,
      }),
    })
    setSaving(false)
    if (res.ok) {
      const updated: Bill = await res.json()
      setBills(prev => prev.map(b => b.id === billId ? { ...b, ...updated } : b))
      setEditingBillId(null)
    } else {
      const d = await res.json().catch(() => null)
      setEditError(d?.error ?? `Could not save (${res.status}). Try again.`)
    }
  }

  async function deleteBill(billId: number) {
    const b = billsById[billId]
    if (!confirm(`Delete bill ${b?.bill_number ?? `#${billId}`}${b?.vendor_name ? ` — ${b.vendor_name}` : ''}? This removes it and all its line items permanently.`)) return
    setSaving(true)
    const res = await fetch(`/api/bills/${billId}`, { method: 'DELETE' })
    setSaving(false)
    if (res.ok) {
      setBills(prev => prev.filter(b => b.id !== billId))
      setEditingBillId(null)
    } else {
      const body = await res.json().catch(() => ({}))
      alert(body.error || 'Could not delete bill')
    }
  }

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  if (violation === 'no_vendor') {
    const rows = flags?.noVendorBills ?? []
    return (
      <div className="overflow-y-auto h-full py-2">
        <p className="text-[10px] text-gray-400 px-2 mb-1">
          {!flags ? 'Loading…' : `${rows.length} bill${rows.length !== 1 ? 's' : ''} with no vendor recorded`}
        </p>
        {flags && (rows.length === 0
          ? <p className="py-4 text-center text-gray-400 text-[10px]">Every bill has a vendor recorded.</p>
          : (
            <div className="bg-white border-t border-b border-gray-200 divide-y divide-gray-100">
              {rows.map(b => (
                <NoVendorFix key={b.id} b={b} onFixed={id =>
                  setFlags(f => f ? { ...f, noVendorBills: f.noVendorBills.filter(x => x.id !== id) } : f)
                } />
              ))}
            </div>
          ))}
      </div>
    )
  }

  if (violation === 'no_items_bills') {
    const rows = flags?.noItemsBills ?? []
    return (
      <div className="overflow-y-auto h-full py-2">
        <p className="text-[10px] text-gray-400 px-2 mb-1">
          {!flags ? 'Loading…' : `${rows.length} bill${rows.length !== 1 ? 's' : ''} with a total but no item list`}
        </p>
        <p className="text-[9px] text-gray-400 px-2 mb-2">
          Mostly historical bills entered as a lump total with no line-by-line breakdown -- there is no fix form here since adding items after the fact is not supported yet; this is a review list.
        </p>
        {flags && (rows.length === 0
          ? <p className="py-4 text-center text-gray-400 text-[10px]">Every bill with a total has an item list.</p>
          : (
            <div className="bg-white border-t border-b border-gray-200 divide-y divide-gray-100">
              {rows.map(b => (
                <div key={b.id} className="px-2 py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-gray-700 truncate">{b.bill_number} · {fmtShort(b.bill_date)}</p>
                    <p className="text-[9px] text-gray-400">{b.vendor_name ?? 'No vendor'}</p>
                  </div>
                  <p className="text-[10px] font-bold text-gray-700 shrink-0">₵{fmt(b.total)}</p>
                </div>
              ))}
            </div>
          ))}
      </div>
    )
  }

  if (violation === 'bill_total_mismatch') {
    const rows = flags?.billTotalMismatch ?? []
    return (
      <div className="overflow-y-auto h-full py-2">
        <p className="text-[10px] text-gray-400 px-2 mb-1">
          {!flags ? 'Loading…' : `${rows.length} bill${rows.length !== 1 ? 's' : ''} whose items don't add up to the total`}
        </p>
        <p className="text-[9px] text-gray-400 px-2 mb-2">
          Check the bill against the actual receipt -- a missing line, a wrong price/qty, or a total typed wrong could each explain the gap.
        </p>
        {flags && (rows.length === 0
          ? <p className="py-4 text-center text-gray-400 text-[10px]">Every bill&apos;s items add up to its total.</p>
          : (
            <div className="bg-white border-t border-b border-gray-200 divide-y divide-gray-100">
              {rows.map(b => {
                const diff = parseFloat(b.total) - parseFloat(b.lines_total)
                return (
                  <div key={b.id} className="px-2 py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-gray-700 truncate">{b.bill_number} · {fmtShort(b.bill_date)}</p>
                      <p className="text-[9px] text-gray-400">{b.vendor_name ?? 'No vendor'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-bold text-gray-700">Total ₵{fmt(b.total)} · Items ₵{fmt(b.lines_total)}</p>
                      <p className="text-[9px] font-semibold text-red-600">{diff > 0 ? `₵${fmt(diff.toFixed(2))} short` : `₵${fmt((-diff).toFixed(2))} over`}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
      </div>
    )
  }

  if (violation === 'bill_no_attachment') {
    const rows = flags?.billNoAttachment ?? []
    return (
      <div className="overflow-y-auto h-full py-2">
        <p className="text-[10px] text-gray-400 px-2 mb-1">
          {!flags ? 'Loading…' : `${rows.length} bill${rows.length !== 1 ? 's' : ''} with no receipt attached`}
        </p>
        {flags && (rows.length === 0
          ? <p className="py-4 text-center text-gray-400 text-[10px]">Every bill has a receipt attached.</p>
          : (
            <div className="bg-white border-t border-b border-gray-200 divide-y divide-gray-100">
              {rows.map(b => (
                <NoAttachmentFix key={b.id} b={b} onFixed={id =>
                  setFlags(f => f ? { ...f, billNoAttachment: f.billNoAttachment.filter(x => x.id !== id) } : f)
                } />
              ))}
            </div>
          ))}
      </div>
    )
  }

  if (violation === 'bill_no_expense') {
    const rows = flags?.billNoExpense ?? []
    return (
      <div className="overflow-y-auto h-full py-2">
        <p className="text-[10px] text-gray-400 px-2 mb-1">
          {!flags ? 'Loading…' : `${rows.length} bill${rows.length !== 1 ? 's' : ''} with no corresponding expense`}
        </p>
        <p className="text-[9px] text-gray-400 px-2 mb-2">
          No bill_expenses row (bank charges, transport, etc.) has been migrated onto this bill from the Expenses tab -- there is no fix form here since that migration happens from the Expenses side; this is a review list.
        </p>
        {flags && (rows.length === 0
          ? <p className="py-4 text-center text-gray-400 text-[10px]">Every bill has a corresponding expense.</p>
          : (
            <div className="bg-white border-t border-b border-gray-200 divide-y divide-gray-100">
              {rows.map(b => (
                <div key={b.id} className="px-2 py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-gray-700 truncate">{b.bill_number} · {fmtShort(b.bill_date)}</p>
                    <p className="text-[9px] text-gray-400">{b.vendor_name ?? 'No vendor'}</p>
                  </div>
                  <p className="text-[10px] font-bold text-gray-700 shrink-0">₵{fmt(b.total)}</p>
                </div>
              ))}
            </div>
          ))}
      </div>
    )
  }

  if (showHistory) return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1.5 px-2 py-1 border-b border-gray-200 bg-gray-50 shrink-0">
        <button onClick={() => setShowHistory(false)}
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-purple-600 text-white transition">
          ← Back
        </button>
        <span className="text-[9px] font-semibold text-purple-700">Bills History</span>
      </div>
      <HistoryPanel keywords={['bill']} onEntryClick={log => {
        // "added bill": "BL-001 · ₵500 from Vendor"  →  bill_number = first token
        // "edited bill": "Bill #5 — Vendor"            →  numeric id after #
        const editMatch = log.details?.match(/Bill #(\d+)/)
        const addMatch = log.details?.match(/^([^\s·]+)/)
        let target: Bill | undefined
        if (editMatch) {
          const id = Number(editMatch[1])
          target = bills.find(b => b.id === id)
        } else if (addMatch) {
          target = bills.find(b => b.bill_number === addMatch[1])
        }
        setShowHistory(false)
        if (target) {
          setTimeout(() => document.getElementById(`billrow-${target!.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
        }
      }} />
    </div>
  )

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="overflow-x-auto">
        <table className="border-collapse text-[10px]" style={{
          tableLayout: 'fixed',
          width: colPrefs.getWidth('item', BILLS_COL_DEFAULTS.item)
            + colPrefs.shownColumns.reduce((s, c) => s + colPrefs.getWidth(c.key, BILLS_COL_DEFAULTS[c.key] ?? 80), 0),
        }}>
          <colgroup>
            <col style={{ width: colPrefs.getWidth('item', BILLS_COL_DEFAULTS.item) }} />
            {colPrefs.shownColumns.map(c => <col key={c.key} style={{ width: colPrefs.getWidth(c.key, BILLS_COL_DEFAULTS[c.key] ?? 80) }} />)}
          </colgroup>
          <thead className="sticky top-0 bg-gray-100 z-10">
            <tr>
              <ResizableTh onResize={d => colPrefs.resizeWidth('item', d, BILLS_COL_DEFAULTS.item)} onReset={() => colPrefs.resetWidth('item')}
                className="text-[9px] sticky left-0 z-20 bg-gray-100">ITEM</ResizableTh>
              {colPrefs.shownColumns.map((c, i) => (
                <ResizableTh key={c.key} align="right" noDivider={i === colPrefs.shownColumns.length - 1} className="text-[9px]"
                  onResize={d => colPrefs.resizeWidth(c.key, d, BILLS_COL_DEFAULTS[c.key] ?? 80)} onReset={() => colPrefs.resetWidth(c.key)}>
                  {c.label}
                </ResizableTh>
              ))}
            </tr>
          </thead>
          <tbody>
            {groupedList.map(g => {
              const isEditing = editingBillId === g.editBillId

              if (isEditing) {
                return (
                  <tr key={g.key}>
                    <td colSpan={1 + colPrefs.shownColumns.length} className="p-2 bg-white space-y-2 border-b border-gray-200">
                      <p className="text-[10px] font-bold text-gray-600">Edit Bill · {billsById[g.editBillId]?.bill_number}</p>
                      <div>
                        <p className="text-[9px] text-gray-400 mb-0.5">Date</p>
                        <input type="date" value={editForm.bill_date}
                          onChange={e => setEditForm(f => ({ ...f, bill_date: e.target.value }))} className={inputCls} />
                      </div>
                      <div>
                        <p className="text-[9px] text-gray-400 mb-0.5">Vendor</p>
                        <input value={editForm.vendor_name} autoComplete="off"
                          onChange={e => setEditForm(f => ({ ...f, vendor_name: e.target.value }))} className={inputCls} />
                      </div>
                      <div>
                        <p className="text-[9px] text-gray-400 mb-0.5">Receipt</p>
                        <AttachmentPicker items={editAttachments.items} onAdd={editAttachments.addFiles}
                          onRemove={editAttachments.remove} disabled={saving} />
                      </div>
                      {editError && (
                        <p className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{editError}</p>
                      )}
                      <div className="flex gap-1">
                        <button onClick={() => saveEdit(g.editBillId)} disabled={saving}
                          className="flex-1 bg-green-600 text-white text-[10px] font-bold rounded py-1 disabled:opacity-40">
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                        <button onClick={() => { setEditingBillId(null); setEditError('') }}
                          className="px-3 py-1 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded">Cancel</button>
                        {isOwnerLevelUser && (
                          <button onClick={() => deleteBill(g.editBillId)} disabled={saving}
                            className="px-3 py-1 bg-red-600 text-white text-[10px] font-semibold rounded disabled:opacity-40">Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              }
              return (
                <Fragment key={g.key}>
                  <tr onClick={() => toggleExpanded(g.key)} title="Show/hide this group's items"
                    className={`cursor-pointer ${g.isDayHead ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-50 hover:bg-gray-100'}`}>
                    <td colSpan={1 + colPrefs.shownColumns.length} className={`relative ${g.isDayHead ? 'px-1.5 py-0.5' : 'px-1 py-0'}`}>
                      <div className="flex items-center gap-1.5">
                        <span className={`whitespace-nowrap ${g.isDayHead ? 'text-white font-semibold' : 'text-gray-600 font-medium'}`}>
                          {fmtShort(g.billDate)}
                        </span>
                        {g.billNumbers.length > 0 && (
                          <span onClick={e => e.stopPropagation()} title="Bill number -- tap and hold to select, then copy"
                            className={`whitespace-nowrap select-text font-mono ${g.isDayHead ? 'text-blue-100' : 'text-gray-400'}`}>
                            {g.billNumbers.join(', ')}
                          </span>
                        )}
                        <button onClick={e => { e.stopPropagation(); toggleEdit(g.editBillId) }} title="Edit this bill"
                          className={`leading-none ${g.isDayHead ? 'text-blue-100 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}>
                          ✏️
                        </button>
                        <AddBillExpenseButton billId={g.editBillId} onAdded={row => setBillExpenses(prev => [...prev, row])} />
                        {g.sharedExpensesTotal > 0 && (
                          <span className={`text-[9px] whitespace-nowrap ${g.isDayHead ? 'text-blue-100' : 'text-gray-400'}`}
                            title="Total shared extra costs entered against this bill">
                            +₵{g.sharedExpensesTotal.toFixed(2)}
                          </span>
                        )}
                        <span className={`flex-1 text-center font-extrabold truncate ${g.isDayHead ? 'text-white text-xs' : 'text-gray-700 text-[11px]'}`}
                          title={g.vendorName ?? ''}>
                          {g.vendorName ?? '—'}
                        </span>
                        <span className={`font-semibold whitespace-nowrap ${g.isDayHead ? 'text-white' : 'text-gray-900'}`}>
                          {fmt(g.total.toFixed(2))}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {(!barsOnly || expandedIds.has(g.key)) && g.rows.map(row => (
                    <tr key={row.key} id={`billrow-${row.billId}`}
                      className={`group border-b border-gray-100 text-[9px] font-bold leading-tight ${row.unresolved ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                      <td className={`sticky left-0 z-10 px-1 py-0 text-gray-900 overflow-hidden ${row.unresolved || (row.itemId && !row.convertsToItemId && row.gmcType !== 'gmc') ? 'bg-red-50' : 'bg-white group-hover:bg-gray-50'}`}>
                        {row.itemId ? (
                          <button type="button" onClick={() => setViewingItemId(row.itemId)} className="block truncate text-blue-600 hover:underline text-left">
                            {row.itemName}
                          </button>
                        ) : (
                          <span className="block truncate text-red-600">{row.itemName}</span>
                        )}
                      </td>
                      {colPrefs.shownColumns.map(c => {
                        if (c.key === 'quantity') return (
                          <td key={c.key} className="px-1 py-0 text-right text-gray-700 truncate">
                            <EditableLineCell lineId={row.lineId} field="quantity" value={row.quantity}
                              display={v => parseFloat(v)} onSaved={handleLineSaved} />
                          </td>
                        )
                        if (c.key === 'unitPrice') return (
                          <td key={c.key} className="px-1 py-0 text-right text-gray-700 truncate">
                            <EditableLineCell lineId={row.lineId} field="unit_price" value={row.unitPrice}
                              display={fmt} onSaved={handleLineSaved} />
                          </td>
                        )
                        if (c.key === 'sharedExpenses') return (
                          <td key={c.key} className="px-1 py-0 text-right text-gray-500 truncate">{g.sharedPerUnit > 0 ? fmt(g.sharedPerUnit.toFixed(2)) : '—'}</td>
                        )
                        if (c.key === 'adjustedCost') return (
                          <td key={c.key} className="px-1 py-0 text-right text-purple-700 truncate">{fmt(((parseFloat(row.unitPrice) || 0) + g.sharedPerUnit).toFixed(2))}</td>
                        )
                        if (c.key === 'itemTotal') return (
                          <td key={c.key} className="px-1 py-0 text-right font-semibold text-gray-900 truncate">{fmt(row.itemTotal)}</td>
                        )
                        if (c.key === 'currentCost') return (
                          <td key={c.key} className="px-1 py-0 text-right text-blue-600 truncate">
                            {row.itemId ? (fmt(String(itemsById.get(row.itemId)?.cost_price ?? ''))) : '—'}
                          </td>
                        )
                        if (c.key === 'costDiff') {
                          const billCost = parseFloat(row.unitPrice) || 0
                          const currentCost = row.itemId ? (parseFloat(String(itemsById.get(row.itemId)?.cost_price ?? 0)) || 0) : 0
                          const diff = currentCost - billCost
                          const color = diff > 0.01 ? 'text-red-600' : diff < -0.01 ? 'text-green-600' : 'text-gray-500'
                          return (
                            <td key={c.key} className={`px-1 py-0 text-right ${color} truncate`}>
                              {Math.abs(diff) > 0.001 ? fmt(diff.toFixed(2)) : '—'}
                            </td>
                          )
                        }
                        return (
                          <td key={c.key} className="px-1 py-0" onClick={e => e.stopPropagation()}>
                            <NewSpCell itemId={row.itemId}
                              currentSp={row.itemId ? (sellingPriceOverrides[row.itemId] ?? itemsById.get(row.itemId)?.selling_price ?? null) : null}
                              onSaved={(id, sp) => setSellingPriceOverrides(prev => ({ ...prev, [id]: sp }))} />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  {/* A migrated (or directly-added) expense has no home of
                      its own anywhere else in the app -- list it right here
                      so it's visible instead of just padding the group's
                      Total silently forever. */}
                  {(!barsOnly || expandedIds.has(g.key)) && g.expenseRows.map(e => {
                    const mentionsPack = isExpenseMentioningPack(e)
                    return (
                    <tr key={`exp-${e.id}`} className={`group border-b border-gray-100 text-[9px] font-bold leading-tight ${mentionsPack ? 'bg-red-50/40 hover:bg-red-50' : 'bg-purple-50/40 hover:bg-purple-50'}`}>
                      {/* The amount lives here, next to the expense's own
                          name, not in the numeric Total column -- there can
                          be more than one related expense on the same bill,
                          each with a different name and amount, so a bare
                          number sitting in the shared Total column would
                          have nothing pinning it to which expense it was. */}
                      <td className={`sticky left-0 z-10 px-1 py-0.5 overflow-hidden ${mentionsPack ? 'text-red-700 bg-red-50 group-hover:bg-red-100' : 'text-purple-700 bg-purple-50 group-hover:bg-purple-100'}`}>
                        <span className={`block italic text-[9px] leading-tight ${mentionsPack ? 'text-red-400' : 'text-purple-400'}`}>Related Expense</span>
                        <span className="block break-words leading-tight">{e.description || 'Other'} — ₵{fmt(e.amount)}</span>
                      </td>
                      {colPrefs.shownColumns.map(c => (
                        <td key={c.key} className="px-1 py-0 text-right truncate">
                          {c.key === 'itemTotal' ? (
                            <button onClick={() => removeBillExpense(e.id)} title="Remove this related expense"
                              className="text-purple-300 hover:text-red-600 font-bold leading-none">×</button>
                          ) : '—'}
                        </td>
                      ))}
                    </tr>
                    )
                  })}
                </Fragment>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-[10px] text-gray-400 text-center py-10">No bills</p>}
        </div>
      </div>
      {viewingItemId != null && (
        <ItemDetailModal itemId={viewingItemId} onClose={() => setViewingItemId(null)} />
      )}
    </div>
  )
}

export default memo(BillsTab)
