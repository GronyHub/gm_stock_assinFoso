import { randomBytes } from 'crypto'
import sql from '@/lib/db'
import { once } from '@/lib/once'

export const FILES_CONSENT_VERSION = 'v1-2026-10'
export const FILES_CONSENT_TEXT =
  'Yes, keep my files so I can ask for copies or earlier versions by quoting my customer number. I can ask Grony Multimedia to delete them at any time.'

export const SITE_URL = 'https://app.gronymultimedia.com'
export const MAX_ATTEMPTS = 5
export const LOCK_MINUTES = 30

export const ensureCustomerInviteColumns = once(async () => {
  const cols = [
    'invite_token TEXT',
    'invited_at TIMESTAMPTZ',
    'invite_opened_at TIMESTAMPTZ',
    'profile_completed_at TIMESTAMPTZ',
    'invite_attempts INTEGER NOT NULL DEFAULT 0',
    'invite_locked_until TIMESTAMPTZ',
    'files_consent BOOLEAN NOT NULL DEFAULT FALSE',
    'files_consent_at TIMESTAMPTZ',
    'files_consent_version TEXT',
    'source TEXT',
    'added_by TEXT',
  ]
  for (const c of cols) await sql.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS ${c}`).catch(() => {})
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS customers_invite_token_idx ON customers (invite_token) WHERE invite_token IS NOT NULL`.catch(() => {})
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

export function newInviteToken(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  const bytes = randomBytes(10)
  let out = ''
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}

export function inviteLink(token: string): string {
  return `${SITE_URL}/register/c/${token}`
}

export function inviteMessage(code: string, token: string, hasPhone: boolean): string {
  const base =
    `Hello from *Grony Multimedia*! Your customer number is *${code}*. ` +
    `Quote it whenever you send us work and we find it faster. ` +
    `Add your name in 1 minute: ${inviteLink(token)}`
  return hasPhone ? base : base + '\n\nOr just reply with your full name and phone number and we will add them for you.'
}

export function jobCard(code: string, phone: string | null): string {
  return [
    'Job ID; JOB ',
    'Name of job; ',
    `Customer ID: ${code}`,
    'Customer from: ',
    'Description; ',
    "Customer's sent file on whatsapp: ",
    `Customer phone number: ${phone ?? ''}`,
    'Location of file: ',
  ].join('\n')
}
