'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type Line = {
  id: number
  item_id: number | null
  item_name: string
  qty_ordered: string
  qty_received: string
  unit_price: string
}

type PO = {
  id: number
  po_number: string
  vendor_id: number | null
  vendor_name: string | null
  order_date: string
  expected_date: string | null
  status: 'draft' | 'sent' | 'cancelled'
  notes: string | null
  created_by: string | null
  lines: Line[]
}

function c(v: string | number | null | undefined) {
  const n = typeof v === 'number' ? v : parseFloat(v ?? '0')
  return isNaN(n) ? '—' : `₵${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// jsPDF's built-in fonts have no ₵ glyph (see receipts/[id]/print) -- plain
// "GHS " prefix in PDF output only; the on-screen preview uses c() instead.
function fcPdf(v: string | number | null | undefined) {
  const n = typeof v === 'number' ? v : parseFloat(v ?? '0')
  return isNaN(n) ? '—' : `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function PurchaseOrderPrintPage() {
  const params = useParams()
  const id = params?.id as string
  const [po, setPo] = useState<PO | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    fetch(`/api/purchase-orders/${id}`)
      .then(async r => {
        if (!r.ok) { setError((await r.json().catch(() => null))?.error ?? 'Could not load purchase order.'); return }
        setPo(await r.json())
      })
      .catch(() => setError('Could not load purchase order.'))
  }, [id])

  async function downloadPdf() {
    if (!po) return
    setDownloading(true)
    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])
      const autoTable = autoTableModule.default
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      const y0 = 15

      let logoDrawn = false
      try {
        const imgData = await fetch('/logo.png').then(r => r.blob()).then(blob => new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        }))
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image()
          el.onload = () => resolve(el)
          el.onerror = reject
          el.src = imgData
        })
        const h = 14
        const w = (img.width / img.height) * h
        doc.addImage(imgData, 'PNG', 14, y0, w, h)
        logoDrawn = true
      } catch { /* fall through to text below */ }

      if (!logoDrawn) {
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('GRONY MULTIMEDIA', 14, y0 + 6)
        doc.setFont('helvetica', 'normal')
      }
      doc.setFontSize(9)
      doc.setTextColor(140, 140, 140)
      doc.text('Assin Foso', 14, y0 + 18)
      doc.setTextColor(0, 0, 0)

      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('PURCHASE ORDER', pageWidth - 14, y0 + 2, { align: 'right' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(po.po_number, pageWidth - 14, y0 + 8, { align: 'right' })
      doc.setFontSize(9)
      doc.setTextColor(140, 140, 140)
      doc.text(fmtDate(po.order_date), pageWidth - 14, y0 + 14, { align: 'right' })
      doc.setTextColor(0, 0, 0)

      let y = y0 + 26
      doc.setDrawColor(20, 20, 20)
      doc.setLineWidth(0.5)
      doc.line(14, y, pageWidth - 14, y)
      y += 8

      doc.setFontSize(8)
      doc.setTextColor(140, 140, 140)
      doc.text('VENDOR', 14, y)
      doc.setTextColor(0, 0, 0)
      y += 5
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(po.vendor_name ?? 'Unknown vendor', 14, y)
      doc.setFont('helvetica', 'normal')
      y += 5
      if (po.expected_date) {
        doc.setFontSize(9)
        doc.text(`Expected delivery: ${fmtDate(po.expected_date)}`, 14, y)
        y += 4
      }
      doc.setFontSize(9)
      doc.text(`Status: ${po.status.toUpperCase()}`, 14, y)
      y += 8

      autoTable(doc, {
        startY: y,
        head: [['Item', 'Ordered', 'Received', 'Unit Price', 'Total']],
        body: po.lines.map(l => [
          l.item_name,
          l.qty_ordered, l.qty_received,
          fcPdf(l.unit_price), fcPdf(parseFloat(l.qty_ordered) * parseFloat(l.unit_price)),
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [243, 244, 246], textColor: [55, 65, 81] },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      })
      y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8

      const total = po.lines.reduce((s, l) => s + parseFloat(l.qty_ordered) * parseFloat(l.unit_price), 0)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('Total', pageWidth - 60, y)
      doc.text(fcPdf(total), pageWidth - 14, y, { align: 'right' })
      doc.setFont('helvetica', 'normal')
      y += 10

      if (po.notes) {
        doc.setFontSize(8)
        doc.setTextColor(140, 140, 140)
        doc.text('NOTES', 14, y)
        doc.setTextColor(0, 0, 0)
        y += 4
        doc.setFontSize(9)
        const noteLines = doc.splitTextToSize(po.notes, pageWidth - 28)
        doc.text(noteLines, 14, y)
        y += noteLines.length * 4 + 6
      }

      doc.save(`${po.po_number}.pdf`)
    } finally {
      setDownloading(false)
    }
  }

  if (error) return <div className="p-6 text-center text-red-600 text-sm">{error}</div>
  if (!po) return <div className="p-6 text-center text-gray-400 text-sm">Loading…</div>

  const total = po.lines.reduce((s, l) => s + parseFloat(l.qty_ordered) * parseFloat(l.unit_price), 0)

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">Purchase Order Preview</p>
        <button onClick={downloadPdf} disabled={downloading}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg px-4 py-2 transition">
          {downloading ? 'Generating…' : '⬇️ Download PDF'}
        </button>
      </div>

      <div className="max-w-2xl mx-auto bg-white print:max-w-none px-6 py-8 print:p-0">
        <div className="flex items-start justify-between border-b-2 border-gray-900 pb-4 mb-6">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Grony Multimedia" className="h-12 w-auto mb-1" />
            <p className="text-xs text-gray-500">Assin Foso</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold uppercase tracking-wide text-gray-900">Purchase Order</p>
            <p className="text-sm text-gray-600">{po.po_number}</p>
            <p className="text-xs text-gray-400">{fmtDate(po.order_date)}</p>
          </div>
        </div>

        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Vendor</p>
            <p className="text-sm font-semibold text-gray-900">{po.vendor_name ?? 'Unknown vendor'}</p>
            {po.expected_date && <p className="text-xs text-gray-600 mt-0.5">Expected delivery: {fmtDate(po.expected_date)}</p>}
          </div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
            po.status === 'draft' ? 'bg-gray-100 text-gray-600'
            : po.status === 'sent' ? 'bg-blue-50 text-blue-600'
            : 'bg-red-50 text-red-500'}`}>
            {po.status.toUpperCase()}
          </span>
        </div>

        <table className="w-full text-sm border-collapse mb-6">
          <thead>
            <tr className="border-b border-gray-300 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
              <th className="text-left py-2">Item</th>
              <th className="text-right py-2">Ordered</th>
              <th className="text-right py-2">Received</th>
              <th className="text-right py-2">Unit Price</th>
              <th className="text-right py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {po.lines.map(l => (
              <tr key={l.id} className="border-b border-gray-100">
                <td className="py-2 pr-2 text-gray-800">{l.item_name}</td>
                <td className="py-2 text-right text-gray-600">{l.qty_ordered}</td>
                <td className="py-2 text-right text-gray-600">{l.qty_received}</td>
                <td className="py-2 text-right text-gray-600">{c(l.unit_price)}</td>
                <td className="py-2 text-right font-semibold text-gray-900">{c(parseFloat(l.qty_ordered) * parseFloat(l.unit_price))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mb-6">
          <div className="w-48 space-y-1">
            <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-300 pt-1">
              <span>Total</span><span>{c(total)}</span>
            </div>
          </div>
        </div>

        {po.notes && (
          <div className="border-t border-gray-100 pt-3 mb-6">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Notes</p>
            <p className="text-xs text-gray-700">{po.notes}</p>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 border-t border-gray-100 pt-4">Grony Multimedia · Assin Foso</p>
      </div>
    </div>
  )
}
