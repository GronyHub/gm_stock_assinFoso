import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// The 19 raw_item_name values already migrated to expenses (source =
// 'bill_migration'). This removes the now-redundant bill_lines rows so
// they stop appearing in the Pre-Zoho Bills queue.
const RAW_NAMES = [
  'Bank Charge = 10',
  'Bank charge  (LF) = 13',
  'Delivery = 90',
  'Delivery Charge  (LF) = 200',
  'Delivery Charge for Goods oredered from Kasoa = 183',
  'Delivery T&T = 80',
  'Delivery for Goods from Data Appcom to Station= 32',
  'Delivery for Goods from Emmanuel Oppong to Driver = 25',
  'Delivery for goods Goods ordered from Derrick and Bengid = 353',
  'Delivery of Goods from Bright and EO to Fosu = 120',
  'Delivery of Goods from Data Appcom to Fosu = 120',
  'Momo Charge = 7',
  'Momo Charge for Bright = 10.00',
  'Momo Charge for Data Appcom = 20',
  'Momo Charge for Emmanuel Oppong = 9',
  'Sent to dispatch from Abaka Freepipe juction to Circle  = 30',
  '70*        Goods T & T from Gentle = 70',
  'A3 paper cutter        1       = 250',
  'fine glue big size      1       = 25',
]

export async function GET() {
  const rows = await sql`
    SELECT raw_item_name, COUNT(*)::int AS n FROM bill_lines
    WHERE raw_item_name = ANY(${RAW_NAMES})
    GROUP BY raw_item_name
  `
  return NextResponse.json({ matchingNames: rows.length, totalLines: rows.reduce((s, r: any) => s + r.n, 0), rows })
}

export async function DELETE() {
  const deleted = await sql`
    DELETE FROM bill_lines WHERE raw_item_name = ANY(${RAW_NAMES})
    RETURNING id, raw_item_name
  `
  return NextResponse.json({ deletedCount: deleted.length, deleted })
}
