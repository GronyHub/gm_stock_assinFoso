'use client'
import { Fragment, useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePolling } from '@/lib/usePolling'
import HistoryPanel from './HistoryPanel'
import ItemDetailDropdown from './ItemDetailDropdown'

type Item = { id: number; item_name: string; cf_group: string | null }

type Bill = {
  id: number
  bill_number: string
  bill_date: string
  vendor_name: string | null
  total: string
  status: string
  entered_by: string | null
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

type Props = {
  items: Item[]
  groupFilter: string | null
  search: string
}

export default function BillsTab({ items, groupFilter, search }: Props) {
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [linesMap, setLinesMap] = useState<Record<number, BillLine[]>>({})
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ bill_date: '', vendor_name: '', status: 'paid' })
  const [saving, setSaving] = useState(false)
  // Which bill line's item drop-down (ItemDetailDropdown) is open, if any --
  // bill lines have no id of their own, so keyed by "bill id:row index"
  // instead, same purpose as SalesTab's expandedLineId.
  const [expandedLineKey, setExpandedLineKey] = useState<string | null>(null)

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
  usePolling(loadBills, 5000, editingId === null)

  const groupItemNames = useMemo(() => {
    if (!groupFilter || groupFilter === 'All') return null
    return new Set(items.filter(i => (i.cf_group ?? 'Ungrouped') === groupFilter).map(i => i.item_name))
  }, [items, groupFilter])

  const filtered = useMemo(() => {
    let list = bills
    if (groupItemNames) {
      list = list.filter(b => (linesMap[b.id] ?? []).some(l => groupItemNames.has(l.item_name)))
    }
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(b =>
        (b.vendor_name ?? '').toLowerCase().includes(q) ||
        b.bill_number.toLowerCase().includes(q) ||
        (linesMap[b.id] ?? []).some(l => l.item_name.toLowerCase().includes(q))
      )
    }
    return list
  }, [bills, linesMap, groupItemNames, search])

  function errorCount(billId: number) {
    return (linesMap[billId] ?? []).filter(l => l.item_id == null || l.unresolved).length
  }

  function toggleExpand(bill: Bill) {
    setExpandedId(id => id === bill.id ? null : bill.id)
    setEditingId(null)
  }

  function startEdit(b: Bill) {
    setEditForm({ bill_date: b.bill_date?.slice(0, 10) ?? '', vendor_name: b.vendor_name ?? '', status: b.status ?? 'paid' })
    setEditingId(b.id)
  }

  async function saveEdit() {
    if (editingId == null) return
    setSaving(true)
    const res = await fetch(`/api/bills/${editingId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bill_date: editForm.bill_date || undefined, vendor_name: editForm.vendor_name || null, status: editForm.status }),
    })
    setSaving(false)
    if (res.ok) {
      const updated: Bill = await res.json()
      setBills(prev => prev.map(b => b.id === editingId ? { ...b, ...updated } : b))
      setEditingId(null)
    }
  }

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

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
          setExpandedId(target.id)
          setTimeout(() => document.getElementById(`bill-${target!.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
        }
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
        <Link href="/bills/new"
          className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100">
          + New Bill
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        <table className="w-full border-collapse text-[10px]">
          <thead className="sticky top-0 bg-gray-100 z-10">
            <tr>
              <th className="text-left px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">DATE</th>
              <th className="text-left px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">VENDOR</th>
              <th className="text-right px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">AMT</th>
              <th className="text-center px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">ERRORS</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(b => {
              const errs = errorCount(b.id)
              const isOpen = expandedId === b.id
              const billLines = linesMap[b.id] ?? []
              return (
                <Fragment key={b.id}>
                  <tr id={`bill-${b.id}`} onClick={() => toggleExpand(b)}
                    className={`cursor-pointer border-b border-gray-100 transition ${isOpen ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <td className="px-0.5 py-0.5 text-gray-700 whitespace-nowrap">{fmtShort(b.bill_date)}</td>
                    <td className="px-0.5 py-0.5 text-gray-700 truncate max-w-[70px]">{b.vendor_name ?? '—'}</td>
                    <td className="px-0.5 py-0.5 text-right text-gray-900 font-semibold">{fmt(b.total)}</td>
                    <td className="px-0.5 py-0.5 text-center">
                      {errs > 0
                        ? <span className="inline-block text-[9px] font-bold text-white bg-red-500 rounded-full px-1.5">{errs}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-gray-200">
                      <td colSpan={4} className="p-0 bg-white">
                        {editingId === b.id ? (
                          <div className="p-2 space-y-2">
                            <p className="text-[10px] font-bold text-gray-600">Edit Bill</p>
                            <div>
                              <p className="text-[9px] text-gray-400 mb-0.5">Date</p>
                              <input type="date" value={editForm.bill_date}
                                onChange={e => setEditForm(f => ({ ...f, bill_date: e.target.value }))} className={inputCls} />
                            </div>
                            <div>
                              <p className="text-[9px] text-gray-400 mb-0.5">Vendor</p>
                              <input value={editForm.vendor_name}
                                onChange={e => setEditForm(f => ({ ...f, vendor_name: e.target.value }))} className={inputCls} />
                            </div>
                            <div>
                              <p className="text-[9px] text-gray-400 mb-0.5">Status</p>
                              <select value={editForm.status}
                                onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} className={inputCls}>
                                <option value="paid">Paid</option>
                                <option value="open">Open</option>
                                <option value="overdue">Overdue</option>
                              </select>
                            </div>
                            <div className="flex gap-1">
                              <button onClick={saveEdit} disabled={saving}
                                className="flex-1 bg-green-600 text-white text-[10px] font-bold rounded py-1 disabled:opacity-40">
                                {saving ? 'Saving…' : 'Save'}
                              </button>
                              <button onClick={() => setEditingId(null)}
                                className="px-3 py-1 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between px-2 py-1 bg-gray-50 border-b border-gray-200">
                              <div>
                                <p className="text-[10px] font-bold text-gray-900">{b.vendor_name ?? 'Unknown'}</p>
                                <p className="text-[9px] text-gray-400">{fmtShort(b.bill_date)} · {b.bill_number}</p>
                              </div>
                              <button onClick={() => startEdit(b)}
                                className="text-[9px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100">
                                Edit
                              </button>
                            </div>
                            {billLines.length === 0 ? (
                              <p className="text-[10px] text-gray-400 text-center py-4">No items.</p>
                            ) : (
                              <table className="w-full border-collapse text-[10px]">
                                <thead>
                                  <tr>
                                    <th className="text-left px-1.5 py-1 font-semibold text-gray-500 border-b border-gray-200">item</th>
                                    <th className="text-right px-1.5 py-1 font-semibold text-gray-500 border-b border-gray-200">qty</th>
                                    <th className="text-right px-1.5 py-1 font-semibold text-gray-500 border-b border-gray-200">price</th>
                                    <th className="text-right px-1.5 py-1 font-semibold text-gray-500 border-b border-gray-200">total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {billLines.map((l, i) => {
                                    const key = `${b.id}:${i}`
                                    const lineOpen = expandedLineKey === key
                                    const lineError = l.item_id == null || l.unresolved
                                    return (
                                    <Fragment key={i}>
                                      <tr className={`border-b border-gray-100 ${lineError ? 'bg-red-50' : ''}`}>
                                        <td className="px-1.5 py-0.5 text-gray-900">
                                          {l.item_id ? (
                                            <button onClick={() => setExpandedLineKey(lineOpen ? null : key)}
                                              className="text-left text-blue-600 hover:underline">
                                              {l.item_name}
                                            </button>
                                          ) : (
                                            <span className="text-red-600">{l.item_name}</span>
                                          )}
                                        </td>
                                        <td className="px-1.5 py-0.5 text-right text-gray-700">{parseFloat(l.quantity)}</td>
                                        <td className="px-1.5 py-0.5 text-right text-gray-700">{fmt(l.unit_price)}</td>
                                        <td className="px-1.5 py-0.5 text-right font-semibold text-gray-900">{fmt(l.item_total)}</td>
                                      </tr>
                                      {lineOpen && l.item_id && (
                                        <tr>
                                          <td colSpan={4} className="p-0 border-b border-gray-100">
                                            <div className="sticky left-0 w-[100vw] max-w-[100vw] max-h-[50vh] overflow-auto bg-blue-50 px-0.5 pb-2 pt-0.5">
                                              <ItemDetailDropdown itemId={l.item_id} />
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
                                    <td className="px-1.5 py-1 text-right font-bold text-gray-900">{fmt(b.total)}</td>
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
        {filtered.length === 0 && <p className="text-[10px] text-gray-400 text-center py-10">No bills</p>}
      </div>
    </div>
  )
}
