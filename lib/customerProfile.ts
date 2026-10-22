import sql from '@/lib/db'
import { once } from '@/lib/once'

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

type WaItem = { name: string; qty: number; price: number }
const cedi = (n: number) => `₵${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// WhatsApp click-to-chat links, opened by staff on their own phone (no SMS cost):
// the message is pre-filled, they just press send.
export function purchaseWhatsAppUrl(phone: string, items: WaItem[], customerId?: string | null): string {
  const total = items.reduce((s, i) => s + i.qty * i.price, 0)
  const lines = items.map(i => `- ${i.qty} x ${i.name} @ ${cedi(i.price)}`).join('\n')
  const text = `Thank you for shopping at *Grony Multimedia*!\n\nYou bought:\n${lines}\n*Total: ${cedi(total)}*` +
    `${customerId ? `\nYour customer number: *${customerId}*` : ''}\n\nCall/WhatsApp/MoMo: 053 432 8977`
  return `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`
}

export function receiptWhatsAppUrl(phone: string, receiptNo: string, items: WaItem[], customerId?: string | null): string {
  const total = items.reduce((s, i) => s + i.qty * i.price, 0)
  const lines = items.map(i => `- ${i.qty} x ${i.name} @ ${cedi(i.price)} = ${cedi(i.qty * i.price)}`).join('\n')
  const text = `*Grony Multimedia* - Receipt ${receiptNo}\n\n${lines}\n*Total: ${cedi(total)}* (paid)` +
    `${customerId ? `\nCustomer number: *${customerId}*` : ''}\n\nThank you!\nCall/WhatsApp/MoMo: 053 432 8977`
  return `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`
}
