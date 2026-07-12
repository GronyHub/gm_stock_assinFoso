import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const receiptId = Number(id)
  const { lines } = await req.json()
  // lines: [{ id: number|null, itemId: number|null, item_name, quantity, item_price }]
  // id == null means a newly added line (insert). Any existing line whose id
  // is not present in this array has been removed by the user (delete).

  try {
    const keepIds: number[] = []

    for (const line of lines) {
      const qty = parseFloat(line.quantity) || 0
      const price = parseFloat(line.item_price) || 0
      const total = qty * price

      if (line.id) {
        // item_id resolution order: an explicit id from the client (the user
        // re-picked the item), else an exact case-insensitive name match
        // against an active item (the user retyped the name to something
        // real), else leave whatever item_id the line already had -- never
        // silently null out a working link just because of a text edit.
        await sql`
          UPDATE sales_receipt_lines
          SET raw_item_name = ${line.item_name},
              resolved_name = ${line.item_name},
              quantity      = ${qty},
              item_price    = ${price},
              item_total    = ${total},
              item_id       = COALESCE(
                ${line.itemId ?? null},
                (SELECT id FROM items WHERE LOWER(canonical_name) = LOWER(${line.item_name}) AND LOWER(status) = 'active' LIMIT 1),
                item_id
              )
          WHERE id = ${line.id} AND receipt_id = ${receiptId}
        `
        keepIds.push(Number(line.id))
      } else {
        const [inserted] = await sql`
          INSERT INTO sales_receipt_lines
            (receipt_id, item_id, raw_item_name, resolved_name, quantity, item_price, item_total, unresolved, source)
          VALUES (${receiptId}, ${line.itemId ?? null}, ${line.item_name}, ${line.item_name}, ${qty}, ${price}, ${total}, false, 'app')
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
      SELECT id, receipt_date::date AS receipt_date, customer_name, total AS invoice_amount, cash_counted,
             (cash_counted - total) AS wnw
      FROM sales_receipts WHERE id = ${receiptId}
    `
    return NextResponse.json(updated[0])
  } catch (e) {
    console.error('sales lines PUT error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not save items: ${detail}` }, { status: 500 })
  }
}
