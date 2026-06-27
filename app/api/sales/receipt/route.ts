import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { date, cashCounted, lines, total: directTotal, customerName } = await req.json()
  if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 })
  const hasLines = Array.isArray(lines) && lines.length > 0
  if (!hasLines && directTotal == null) return NextResponse.json({ error: 'Provide lines or total' }, { status: 400 })

  const total = hasLines ? lines.reduce((s: number, l: any) => s + Number(l.total), 0) : Number(directTotal)
  const receiptNumber = `APP-${date.replace(/-/g,'')}-${Date.now().toString().slice(-4)}`

  const enteredBy = session.user?.name || (session.user as any)?.username || null
  const customer = customerName ?? null

  try {
    let receipt
    try {
      [receipt] = await sql`
        INSERT INTO sales_receipts (receipt_number, receipt_date, customer_name, total, cash_counted, source, entered_by)
        VALUES (${receiptNumber}, ${date}, ${customer}, ${total}, ${cashCounted ?? null}, 'app', ${enteredBy})
        RETURNING id
      `
    } catch (e) {
      console.error('sales_receipts insert with entered_by failed, retrying without it:', e)
      ;[receipt] = await sql`
        INSERT INTO sales_receipts (receipt_number, receipt_date, customer_name, total, cash_counted, source)
        VALUES (${receiptNumber}, ${date}, ${customer}, ${total}, ${cashCounted ?? null}, 'app')
        RETURNING id
      `
    }

    for (const l of (lines ?? [])) {
      await sql`
        INSERT INTO sales_receipt_lines
          (receipt_id, item_id, raw_item_name, resolved_name, quantity, item_price, item_total, unresolved, source)
        VALUES (${receipt.id}, ${l.itemId}, ${l.itemName}, ${l.itemName}, ${l.qty}, ${l.price}, ${l.total}, false, 'app')
      `
    }

    // Ensure cash_at_bank has a row for this date -- avoid relying on a named
    // unique constraint existing for ON CONFLICT (see staff_times incident);
    // check first, then insert only if missing.
    try {
      const [existing] = await sql`SELECT 1 FROM cash_at_bank WHERE entry_date = ${date}`
      if (!existing) {
        await sql`INSERT INTO cash_at_bank (entry_date) VALUES (${date})`
      }
    } catch (e) {
      console.error('cash_at_bank ensure-row error (non-fatal):', e)
    }

    await logActivity(enteredBy ?? 'Unknown', 'added sale receipt', `${receiptNumber} · ₵${total.toFixed(2)} on ${date}`)
    return NextResponse.json({ ok: true, receiptNumber })
  } catch (e) {
    console.error('sales receipt POST error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not save receipt: ${detail}` }, { status: 500 })
  }
}
