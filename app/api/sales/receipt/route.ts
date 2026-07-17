import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { createItemFromTypedName } from '@/lib/createItem'
import { impossibleUsageWarnings } from '@/lib/usageCheck'
import { negativeStockViolations } from '@/lib/stockGuard'
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
  const customerType = customer === 'Grony Multimedia as Customer' ? 'GMC' : 'WIC'

  try {
    // Block any entry that would drive an item's stock below zero.
    if (hasLines) {
      const deltas = new Map<number, number>()
      for (const l of lines) {
        if (l.itemId) deltas.set(Number(l.itemId), (deltas.get(Number(l.itemId)) ?? 0) + (Number(l.qty) || 0))
      }
      const violations = await negativeStockViolations(deltas)
      if (violations.length > 0) {
        return NextResponse.json({ error: `Not allowed — this would create negative stock. ${violations.join(' ')}` }, { status: 400 })
      }
    }

    const [existingReceipt] = await sql`
      SELECT id, receipt_number FROM sales_receipts
      WHERE receipt_date::date = ${date}
        AND (CASE WHEN customer_name = 'Grony Multimedia as Customer' THEN 'GMC' ELSE 'WIC' END) = ${customerType}
    `
    if (existingReceipt) {
      return NextResponse.json({
        error: `A ${customerType} sales receipt already exists for ${date} (${existingReceipt.receipt_number}). Edit that receipt to add items instead of creating a new one.`,
      }, { status: 409 })
    }

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
      // The New Sale cart only ever adds picked catalogue items, so l.itemId
      // should always be set -- this is just a safety net matching the same
      // rule everywhere else: a line with no picked item becomes a new item,
      // never a text match against the existing catalogue.
      const itemId = l.itemId ?? await createItemFromTypedName(l.itemName)
      await sql`
        INSERT INTO sales_receipt_lines
          (receipt_id, item_id, raw_item_name, resolved_name, quantity, item_price, item_total, unresolved, source)
        VALUES (${receipt.id}, ${itemId}, ${l.itemName}, ${l.itemName}, ${l.qty}, ${l.price}, ${l.total}, false, 'app')
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

    // Non-blocking sanity check: flag usage that exceeds what could have
    // existed (e.g. papers used with no GMC pack recorded). The save still
    // succeeds -- the warning tells the user what record is missing.
    const warnings = await impossibleUsageWarnings(date)
    return NextResponse.json({ ok: true, receiptNumber, warnings })
  } catch (e) {
    console.error('sales receipt POST error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not save receipt: ${detail}` }, { status: 500 })
  }
}
