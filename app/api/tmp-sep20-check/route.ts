import sql from '@/lib/db'
import { NextResponse } from 'next/server'

const VENDOR = 'DATA APPCOM'
const BILL_IDS = [199, 200, 201, 202, 203, 204, 205, 206, 207, 208]

// quantity/unit_price parsed from the "(qty X price)" note in each raw
// ledger line; verified qty*price == item_total for every row before use.
const LINES: { lineId: number; billId: number; qty: number; price: number; itemId?: number; resolvedName?: string }[] = [
  { lineId: 495, billId: 199, qty: 5, price: 120 },
  { lineId: 496, billId: 200, qty: 5, price: 120 },
  { lineId: 497, billId: 201, qty: 3, price: 95 },
  { lineId: 498, billId: 202, qty: 5, price: 80, itemId: 116, resolvedName: 'StarInk 85A Toner Cartridge' }, // was mis-linked to item 112 (55A) despite raw text saying 85A
  { lineId: 499, billId: 203, qty: 5, price: 280 },
  { lineId: 500, billId: 204, qty: 5, price: 90 },
  { lineId: 501, billId: 205, qty: 1, price: 260 },
  { lineId: 502, billId: 206, qty: 3, price: 100 },
  { lineId: 503, billId: 207, qty: 2, price: 145 },
  { lineId: 504, billId: 208, qty: 2, price: 420 },
]

export async function GET() {
  const rows = await sql`
    SELECT bl.id, bl.bill_id, bl.raw_item_name, bl.resolved_name, bl.item_id, bl.quantity, bl.unit_price, bl.item_total, b.vendor_name
    FROM bill_lines bl JOIN bills b ON b.id = bl.bill_id
    WHERE bl.id = ANY(${LINES.map(l => l.lineId)})
    ORDER BY bl.id
  `
  return NextResponse.json({ rows })
}

export async function POST() {
  try {
    for (const l of LINES) {
      if (l.itemId) {
        await sql`
          UPDATE bill_lines SET quantity = ${l.qty}, unit_price = ${l.price}, item_id = ${l.itemId}, resolved_name = ${l.resolvedName}
          WHERE id = ${l.lineId}
        `
      } else {
        await sql`
          UPDATE bill_lines SET quantity = ${l.qty}, unit_price = ${l.price}
          WHERE id = ${l.lineId}
        `
      }
    }
    const vendorUpdate = await sql`
      UPDATE bills SET vendor_name = ${VENDOR} WHERE id = ANY(${BILL_IDS}) RETURNING id
    `
    return NextResponse.json({ ok: true, linesUpdated: LINES.length, vendorUpdated: vendorUpdate.length })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}
