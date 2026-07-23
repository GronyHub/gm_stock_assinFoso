import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// Jul 11, 2025: 51 of 53 bill_lines have no vendor_name at all -- the
// itemized Gentle order used a "Qty | Description | Price = Total" table
// format unique to that section (safe to match on '|'), Christina/Data
// Appcom/Lucky's items and remaining tail notes are matched by their exact
// known raw_item_name text.
const CHRISTINA = ['Printer Cable 3m - 10 = 250', 'Printer Cable 5m - 6 = 180', 'Christina order - 4  = 32']
const DATA_APPCOM = ['85A Toner Cart - 5 - 450', '107A Toner Cart - 3 =  420', 'Data Appcom Ghana = 8']
const LUCKY = ['80A/05A - 5 = 450', '500gr Toner Refill - 20 = 1400', '59A Toner cart  - 1 = 400', 'Lucky order  = 20"']
const GENTLE_TAIL = ['Gentle order  = 10']

export async function GET() {
  const rows = await sql`
    SELECT b.id, b.vendor_name, bl.raw_item_name, bl.item_id, bl.resolved_name, i.canonical_name
    FROM bills b
    JOIN bill_lines bl ON bl.bill_id = b.id
    LEFT JOIN items i ON i.id = bl.item_id
    WHERE b.bill_date::date = '2025-07-11'
    ORDER BY b.id
  `
  const noVendor = rows.filter((r: any) => !r.vendor_name)
  const nameMismatch = rows.filter((r: any) => r.item_id != null && r.resolved_name !== r.canonical_name)
  return NextResponse.json({ total: rows.length, noVendorCount: noVendor.length, nameMismatchCount: nameMismatch.length, nameMismatch })
}

export async function POST() {
  try {
    const gentle = await sql`
      UPDATE bills b SET vendor_name = 'GENTLE MISSION'
      FROM bill_lines bl
      WHERE bl.bill_id = b.id AND b.bill_date::date = '2025-07-11'
        AND bl.raw_item_name LIKE '%|%' AND b.vendor_name IS NULL
      RETURNING b.id
    `
    const christina = await sql`
      UPDATE bills b SET vendor_name = 'Christina Smith'
      FROM bill_lines bl
      WHERE bl.bill_id = b.id AND b.bill_date::date = '2025-07-11' AND bl.raw_item_name = ANY(${CHRISTINA})
      RETURNING b.id
    `
    const dataAppcom = await sql`
      UPDATE bills b SET vendor_name = 'Data Appcom Ghana'
      FROM bill_lines bl
      WHERE bl.bill_id = b.id AND b.bill_date::date = '2025-07-11' AND bl.raw_item_name = ANY(${DATA_APPCOM})
      RETURNING b.id
    `
    const lucky = await sql`
      UPDATE bills b SET vendor_name = 'LUCKY'
      FROM bill_lines bl
      WHERE bl.bill_id = b.id AND b.bill_date::date = '2025-07-11' AND bl.raw_item_name = ANY(${LUCKY})
      RETURNING b.id
    `
    const gentleTail = await sql`
      UPDATE bills b SET vendor_name = 'GENTLE MISSION'
      FROM bill_lines bl
      WHERE bl.bill_id = b.id AND b.bill_date::date = '2025-07-11' AND bl.raw_item_name = ANY(${GENTLE_TAIL})
      RETURNING b.id
    `

    // Sync resolved_name to each resolved line's current canonical_name,
    // for this date only -- same fix as the item-rename propagation bug,
    // applied retroactively here.
    const nameSynced = await sql`
      UPDATE bill_lines bl SET resolved_name = i.canonical_name
      FROM bills b, items i
      WHERE bl.bill_id = b.id AND b.bill_date::date = '2025-07-11'
        AND bl.item_id = i.id AND bl.resolved_name IS DISTINCT FROM i.canonical_name
      RETURNING bl.id
    `

    return NextResponse.json({
      vendorUpdates: { gentle: gentle.length, christina: christina.length, dataAppcom: dataAppcom.length, lucky: lucky.length, gentleTail: gentleTail.length },
      nameSyncedCount: nameSynced.length,
    })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}
