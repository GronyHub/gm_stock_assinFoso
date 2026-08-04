import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// Live Sale is still under test -- clears out every tap and every
// sales_receipts/sales_receipt_lines row it created (source = 'live_sale'),
// so testing doesn't leave fake sales in the real sales history.
export async function POST() {
  const lines = await sql`DELETE FROM sales_receipt_lines WHERE source = 'live_sale' RETURNING id`
  const receipts = await sql`DELETE FROM sales_receipts WHERE source = 'live_sale' RETURNING id`
  const taps = await sql`DELETE FROM live_sale_taps RETURNING id`
  return NextResponse.json({ ok: true, deletedLines: lines.length, deletedReceipts: receipts.length, deletedTaps: taps.length })
}
