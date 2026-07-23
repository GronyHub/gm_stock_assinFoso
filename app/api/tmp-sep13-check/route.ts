import sql from '@/lib/db'
import { NextResponse } from 'next/server'

const VENDOR = 'Humble Beginnings'
const BILL_IDS = [182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197]

// quantity parsed from the "pk"/"pks"/"pcs" count (or the bare number before
// "=" for the one line without a unit); unit_price derived as total/qty.
// "Goods charge" (line 493) has no quantity in the source text and stays
// unresolved -- it's the flagged line the user already said they'd handle later.
const LINES: { lineId: number; qty: number; price: number }[] = [
  { lineId: 478, qty: 1, price: 55 },
  { lineId: 479, qty: 5, price: 25 },
  { lineId: 480, qty: 3, price: 18 },
  { lineId: 481, qty: 10, price: 70 },
  { lineId: 482, qty: 3, price: 72 },
  { lineId: 483, qty: 5, price: 60 },
  { lineId: 484, qty: 5, price: 60 },
  { lineId: 485, qty: 15, price: 8 },
  { lineId: 486, qty: 6, price: 15 },
  { lineId: 487, qty: 1, price: 100 },
  { lineId: 488, qty: 1, price: 110 },
  { lineId: 489, qty: 5, price: 28 },
  { lineId: 490, qty: 1, price: 80 },
  { lineId: 491, qty: 1, price: 150 },
  { lineId: 492, qty: 2, price: 22 },
]

export async function GET() {
  const rows = await sql`
    SELECT bl.id, bl.bill_id, bl.raw_item_name, bl.resolved_name, bl.item_id, bl.quantity, bl.unit_price, bl.item_total, b.vendor_name
    FROM bill_lines bl JOIN bills b ON b.id = bl.bill_id
    WHERE b.bill_date::date = '2025-09-13'
    ORDER BY bl.id
  `
  return NextResponse.json({ count: rows.length, rows })
}

export async function POST() {
  try {
    for (const l of LINES) {
      await sql`UPDATE bill_lines SET quantity = ${l.qty}, unit_price = ${l.price} WHERE id = ${l.lineId}`
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
