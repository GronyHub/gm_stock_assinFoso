import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST() {
  // Do bills/invoices store their own independent `total`, or is it derived
  // live from their lines? Determines whether removing a line needs a
  // matching total adjustment.
  const billTotals = await sql`
    SELECT b.id, b.total AS bill_total, COALESCE(SUM(bl.item_total), 0) AS lines_sum
    FROM bills b LEFT JOIN bill_lines bl ON bl.bill_id = b.id
    WHERE b.id IN (86, 212, 197) GROUP BY b.id, b.total
  `
  const invoiceTotals = await sql`
    SELECT iv.id, iv.total AS invoice_total, COALESCE(SUM(il.item_total), 0) AS lines_sum
    FROM invoices iv LEFT JOIN invoice_lines il ON il.invoice_id = iv.id
    WHERE iv.id IN (SELECT invoice_id FROM invoice_lines WHERE id IN (218, 219, 220) UNION SELECT 118)
    GROUP BY iv.id, iv.total
  `
  // The two "Delivery" invoices from earlier tonight -- were their totals
  // left stale after I deleted their lines?
  const deletedDeliveryInvoices = await sql`
    SELECT iv.id, iv.total AS invoice_total, COALESCE(SUM(il.item_total), 0) AS lines_sum
    FROM invoices iv LEFT JOIN invoice_lines il ON il.invoice_id = iv.id
    WHERE iv.id IN (51, 63) GROUP BY iv.id, iv.total
  `
  return NextResponse.json({ billTotals, invoiceTotals, deletedDeliveryInvoices })
}

export async function GET() {
  const billLinesDetail = await sql`
    SELECT bl.id, bl.bill_id, bl.raw_item_name, bl.item_total, bl.quantity, bl.unit_price,
           b.bill_date::text, b.vendor_name, b.bill_number
    FROM bill_lines bl JOIN bills b ON b.id = bl.bill_id
    WHERE bl.id IN (508, 493, 382)
  `

  const bestPrintCandidates = await sql`
    SELECT id, canonical_name, cf_group, status FROM items
    WHERE canonical_name ILIKE '%best print%' OR canonical_name ILIKE '%bestprint%'
    ORDER BY canonical_name
  `

  const invitationCardsPointer = await sql`
    SELECT srl.raw_item_name, srl.item_id, i.canonical_name, i.status, COUNT(*)::int AS cnt
    FROM sales_receipt_lines srl
    LEFT JOIN items i ON i.id = srl.item_id
    WHERE srl.raw_item_name IN ('Fueral Invitation Cards', 'Invitation Card all others')
    GROUP BY srl.raw_item_name, srl.item_id, i.canonical_name, i.status
    ORDER BY srl.raw_item_name
  `

  const coloredA4Line = await sql`
    SELECT il.id, il.invoice_id, il.raw_item_name, il.item_id, il.quantity, il.item_price, il.item_total,
           iv.invoice_date::text, iv.customer_name
    FROM invoice_lines il LEFT JOIN invoices iv ON iv.id = il.invoice_id
    WHERE il.raw_item_name = 'Coloured A4 Sheet (Blue)'
  `

  return NextResponse.json({ billLinesDetail, bestPrintCandidates, invitationCardsPointer, coloredA4Line })
}
