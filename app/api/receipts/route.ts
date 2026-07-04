import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

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
