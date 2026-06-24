import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const rows = await sql`
    SELECT id, bill_number, bill_date::date AS bill_date, vendor_name, total, status, entered_by
    FROM bills
    ORDER BY bill_date DESC, id DESC
  `
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { date, vendorId, vendorName, lines } = await req.json()
  if (!date || !lines?.length) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const total = lines.reduce((s: number, l: any) => s + Number(l.total), 0)
  const billNumber = `APP-BILL-${date.replace(/-/g,'')}-${Date.now().toString().slice(-4)}`

  const enteredBy = session.user?.name || (session.user as any)?.username || null
  const [bill] = await sql`
    INSERT INTO bills (bill_number, bill_date, vendor_id, vendor_name, total, subtotal, status, source, entered_by)
    VALUES (${billNumber}, ${date}, ${vendorId ?? null}, ${vendorName ?? null}, ${total}, ${total}, 'paid', 'app', ${enteredBy})
    RETURNING id
  `

  for (const l of lines) {
    await sql`
      INSERT INTO bill_lines (bill_id, item_id, raw_item_name, resolved_name, quantity, unit_price, item_total, unresolved, source)
      VALUES (${bill.id}, ${l.itemId}, ${l.itemName}, ${l.itemName}, ${l.qty}, ${l.price}, ${l.total}, false, 'app')
    `
  }

  await sql`INSERT INTO cash_at_bank (entry_date) VALUES (${date}) ON CONFLICT (entry_date) DO NOTHING`

  return NextResponse.json({ ok: true, billNumber })
}
