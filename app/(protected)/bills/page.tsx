'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

type Bill = {
  id: number
  bill_number: string
  bill_date: string
  vendor_name: string | null
  total: string
  status: string
}

type BillLine = {
  item_name: string
  quantity: string
  unit_price: string
  item_total: string
  usage_unit: string | null
}

function fmt(val: string | null) {
  if (!val) return '—'
  const n = parseFloat(val)
  return isNaN(n) ? val : `GH₵ ${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GH', { day: '2-digit', month: 'short', year: 'numeric' })
}

function statusBadge(status: string) {
  const s = status.toLowerCase()
  if (s === 'paid') return 'bg-green-100 text-green-700'
  if (s === 'overdue') return 'bg-red-100 text-red-600'
  return 'bg-orange-100 text-orange-600'
}

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Bill | null>(null)
  const [lines, setLines] = useState<BillLine[]>([])
  const [linesLoading, setLinesLoading] = useState(false)

  useEffect(() => {
    fetch('/api/bills')
      .then(r => r.json())
      .then(data => { setBills(data); setLoading(false) })
  }, [])

  async function selectBill(bill: Bill) {
    setSelected(bill)
    setLines([])
    setLinesLoading(true)
    const res = await fetch(`/api/bills/${bill.id}`)
    const data = await res.json()
    setLines(data)
    setLinesLoading(false)
  }

  if (loading) return <div className="py-20 text-center text-gray-400">Loading…</div>

  return (
    <div className="py-4">
      {/* Header + New Bill button */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Bills</h1>
          <p className="text-sm text-gray-400 mt-0.5">{bills.length} bills</p>
        </div>
        <Link href="/bills/new"
          className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">
          + New Bill
        </Link>
      </div>

      {/* Desktop: split pane — Mobile: list + slide-up detail */}
      <div className="md:flex md:gap-4 md:h-[calc(100vh-160px)]">

        {/* Left: Bills list */}
        <div className={`md:w-2/5 md:overflow-y-auto space-y-2 ${selected ? 'hidden md:block' : 'block'}`}>
          {bills.map(bill => (
            <button
              key={bill.id}
              onClick={() => selectBill(bill)}
              className={`w-full text-left rounded-xl border p-3 transition
                ${selected?.id === bill.id
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {bill.vendor_name ?? 'Unknown vendor'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{fmtDate(bill.bill_date)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-900">{fmt(bill.total)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Right: Bill detail */}
        {selected && (
          <div className="md:flex-1 md:overflow-y-auto">
            {/* Back button — mobile only */}
            <button
              onClick={() => setSelected(null)}
              className="md:hidden flex items-center gap-1 text-blue-600 text-sm font-medium mb-3">
              ← Back to bills
            </button>

            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
              {/* Bill header */}
              <div>
                <p className="text-lg font-bold text-gray-900">{selected.vendor_name ?? 'Unknown vendor'}</p>
                <p className="text-sm text-gray-400">{fmtDate(selected.bill_date)} · {selected.bill_number}</p>
              </div>

              <div className="border-t border-gray-100" />

              {/* Lines */}
              {linesLoading ? (
                <p className="text-center text-gray-400 py-6">Loading…</p>
              ) : lines.length === 0 ? (
                <p className="text-center text-gray-400 py-6">No line items found.</p>
              ) : (
                <>
                  {/* Mobile: cards */}
                  <div className="md:hidden space-y-3">
                    {lines.map((line, i) => (
                      <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-1">
                        <p className="text-sm font-semibold text-gray-900">{line.item_name}</p>
                        <div className="grid grid-cols-3 gap-2 text-xs mt-1">
                          <div>
                            <p className="text-gray-400">Qty</p>
                            <p className="text-gray-900 font-medium">{parseFloat(line.quantity)}{line.usage_unit ? ` ${line.usage_unit}` : ''}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Unit Price</p>
                            <p className="text-gray-900 font-medium">{fmt(line.unit_price)}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Total</p>
                            <p className="text-gray-900 font-semibold">{fmt(line.item_total)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop: table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                          <th className="pb-2 font-medium">Item</th>
                          <th className="pb-2 font-medium text-right">Qty</th>
                          <th className="pb-2 font-medium text-right">Unit Price</th>
                          <th className="pb-2 font-medium text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {lines.map((line, i) => (
                          <tr key={i}>
                            <td className="py-2 text-gray-900">{line.item_name}</td>
                            <td className="py-2 text-right text-gray-600">{parseFloat(line.quantity)}{line.usage_unit ? ` ${line.usage_unit}` : ''}</td>
                            <td className="py-2 text-right text-gray-600">{fmt(line.unit_price)}</td>
                            <td className="py-2 text-right font-semibold text-gray-900">{fmt(line.item_total)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-gray-200">
                          <td colSpan={3} className="pt-3 text-sm font-semibold text-gray-600 text-right">Total</td>
                          <td className="pt-3 text-right font-bold text-gray-900">{fmt(selected.total)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Mobile total */}
                  <div className="md:hidden flex justify-between items-center pt-2 border-t border-gray-100">
                    <span className="text-sm font-semibold text-gray-600">Total</span>
                    <span className="text-base font-bold text-gray-900">{fmt(selected.total)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
