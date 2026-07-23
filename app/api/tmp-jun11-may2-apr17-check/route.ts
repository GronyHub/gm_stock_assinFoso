import sql from '@/lib/db'
import { NextResponse } from 'next/server'

const DERRICK_BILLS = [50, 51, 52] // May 2
const APPCOM_BILLS = [62, 63, 64, 65] // Jun 11
const BULBMAN_BILLS = [41, 42, 43, 44, 45, 46, 49] // Apr 17
const ORPHAN_BILL_IDS = [47, 48] // Apr 17 -- already exist as expenses #184/#185, bills never cleaned up

const LINES: { lineId: number; qty: number; price: number }[] = [
  // May 2 -- Derrick
  { lineId: 346, qty: 1, price: 890 },
  { lineId: 347, qty: 1, price: 830 },
  { lineId: 348, qty: 10, price: 110 },
  // Jun 11 -- Appcom Ghana (cp confirmed 420, matches total since qty=1)
  { lineId: 358, qty: 1, price: 420 },
  { lineId: 359, qty: 1, price: 420 },
  { lineId: 360, qty: 1, price: 420 },
  { lineId: 361, qty: 1, price: 420 },
  // Apr 17 -- BULBMAN
  { lineId: 337, qty: 4, price: 80 },
  { lineId: 338, qty: 3, price: 60 },
  { lineId: 339, qty: 1, price: 95 },
  { lineId: 340, qty: 2, price: 80 },
  { lineId: 341, qty: 2, price: 70 },
  { lineId: 342, qty: 1, price: 150 },
  { lineId: 345, qty: 6, price: 35 },
]

export async function GET() {
  const lines = await sql`
    SELECT id, bill_id, raw_item_name, resolved_name, item_id, quantity, unit_price, item_total
    FROM bill_lines WHERE id = ANY(${LINES.map(l => l.lineId)})
    ORDER BY id
  `
  const bills = await sql`
    SELECT id, bill_number, vendor_name, total FROM bills
    WHERE id = ANY(${[...DERRICK_BILLS, ...APPCOM_BILLS, ...BULBMAN_BILLS, ...ORPHAN_BILL_IDS]})
    ORDER BY id
  `
  const orphanLineCheck = await sql`SELECT COUNT(*) FROM bill_lines WHERE bill_id = ANY(${ORPHAN_BILL_IDS})`
  return NextResponse.json({ lines, bills, orphanLineCount: orphanLineCheck[0].count })
}

export async function POST() {
  try {
    for (const l of LINES) {
      await sql`UPDATE bill_lines SET quantity = ${l.qty}, unit_price = ${l.price} WHERE id = ${l.lineId}`
    }
    const derrick = await sql`UPDATE bills SET vendor_name = 'Derrick' WHERE id = ANY(${DERRICK_BILLS}) RETURNING id`
    const appcom = await sql`UPDATE bills SET vendor_name = 'DATA APPCOM' WHERE id = ANY(${APPCOM_BILLS}) RETURNING id`
    const bulbman = await sql`UPDATE bills SET vendor_name = 'BULBMAN' WHERE id = ANY(${BULBMAN_BILLS}) RETURNING id`
    const deletedOrphans = await sql`DELETE FROM bills WHERE id = ANY(${ORPHAN_BILL_IDS}) RETURNING id`
    return NextResponse.json({
      ok: true, linesUpdated: LINES.length,
      vendorUpdates: { derrick: derrick.length, appcom: appcom.length, bulbman: bulbman.length },
      orphanBillsDeleted: deletedOrphans.length,
    })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}
