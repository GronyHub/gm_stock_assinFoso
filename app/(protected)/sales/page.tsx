'use client'
import { useState, useEffect, useMemo, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { fmtDate } from '@/lib/fmtDate'

const MONTHS = ['Ja','Fe','Mr','Ap','My','Ju','Jl','Au','Se','Oc','No','De']
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa']

function fmtShort(dateStr: string) {
  const d = new Date(dateStr)
  const day   = d.getUTCDate()
  const mo    = MONTHS[d.getUTCMonth()]
  const yr    = String(d.getUTCFullYear()).slice(-2)
  const dow   = DAYS[d.getUTCDay()]
  return `${day} ${mo} ${yr}-${dow}`
}

function fmtCust(name: string | null) {
  if (!name) return 'WIC'
  const u = name.toLowerCase()
  if (u.includes('walk') || u.includes('wic')) return 'WIC'
  return 'GMC'
}

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
  item_name: string
  quantity: string | null
  item_price: string | null
  item_total: string | null
  usage_unit: string | null
}

type EditLine = { id: number; item_name: string; quantity: string; item_price: string }

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

const TABS = ['List', 'No Cash', 'Missing Days', 'Cost Price'] as const
type Tab = typeof TABS[number]

function Badge({ n }: { n: number }) {
  if (!n) return null
  return <span className="ml-1 bg-red-100 text-red-600 text-[9px] font-bold px-1 py-0.5 rounded-full">{n}</span>
}

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
        className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-[10px] font-semibold rounded py-1.5 transition">
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
              className="px-3 py-1.5 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded">
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
        className="w-full text-left px-2 py-1.5 hover:bg-gray-50 transition">
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
          <a href={`/sales?receipt=${r.receipt_id}`}
            className="text-[9px] text-blue-600 font-semibold hover:underline">
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

function SalesPageInner() {
  const searchParams = useSearchParams()
  const autoReceiptId = searchParams.get('receipt')

  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [linesMap, setLinesMap] = useState<Record<number, Line[]>>({})
  const [search, setSearch] = useState('')
  const autoOpened = useRef(false)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ receipt_date: '', customer_name: '', cash_counted: '' })
  const [editLines, setEditLines] = useState<EditLine[]>([])
  const [saving, setSaving] = useState(false)

  const [tab, setTab] = useState<Tab>('List')
  const [flags, setFlags] = useState<any | null>(null)
  const [flagsLoading, setFlagsLoading] = useState(false)

  useEffect(() => {
    const flagTabs: Tab[] = ['No Cash', 'Missing Days', 'Cost Price']
    if (flagTabs.includes(tab) && !flags && !flagsLoading) {
      setFlagsLoading(true)
      fetch('/api/flags')
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(d => { setFlags(d); setFlagsLoading(false) })
        .catch(() => {
          setFlags({ noCash: [], missingDays: [], costGteSell: [] })
          setFlagsLoading(false)
        })
    }
  }, [tab, flags, flagsLoading])

  useEffect(() => {
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
  }, [])

  useEffect(() => {
    if (!autoReceiptId || autoOpened.current || receipts.length === 0) return
    const match = receipts.find(r => r.id === Number(autoReceiptId))
    if (match) { autoOpened.current = true; jumpTo(match) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoReceiptId, receipts])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return receipts
    return receipts.filter(r =>
      (r.customer_name ?? '').toLowerCase().includes(q) ||
      r.receipt_number.toLowerCase().includes(q) ||
      r.receipt_date.includes(q)
    )
  }, [receipts, search])

  function jumpTo(r: Receipt) {
    setSelectedId(r.id)
    document.getElementById(`receipt-${r.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function startEdit(r: Receipt) {
    setEditForm({
      receipt_date: r.receipt_date?.slice(0, 10) ?? '',
      customer_name: r.customer_name ?? '',
      cash_counted: r.cash_counted ? parseFloat(r.cash_counted).toString() : '',
    })
    const rLines = linesMap[r.id] ?? []
    setEditLines(rLines.map(l => ({
      id: l.id,
      item_name: l.item_name,
      quantity: l.quantity ? parseFloat(l.quantity).toString() : '1',
      item_price: l.item_price ? parseFloat(l.item_price).toString() : '0',
    })))
    setEditingId(r.id)
  }

  function updateEditLine(idx: number, field: keyof EditLine, val: string) {
    setEditLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: val } : l))
  }

  const editTotal = editLines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.item_price) || 0), 0)

  async function saveEdit() {
    if (editingId == null) return
    setSaving(true)
    const headerRes = await fetch(`/api/sales/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receipt_date: editForm.receipt_date || undefined,
        customer_name: editForm.customer_name || null,
        cash_counted: editForm.cash_counted ? parseFloat(editForm.cash_counted) : null,
      }),
    })
    await fetch(`/api/sales/${editingId}/lines`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines: editLines }),
    })
    setSaving(false)
    if (headerRes.ok) {
      const updated = await headerRes.json()
      setReceipts(prev => prev.map(r => r.id === editingId ? { ...r, ...updated } : r))
      const lRes = await fetch(`/api/sales/${editingId}`)
      const freshLines = await lRes.json()
      setLinesMap(prev => ({ ...prev, [editingId]: freshLines }))
      setEditingId(null)
    }
  }

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading...</div>

  return (
    <div className="-mx-4 -mt-4 flex flex-col h-[calc(100dvh-60px)] md:h-[calc(100dvh-56px)]">

      {/* Top bar */}
      <div className="shrink-0 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${receipts.length}…`}
            className="w-20 flex-1 min-w-0 text-[10px] text-gray-900 placeholder-gray-300 bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400" />
          <div className="flex gap-1 overflow-x-auto shrink-0 max-w-[65%]">
            {TABS.map(t => {
              const cnt = t === 'No Cash' ? (flags?.noCash.length ?? 0)
                : t === 'Missing Days' ? (flags?.missingDays.length ?? 0)
                : t === 'Cost Price' ? (flags?.costGteSell.length ?? 0)
                : 0
              return (
                <button key={t} onClick={() => setTab(t)}
                  className={`shrink-0 text-[9px] font-semibold px-1.5 py-1 rounded transition whitespace-nowrap
                    ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {t}<Badge n={cnt} />
                </button>
              )
            })}
          </div>
        </div>
        {tab === 'List' && (
          <div className="flex justify-end px-2 pb-1.5">
            <Link href="/sales/new"
              className="shrink-0 bg-blue-600 text-white text-[9px] font-bold px-2 py-1 rounded transition hover:bg-blue-500">
              + New
            </Link>
          </div>
        )}
      </div>

      {/* Split body */}
      {tab === 'List' && (
      <div className="flex flex-1 min-h-0">

        {/* ── LEFT: receipts table ── */}
        <div className="w-1/2 border-r border-gray-200 overflow-y-auto min-h-0">
          <table className="w-full border-collapse text-[10px]">
            <thead className="sticky top-0 bg-gray-100 z-10">
              <tr>
                <th className="text-left px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">DATE</th>
                <th className="text-left px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">CST</th>
                <th className="text-right px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">CC</th>
                <th className="text-right px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">INV</th>
                <th className="text-right px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">WNW</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}
                  onClick={() => jumpTo(r)}
                  className={`cursor-pointer border-b border-gray-100 transition
                    ${selectedId === r.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <td className="px-0.5 py-0.5 text-gray-700 whitespace-nowrap">{fmtShort(r.receipt_date)}</td>
                  <td className="px-0.5 py-0.5 text-gray-700">{fmtCust(r.customer_name)}</td>
                  <td className="px-0.5 py-0.5 text-right text-gray-700">{fmt(r.cash_counted)}</td>
                  <td className="px-0.5 py-0.5 text-right text-gray-900 font-semibold">{fmt(r.invoice_amount)}</td>
                  <td className={`px-0.5 py-0.5 text-right font-semibold ${wnwColor(r.wnw)}`}>{fmt(r.wnw)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── RIGHT: every receipt's items, stacked continuously ── */}
        <div className="w-1/2 overflow-y-auto min-h-0 bg-white">
          {filtered.length === 0 ? (
            <p className="text-[10px] text-gray-400 text-center py-10">No receipts found</p>
          ) : (
            filtered.map(r => {
              const rLines = linesMap[r.id] ?? []
              return (
                <div key={r.id} id={`receipt-${r.id}`}
                  className={`border-b border-gray-200 transition ${selectedId === r.id ? 'bg-blue-50/40' : ''}`}>
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
                          </tr>
                        </thead>
                        <tbody>
                          {editLines.map((l, idx) => (
                            <tr key={l.id} className="border-b border-gray-100">
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
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-gray-200 bg-gray-50">
                            <td colSpan={3} className="px-1 py-0.5 text-right font-bold text-gray-600">Total</td>
                            <td className="px-1 py-0.5 text-right font-bold text-gray-900">{editTotal.toFixed(0)}</td>
                          </tr>
                        </tfoot>
                      </table>
                      <div className="flex gap-1">
                        <button onClick={saveEdit} disabled={saving}
                          className="flex-1 bg-green-600 text-white text-[10px] font-bold rounded py-1 disabled:opacity-40">
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="px-3 py-1 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Receipt header strip */}
                      <div className="flex items-center justify-between px-2 py-1 bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                        <div>
                          <p className="text-[10px] font-bold text-gray-900">{r.customer_name ?? 'Walk-in Customer'}</p>
                          <p className="text-[9px] text-gray-400">{fmtDate(r.receipt_date)} · {r.receipt_number}</p>
                        </div>
                        <button onClick={() => startEdit(r)}
                          className="text-[9px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100 transition">
                          Edit
                        </button>
                      </div>

                      {/* Items table */}
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
                            {rLines.map((line, i) => (
                              <tr key={i} className="border-b border-gray-100">
                                <td className="px-1.5 py-1 text-gray-900">{line.item_name}</td>
                                <td className="px-1.5 py-1 text-right text-gray-700">{line.quantity ? parseFloat(line.quantity) : '—'}</td>
                                <td className="px-1.5 py-1 text-right text-gray-700">{fmt(line.item_price)}</td>
                                <td className="px-1.5 py-1 text-right font-semibold text-gray-900">{fmt(line.item_total)}</td>
                              </tr>
                            ))}
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
                </div>
              )
            })
          )}
        </div>
      </div>
      )}

      {tab === 'No Cash' && (
        <div className="flex-1 overflow-y-auto min-h-0 py-2">
          <p className="text-[10px] text-gray-400 px-2 mb-1">
            {flagsLoading || !flags ? 'Loading…' : `${flags.noCash.length} walk-in receipt${flags.noCash.length !== 1 ? 's' : ''} missing cash counted`}
          </p>
          {flagsLoading || !flags ? null : flags.noCash.length === 0
            ? <p className="py-4 text-center text-gray-400 text-[10px]">All walk-in receipts have cash counted recorded.</p>
            : <div className="bg-white border-t border-b border-gray-200 divide-y divide-gray-100">
                {flags.noCash.map((r: any) => (
                  <NoCashFix key={r.id} r={r} onFixed={id =>
                    setFlags((f: any) => f ? { ...f, noCash: f.noCash.filter((x: any) => x.id !== id) } : f)
                  } />
                ))}
              </div>
          }
        </div>
      )}

      {tab === 'Missing Days' && (
        <div className="flex-1 overflow-y-auto min-h-0 py-2">
          <p className="text-[10px] text-gray-400 px-2 mb-1">
            {flagsLoading || !flags ? 'Loading…' : `${flags.missingDays.length} day${flags.missingDays.length !== 1 ? 's' : ''} with no sales receipts (excluding Sundays)`}
          </p>
          {flagsLoading || !flags ? null : flags.missingDays.length === 0
            ? <p className="py-4 text-center text-gray-400 text-[10px]">No missing days found.</p>
            : <div className="bg-white border-t border-b border-gray-200 divide-y divide-gray-100">
                {flags.missingDays.map((r: any) => (
                  <MissingDayFix key={r.missing_date} date={r.missing_date} onFixed={d =>
                    setFlags((f: any) => f ? { ...f, missingDays: f.missingDays.filter((x: any) => x.missing_date !== d) } : f)
                  } />
                ))}
              </div>
          }
        </div>
      )}

      {tab === 'Cost Price' && (
        <div className="flex-1 overflow-y-auto min-h-0 py-2">
          <p className="text-[10px] text-gray-400 px-2 mb-1">
            {flagsLoading || !flags ? 'Loading…' : `${flags.costGteSell.length} line${flags.costGteSell.length !== 1 ? 's' : ''} where cost price ≥ selling price`}
          </p>
          {flagsLoading || !flags ? null : flags.costGteSell.length === 0
            ? <p className="py-4 text-center text-gray-400 text-[10px]">No items sold at or below cost price.</p>
            : <div className="bg-white border-t border-b border-gray-200 divide-y divide-gray-100">
                {flags.costGteSell.map((r: any, i: number) => (
                  <CostPriceFix key={`${r.item_id}-${i}`} r={r} onFixed={itemId =>
                    setFlags((f: any) => f ? { ...f, costGteSell: f.costGteSell.filter((x: any) => x.item_id !== itemId) } : f)
                  } />
                ))}
              </div>
          }
        </div>
      )}
    </div>
  )
}

export default function SalesPage() {
  return (
    <Suspense fallback={<div className="py-10 text-center text-gray-400 text-sm">Loading…</div>}>
      <SalesPageInner />
    </Suspense>
  )
}
