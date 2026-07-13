import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'

// invoices predates this app's own Receipt/Invoice creation flow (it was
// built for Zoho-imported data), so these columns don't exist yet on older
// databases. ADD COLUMN IF NOT EXISTS is cheap once the columns are there,
// so just ensure them on every request rather than requiring a separate
// migration step.
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

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  await ensureColumns()
  const receipts = await sql.query(`
    SELECT ${SELECT_FIELDS}
    GROUP BY i.id, c.display_name
    ORDER BY i.invoice_date DESC, i.invoice_number DESC
  `)
  return NextResponse.json(receipts)
}

// Every receipt here is paid in full once issued -- no draft/overdue/balance
// tracking, so new receipts are always created as fully settled.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    invoice_number, invoice_date, customer_name, notes, lines, document_type,
    customer_phone, customer_organisation, customer_town_district, customer_region,
  } = await req.json()
  if (!invoice_number || !invoice_date || !customer_name) {
    return NextResponse.json({ error: 'Receipt number, date, and customer name are required' }, { status: 400 })
  }
  const docType = document_type === 'Invoice' ? 'Invoice' : 'Receipt'

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
    await ensureColumns()

    // zoho_invoice_id is NOT NULL (the column was built for Zoho-imported
    // invoices) but receipts created here have no Zoho id, so synthesize a
    // unique placeholder the same way internal items do.
    const zohoInvoiceId = `INTERNAL_${invoice_number}_${Date.now()}`
    const [invoice] = await sql`
      INSERT INTO invoices
        (zoho_invoice_id, invoice_number, invoice_date, due_date, status, document_type,
         customer_name, customer_id, currency_code,
         customer_phone, customer_organisation, customer_town_district, customer_region,
         subtotal, total, balance, adjustment, notes)
      VALUES
        (${zohoInvoiceId}, ${invoice_number}, ${invoice_date}, NULL, 'Closed', ${docType},
         ${customer_name}, NULL, 'GHS',
         ${customer_phone || null}, ${customer_organisation || null}, ${customer_town_district || null}, ${customer_region || null},
         ${subtotal}, ${subtotal}, 0, 0, ${notes ?? null})
      RETURNING id
    `

    for (const l of cleanLines) {
      await sql`
        INSERT INTO invoice_lines (invoice_id, raw_item_name, quantity, item_price, item_total, usage_unit, dimensions)
        VALUES (${invoice.id}, ${l.item}, ${l.qty}, ${l.price}, ${l.qty * l.price}, ${l.unit}, ${l.dimensions})
      `
    }

    const [created] = await sql.query(`
      SELECT ${SELECT_FIELDS}
      WHERE i.id = $1
      GROUP BY i.id, c.display_name
    `, [invoice.id])

    await logActivity(enteredBy ?? 'Unknown', 'added receipt', `${invoice_number} · ₵${subtotal.toFixed(2)} for ${customer_name}`)
    return NextResponse.json(created)
  } catch (e) {
    console.error('receipt insert error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not save receipt: ${detail}` }, { status: 500 })
  }
}
