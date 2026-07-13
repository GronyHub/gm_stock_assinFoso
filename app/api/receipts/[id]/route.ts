import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// See app/api/receipts/route.ts -- these columns are added lazily on first
// use rather than via a separate migration step.
async function ensureColumns() {
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'Receipt'`.catch(() => {})
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_phone TEXT`.catch(() => {})
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_organisation TEXT`.catch(() => {})
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_town_district TEXT`.catch(() => {})
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_region TEXT`.catch(() => {})
}

const SELECT_FIELDS = `
      i.id, i.invoice_number, i.invoice_date, i.due_date, i.status,
      i.document_type, i.customer_name, i.customer_id, i.currency_code,
      i.customer_phone, i.customer_organisation, i.customer_town_district, i.customer_region,
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
`

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await ensureColumns()
  const [receipt] = await sql.query(`
    SELECT ${SELECT_FIELDS}
    WHERE i.id = $1
    GROUP BY i.id, c.display_name
  `, [Number(id)])

  if (!receipt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(receipt)
}
