import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const receipts = await sql`
    SELECT
      i.id, i.invoice_number, i.invoice_date, i.due_date, i.status,
      i.customer_name, i.customer_id, i.currency_code,
      i.subtotal, i.total, i.balance, i.adjustment, i.notes,
      c.display_name AS customer_display,
      COALESCE(
        json_agg(
          json_build_object(
            'id',         il.id,
            'item',       COALESCE(il.resolved_name, il.raw_item_name),
            'qty',        il.quantity,
            'price',      il.item_price,
            'total',      il.item_total,
            'unit',       il.usage_unit,
            'dimensions', il.dimensions
          ) ORDER BY il.id
        ) FILTER (WHERE il.id IS NOT NULL),
        '[]'
      ) AS lines
    FROM invoices i
    LEFT JOIN customers c    ON c.id = i.customer_id
    LEFT JOIN invoice_lines il ON il.invoice_id = i.id
    GROUP BY i.id, c.display_name
    ORDER BY i.invoice_date DESC, i.invoice_number DESC
  `
  return NextResponse.json(receipts)
}

// Every receipt here is paid in full once issued -- no draft/overdue/balance
// tracking, so new receipts are always created as fully settled.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { invoice_number, invoice_date, customer_name, notes, lines } = await req.json()
  if (!invoice_number || !invoice_date || !customer_name) {
    return NextResponse.json({ error: 'Receipt number, date, and customer name are required' }, { status: 400 })
  }

  const cleanLines = (Array.isArray(lines) ? lines : [])
    .map((l: any) => ({
      item: String(l.item ?? '').trim(),
      qty: Number(l.qty) || 0,
      price: Number(l.price) || 0,
      unit: l.unit ? String(l.unit).trim() : null,
      dimensions: l.dimensions ? String(l.dimensions).trim() : null,
    }))
    .filter((l: any) => l.item && l.qty > 0)
  if (cleanLines.length === 0) {
    return NextResponse.json({ error: 'At least one valid item is required' }, { status: 400 })
  }

  const subtotal = cleanLines.reduce((s: number, l: any) => s + l.qty * l.price, 0)
  const enteredBy = session.user?.name || (session.user as any)?.username || null

  try {
    const [invoice] = await sql`
      INSERT INTO invoices
        (invoice_number, invoice_date, due_date, status, customer_name, customer_id, currency_code, subtotal, total, balance, adjustment, notes)
      VALUES
        (${invoice_number}, ${invoice_date}, NULL, 'Closed', ${customer_name}, NULL, 'GHS', ${subtotal}, ${subtotal}, 0, 0, ${notes ?? null})
      RETURNING id
    `

    for (const l of cleanLines) {
      await sql`
        INSERT INTO invoice_lines (invoice_id, raw_item_name, quantity, item_price, item_total, usage_unit, dimensions)
        VALUES (${invoice.id}, ${l.item}, ${l.qty}, ${l.price}, ${l.qty * l.price}, ${l.unit}, ${l.dimensions})
      `
    }

    const [created] = await sql`
      SELECT
        i.id, i.invoice_number, i.invoice_date, i.due_date, i.status,
        i.customer_name, i.customer_id, i.currency_code,
        i.subtotal, i.total, i.balance, i.adjustment, i.notes,
        c.display_name AS customer_display,
        COALESCE(
          json_agg(
            json_build_object(
              'id',         il.id,
              'item',       COALESCE(il.resolved_name, il.raw_item_name),
              'qty',        il.quantity,
              'price',      il.item_price,
              'total',      il.item_total,
              'unit',       il.usage_unit,
              'dimensions', il.dimensions
            ) ORDER BY il.id
          ) FILTER (WHERE il.id IS NOT NULL),
          '[]'
        ) AS lines
      FROM invoices i
      LEFT JOIN customers c    ON c.id = i.customer_id
      LEFT JOIN invoice_lines il ON il.invoice_id = i.id
      WHERE i.id = ${invoice.id}
      GROUP BY i.id, c.display_name
    `

    await logActivity(enteredBy ?? 'Unknown', 'added receipt', `${invoice_number} · ₵${subtotal.toFixed(2)} for ${customer_name}`)
    return NextResponse.json(created)
  } catch (e) {
    console.error('receipt insert error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not save receipt: ${detail}` }, { status: 500 })
  }
}
