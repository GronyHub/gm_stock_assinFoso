'use client'
import { Fragment, useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePolling } from '@/lib/usePolling'
import HistoryPanel from './HistoryPanel'

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
  const [showHistory, setShowHistory] = useState(false)
  const [linesMap, setLinesMap] = useState<Record<number, BillLine[]>>({})
  // Editing is keyed by FlatRow.key (bill id + line index) since each
  // visible row is now one item line, not one bill.
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ bill_date: '', vendor_name: '' })
  const [saving, setSaving] = useState(false)

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
  usePolling(loadBills, 5000, editingKey === null)

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

  const filtered = useMemo(() => {
    let list = flatRows
    if (groupItemNames) {
      list = list.filter(r => groupItemNames.has(r.itemName))
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
  }, [flatRows, groupItemNames, search])

  // First visible row of each date+vendor block shows the block's total;
  // the rest show nothing, so the sum reads as "for this whole group" once.
  const firstInGroupKeys = useMemo(() => {
    const first = new Set<string>()
    const seenGroups = new Set<string>()
    for (const r of filtered) {
      const groupKey = `${r.billDate}|${r.vendorName ?? ''}`
      if (!seenGroups.has(groupKey)) { seenGroups.add(groupKey); first.add(r.key) }
    }
    return first
  }, [filtered])

  function toggleEdit(row: FlatRow) {
    if (editingKey === row.key) { setEditingKey(null); return }
    const b = billsById[row.billId]
    setEditForm({ bill_date: b?.bill_date?.slice(0, 10) ?? '', vendor_name: b?.vendor_name ?? '' })
    setEditingKey(row.key)
  }

  async function saveEdit(row: FlatRow) {
    setSaving(true)
    const res = await fetch(`/api/bills/${row.billId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bill_date: editForm.bill_date || undefined, vendor_name: editForm.vendor_name || null }),
    })
    setSaving(false)
    if (res.ok) {
      const updated: Bill = await res.json()
      setBills(prev => prev.map(b => b.id === row.billId ? { ...b, ...updated } : b))
      setEditingKey(null)
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
          setTimeout(() => document.getElementById(`billrow-${target!.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
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
              <th className="text-left px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">ITEM</th>
              <th className="text-right px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">QTY</th>
              <th className="text-right px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">COST PRICE</th>
              <th className="text-right px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">TOTAL</th>
              <th className="text-left px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">VENDOR</th>
              <th className="text-right px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">VENDOR/DAY TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(row => {
              const isEditing = editingKey === row.key
              const showGroupTotal = firstInGroupKeys.has(row.key)
              return (
                <Fragment key={row.key}>
                  <tr id={`billrow-${row.billId}`} onClick={() => toggleEdit(row)}
                    className={`cursor-pointer border-b border-gray-100 transition ${isEditing ? 'bg-blue-50' : row.unresolved ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                    <td className="px-0.5 py-0.5 text-gray-700 whitespace-nowrap">{fmtShort(row.billDate)}</td>
                    <td className="px-0.5 py-0.5">
                      {row.itemId ? (
                        <Link href={`/stock/${row.itemId}`} onClick={e => e.stopPropagation()}
                          className="text-left text-blue-600 hover:underline">
                          {row.itemName}
                        </Link>
                      ) : (
                        <span className="text-red-600">{row.itemName}</span>
                      )}
                    </td>
                    <td className="px-0.5 py-0.5 text-right text-gray-700">{row.quantity ? parseFloat(row.quantity) : '—'}</td>
                    <td className="px-0.5 py-0.5 text-right text-gray-700">{fmt(row.unitPrice)}</td>
                    <td className="px-0.5 py-0.5 text-right font-semibold text-gray-900">{fmt(row.itemTotal)}</td>
                    <td className="px-0.5 py-0.5 text-gray-700 truncate max-w-[100px]">{row.vendorName ?? '—'}</td>
                    <td className="px-0.5 py-0.5 text-right font-semibold text-gray-900">
                      {showGroupTotal ? fmt(vendorDayTotals[`${row.billDate}|${row.vendorName ?? ''}`].toFixed(2)) : ''}
                    </td>
                  </tr>
                  {isEditing && (
                    <tr className="border-b border-gray-200">
                      <td colSpan={7} className="p-2 bg-white space-y-2">
                        <p className="text-[10px] font-bold text-gray-600">Edit Bill · {row.billNumber}</p>
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
                        <div className="flex gap-1">
                          <button onClick={() => saveEdit(row)} disabled={saving}
                            className="flex-1 bg-green-600 text-white text-[10px] font-bold rounded py-1 disabled:opacity-40">
                            {saving ? 'Saving…' : 'Save'}
                          </button>
                          <button onClick={() => setEditingKey(null)}
                            className="px-3 py-1 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded">Cancel</button>
                        </div>
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
