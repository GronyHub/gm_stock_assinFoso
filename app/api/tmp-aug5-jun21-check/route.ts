import sql from '@/lib/db'
import { NextResponse } from 'next/server'

const KASOA_BILLS = [148, 149, 150]
const DERRICK_BILLS = [67, 68, 69, 70, 71, 72, 73, 74, 75, 76]
const BENGID_BILLS = [77, 78, 79, 80, 81, 82, 83, 84, 85, 86] // 86 = "Bengid = 30", stays unresolved, vendor-tagged only

const LINES: { lineId: number; qty: number; price: number }[] = [
  // Aug 5 -- Kasoa Lady
  { lineId: 444, qty: 60, price: 30 },
  { lineId: 445, qty: 40, price: 12.5 },
  { lineId: 446, qty: 1, price: 75 },
  // Jun 21 -- Derrick order
  { lineId: 363, qty: 1, price: 1100 },
  { lineId: 364, qty: 3, price: 720 },
  { lineId: 365, qty: 3, price: 750 },
  { lineId: 366, qty: 1, price: 720 },
  { lineId: 367, qty: 1, price: 720 },
  { lineId: 368, qty: 1, price: 750 },
  { lineId: 369, qty: 2, price: 780 },
  { lineId: 370, qty: 1, price: 1180 },
  { lineId: 371, qty: 1, price: 1180 },
  { lineId: 372, qty: 1, price: 800 },
  // Jun 21 -- Bengid order
  { lineId: 373, qty: 10, price: 25 },
  { lineId: 374, qty: 10, price: 25 },
  { lineId: 375, qty: 7, price: 25 },
  { lineId: 376, qty: 12, price: 25 },
  { lineId: 377, qty: 20, price: 15 },
  { lineId: 378, qty: 20, price: 15 },
  { lineId: 379, qty: 12, price: 15 },
  { lineId: 380, qty: 5, price: 15 },
  { lineId: 381, qty: 25, price: 15 },
]

export async function GET() {
  const lines = await sql`
    SELECT id, bill_id, raw_item_name, resolved_name, item_id, quantity, unit_price, item_total
    FROM bill_lines WHERE id = ANY(${LINES.map(l => l.lineId)})
    ORDER BY id
  `
  const bills = await sql`
    SELECT id, bill_number, bill_date::date AS bill_date, vendor_name, total
    FROM bills WHERE id = ANY(${[...KASOA_BILLS, ...DERRICK_BILLS, ...BENGID_BILLS]})
    ORDER BY id
  `
  return NextResponse.json({ lines, bills })
}

export async function POST() {
  try {
    for (const l of LINES) {
      await sql`UPDATE bill_lines SET quantity = ${l.qty}, unit_price = ${l.price} WHERE id = ${l.lineId}`
    }
    const kasoa = await sql`UPDATE bills SET vendor_name = 'Kasoa Lady' WHERE id = ANY(${KASOA_BILLS}) RETURNING id`
    const derrick = await sql`UPDATE bills SET vendor_name = 'Derrick' WHERE id = ANY(${DERRICK_BILLS}) RETURNING id`
    const bengid = await sql`UPDATE bills SET vendor_name = 'Bengid' WHERE id = ANY(${BENGID_BILLS}) RETURNING id`
    return NextResponse.json({
      ok: true, linesUpdated: LINES.length,
      vendorUpdates: { kasoa: kasoa.length, derrick: derrick.length, bengid: bengid.length },
    })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}
