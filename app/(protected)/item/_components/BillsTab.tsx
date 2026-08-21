'use client'
import { Fragment, useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { isOwnerLevel } from '@/lib/roles'
import { usePolling } from '@/lib/usePolling'
import HistoryPanel from './HistoryPanel'
import { useColumnPrefs, ColumnsPickerButton, ResizableTh, type ColumnDef } from './columnPrefs'
import { useAttachments, AttachmentPicker, type Attachment } from './attachmentsShared'
import ItemDetailModal from './ItemDetailModal'

type Item = { id: number; item_name: string; cf_group: string | null }

// Item stays sticky/always-visible (first column); these three are the
// only ones the picker can hide/reorder/rename.
type ColKey = 'quantity' | 'unitPrice' | 'itemTotal'
const COLUMNS: ColumnDef<ColKey>[] = [
  { key: 'quantity',  label: 'QTY' },
  { key: 'unitPrice', label: 'CP' },
  { key: 'itemTotal', label: 'TOTAL' },
]
const BILLS_COL_DEFAULTS: Record<string, number> = { item: 200, quantity: 70, unitPrice: 100, itemTotal: 100 }

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
  bill_id: number
  item_id: number | null
  item_name: string
  quantity: string
  unit_price: string
  item_total: string
  usage_unit: string | null
  unresolved: boolean
}

// One row per item line (not per bill) -- date/vendor come from the line's
// parent bill, so the same vendor repeats across every line it supplied
// that day instead of being a single group header hiding the items below it.
type FlatRow = {
  key: string
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
}

const MONTHS = ['Ja','Fe','Mr','Ap','My','Ju','Jl','Au','Se','Oc','No','De']
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

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

const BILLS_FLAG_VIOLATIONS = new Set(['no_vendor', 'no_items_bills', 'bill_total_mismatch', 'bill_no_attachment'])

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

type Props = {
  items: Item[]
  groupFilter: string | null
  search: string
  violation?: string | null
}

export default function BillsTab({ items, groupFilter, search, violation = null }: Props) {
  const { data: session } = useSession()
  const isOwnerLevelUser = isOwnerLevel(session?.user as any)
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [viewingItemId, setViewingItemId] = useState<number | null>(null)
  const [linesMap, setLinesMap] = useState<Record<number, BillLine[]>>({})
  // Editing is bill-level now, triggered from the ✏️ on a group's bar
  // rather than by clicking any line -- keyed by bill id directly.
  const [editingBillId, setEditingBillId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ bill_date: '', vendor_name: '' })
  const editAttachments = useAttachments([], '/api/bills/upload')
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')
  // Collapses every group down to just its header bar (Date/Vendor/Total) --
  // the item lines beneath stay hidden until toggled back on, same pattern
  // as Sales' Bars Only.
  const [barsOnly, setBarsOnly] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  // Narrows the list to one vendor and/or one month/year, independent of the
  // text search box above (which still searches within whatever this
  // narrows down to).
  const [vendorFilter, setVendorFilter] = useState<string | null>(null)
  const [monthFilter, setMonthFilter] = useState<number | null>(null)
  const [yearFilter, setYearFilter] = useState<number | null>(null)
  // null doubles as "loading" -- no separate loading flag needed since
  // there's nothing to distinguish "not fetched yet" from "fetching".
  const [flags, setFlags] = useState<{
    noVendorBills: NoVendorRow[]; noItemsBills: NoItemsRow[]
    billTotalMismatch: MismatchRow[]; billNoAttachment: NoAttachmentRow[]
  } | null>(null)
  const colPrefs = useColumnPrefs<ColKey>('billsTab', COLUMNS)

  useEffect(() => {
    if (violation && BILLS_FLAG_VIOLATIONS.has(violation) && !flags) {
      fetch('/api/flags').then(r => r.ok ? r.json() : null).then(d => { if (d) setFlags(d) })
    }
  }, [violation, flags])

  function loadBills() {
    Promise.all([
      fetch('/api/bills').then(r => r.json()),
      fetch('/api/bills/all-lines').then(r => r.json()),
    ]).then(([billsData, linesData]) => {
      setBills(Array.isArray(billsData) ? billsData : [])
      const map: Record<number, BillLine[]> = {}
      if (Array.isArray(linesData)) {
        for (const l of linesData) {
          if (!map[l.bill_id]) map[l.bill_id] = []
          map[l.bill_id].push(l)
        }
      }
      setLinesMap(map)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { loadBills() }, [])
  usePolling(loadBills, 120000, editingBillId === null)

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

  const filtered = useMemo(() => {
    let list = flatRows
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
  }, [flatRows, groupItemNames, vendorFilter, monthFilter, yearFilter, search])

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
    const list: { key: string; billDate: string; vendorName: string | null; total: number; editBillId: number; isDayHead: boolean; rows: FlatRow[] }[] = []
    for (const [key, g] of map) {
      const date10 = g.billDate.slice(0, 10)
      list.push({
        key, billDate: g.billDate, vendorName: g.vendorName,
        total: vendorDayTotals[key] ?? 0,
        editBillId: g.rows[0].billId,
        isDayHead: date10 !== prevDate,
        rows: g.rows,
      })
      prevDate = date10
    }
    return list
  }, [filtered, vendorDayTotals])

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
      <div className="flex items-center justify-between px-2 py-1 border-b border-gray-100 bg-gray-50 shrink-0">
        <div className="flex items-center gap-1.5">
          <button onClick={() => setShowHistory(true)}
            className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-700 transition">
            History
          </button>
          <label title="Show only the date/vendor bars, hiding each bill's item lines"
            className="flex items-center gap-1 text-[9px] font-semibold text-gray-600 px-1.5 py-0.5 cursor-pointer select-none">
            <input type="checkbox" checked={barsOnly} onChange={() => setBarsOnly(b => !b)}
              className="w-3 h-3 accent-blue-600" />
            Bars Only
          </label>
        </div>
        <div className="flex items-center gap-1.5">
          <ColumnsPickerButton prefs={colPrefs} />
        </div>
      </div>
      {/* Own row, separate from the toggle above -- narrows the list by
          vendor and/or month/year independently of the search box, which
          still applies within whatever this narrows down to. */}
      <div className="flex items-center flex-wrap gap-1.5 px-2 py-1 border-b border-gray-100 bg-gray-50 shrink-0">
        <select value={vendorFilter ?? ''} onChange={e => setVendorFilter(e.target.value || null)}
          className="text-[10px] text-gray-700 bg-white border border-gray-200 rounded px-1.5 py-0.5 outline-none max-w-[120px]">
          <option value="">All Vendors</option>
          {availableVendors.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={monthFilter ?? ''} onChange={e => setMonthFilter(e.target.value ? Number(e.target.value) : null)}
          className="text-[10px] text-gray-700 bg-white border border-gray-200 rounded px-1.5 py-0.5 outline-none">
          <option value="">All Months</option>
          {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={yearFilter ?? ''} onChange={e => setYearFilter(e.target.value ? Number(e.target.value) : null)}
          className="text-[10px] text-gray-700 bg-white border border-gray-200 rounded px-1.5 py-0.5 outline-none">
          <option value="">All Years</option>
          {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {(vendorFilter !== null || monthFilter !== null || yearFilter !== null) && (
          <button onClick={() => { setVendorFilter(null); setMonthFilter(null); setYearFilter(null) }}
            className="text-[9px] font-semibold text-blue-600 hover:text-blue-700">
            Clear
          </button>
        )}
      </div>
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
                className="text-[11px]">ITEM</ResizableTh>
              {colPrefs.shownColumns.map((c, i) => (
                <ResizableTh key={c.key} align="right" noDivider={i === colPrefs.shownColumns.length - 1} className="text-[11px]"
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
                    <td colSpan={1 + colPrefs.shownColumns.length} className={`relative ${g.isDayHead ? 'px-1.5 py-2' : 'px-1 py-1'}`}>
                      <div className="flex items-center gap-2">
                        <span className={`whitespace-nowrap ${g.isDayHead ? 'text-white font-semibold' : 'text-gray-600 font-medium'}`}>
                          {fmtShort(g.billDate)}
                        </span>
                        <button onClick={e => { e.stopPropagation(); toggleEdit(g.editBillId) }} title="Edit this bill"
                          className={`leading-none ${g.isDayHead ? 'text-blue-100 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}>
                          ✏️
                        </button>
                        <span className={`flex-1 text-center font-extrabold truncate ${g.isDayHead ? 'text-white text-base' : 'text-gray-700 text-sm'}`}
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
                      className={`border-b border-gray-100 text-[13px] font-bold ${row.unresolved ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                      <td className="px-1 py-1 text-gray-900 overflow-hidden">
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
                          <td key={c.key} className="px-1 py-1 text-right text-gray-700 truncate">{row.quantity ? parseFloat(row.quantity) : '—'}</td>
                        )
                        if (c.key === 'unitPrice') return (
                          <td key={c.key} className="px-1 py-1 text-right text-gray-700 truncate">{fmt(row.unitPrice)}</td>
                        )
                        return (
                          <td key={c.key} className="px-1 py-1 text-right font-semibold text-gray-900 truncate">{fmt(row.itemTotal)}</td>
                        )
                      })}
                    </tr>
                  ))}
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
