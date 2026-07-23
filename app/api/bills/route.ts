import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const rows = await sql`
      SELECT id, bill_number, bill_date::date AS bill_date, vendor_name, total, status, entered_by
      FROM bills
      ORDER BY bill_date DESC, id DESC
    `
    return NextResponse.json(rows)
  } catch {
    const rows = await sql`
      SELECT id, bill_number, bill_date::date AS bill_date, vendor_name, total, status, NULL AS entered_by
      FROM bills
      ORDER BY bill_date DESC, id DESC
    `
    return NextResponse.json(rows)
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { date, lines } = (await req.json()) as {
    date: string
    lines: { itemId: number; itemName: string; qty: number; price: number; total: number; vendorName: string | null }[]
  }
  if (!date || !lines?.length) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  // A line with no real quantity isn't a transaction -- it's a phantom row
  // that pollutes per-date aliases and other displays while contributing
  // nothing to any actual stock math. Reject it outright.
  for (const l of lines) {
    const qty = Number(l.qty)
    if (!Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ error: `"${l.itemName || 'a line'}" needs a valid quantity greater than 0.` }, { status: 400 })
    }
  }

  const enteredBy = session.user?.name || (session.user as any)?.username || null
  const grandTotal = lines.reduce((s: number, l) => s + Number(l.total), 0)

  // Each item line becomes its own bills row (one bill_lines child each),
  // matching the historical import pattern -- so a line's vendor is its own
  // column, not a single vendor shared across a whole multi-item bill.
  try {
    const billNumbers: string[] = []
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      const billNumber = `APP-BILL-${date.replace(/-/g, '')}-${Date.now().toString().slice(-4)}-${i}`
      billNumbers.push(billNumber)
      const vendorName = l.vendorName || null

      let bill
      try {
        [bill] = await sql`
          INSERT INTO bills (bill_number, bill_date, vendor_name, total, subtotal, status, source, entered_by, zoho_bill_id)
          VALUES (${billNumber}, ${date}, ${vendorName}, ${l.total}, ${l.total}, 'paid', 'app', ${enteredBy}, ${billNumber})
          RETURNING id
        `
      } catch (e) {
        console.error('bills insert with entered_by failed, retrying without it:', e)
        ;[bill] = await sql`
          INSERT INTO bills (bill_number, bill_date, vendor_name, total, subtotal, status, source, zoho_bill_id)
          VALUES (${billNumber}, ${date}, ${vendorName}, ${l.total}, ${l.total}, 'paid', 'app', ${billNumber})
          RETURNING id
        `
      }

      await sql`
        INSERT INTO bill_lines (bill_id, item_id, raw_item_name, resolved_name, quantity, unit_price, item_total, unresolved, source)
        VALUES (${bill.id}, ${l.itemId}, ${l.itemName}, ${l.itemName}, ${l.qty}, ${l.price}, ${l.total}, false, 'app')
      `
    }

    try {
      const [existing] = await sql`SELECT 1 FROM cash_at_bank WHERE entry_date = ${date}`
      if (!existing) await sql`INSERT INTO cash_at_bank (entry_date) VALUES (${date})`
    } catch (e) {
      console.error('cash_at_bank ensure-row error (non-fatal):', e)
    }

    const vendorsUsed = Array.from(new Set(lines.map(l => l.vendorName).filter(Boolean)))
    const vendorNote = vendorsUsed.length === 1 ? ` from ${vendorsUsed[0]}` : vendorsUsed.length > 1 ? ` from ${vendorsUsed.length} vendors` : ''
    await logActivity(enteredBy ?? 'Unknown', 'added bill', `${lines.length} line${lines.length > 1 ? 's' : ''} · ₵${grandTotal.toFixed(2)}${vendorNote}`)
    return NextResponse.json({ ok: true, billNumbers })
  } catch (e) {
    console.error('bills POST error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not save bill: ${detail}` }, { status: 500 })
  }
}
