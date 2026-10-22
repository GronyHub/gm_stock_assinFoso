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
// the message is pre-filled, they just press send. Same style as the shop's WhatsApp
// greeting: what was done and the amount first, then who we are and where to find us.
const REGISTER = 'https://app.gronymultimedia.com/register'
const CONTACT_BLOCK = (customerId?: string | null) =>
  (customerId
    ? `Your customer number is *${customerId}*. Quote it whenever you send us work and we find it faster.`
    : `*New here? Register in 1 minute and get your own customer number:*\n${REGISTER}\nWe keep your files only if you register and agree. Quote your number to get copies without resending.`) +
  `\n\nSend all work and payments in this chat only.\n` +
  `Call / WhatsApp / Mobile Money: 053 432 8977\n\n` +
  `Join our community group for offers, new products and tips:\nhttps://chat.whatsapp.com/LOOxCVhHFlC8SjpfnoWI7p\n\n` +
  `Website: https://www.gronymultimedia.com\n` +
  `Like our Facebook page: https://www.facebook.com/share/1F5K2JTViP/\n` +
  `Join our TikTok page: https://www.tiktok.com/@grony.multimedia\n` +
  `Email: info@gronymultimedia.com`

export function purchaseWhatsAppUrl(phone: string, items: WaItem[], customerId?: string | null, name?: string | null): string {
  const total = items.reduce((s, i) => s + i.qty * i.price, 0)
  const lines = items.map(i => `- ${i.qty} x ${i.name} @ ${cedi(i.price)} = ${cedi(i.qty * i.price)}`).join('\n')
  const text = `Hello${name?.trim() ? ` ${name.trim()}` : ''} and thank you for choosing *Grony Multimedia*, Assin Foso (near GCB Bank)!\n\n` +
    `Here is what we did for you today:\n${lines}\n*Total: ${cedi(total)}*\n\n${CONTACT_BLOCK(customerId)}`
  return `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`
}

export function receiptWhatsAppUrl(phone: string, receiptNo: string, items: WaItem[], customerId?: string | null, name?: string | null): string {
  const total = items.reduce((s, i) => s + i.qty * i.price, 0)
  const lines = items.map(i => `- ${i.qty} x ${i.name} @ ${cedi(i.price)} = ${cedi(i.qty * i.price)}`).join('\n')
  const text = `Hello${name?.trim() ? ` ${name.trim()}` : ''} and thank you for choosing *Grony Multimedia*, Assin Foso (near GCB Bank)!\n\n` +
    `Receipt ${receiptNo}:\n${lines}\n*Total: ${cedi(total)}* (paid)\n\n${CONTACT_BLOCK(customerId)}`
  return `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`
}
