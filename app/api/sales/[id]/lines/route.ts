import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { createItemFromTypedName } from '@/lib/createItem'
import { impossibleUsageWarnings } from '@/lib/usageCheck'
import { negativeStockViolations } from '@/lib/stockGuard'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const receiptId = Number(id)
  const { lines } = await req.json()
  // lines: [{ id: number|null, itemId: number|null, item_name, quantity, item_price, nameTouched?: boolean }]
  // id == null means a newly added line (insert). Any existing line whose id
  // is not present in this array has been removed by the user (delete).

  try {
    // Block edits that would drive an item's stock below zero. Existing
    // recorded quantities are already reflected in SOH, so the check is on
    // the NET change per item (new totals minus what this receipt already
    // had recorded).
    {
      const deltas = new Map<number, number>()
      for (const line of lines) {
        const id = line.itemId ?? null
        if (id) deltas.set(Number(id), (deltas.get(Number(id)) ?? 0) + (parseFloat(line.quantity) || 0))
      }
      const existing = await sql`
        SELECT item_id, SUM(quantity) AS qty FROM sales_receipt_lines
        WHERE receipt_id = ${receiptId} AND item_id IS NOT NULL
        GROUP BY item_id
      `
      for (const r of existing) {
        deltas.set(r.item_id, (deltas.get(r.item_id) ?? 0) - (parseFloat(r.qty) || 0))
      }
      const violations = await negativeStockViolations(deltas)
      if (violations.length > 0) {
        return NextResponse.json({ error: `Not allowed — this would create negative stock. ${violations.join(' ')}` }, { status: 400 })
      }
    }

    const keepIds: number[] = []

    for (const line of lines) {
      const qty = parseFloat(line.quantity) || 0
      const price = parseFloat(line.item_price) || 0
      const total = qty * price

      // A typed name (no explicit pick) is never matched against the existing
      // catalogue by text -- it always becomes its own new item. Untouched
      // lines that already had no item link (item_id null before this edit,
      // name never retyped) are left alone rather than auto-creating an item
      // for them, so the dedicated "Unlinked" flag/Link Now flow still owns
      // fixing historical gaps.
      let itemId: number | null = line.itemId ?? null
      if (itemId == null && (line.id ? line.nameTouched : true)) {
        itemId = await createItemFromTypedName(line.item_name)
      }

      if (line.id) {
        await sql`
          UPDATE sales_receipt_lines
          SET raw_item_name = ${line.item_name},
              resolved_name = ${line.item_name},
              quantity      = ${qty},
              item_price    = ${price},
              item_total    = ${total},
              item_id       = COALESCE(${itemId}, item_id)
          WHERE id = ${line.id} AND receipt_id = ${receiptId}
        `
        keepIds.push(Number(line.id))
      } else {
        const [inserted] = await sql`
          INSERT INTO sales_receipt_lines
            (receipt_id, item_id, raw_item_name, resolved_name, quantity, item_price, item_total, unresolved, source)
          VALUES (${receiptId}, ${itemId}, ${line.item_name}, ${line.item_name}, ${qty}, ${price}, ${total}, false, 'app')
          RETURNING id
        `
        keepIds.push(inserted.id)
      }
    }

    // Remove any existing line not present in the submitted set (user deleted it)
    if (keepIds.length > 0) {
      await sql`
        DELETE FROM sales_receipt_lines
        WHERE receipt_id = ${receiptId} AND NOT (id = ANY(${keepIds}))
      `
    } else {
      await sql`DELETE FROM sales_receipt_lines WHERE receipt_id = ${receiptId}`
    }

    // Recalculate receipt total from lines
    await sql`
      UPDATE sales_receipts
      SET total = (SELECT COALESCE(SUM(item_total),0) FROM sales_receipt_lines WHERE receipt_id = ${receiptId})
      WHERE id = ${receiptId}
    `
    const updated = await sql`
      SELECT id, receipt_date::date AS receipt_date, receipt_date::date::text AS receipt_date_str,
             customer_name, total AS invoice_amount, cash_counted,
             (cash_counted - total) AS wnw
      FROM sales_receipts WHERE id = ${receiptId}
    `

    // Non-blocking sanity check: flag usage that exceeds what could have
    // existed on this receipt's date (e.g. papers used with no GMC pack
    // recorded). The save still succeeds -- the warning says what's missing.
    const { receipt_date_str, ...row } = updated[0] ?? {}
    const warnings = receipt_date_str ? await impossibleUsageWarnings(receipt_date_str) : []
    return NextResponse.json({ ...row, warnings })
  } catch (e) {
    console.error('sales lines PUT error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not save items: ${detail}` }, { status: 500 })
  }
}
