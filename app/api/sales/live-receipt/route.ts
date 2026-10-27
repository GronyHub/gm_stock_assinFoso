import { requireAuth, badRequest, success, handleError, getActorName } from '@/lib/api'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { ensureLiveSaleTapsTable } from '@/lib/liveSales'
import { emailWorkDone } from '@/lib/customerEmail'
import { receiptWhatsAppUrl, customerLifetimeTotal, normalizeGhPhone } from '@/lib/customerProfile'
import { findCustomerByPhone } from '@/lib/customerPhones'
import { NextRequest } from 'next/server'

// POST { tapIds: number[] } -- MI (multiple items) in Live Sale: the taps just recorded for one
// customer are issued as ONE customer receipt. The sales were already recorded by the taps
// themselves (Sales Log, stock), so this only writes the receipt document and links the taps to it.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await ensureLiveSaleTapsTable()
    await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'Receipt'`.catch(() => {})
    await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_phone TEXT`.catch(() => {})
    await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_organisation TEXT`.catch(() => {})
    await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_town_district TEXT`.catch(() => {})
    await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_region TEXT`.catch(() => {})

    const b = await req.json().catch(() => ({}))
    const ids = (Array.isArray(b.tapIds) ? b.tapIds : []).map(Number).filter((n: number) => Number.isInteger(n) && n > 0).slice(0, 60)
    if (!ids.length) return badRequest('No items to put on the receipt.')

    const taps = await sql`SELECT id, item_name, price, quantity, tapped_at, customer_id_code, undone, invoice_id FROM live_sale_taps WHERE id = ANY(${ids}) ORDER BY id` as
      { id: number; item_name: string; price: string; quantity: number; tapped_at: string; customer_id_code: string | null; undone: boolean; invoice_id: number | null }[]
    if (taps.length !== ids.length) return badRequest('Some of these sales were not found.')
    if (taps.some(t => t.undone)) return badRequest('One of these sales was undone.')
    if (taps.some(t => t.invoice_id)) return badRequest('These sales are already on a receipt.')
    const code = taps[0].customer_id_code
    if (!code || taps.some(t => t.customer_id_code !== code)) return badRequest('All items must be for the same customer.')

    const [cust] = await sql`SELECT id, display_name, company_name, phone, location FROM customers WHERE customer_id_code = ${code}`
    if (!cust) return badRequest('That customer is not registered yet.')

    const date = new Date(taps[0].tapped_at).toISOString().slice(0, 10)
    const total = taps.reduce((s, t) => s + Number(t.price) * Number(t.quantity), 0)
    const number = `RCT-${date.replace(/-/g, '').slice(2)}-${Date.now().toString().slice(-5)}`
    const phone = normalizeGhPhone(cust.phone)

    const [inv] = await sql`
      INSERT INTO invoices
        (zoho_invoice_id, invoice_number, invoice_date, due_date, status, document_type, customer_name, customer_id, currency_code,
         customer_phone, customer_organisation, customer_town_district, customer_region, subtotal, total, balance, adjustment, notes)
      VALUES
        (${`INTERNAL_${number}_${Date.now()}`}, ${number}, ${date}, NULL, 'Closed', 'Receipt', ${cust.display_name}, ${cust.id}, 'GHS',
         ${phone}, ${cust.company_name ?? null}, ${(cust.location as string | null)?.split(',')[0]?.trim() ?? null}, NULL,
         ${total}, ${total}, 0, 0, 'Live Sale (MI)')
      RETURNING id`
    for (const t of taps) {
      await sql`INSERT INTO invoice_lines (invoice_id, raw_item_name, quantity, item_price, item_total, tap_id)
        VALUES (${inv.id}, ${t.item_name}, ${t.quantity}, ${t.price}, ${Number(t.price) * Number(t.quantity)}, ${t.id})`
    }
    await sql`UPDATE live_sale_taps SET invoice_id = ${inv.id} WHERE id = ANY(${ids})`
    await logActivity(getActorName(session), 'issued receipt', `${number} · ₵${total.toFixed(2)} for ${cust.display_name}`)

    void emailWorkDone(code, taps.map(t => ({ name: t.item_name as string, qty: Number(t.quantity), price: Number(t.price) })), number)
    const whatsappUrl = phone
      ? receiptWhatsAppUrl(phone, number, taps.map(t => ({ name: t.item_name, qty: Number(t.quantity), price: Number(t.price) })), code, cust.display_name as string, await customerLifetimeTotal(code))
      : null
    return success({ invoiceId: inv.id, invoiceNumber: number, total, whatsappUrl, printUrl: `/receipts/${inv.id}/print` }, 201)
  } catch (e) { return handleError('sales/live-receipt', e) }
}

// GET ?invoiceId=123 -> the WhatsApp link and print page of a receipt already issued from Live Sale.
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error
  try {
    const id = Number(req.nextUrl.searchParams.get('invoiceId'))
    if (!id) return badRequest('No receipt chosen.')
    const [inv] = await sql`SELECT i.id, i.invoice_number, i.customer_phone, c.customer_id_code, c.display_name, c.phone
      FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id WHERE i.id = ${id}`
    if (!inv) return badRequest('Receipt not found.')
    const lines = await sql`SELECT raw_item_name, quantity, item_price FROM invoice_lines WHERE invoice_id = ${id} ORDER BY id`
    let phone = normalizeGhPhone(inv.customer_phone) ?? normalizeGhPhone(inv.phone)
    const code = (inv.customer_id_code as string | null) ?? null
    // ?to= : another of this customer's own numbers.
    const to = normalizeGhPhone(req.nextUrl.searchParams.get('to'))
    if (to && code) { const owner = await findCustomerByPhone(to); if (owner && owner.customer_id_code === code) phone = to }
    const whatsappUrl = phone
      ? receiptWhatsAppUrl(phone, inv.invoice_number as string, lines.map(l => ({ name: l.raw_item_name as string, qty: Number(l.quantity), price: Number(l.item_price) })), code, inv.display_name as string, await customerLifetimeTotal(code))
      : null
    return success({ invoiceNumber: inv.invoice_number, whatsappUrl, printUrl: `/receipts/${id}/print` })
  } catch (e) { return handleError('sales/live-receipt GET', e) }
}
