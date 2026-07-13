'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type Line = {
  id: number
  item: string
  qty: number
  price: string
  total: string
  unit: string | null
  dimensions: string | null
}

type Receipt = {
  id: number
  invoice_number: string
  invoice_date: string
  document_type: string | null
  customer_name: string
  customer_display: string | null
  customer_phone: string | null
  customer_organisation: string | null
  customer_town_district: string | null
  customer_region: string | null
  subtotal: string
  total: string
  notes: string | null
  lines: Line[]
}

function c(v: string | null | undefined) {
  const n = parseFloat(v ?? '0')
  return isNaN(n) ? '—' : `₵${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ReceiptPrintPage() {
  const params = useParams()
  const id = params?.id as string
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/receipts/${id}`)
      .then(async r => {
        if (!r.ok) { setError((await r.json().catch(() => null))?.error ?? 'Could not load receipt.'); return }
        setReceipt(await r.json())
      })
      .catch(() => setError('Could not load receipt.'))
  }, [id])

  if (error) return <div className="p-6 text-center text-red-600 text-sm">{error}</div>
  if (!receipt) return <div className="p-6 text-center text-gray-400 text-sm">Loading…</div>

  const docType = receipt.document_type ?? 'Receipt'
  const hasMoreDetails = receipt.customer_phone || receipt.customer_organisation
    || receipt.customer_town_district || receipt.customer_region

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">Print / Save as PDF</p>
        <button onClick={() => window.print()}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg px-4 py-2 transition">
          🖨️ Print
        </button>
      </div>

      <div className="max-w-2xl mx-auto bg-white print:max-w-none px-6 py-8 print:p-0">
        <div className="flex items-start justify-between border-b-2 border-gray-900 pb-4 mb-6">
          <div>
            <p className="text-xl font-bold text-gray-900">Grony Multimedia</p>
            <p className="text-xs text-gray-500">Assin Foso</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold uppercase tracking-wide text-gray-900">{docType}</p>
            <p className="text-sm text-gray-600">{receipt.invoice_number}</p>
            <p className="text-xs text-gray-400">{fmtDate(receipt.invoice_date)}</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Bill To</p>
          <p className="text-sm font-semibold text-gray-900">{receipt.customer_display ?? receipt.customer_name}</p>
          {hasMoreDetails && (
            <div className="text-xs text-gray-600 mt-0.5 space-y-0.5">
              {receipt.customer_organisation && <p>{receipt.customer_organisation}</p>}
              {receipt.customer_phone && <p>☎ {receipt.customer_phone}</p>}
              {(receipt.customer_town_district || receipt.customer_region) && (
                <p>{[receipt.customer_town_district, receipt.customer_region].filter(Boolean).join(', ')}</p>
              )}
            </div>
          )}
        </div>

        <table className="w-full text-sm border-collapse mb-6">
          <thead>
            <tr className="border-b border-gray-300 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
              <th className="text-left py-2">Item</th>
              <th className="text-right py-2">Qty</th>
              <th className="text-right py-2">Price</th>
              <th className="text-right py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {receipt.lines.map(l => (
              <tr key={l.id} className="border-b border-gray-100">
                <td className="py-2 pr-2 text-gray-800">
                  {l.item}
                  {l.dimensions && <span className="text-gray-400"> ({l.dimensions})</span>}
                </td>
                <td className="py-2 text-right text-gray-600 whitespace-nowrap">{l.qty}{l.unit ? ` ${l.unit}` : ''}</td>
                <td className="py-2 text-right text-gray-600">{c(l.price)}</td>
                <td className="py-2 text-right font-semibold text-gray-900">{c(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mb-6">
          <div className="w-48 space-y-1">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span><span>{c(receipt.subtotal)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-300 pt-1">
              <span>Total</span><span>{c(receipt.total)}</span>
            </div>
          </div>
        </div>

        {receipt.notes && (
          <div className="border-t border-gray-100 pt-3 mb-6">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Notes</p>
            <p className="text-xs text-gray-700">{receipt.notes}</p>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 border-t border-gray-100 pt-4">Thank you for your business.</p>
      </div>
    </div>
  )
}
