import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const taps = await sql`SELECT id, item_id, item_name, staff_name, tapped_at, undone, receipt_id, quantity FROM live_sale_taps ORDER BY tapped_at`
  const receipts = await sql`SELECT id, receipt_number, receipt_date, total, source FROM sales_receipts WHERE source = 'live_sale' ORDER BY receipt_date`
  const lines = await sql`
    SELECT srl.id, srl.receipt_id, srl.item_id, srl.raw_item_name, srl.quantity, srl.item_total, srl.source
    FROM sales_receipt_lines srl
    WHERE srl.source = 'live_sale'
    ORDER BY srl.id
  `
  return NextResponse.json({ tapCount: taps.length, taps, receiptCount: receipts.length, receipts, lineCount: lines.length, lines })
}
