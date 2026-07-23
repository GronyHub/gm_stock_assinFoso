import sql from '@/lib/db'
import { NextResponse } from 'next/server'

const BRIGHT_BILLS = [154]
const EMMANUEL_BILLS = [155, 156, 157, 158]
const APPCOM_BILLS = [159, 160, 161, 162, 163, 164, 165, 166, 167, 168]

// qty parsed from the number before "=" when present; where the raw text has
// no separate qty token (item name = total, or the "-" is part of the item's
// own name like "C-EXV 28 - Black"), qty defaults to 1. Confirmed against
// each line's already-resolved item name before assuming this.
const LINES: { lineId: number; qty: number; price: number; itemId?: number; resolvedName?: string }[] = [
  { lineId: 450, qty: 15, price: 110 },   // Bright: 1Kg Toner Refill
  { lineId: 451, qty: 5, price: 45 },     // Emmanuel Oppong: Cardboard Blue
  { lineId: 452, qty: 5, price: 45 },     // Cardboard Yellow
  { lineId: 453, qty: 5, price: 45 },     // Cardboard Green
  { lineId: 454, qty: 5, price: 45 },     // Cardboard Pink
  { lineId: 455, qty: 2, price: 400 },    // Data Appcom: 1Kg Black Colour Refill for 5045
  { lineId: 456, qty: 1, price: 380 },    // C-EXV 28 - Black
  { lineId: 457, qty: 1, price: 380 },    // C-EXV 28 - Yellow
  { lineId: 458, qty: 1, price: 380 },    // C-EXV 28 - Cyan
  { lineId: 459, qty: 1, price: 170 },    // C-EXV 33 - Black
  { lineId: 460, qty: 12, price: 90 },    // 85A Toner Cart (Star Ink)
  { lineId: 461, qty: 1, price: 280 },    // 150A Toner Cart
  { lineId: 462, qty: 3, price: 140 },    // 107A Toner Cart
  { lineId: 463, qty: 2, price: 170 },    // 87A Toner Cart
  { lineId: 464, qty: 5, price: 280, itemId: 52, resolvedName: '55A TONER CARTRIDGE' }, // was linked to "Best Print" despite raw text saying Crest Print -- switched to the generic 55A entry
]

export async function GET() {
  const rows = await sql`
    SELECT bl.id, bl.bill_id, bl.raw_item_name, bl.resolved_name, bl.item_id, bl.quantity, bl.unit_price, bl.item_total, b.vendor_name
    FROM bill_lines bl JOIN bills b ON b.id = bl.bill_id
    WHERE b.bill_date::date = '2025-08-19'
    ORDER BY bl.id
  `
  return NextResponse.json({ count: rows.length, rows })
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
        await sql`UPDATE bill_lines SET quantity = ${l.qty}, unit_price = ${l.price} WHERE id = ${l.lineId}`
      }
    }
    const bright = await sql`UPDATE bills SET vendor_name = 'Bright' WHERE id = ANY(${BRIGHT_BILLS}) RETURNING id`
    const emmanuel = await sql`UPDATE bills SET vendor_name = 'Emmanuel Oppong' WHERE id = ANY(${EMMANUEL_BILLS}) RETURNING id`
    const appcom = await sql`UPDATE bills SET vendor_name = 'DATA APPCOM' WHERE id = ANY(${APPCOM_BILLS}) RETURNING id`
    return NextResponse.json({
      ok: true, linesUpdated: LINES.length,
      vendorUpdates: { bright: bright.length, emmanuel: emmanuel.length, appcom: appcom.length },
    })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}
