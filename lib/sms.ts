import sql from '@/lib/db'
import { once } from '@/lib/once'
import { COMPANY } from '@/lib/companyInfo'
import { normalizeGhPhone } from '@/lib/customerProfile'

// Customer SMS through Arkesel (Ghana) or Africa's Talking. Arkesel is used when
// ARKESEL_API_KEY is set (or SMS_PROVIDER=arkesel); otherwise Africa's Talking
// with AT_USERNAME + AT_API_KEY. SMS_SENDER_ID is the registered sender name
// (e.g. GRONY). All of these live in the server's .env.local. With no keys set, every
// send is skipped quietly and logged as 'not_configured', so the rest of the app
// never fails because of SMS. SMS_ENABLED=off switches it off entirely.
//
// Messages use plain ASCII and "GHS" instead of the cedi sign: a single
// non-GSM character makes the whole SMS Unicode (70 characters per part
// instead of 160), which multiplies the cost.

const ensureSmsLog = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS sms_log (
    id SERIAL PRIMARY KEY, to_phone TEXT NOT NULL, message TEXT NOT NULL, kind TEXT,
    status TEXT NOT NULL, error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`.catch(() => {})
})

// "0244123456", "244123456", "+233244123456" -> "+233244123456"; null if not a Ghana mobile number.
export function toE164(raw: unknown): string | null {
  const local = normalizeGhPhone(raw)
  return local ? '+233' + local.slice(1) : null
}

export const ascii = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim()
const ghs = (n: number) => `GHS ${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function purchaseMessage(items: { name: string; qty: number; price: number }[], customerId?: string | null) {
  const total = items.reduce((s, i) => s + i.qty * i.price, 0)
  const shown = items.slice(0, 3).map(i => `${i.qty} x ${ascii(i.name).slice(0, 40)} @ ${ghs(i.price)}`).join(', ')
  const more = items.length > 3 ? ` +${items.length - 3} more` : ''
  return `${COMPANY.name}: Thank you! You bought ${shown}${more}. Total ${ghs(total)}.${customerId ? ` ID ${customerId}.` : ''} Call/WhatsApp ${COMPANY.phone}`
}

export function receiptMessage(receiptNo: string, items: { name: string; qty: number; price: number }[], customerId?: string | null) {
  const total = items.reduce((s, i) => s + i.qty * i.price, 0)
  const shown = items.slice(0, 3).map(i => `${i.qty} x ${ascii(i.name).slice(0, 40)}`).join(', ')
  const more = items.length > 3 ? ` +${items.length - 3} more` : ''
  return `${COMPANY.name}: Receipt ${ascii(receiptNo)}. ${shown}${more}. Total ${ghs(total)}. Paid. Thank you!${customerId ? ` ID ${customerId}.` : ''} ${COMPANY.phone}`
}

export function welcomeSms(name: string, code: string) {
  const who = ascii(name) ? `, ${ascii(name).split(' ')[0]}` : ''
  return `Welcome to ${COMPANY.name}${who}! Your customer number is ${code}. Quote it whenever you send us work. ${COMPANY.phone}`
}

async function log(to: string, message: string, kind: string, status: string, error?: string) {
  await ensureSmsLog()
  await sql`INSERT INTO sms_log (to_phone, message, kind, status, error) VALUES (${to}, ${message}, ${kind}, ${status}, ${error ?? null})`.catch(() => {})
}

// Never throws and never blocks the caller for long; call it without awaiting
// (void sendSms(...)) from request handlers.
export async function sendSms(rawPhone: unknown, message: string, kind: string): Promise<'sent' | 'failed' | 'skipped'> {
  const to = toE164(rawPhone)
  if (!to) return 'skipped'
  if (process.env.SMS_ENABLED === 'off') return 'skipped'
  const provider = process.env.SMS_PROVIDER ?? (process.env.ARKESEL_API_KEY ? 'arkesel' : 'africastalking')
  const sender = process.env.SMS_SENDER_ID ?? process.env.AT_SENDER_ID
  try {
    if (provider === 'arkesel') {
      const key = process.env.ARKESEL_API_KEY
      if (!key) { await log(to, message, kind, 'not_configured'); return 'skipped' }
      // Arkesel SMS API v2: numbers as 233XXXXXXXXX, key in the api-key header.
      const res = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
        method: 'POST',
        headers: { 'api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ sender: sender || 'GRONY', message, recipients: [to.replace('+', '')] }),
        signal: AbortSignal.timeout(15000),
      })
      const d = await res.json().catch(() => null) as { status?: string; message?: string } | null
      if (!res.ok || (d?.status && d.status !== 'success')) { await log(to, message, kind, 'failed', `${res.status} ${d?.message ?? d?.status ?? ''}`.trim()); return 'failed' }
      await log(to, message, kind, 'sent')
      return 'sent'
    }
    const user = process.env.AT_USERNAME, key = process.env.AT_API_KEY
    if (!user || !key) { await log(to, message, kind, 'not_configured'); return 'skipped' }
    const host = user === 'sandbox' ? 'api.sandbox.africastalking.com' : 'api.africastalking.com'
    const body = new URLSearchParams({ username: user, to, message })
    if (sender) body.set('from', sender)
    const res = await fetch(`https://${host}/version1/messaging`, {
      method: 'POST',
      headers: { apiKey: key, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(15000),
    })
    const d = await res.json().catch(() => null) as { SMSMessageData?: { Recipients?: { status?: string }[] } } | null
    const status = d?.SMSMessageData?.Recipients?.[0]?.status
    if (!res.ok || (status && status !== 'Success')) { await log(to, message, kind, 'failed', `${res.status} ${status ?? ''}`.trim()); return 'failed' }
    await log(to, message, kind, 'sent')
    return 'sent'
  } catch (e) {
    await log(to, message, kind, 'failed', e instanceof Error ? e.message : String(e))
    return 'failed'
  }
}
