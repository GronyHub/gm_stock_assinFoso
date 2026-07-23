'use client'
import { Fragment, useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { fmtDate } from '@/lib/fmtDate'
import { usePolling } from '@/lib/usePolling'
import HistoryPanel from './HistoryPanel'
import ItemDetailDropdown from './ItemDetailDropdown'

type Item = { id: number; item_name: string; cf_group: string | null }

type Receipt = {
  id: number
  receipt_number: string
  receipt_date: string
  customer_name: string | null
  invoice_amount: string | null
  cash_counted: string | null
  wnw: string | null
  entered_by: string | null
}

type Line = {
  id: number
  receipt_id: number
  item_id: number | null
  item_name: string
  quantity: string | null
  item_price: string | null
  item_total: string | null
  usage_unit: string | null
}

type EditLine = { id: number | null; itemId: number | null; item_name: string; quantity: string; item_price: string; nameTouched: boolean }

const MONTHS = ['Ja','Fe','Mr','Ap','My','Ju','Jl','Au','Se','Oc','No','De']
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa']

function fmtShort(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(-2)}-${DAYS[d.getUTCDay()]}`
}

function fmtCust(name: string | null) {
  if (!name) return 'WIC'
  const u = name.toLowerCase()
  if (u.includes('walk') || u.includes('wic')) return 'WIC'
  return 'GMC'
}

function n(val: string | null) {
  if (!val) return null
  const v = parseFloat(val)
  return isNaN(v) ? null : v
}

function fmt(val: string | null) {
  const v = n(val)
  if (v === null) return '—'
  return v.toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function wnwColor(wnw: string | null) {
  const v = n(wnw)
  if (v === null) return 'text-gray-400'
  if (v > 0) return 'text-orange-600'
  if (v < 0) return 'text-red-600'
  return 'text-green-600'
}

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded px-2 py-1 text-[10px] text-gray-900 placeholder-gray-400 outline-none focus:ring-1 focus:ring-blue-400'

const NO_WORK_REASONS = [
  'No work — Public Holiday','No work — Christmas Day','No work — Good Friday',
  'No work — Easter Monday','No work — Independence Day','No work — Special Assignment',
  'No work — Shop Closed','No work — Staff Training','No work — Other',
]

function FixRow({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <div className="flex items-center justify-between px-2 py-1.5 gap-2">
        <div className="min-w-0 flex-1">
          <span className="text-[10px] text-gray-900 font-semibold">{label}</span>
          {sub && <span className="ml-2 text-[9px] text-gray-400">{sub}</span>}
        </div>
        <button onClick={() => setOpen(o => !o)}
          className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition">
          {open ? 'Close' : 'Fix'}
        </button>
      </div>
      {open && <div className="px-2 pb-2 border-t border-gray-50 space-y-1.5 pt-1.5">{children}</div>}
    </div>
  )
}

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
        className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-[10px] font-semibold rounded py-1.5 transition">
        {saving ? 'Saving…' : 'Save Cash Counted'}
      </button>
    </FixRow>
  )
}

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
        <div className="space-y-1.5">
          <select value={noWorkReason} onChange={e => setNoWorkReason(e.target.value)} className={inputCls}>
            {NO_WORK_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <div className="flex gap-1">
            <button onClick={markNoWork} disabled={saving}
              className="flex-1 bg-red-500 hover:bg-red-400 disabled:opacity-40 text-white text-[10px] font-semibold rounded py-1.5 transition">
              {saving ? 'Saving…' : 'Confirm No Work'}
            </button>
            <button onClick={() => setShowNoWork(false)} disabled={saving}
              className="px-3 py-1.5 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded">Cancel</button>
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
          <div className="flex gap-1">
            {total ? (
              <button onClick={addReceipt} disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-[10px] font-semibold rounded py-1.5 transition">
                {saving ? 'Saving…' : 'Create Receipt'}
              </button>
            ) : (
              <button onClick={() => setShowNoWork(true)}
                className="flex-1 bg-orange-500 hover:bg-orange-400 text-white text-[10px] font-semibold rounded py-1.5 transition">
                No Work
              </button>
            )}
          </div>
        </>
      )}
    </FixRow>
  )
}

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
      <button onClick={() => setExpanded(e => !e)} className="w-full text-left px-2 py-1.5 hover:bg-gray-50 transition">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-semibold text-gray-900 truncate block">{r.item_name}</span>
            <span className="text-[9px] text-gray-400">{fmtDate(r.receipt_date)} · </span>
            <span className="text-[9px] text-red-500">₵{Number(r.selling_price).toFixed(2)} sell · ₵{Number(r.cost_price).toFixed(2)} cost</span>
          </div>
          <span className="shrink-0 text-[9px] text-blue-600 font-semibold">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>
      {expanded && (
        <div className="px-2 pb-2 border-t border-gray-50 space-y-1.5 pt-1.5">
          <a href={`/sales?receipt=${r.receipt_id}`} className="text-[9px] text-blue-600 font-semibold hover:underline">
            Open receipt {r.receipt_number} →
          </a>
          <input type="number" min="0" step="0.01" inputMode="decimal"
            placeholder={`New cost price (currently ₵${Number(r.cost_price).toFixed(2)})`}
            value={cost} onChange={e => setCost(e.target.value)} className={inputCls} />
          <button onClick={save} disabled={!cost || saving}
            className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white text-[10px] font-semibold rounded py-1.5 transition">
            {saving ? 'Saving…' : 'Update Cost Price'}
          </button>
        </div>
      )}
    </div>
  )
}

type Props = {
  items: Item[]
  groupFilter: string | null
  search: string
  violation: string | null
  jumpToDate?: string | null
  jumpToItemName?: string | null
  onJumpDone?: () => void
}

export default function SalesTab({ items, groupFilter, search, violation, jumpToDate, jumpToItemName, onJumpDone }: Props) {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [linesMap, setLinesMap] = useState<Record<number, Line[]>>({})
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ receipt_date: '', customer_name: '', cash_counted: '' })
  const [editLines, setEditLines] = useState<EditLine[]>([])
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [newItemQuery, setNewItemQuery] = useState('')
  const [flags, setFlags] = useState<any | null>(null)
  const [flagsLoading, setFlagsLoading] = useState(false)
  // Which receipt line's item drop-down (ItemDetailDropdown) is open, if
  // any -- keyed by the line's own id so tapping one occurrence of an item
  // doesn't also expand every other receipt row selling the same item.
  const [expandedLineId, setExpandedLineId] = useState<number | null>(null)

  const needsFlags = violation === 'no_cash' || violation === 'missing_days' || violation === 'cost_price' || violation === 'dup_receipt'

  useEffect(() => {
    if (needsFlags && !flags && !flagsLoading) {
      setFlagsLoading(true)
      fetch('/api/flags')
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(d => { setFlags(d); setFlagsLoading(false) })
        .catch(() => { setFlags({ noCash: [], missingDays: [], costGteSell: [], dupReceipts: [] }); setFlagsLoading(false) })
    }
  }, [needsFlags, flags, flagsLoading])

  function loadReceipts() {
    Promise.all([
      fetch('/api/sales').then(r => r.json()),
      fetch('/api/sales/all-lines').then(r => r.json()),
    ]).then(([receiptsData, linesData]) => {
      setReceipts(Array.isArray(receiptsData) ? receiptsData : [])
      const map: Record<number, Line[]> = {}
      if (Array.isArray(linesData)) {
        for (const l of linesData) {
          if (!map[l.receipt_id]) map[l.receipt_id] = []
          map[l.receipt_id].push(l)
        }
      }
      setLinesMap(map)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { loadReceipts() }, [])
  usePolling(loadReceipts, 5000, editingId === null)

  const [verifiedDates, setVerifiedDates] = useState<Set<string>>(new Set())
  function loadVerifiedDates() {
    fetch('/api/sales/verified-dates')
      .then(r => r.ok ? r.json() : [])
      .then(d => setVerifiedDates(new Set(Array.isArray(d) ? d : [])))
      .catch(() => {})
  }
  useEffect(() => { loadVerifiedDates() }, [])
  usePolling(loadVerifiedDates, 20000)

  const groupItemNames = useMemo(() => {
    if (!groupFilter || groupFilter === 'All') return null
    return new Set(items.filter(i => (i.cf_group ?? 'Ungrouped') === groupFilter).map(i => i.item_name))
  }, [items, groupFilter])

  const filtered = useMemo(() => {
    let list = receipts
    if (groupItemNames) {
      list = list.filter(r => (linesMap[r.id] ?? []).some(l => groupItemNames.has(l.item_name)))
    }
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        (r.customer_name ?? '').toLowerCase().includes(q) ||
        r.receipt_number.toLowerCase().includes(q) ||
        (linesMap[r.id] ?? []).some(l => l.item_name.toLowerCase().includes(q))
      )
    }
    return list
  }, [receipts, linesMap, groupItemNames, search])

  function jumpTo(r: Receipt) {
    setSelectedId(r.id)
    document.getElementById(`receipt-${r.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Incoming jump from an item's day table: find the receipt for that date,
  // preferring the one that actually has the item on it (a date can have both
  // a WIC and a GMC receipt) over just the first match.
  useEffect(() => {
    if (!jumpToDate || loading) return
    const targetDate = jumpToDate.slice(0, 10)
    const candidates = receipts.filter(r => r.receipt_date?.slice(0, 10) === targetDate)
    if (candidates.length > 0) {
      const withItem = jumpToItemName
        ? candidates.find(r => (linesMap[r.id] ?? []).some(l => l.item_name.toLowerCase() === jumpToItemName.toLowerCase()))
        : undefined
      const target = withItem ?? candidates[0]
      setTimeout(() => jumpTo(target), 50)
    }
    onJumpDone?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpToDate, loading])

  function startEdit(r: Receipt) {
    setEditForm({
      receipt_date: r.receipt_date?.slice(0, 10) ?? '',
      customer_name: r.customer_name ?? '',
      cash_counted: r.cash_counted ? parseFloat(r.cash_counted).toString() : '',
    })
    const rLines = linesMap[r.id] ?? []
    setEditLines(rLines.map(l => ({
      id: l.id,
      itemId: l.item_id,
      item_name: l.item_name,
      quantity: l.quantity ? parseFloat(l.quantity).toString() : '1',
      item_price: l.item_price ? parseFloat(l.item_price).toString() : '0',
      nameTouched: false,
    })))
    setNewItemQuery('')
    setEditingId(r.id)
  }

  function addEditLine(item: Item & { selling_rate?: string | number | null }) {
    setEditLines(prev => [...prev, {
      id: null,
      itemId: item.id,
      item_name: item.item_name,
      quantity: '1',
      item_price: item.selling_rate != null ? String(item.selling_rate) : '0',
      nameTouched: false,
    }])
    setNewItemQuery('')
  }

  // Typed names are never matched against the existing catalogue by text --
  // this always creates a brand-new item, same rule as editing an existing
  // line's name. Any accidental duplicates get caught by the Duplicates flag.
  function addFreeTextLine(name: string) {
    setEditLines(prev => [...prev, {
      id: null,
      itemId: null,
      item_name: name,
      quantity: '1',
      item_price: '0',
      nameTouched: true,
    }])
    setNewItemQuery('')
  }

  function removeEditLine(idx: number) {
    setEditLines(prev => prev.filter((_, i) => i !== idx))
  }

  async function deleteReceipt(id: number) {
    setDeletingId(id)
    const res = await fetch(`/api/sales/${id}`, { method: 'DELETE' })
    setDeletingId(null)
    setConfirmDeleteId(null)
    if (res.ok) {
      setReceipts(prev => prev.filter(r => r.id !== id))
      setLinesMap(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      if (editingId === id) setEditingId(null)
    } else {
      const d = await res.json().catch(() => ({}))
      alert(d.error || 'Could not delete receipt.')
    }
  }

  function updateEditLine(idx: number, field: keyof EditLine, val: string) {
    // Hand-editing the name text means it's no longer the picked item -- clear
    // itemId and mark it touched so the server creates a brand-new item for
    // it on save, rather than matching the typed text against the catalogue.
    setEditLines(prev => prev.map((l, i) => i === idx
      ? { ...l, [field]: val, ...(field === 'item_name' ? { itemId: null, nameTouched: true } : {}) }
      : l))
  }

  const editTotal = editLines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.item_price) || 0), 0)

  async function saveEdit() {
    if (editingId == null) return
    setSaving(true)
    setEditError('')
    const headerRes = await fetch(`/api/sales/${editingId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receipt_date: editForm.receipt_date || undefined,
        customer_name: editForm.customer_name || null,
        cash_counted: editForm.cash_counted ? parseFloat(editForm.cash_counted) : null,
      }),
    })
    const linesRes = await fetch(`/api/sales/${editingId}/lines`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines: editLines }),
    })
    setSaving(false)
    if (headerRes.ok && linesRes.ok) {
      const updated = await headerRes.json()
      const linesResult = await linesRes.json().catch(() => ({}))
      setReceipts(prev => prev.map(r => r.id === editingId ? { ...r, ...updated } : r))
      const lRes = await fetch(`/api/sales/${editingId}`)
      const freshLines = await lRes.json()
      setLinesMap(prev => ({ ...prev, [editingId]: freshLines }))
      setEditingId(null)
      // Impossible-usage warnings (e.g. papers used with no GMC pack recorded)
      // -- the save went through; make sure the user sees what record is missing.
      if (Array.isArray(linesResult.warnings) && linesResult.warnings.length > 0) {
        alert(linesResult.warnings.join('\n\n'))
      }
    } else {
      const d = await (linesRes.ok ? headerRes : linesRes).json().catch(() => ({}))
      setEditError(d.error || 'Could not save changes. Please try again.')
    }
  }

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  // Violation views
  if (violation === 'no_cash') {
    return (
      <div className="overflow-y-auto h-full py-2">
        <p className="text-[10px] text-gray-400 px-2 mb-1">
          {flagsLoading || !flags ? 'Loading…' : `${flags.noCash.length} receipt${flags.noCash.length !== 1 ? 's' : ''} missing cash counted`}
        </p>
        {!flagsLoading && flags && (flags.noCash.length === 0
          ? <p className="py-4 text-center text-gray-400 text-[10px]">All walk-in receipts have cash counted.</p>
          : <div className="bg-white border-t border-b border-gray-200 divide-y divide-gray-100">
              {flags.noCash.map((r: any) => (
                <NoCashFix key={r.id} r={r} onFixed={id =>
                  setFlags((f: any) => f ? { ...f, noCash: f.noCash.filter((x: any) => x.id !== id) } : f)
                } />
              ))}
            </div>
        )}
      </div>
    )
  }

  if (violation === 'missing_days') {
    return (
      <div className="overflow-y-auto h-full py-2">
        <p className="text-[10px] text-gray-400 px-2 mb-1">
          {flagsLoading || !flags ? 'Loading…' : `${flags.missingDays.length} day${flags.missingDays.length !== 1 ? 's' : ''} with no sales receipts`}
        </p>
        {!flagsLoading && flags && (flags.missingDays.length === 0
          ? <p className="py-4 text-center text-gray-400 text-[10px]">No missing days found.</p>
          : <div className="bg-white border-t border-b border-gray-200 divide-y divide-gray-100">
              {flags.missingDays.map((r: any) => (
                <MissingDayFix key={r.missing_date} date={r.missing_date} onFixed={d =>
                  setFlags((f: any) => f ? { ...f, missingDays: f.missingDays.filter((x: any) => x.missing_date !== d) } : f)
                } />
              ))}
            </div>
        )}
      </div>
    )
  }

  if (violation === 'cost_price') {
    return (
      <div className="overflow-y-auto h-full py-2">
        <p className="text-[10px] text-gray-400 px-2 mb-1">
          {flagsLoading || !flags ? 'Loading…' : `${flags.costGteSell.length} line${flags.costGteSell.length !== 1 ? 's' : ''} where cost price ≥ selling price`}
        </p>
        {!flagsLoading && flags && (flags.costGteSell.length === 0
          ? <p className="py-4 text-center text-gray-400 text-[10px]">No items sold at or below cost price.</p>
          : <div className="bg-white border-t border-b border-gray-200 divide-y divide-gray-100">
              {flags.costGteSell.map((r: any, i: number) => (
                <CostPriceFix key={`${r.item_id}-${i}`} r={r} onFixed={itemId =>
                  setFlags((f: any) => f ? { ...f, costGteSell: f.costGteSell.filter((x: any) => x.item_id !== itemId) } : f)
                } />
              ))}
            </div>
        )}
      </div>
    )
  }

  if (violation === 'dup_receipt') {
    return (
      <div className="overflow-y-auto h-full py-2">
        <p className="text-[10px] text-gray-400 px-2 mb-1">
          {flagsLoading || !flags ? 'Loading…' : `${flags.dupReceipts.length} day${flags.dupReceipts.length !== 1 ? 's' : ''} with more than one receipt of the same customer type`}
        </p>
        {!flagsLoading && flags && (flags.dupReceipts.length === 0
          ? <p className="py-4 text-center text-gray-400 text-[10px]">No duplicate WIC/GMC receipts found.</p>
          : <div className="bg-white border-t border-b border-gray-200 divide-y divide-gray-100">
              {flags.dupReceipts.map((r: any, i: number) => (
                <div key={i} className="px-2 py-2">
                  <p className="text-[10px] font-semibold text-gray-900">
                    {fmtDate(r.receipt_date)} — {r.customer_type}
                    <span className="ml-1 text-red-500">({r.receipt_count} receipts)</span>
                  </p>
                  <p className="text-[9px] text-gray-400 mt-0.5">{r.receipt_numbers}</p>
                  <p className="text-[9px] text-gray-400 mt-0.5">Merge the items from the extra receipt(s) into one via Edit, then delete the rest.</p>
                </div>
              ))}
            </div>
        )}
      </div>
    )
  }

  // Normal list view
  if (showHistory) return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1.5 px-2 py-1 border-b border-gray-200 bg-gray-50 shrink-0">
        <button onClick={() => setShowHistory(false)}
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-purple-600 text-white transition">
          ← Back
        </button>
        <span className="text-[9px] font-semibold text-purple-700">Sales History</span>
      </div>
      <HistoryPanel keywords={['sale', 'receipt']} onEntryClick={log => {
        // "added sale receipt": "SR-001 · ₵300 on date"  →  receipt_number = first token
        // "deleted sale receipt": "SR-001 · ₵300"         →  same
        const match = log.details?.match(/^([^\s·]+)/)
        const target = match ? receipts.find(r => r.receipt_number === match[1]) : undefined
        setShowHistory(false)
        if (target) setTimeout(() => jumpTo(target!), 50)
      }} />
    </div>
  )

  return (
    <div className="flex flex-col h-full min-h-0">
    <div className="flex items-center justify-between px-2 py-1 border-b border-gray-100 bg-gray-50 shrink-0">
      <button onClick={() => setShowHistory(true)}
        className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-700 transition">
        History
      </button>
      <Link href="/sales/new"
            className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100">
            + New Receipt
          </Link>
    </div>
    <div className="flex-1 overflow-y-auto min-h-0">
      <table className="w-full border-collapse text-[10px]">
        <thead className="sticky top-0 bg-gray-100 z-10">
          <tr>
            <th className="text-left px-1 py-1 font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">DATE</th>
            <th className="text-left px-1 py-1 font-semibold text-gray-500 border-b border-gray-200">CST</th>
            <th className="text-right px-1 py-1 font-semibold text-gray-500 border-b border-gray-200">CC</th>
            <th className="text-right px-1 py-1 font-semibold text-gray-500 border-b border-gray-200">INV</th>
            <th className="text-right px-1 py-1 font-semibold text-gray-500 border-b border-gray-200">WNW</th>
          </tr>
        </thead>
        <tbody>
        {filtered.map(r => {
          const rLines = linesMap[r.id] ?? []
          const rowOpen = selectedId === r.id
          return (
            <Fragment key={r.id}>
            <tr id={`receipt-${r.id}`}
              onClick={() => { if (editingId === r.id) return; setSelectedId(rowOpen ? null : r.id) }}
              className={`cursor-pointer border-b border-gray-100 transition ${rowOpen ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
              <td className="px-1 py-1 text-gray-700 whitespace-nowrap">
                {fmtShort(r.receipt_date)}
                {verifiedDates.has(r.receipt_date?.slice(0, 10)) && (
                  <span title="Every item sold this day is verified" className="ml-0.5">✅</span>
                )}
              </td>
              <td className="px-1 py-1 text-gray-700">{fmtCust(r.customer_name)}</td>
              <td className="px-1 py-1 text-right text-gray-700">{fmt(r.cash_counted)}</td>
              <td className="px-1 py-1 text-right text-gray-900 font-semibold">{fmt(r.invoice_amount)}</td>
              <td className={`px-1 py-1 text-right font-semibold ${wnwColor(r.wnw)}`}>{fmt(r.wnw)}</td>
            </tr>
            {rowOpen && (
              <tr className="bg-blue-50/40">
                <td colSpan={5} className="p-0 border-b border-gray-200 bg-white">
              {editingId === r.id ? (
                <div className="p-2 space-y-2">
                  <p className="text-[10px] font-bold text-gray-600">Edit Receipt</p>
                  <div className="grid grid-cols-2 gap-1">
                    <div>
                      <p className="text-[9px] text-gray-400 mb-0.5">Date</p>
                      <input type="date" value={editForm.receipt_date}
                        onChange={e => setEditForm(f => ({ ...f, receipt_date: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-400 mb-0.5">Customer</p>
                      <input value={editForm.customer_name}
                        onChange={e => setEditForm(f => ({ ...f, customer_name: e.target.value }))}
                        placeholder="Walk-in" className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-400 mb-0.5">Cash Counted (₵)</p>
                    <input type="number" min="0" step="0.01" inputMode="decimal"
                      value={editForm.cash_counted}
                      onChange={e => setEditForm(f => ({ ...f, cash_counted: e.target.value }))}
                      placeholder="0" className={inputCls} />
                  </div>
                  <table className="w-full border-collapse text-[10px]">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-200">
                        <th className="text-left px-1 py-0.5 font-semibold text-gray-500">Item</th>
                        <th className="text-right px-1 py-0.5 font-semibold text-gray-500">Qty</th>
                        <th className="text-right px-1 py-0.5 font-semibold text-gray-500">SP</th>
                        <th className="text-right px-1 py-0.5 font-semibold text-gray-500">Total</th>
                        <th className="w-5" />
                      </tr>
                    </thead>
                    <tbody>
                      {editLines.map((l, idx) => (
                        <tr key={l.id ?? `new-${idx}`} className="border-b border-gray-100">
                          <td className="px-1 py-0.5">
                            <input value={l.item_name} onChange={e => updateEditLine(idx, 'item_name', e.target.value)}
                              className="w-full bg-gray-50 border border-gray-200 rounded px-1 py-0.5 text-[10px] outline-none focus:ring-1 focus:ring-blue-400" />
                          </td>
                          <td className="px-1 py-0.5">
                            <input type="number" value={l.quantity} onChange={e => updateEditLine(idx, 'quantity', e.target.value)}
                              className="w-full text-right bg-gray-50 border border-gray-200 rounded px-1 py-0.5 text-[10px] outline-none focus:ring-1 focus:ring-blue-400" />
                          </td>
                          <td className="px-1 py-0.5">
                            <input type="number" value={l.item_price} onChange={e => updateEditLine(idx, 'item_price', e.target.value)}
                              className="w-full text-right bg-gray-50 border border-gray-200 rounded px-1 py-0.5 text-[10px] outline-none focus:ring-1 focus:ring-blue-400" />
                          </td>
                          <td className="px-1 py-0.5 text-right text-gray-700">
                            {((parseFloat(l.quantity)||0)*(parseFloat(l.item_price)||0)).toFixed(0)}
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            <button onClick={() => removeEditLine(idx)} title="Remove item"
                              className="text-red-500 hover:text-red-700 font-bold leading-none">×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-200 bg-gray-50">
                        <td colSpan={3} className="px-1 py-0.5 text-right font-bold text-gray-600">Total</td>
                        <td className="px-1 py-0.5 text-right font-bold text-gray-900">{editTotal.toFixed(0)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>

                  {/* Add item to receipt */}
                  <div className="relative">
                    <input value={newItemQuery} onChange={e => setNewItemQuery(e.target.value)}
                      placeholder="+ Search item to add…"
                      className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 text-[10px] outline-none focus:ring-1 focus:ring-blue-400" />
                    {newItemQuery.trim().length > 0 && (
                      <div className="absolute z-20 left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded shadow-lg max-h-32 overflow-y-auto">
                        {items.filter(it => it.item_name.toLowerCase().includes(newItemQuery.trim().toLowerCase())).slice(0, 15).map(it => (
                          <button key={it.id} onClick={() => addEditLine(it as any)}
                            className="w-full text-left px-2 py-1 text-[10px] text-gray-800 hover:bg-blue-50 border-b border-gray-100 last:border-0">
                            {it.item_name}
                          </button>
                        ))}
                        {items.filter(it => it.item_name.toLowerCase().includes(newItemQuery.trim().toLowerCase())).length === 0 && (
                          <button onClick={() => addFreeTextLine(newItemQuery.trim())}
                            className="w-full text-left px-2 py-1.5 text-[10px] text-blue-600 font-semibold hover:bg-blue-50">
                            + Add &quot;{newItemQuery.trim()}&quot; as a new item
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {editError && <p className="text-[10px] text-red-500 font-medium text-center">{editError}</p>}
                  <div className="flex gap-1">
                    <button onClick={saveEdit} disabled={saving}
                      className="flex-1 bg-green-600 text-white text-[10px] font-bold rounded py-1 disabled:opacity-40">
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="px-3 py-1 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded">Cancel</button>
                    <button onClick={() => setConfirmDeleteId(r.id)}
                      className="px-3 py-1 bg-red-50 text-red-600 text-[10px] font-semibold rounded">Delete</button>
                  </div>
                  {confirmDeleteId === r.id && (
                    <div className="mt-1.5 px-2 py-2 bg-red-50 border border-red-100 rounded flex items-center justify-between gap-2">
                      <span className="text-[10px] text-red-700 font-medium">Delete this receipt permanently?</span>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => deleteReceipt(r.id)} disabled={deletingId === r.id}
                          className="text-[9px] font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-40 px-2 py-1 rounded">
                          {deletingId === r.id ? 'Deleting…' : 'Yes, Delete'}
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)}
                          className="text-[9px] font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-2 py-1 bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                    <div>
                      <p className="text-[10px] font-bold text-gray-900">
                        {r.customer_name ?? 'Walk-in Customer'}
                        {verifiedDates.has(r.receipt_date?.slice(0, 10)) && (
                          <span title="Every item sold this day is verified" className="ml-1">✅</span>
                        )}
                      </p>
                      <p className="text-[9px] text-gray-400">{fmtDate(r.receipt_date)} · {r.receipt_number}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => startEdit(r)}
                        className="text-[9px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100 transition">
                        Edit
                      </button>
                      <button onClick={() => setConfirmDeleteId(r.id)}
                        className="text-[9px] text-red-600 font-semibold bg-red-50 px-2 py-0.5 rounded hover:bg-red-100 transition">
                        Delete
                      </button>
                    </div>
                  </div>
                  {confirmDeleteId === r.id && (
                    <div className="px-2 py-2 bg-red-50 border-b border-red-100 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-red-700 font-medium">Delete this receipt permanently?</span>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => deleteReceipt(r.id)} disabled={deletingId === r.id}
                          className="text-[9px] font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-40 px-2 py-1 rounded">
                          {deletingId === r.id ? 'Deleting…' : 'Yes, Delete'}
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)}
                          className="text-[9px] font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  {rLines.length === 0 ? (
                    <p className="text-[10px] text-gray-400 text-center py-4">No items.</p>
                  ) : (
                    <table className="w-full border-collapse text-[10px]">
                      <thead>
                        <tr>
                          <th className="text-left px-1.5 py-1 font-semibold text-gray-500 border-b border-gray-200">item</th>
                          <th className="text-right px-1.5 py-1 font-semibold text-gray-500 border-b border-gray-200">qty</th>
                          <th className="text-right px-1.5 py-1 font-semibold text-gray-500 border-b border-gray-200">SP</th>
                          <th className="text-right px-1.5 py-1 font-semibold text-gray-500 border-b border-gray-200">TOTAL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rLines.map((line, i) => {
                          const isOpen = expandedLineId === line.id
                          return (
                          <Fragment key={i}>
                            <tr className="border-b border-gray-100">
                              <td className="px-1.5 py-1 text-gray-900">
                                {line.item_id ? (
                                  <button onClick={() => setExpandedLineId(isOpen ? null : line.id)}
                                    className="text-left text-blue-600 hover:underline">
                                    {line.item_name}
                                  </button>
                                ) : line.item_name}
                              </td>
                              <td className="px-1.5 py-1 text-right text-gray-700">{line.quantity ? parseFloat(line.quantity) : '—'}</td>
                              <td className="px-1.5 py-1 text-right text-gray-700">{fmt(line.item_price)}</td>
                              <td className="px-1.5 py-1 text-right font-semibold text-gray-900">{fmt(line.item_total)}</td>
                            </tr>
                            {isOpen && line.item_id && (
                              <tr>
                                <td colSpan={4} className="p-0 border-b border-gray-100">
                                  <div className="sticky left-0 w-[100vw] max-w-[100vw] max-h-[50vh] overflow-auto bg-blue-50 px-0.5 pb-2 pt-0.5">
                                    <ItemDetailDropdown itemId={line.item_id} />
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-gray-200 bg-gray-50">
                          <td colSpan={3} className="px-1.5 py-1 text-right font-bold text-gray-600">Total</td>
                          <td className="px-1.5 py-1 text-right font-bold text-gray-900">{fmt(r.invoice_amount)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </>
              )}
                </td>
              </tr>
            )}
            </Fragment>
          )
        })}
        </tbody>
      </table>
      {filtered.length === 0 && <p className="text-[10px] text-gray-400 text-center py-10">No receipts</p>}
    </div>
    </div>
  )
}
