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

// jsPDF's built-in fonts have no ₵ glyph (see DailySummaryTab.tsx) -- plain
// "GHS " prefix in PDF output only; the on-screen preview uses c() instead.
function fcPdf(v: string | null | undefined) {
  const n = parseFloat(v ?? '0')
  return isNaN(n) ? '—' : `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function ReceiptPrintPage() {
  const params = useParams()
  const id = params?.id as string
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    fetch(`/api/receipts/${id}`)
      .then(async r => {
        if (!r.ok) { setError((await r.json().catch(() => null))?.error ?? 'Could not load receipt.'); return }
        setReceipt(await r.json())
      })
      .catch(() => setError('Could not load receipt.'))
  }, [id])

  // Generates a real PDF file (jsPDF) instead of the browser's own print-to-
  // PDF -- that path always adds Chrome's own URL/date/page-number header
  // and footer around the page, which can't be turned off from the page
  // itself. Building the PDF directly sidesteps that entirely.
  async function downloadPdf() {
    if (!receipt) return
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

      // Logo is best-effort -- falls back to plain text if it can't be
      // fetched/decoded, so a network hiccup never blocks the download.
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

      const docTypeText = (receipt.document_type ?? 'Receipt').toUpperCase()
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(docTypeText, pageWidth - 14, y0 + 2, { align: 'right' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(receipt.invoice_number, pageWidth - 14, y0 + 8, { align: 'right' })
      doc.setFontSize(9)
      doc.setTextColor(140, 140, 140)
      doc.text(fmtDate(receipt.invoice_date), pageWidth - 14, y0 + 14, { align: 'right' })
      doc.setTextColor(0, 0, 0)

      let y = y0 + 26
      doc.setDrawColor(20, 20, 20)
      doc.setLineWidth(0.5)
      doc.line(14, y, pageWidth - 14, y)
      y += 8

      doc.setFontSize(8)
      doc.setTextColor(140, 140, 140)
      doc.text('BILL TO', 14, y)
      doc.setTextColor(0, 0, 0)
      y += 5
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(receipt.customer_display ?? receipt.customer_name, 14, y)
      doc.setFont('helvetica', 'normal')
      y += 5
      doc.setFontSize(9)
      if (receipt.customer_organisation) { doc.text(receipt.customer_organisation, 14, y); y += 4 }
      if (receipt.customer_phone) { doc.text(`Tel: ${receipt.customer_phone}`, 14, y); y += 4 }
      const loc = [receipt.customer_town_district, receipt.customer_region].filter(Boolean).join(', ')
      if (loc) { doc.text(loc, 14, y); y += 4 }
      y += 4

      autoTable(doc, {
        startY: y,
        head: [['Item', 'Qty', 'Price', 'Total']],
        body: receipt.lines.map(l => [
          l.item + (l.dimensions ? ` (${l.dimensions})` : ''),
          `${l.qty}${l.unit ? ` ${l.unit}` : ''}`,
          fcPdf(l.price), fcPdf(l.total),
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [243, 244, 246], textColor: [55, 65, 81] },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      })
      y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8

      doc.setFontSize(9)
      doc.text('Subtotal', pageWidth - 60, y)
      doc.text(fcPdf(receipt.subtotal), pageWidth - 14, y, { align: 'right' })
      y += 6
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('Total', pageWidth - 60, y)
      doc.text(fcPdf(receipt.total), pageWidth - 14, y, { align: 'right' })
      doc.setFont('helvetica', 'normal')
      y += 10

      if (receipt.notes) {
        doc.setFontSize(8)
        doc.setTextColor(140, 140, 140)
        doc.text('NOTES', 14, y)
        doc.setTextColor(0, 0, 0)
        y += 4
        doc.setFontSize(9)
        const noteLines = doc.splitTextToSize(receipt.notes, pageWidth - 28)
        doc.text(noteLines, 14, y)
        y += noteLines.length * 4 + 6
      }

      doc.setFontSize(8)
      doc.setTextColor(140, 140, 140)
      doc.text('Thank you for your business.', pageWidth / 2, y + 6, { align: 'center' })

      doc.save(`${receipt.invoice_number}.pdf`)
    } finally {
      setDownloading(false)
    }
  }

  if (error) return <div className="p-6 text-center text-red-600 text-sm">{error}</div>
  if (!receipt) return <div className="p-6 text-center text-gray-400 text-sm">Loading…</div>

  const docType = receipt.document_type ?? 'Receipt'
  const hasMoreDetails = receipt.customer_phone || receipt.customer_organisation
    || receipt.customer_town_district || receipt.customer_region

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">Receipt Preview</p>
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
