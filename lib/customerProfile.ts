import sql from '@/lib/db'
import { once } from '@/lib/once'
import { ensureLiveSaleTapsTable } from '@/lib/liveSales'

export const FILES_CONSENT_VERSION = 'v1-2026-10'

export const ensureCustomerProfileColumns = once(async () => {
  const cols = [
    'profile_completed_at TIMESTAMPTZ',
    'files_consent BOOLEAN NOT NULL DEFAULT FALSE',
    'files_consent_at TIMESTAMPTZ',
    'files_consent_version TEXT',
    'source TEXT',
    'added_by TEXT',
  ]
  for (const c of cols) await sql.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS ${c}`).catch(() => {})
})

// Any Ghana number format -> 0XXXXXXXXX, or null if it is not a valid number.
// Handles +233, 233, a doubled "2330..." prefix, and 9-digit numbers without the 0.
export function normalizeGhPhone(raw: unknown): string | null {
  let d = String(raw ?? '').replace(/\D/g, '')
  if (d.startsWith('233')) d = d.slice(3)
  if (d.length === 9) d = '0' + d
  return /^0\d{9}$/.test(d) ? d : null
}

export function waNumber(local: string): string {
  return '233' + local.slice(1)
}

export function welcomeMessage(name: string, code: string): string {
  const who = name.trim() ? `, ${name.trim()}` : ''
  return (
    `Welcome to *Grony Multimedia*${who}! Your customer number is *${code}*. ` +
    `Quote it whenever you send us work and we find it faster. ` +
    `We keep your files only if you register and agree. Quote your number to get copies without resending.\n\n` +
    `Call/WhatsApp/MoMo: 053 432 8977`
  )
}

export function welcomeWhatsAppUrl(phone: string, name: string, code: string): string {
  return `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(welcomeMessage(name, code))}`
}

// The total a customer must reach in total work with us to stand a chance of winning the prize.
export const PRIZE_TARGET = 1000

// Everything this customer has paid us: live sales tapped with their number, named sales
// receipts and customer receipts / invoices (taps that were undone are not counted).
export async function customerLifetimeTotal(code: string | null | undefined): Promise<number | null> {
  if (!code) return null
  try {
    await ensureLiveSaleTapsTable()
    const [c] = await sql`SELECT id FROM customers WHERE customer_id_code = ${code}`
    if (!c) return null
    const [r] = await sql`
      SELECT
        COALESCE((SELECT SUM(total) FROM invoices WHERE customer_id = ${c.id}), 0)
      + COALESCE((SELECT SUM(total) FROM sales_receipts WHERE customer_id = ${c.id}), 0)
      + COALESCE((SELECT SUM(price * quantity) FROM live_sale_taps WHERE customer_id_code = ${code} AND undone IS NOT TRUE AND invoice_id IS NULL), 0) AS total`
    return Number(r.total) || 0
  } catch (e) { console.error('customerLifetimeTotal:', e instanceof Error ? e.message : String(e)); return null }
}

type WaItem = { name: string; qty: number; price: number }
const cedi = (n: number) => `₵${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// WhatsApp click-to-chat links, opened by staff on their own phone (no SMS cost):
// the message is pre-filled, they just press send. Same style as the shop's WhatsApp
// greeting: what was done and the amount first, then who we are and where to find us.
const REGISTER = 'https://app.gronymultimedia.com/register'
// "Hello Kofi (GM45)": the customer ID rides in the greeting, never as a sentence of its own.
const hello = (name?: string | null, customerId?: string | null) =>
  `Hello${name?.trim() ? ` ${name.trim()}` : ''}${customerId ? ` (${customerId})` : ''}`
// Total work with us so far, and the prize chance: only for saved customers (their total is known).
const LOYALTY = (lifetime?: number | null) => {
  if (lifetime == null) return ''
  const left = PRIZE_TARGET - lifetime
  return `*Your total work with us so far: ${cedi(lifetime)}*\n` +
    (left > 0
      ? `Reach ${cedi(PRIZE_TARGET)} in total and you stand a chance to win an amazing prize from us! Only ${cedi(left)} to go.\n\n`
      : `You have passed ${cedi(PRIZE_TARGET)} with us, so you stand a chance to win an amazing prize from us! Thank you for your trust.\n\n`)
}
const CONTACT_BLOCK = (customerId?: string | null) =>
  (customerId
    ? ''
    : `*New here? Register in 1 minute and get your own customer number:*\n${REGISTER}\nWe keep your files only if you register and agree. Quote your number to get copies without resending.\n\n`) +
  `Send all work and payments in this chat only.\n` +
  `Call / WhatsApp / Mobile Money: 053 432 8977\n\n` +
  `Join our community group for offers, new products and tips:\nhttps://chat.whatsapp.com/LOOxCVhHFlC8SjpfnoWI7p\n\n` +
  `Website: https://www.gronymultimedia.com\n` +
  `Like our Facebook page: https://www.facebook.com/share/1F5K2JTViP/\n` +
  `Join our TikTok page: https://www.tiktok.com/@grony.multimedia\n` +
  `Email: info@gronymultimedia.com`

export function purchaseWhatsAppUrl(phone: string, items: WaItem[], customerId?: string | null, name?: string | null, lifetime?: number | null): string {
  const total = items.reduce((s, i) => s + i.qty * i.price, 0)
  const lines = items.map(i => `- ${i.qty} x ${i.name} @ ${cedi(i.price)} = ${cedi(i.qty * i.price)}`).join('\n')
  const text = `${hello(name, customerId)} and thank you for choosing *Grony Multimedia*, Assin Foso (near GCB Bank)!\n\n` +
    `Here is what we did for you today:\n${lines}\n*Total: ${cedi(total)}*\n\n${LOYALTY(lifetime)}${CONTACT_BLOCK(customerId)}`
  return `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`
}

export function receiptWhatsAppUrl(phone: string, receiptNo: string, items: WaItem[], customerId?: string | null, name?: string | null, lifetime?: number | null): string {
  const total = items.reduce((s, i) => s + i.qty * i.price, 0)
  const lines = items.map(i => `- ${i.qty} x ${i.name} @ ${cedi(i.price)} = ${cedi(i.qty * i.price)}`).join('\n')
  const text = `${hello(name, customerId)} and thank you for choosing *Grony Multimedia*, Assin Foso (near GCB Bank)!\n\n` +
    `Receipt ${receiptNo}:\n${lines}\n*Total: ${cedi(total)}* (paid)\n\n${LOYALTY(lifetime)}${CONTACT_BLOCK(customerId)}`
  return `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`
}
