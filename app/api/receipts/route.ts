import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { sendSms, receiptMessage, toE164 } from '@/lib/sms'
import { resolveSaleLines, addCustomerReceiptToSales } from '@/lib/salesLog'
import { receiptWhatsAppUrl } from '@/lib/customerProfile'
import { NextRequest } from 'next/server'
import { ensureDbInitialized } from '@/lib/api/dbInitCache'
import { once } from '@/lib/once'

// invoices predates this app's own Receipt/Invoice creation flow (it was
// built for Zoho-imported data), so these columns don't exist yet on older
// databases. ADD COLUMN IF NOT EXISTS is cheap once the columns are there,
// so just ensure them on every request rather than requiring a separate
// migration step.
const ensureColumns = once(async () => {
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'Receipt'`.catch(() => {})
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_phone TEXT`.catch(() => {})
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_organisation TEXT`.catch(() => {})
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_town_district TEXT`.catch(() => {})
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_region TEXT`.catch(() => {})
})

const SELECT_FIELDS = `
      i.id, i.invoice_number, i.invoice_date, i.due_date, i.status,
      i.document_type, i.customer_name, i.customer_id, i.currency_code,
      i.customer_phone, i.customer_organisation, i.customer_town_district, i.customer_region,
      i.subtotal, i.total, i.balance, i.adjustment, i.notes,
      c.display_name AS customer_display, c.customer_id_code,
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
  const { session, error } = await requireAuth()
  if (error) return error

  await ensureDbInitialized()
  await ensureColumns()
  try {
    const receipts = await sql.query(`
      SELECT ${SELECT_FIELDS}
      GROUP BY i.id, c.id
      ORDER BY i.invoice_date DESC, i.invoice_number DESC
    `)
    return success(receipts)
  } catch (e) {
    // This query silently broke once (a GROUP BY mistake) and the page just
    // showed "No receipts found" -- log it and return a real failure status.
    console.error('receipts GET error:', e instanceof Error ? e.message : String(e))
    return success([], 500)
  }
}

// Every receipt here is paid in full once issued -- no draft/overdue/balance
// tracking, so new receipts are always created as fully settled.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const {
    invoice_number, invoice_date, customer_name, customer_id, notes, lines, document_type,
    customer_phone, customer_organisation, customer_town_district, customer_region,
  } = await req.json()
  if (!invoice_number || !invoice_date || !customer_name) {
    return badRequest('Receipt number, date, and customer name are required')
  }
  const docType = document_type === 'Invoice' ? 'Invoice' : 'Receipt'

  // A picked customer's name is resolved here rather than trusted from the
  // client -- same reasoning as vendors on Purchase Orders and customers on
  // Sales receipts, so a stale name sent alongside customer_id can't leave
  // this record linked to one customer but displaying another's name.
  let resolvedCustomerName = String(customer_name).trim()
  const customerIdVal = customer_id ? Number(customer_id) : null
  if (customerIdVal) {
    const [cust] = await sql`SELECT display_name FROM customers WHERE id = ${customerIdVal}`
    if (cust) resolvedCustomerName = cust.display_name
  }

  const cleanLines = (Array.isArray(lines) ? lines : [])
    .map((l: any) => ({
      itemId: l.itemId ? Number(l.itemId) : null,
      item: String(l.item ?? '').trim(),
      qty: Number(l.qty) || 0,
      price: Number(l.price) || 0,
      unit: l.unit ? String(l.unit).trim() : null,
      dimensions: l.dimensions ? String(l.dimensions).trim() : null,
    }))
    .filter((l: any) => l.item && l.qty > 0)
  if (cleanLines.length === 0) {
    return badRequest('At least one valid item is required')
  }

  // The same work must not be typed again in the Sales Log: lines go there automatically, under the
  // same rules as a sale (no negative stock, price above cost). Checked first so nothing is half-saved.
  const resolved = await resolveSaleLines(cleanLines)
  if (resolved.error) return badRequest(resolved.error)

  const subtotal = cleanLines.reduce((s: number, l: any) => s + l.qty * l.price, 0)
  const enteredBy = session.user?.name || (session.user as any)?.username || null

  try {
    await ensureDbInitialized()
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
         ${resolvedCustomerName}, ${customerIdVal}, 'GHS',
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

    // Into the Sales Log (that day's receipt), with the customer attached.
    let custCodeForWa: string | null = null
    try {
      let custCode: string | null = null
      if (customerIdVal) { const [cc] = await sql`SELECT customer_id_code FROM customers WHERE id = ${customerIdVal}`; custCode = (cc?.customer_id_code as string | null) ?? null; custCodeForWa = custCode }
      const salesReceiptId = await addCustomerReceiptToSales({ date: String(invoice_date).slice(0, 10), lines: resolved.lines, enteredBy: enteredBy ?? null, invoiceId: invoice.id as number,
        customerCode: custCode, customerName: resolvedCustomerName, customerPhone: customer_phone || null })
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sales_receipt_id INTEGER`.catch(() => {})
      await sql`UPDATE invoices SET sales_receipt_id = ${salesReceiptId} WHERE id = ${invoice.id}`.catch(() => {})
    } catch (e) {
      console.error('receipt -> sales log failed:', e instanceof Error ? e.message : String(e))
    }

    const [created] = await sql.query(`
      SELECT ${SELECT_FIELDS}
      WHERE i.id = $1
      GROUP BY i.id, c.id
    `, [invoice.id])

    await logActivity(enteredBy ?? 'Unknown', 'added receipt', `${invoice_number} · ₵${subtotal.toFixed(2)} for ${resolvedCustomerName}`)
    if (customer_phone) void sendSms(customer_phone, receiptMessage(String(invoice_number), cleanLines.map((l: any) => ({ name: l.item, qty: l.qty, price: l.price }))), 'receipt')
    const waTo = toE164(customer_phone)
    return success({ ...created, whatsapp_url: waTo ? receiptWhatsAppUrl('0' + waTo.slice(-9), String(invoice_number), cleanLines.map((l: any) => ({ name: l.item, qty: l.qty, price: l.price })), custCodeForWa, resolvedCustomerName) : null })
  } catch (e) {
    return handleError('receipt POST', e)
  }
}
