import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { date, cashCounted, lines } = await req.json()
  if (!date || !lines?.length) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const total = lines.reduce((s: number, l: any) => s + Number(l.total), 0)
  const receiptNumber = `APP-${date.replace(/-/g,'')}-${Date.now().toString().slice(-4)}`

  const [receipt] = await sql`
    INSERT INTO sales_receipts (receipt_number, receipt_date, total, cash_counted, source)
    VALUES (${receiptNumber}, ${date}, ${total}, ${cashCounted ?? null}, 'app')
    RETURNING id
  `

  for (const l of lines) {
    await sql`
      INSERT INTO sales_receipt_lines
        (receipt_id, item_id, raw_item_name, resolved_name, quantity, item_price, item_total, unresolved, source)
      VALUES (${receipt.id}, ${l.itemId}, ${l.itemName}, ${l.itemName}, ${l.qty}, ${l.price}, ${l.total}, false, 'app')
    `
  }

  // Ensure cash_at_bank has a row for this date
  await sql`
    INSERT INTO cash_at_bank (entry_date) VALUES (${date})
    ON CONFLICT (entry_date) DO NOTHING
  `

  return NextResponse.json({ ok: true, receiptNumber })
}
