import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { createItemFromTypedName } from '@/lib/createItem'
import { impossibleUsageWarnings } from '@/lib/usageCheck'
import { negativeStockViolations } from '@/lib/stockGuard'
import { itemsDueForCount, countGuardResponseBody } from '@/lib/countGuard'
import { ensureSalesAttachmentsColumn, normalizeAttachments } from '@/lib/salesAttachments'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { date, cashCounted, lines, total: directTotal, customerName, customerId, attachments } = await req.json()
  const attachmentsList = normalizeAttachments(attachments)
  if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 })
  const hasLines = Array.isArray(lines) && lines.length > 0
  if (!hasLines && directTotal == null) return NextResponse.json({ error: 'Provide lines or total' }, { status: 400 })

  // A line with no real quantity isn't a transaction -- it's a phantom row
  // that pollutes per-date aliases and other displays while contributing
  // nothing to any actual stock math. Reject it outright.
  if (hasLines) {
    for (const l of lines) {
      const qty = Number(l.qty)
      if (!Number.isFinite(qty) || qty <= 0) {
        return NextResponse.json({ error: `"${l.itemName || 'a line'}" needs a valid quantity greater than 0.` }, { status: 400 })
      }
    }
  }

  const total = hasLines ? lines.reduce((s: number, l: any) => s + Number(l.total), 0) : Number(directTotal)
  const receiptNumber = `APP-${date.replace(/-/g,'')}-${Date.now().toString().slice(-4)}`

  const enteredBy = session.user?.name || (session.user as any)?.username || null

  // A picked customer's name is resolved here rather than trusted from the
  // client, same reasoning as vendors on Purchase Orders -- otherwise a
  // stale/blank name sent alongside customerId can leave the receipt
  // linked to a customer but still showing "Unknown"/blank.
  let customer: string | null = customerName ?? null
  if (customerId) {
    const [cust] = await sql`SELECT display_name FROM customers WHERE id = ${Number(customerId)}`
    if (cust) customer = cust.display_name
  }
  const customerType = customer === 'Grony Multimedia as Customer' ? 'GMC' : 'WIC'

  try {
    await ensureSalesAttachmentsColumn()

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

      // A sale keeps assuming the last count was still accurate -- if it's
      // overdue, that assumption is exactly what's unverified. Block until
      // a fresh count re-anchors it.
      const due = await itemsDueForCount(lines.map((l: any) => l.itemId ? Number(l.itemId) : null))
      if (due.size > 0) {
        return NextResponse.json(countGuardResponseBody(Array.from(due.values())), { status: 409 })
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

    const customerIdVal = customerId ? Number(customerId) : null
    let receipt
    try {
      [receipt] = await sql`
        INSERT INTO sales_receipts (receipt_number, receipt_date, customer_id, customer_name, total, cash_counted, source, entered_by, attachments)
        VALUES (${receiptNumber}, ${date}, ${customerIdVal}, ${customer}, ${total}, ${cashCounted ?? null}, 'app', ${enteredBy}, ${JSON.stringify(attachmentsList)}::jsonb)
        RETURNING id
      `
    } catch (e) {
      console.error('sales_receipts insert with customer_id/entered_by failed, retrying without them:', e)
      ;[receipt] = await sql`
        INSERT INTO sales_receipts (receipt_number, receipt_date, customer_name, total, cash_counted, source, attachments)
        VALUES (${receiptNumber}, ${date}, ${customer}, ${total}, ${cashCounted ?? null}, 'app', ${JSON.stringify(attachmentsList)}::jsonb)
        RETURNING id
      `
    }

    // Batch insert all lines in parallel
    if (lines && lines.length > 0) {
      const lineInserts = await Promise.all(
        lines.map(async (l: any) => {
          const itemId = l.itemId ?? await createItemFromTypedName(l.itemName)
          return { itemId, itemName: l.itemName, qty: l.qty, price: l.price, total: l.total }
        })
      )

      await Promise.all(
        lineInserts.map(line =>
          sql`
            INSERT INTO sales_receipt_lines
              (receipt_id, item_id, raw_item_name, resolved_name, quantity, item_price, item_total, unresolved, source)
            VALUES (${receipt.id}, ${line.itemId}, ${line.itemName}, ${line.itemName}, ${line.qty}, ${line.price}, ${line.total}, false, 'app')
          `
        )
      )
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
