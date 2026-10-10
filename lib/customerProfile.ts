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
