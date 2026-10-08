import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { sendRegistrationEmail } from '@/lib/mailer'
import { NextRequest, NextResponse } from 'next/server'
import { once } from '@/lib/once'
import { ensureCustomerInviteColumns, FILES_CONSENT_VERSION } from '@/lib/customerInvite'

const SERVICES = [
  'Printing Press Services', 'Large Format Printing', 'Sale of Printing Materials',
  'Software Development', 'Artificial Intelligence Services', 'Internet Cafe Services',
  'Sale of Computer Accessories', 'Photo, Video & Audio', 'Hiring Services',
  'Online Admission Applications',
]

const ensureColumns = once(async () => {
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS source TEXT`.catch(() => {})
})

// Simple per-IP limit: max 5 registrations per hour per server process.
const hits = new Map<string, number[]>()
function rateLimited(ip: string) {
  const now = Date.now(), hour = 60 * 60 * 1000
  const list = (hits.get(ip) ?? []).filter(t => now - t < hour)
  list.push(now); hits.set(ip, list)
  return list.length > 5
}

// Ghana numbers -> 0XXXXXXXXX
function normalizePhone(raw: string): string | null {
  let d = String(raw || '').replace(/\D/g, '')
  if (d.startsWith('233')) d = '0' + d.slice(3)
  if (d.length === 9) d = '0' + d
  return /^0\d{9}$/.test(d) ? d : null
}
const clean = (v: unknown, max = 120) => String(v ?? '').trim().slice(0, max)

export async function POST(req: NextRequest) {
  try {
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
    if (rateLimited(ip)) {
      return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 })
    }
    const body = await req.json().catch(() => ({}))

    // Honeypot: real people never see or fill this field.
    if (clean(body.website)) return NextResponse.json({ ok: true, code: null })

    const firstName = clean(body.first_name, 60)
    const lastName = clean(body.last_name, 60)
    const phone = normalizePhone(body.phone)
    const email = clean(body.email, 120).toLowerCase()
    const location = clean(body.location, 80)
    const heardFrom = clean(body.heard_from, 60)
    const services: string[] = Array.isArray(body.services)
      ? body.services.filter((s: unknown) => SERVICES.includes(String(s))) : []
    const joinGroup = body.join_group === true
    const filesConsent = body.files_consent === true

    if (!firstName || !lastName) return NextResponse.json({ error: 'Please enter your first and last name.' }, { status: 400 })
    if (!phone) return NextResponse.json({ error: 'Please enter a valid Ghana phone number (e.g. 024 123 4567).' }, { status: 400 })
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Please check your email address.' }, { status: 400 })

    await ensureColumns()
    await ensureCustomerInviteColumns()

    // Already registered? Give back their existing number instead of a duplicate.
    const existing = await sql`
      SELECT customer_id_code FROM customers
      WHERE regexp_replace(coalesce(phone,''), '\\D', '', 'g') IN (${phone}, ${'233' + phone.slice(1)})
      ORDER BY id ASC LIMIT 1`
    if (existing.length && existing[0].customer_id_code) {
      return NextResponse.json({ ok: true, code: existing[0].customer_id_code, existing: true })
    }

    const displayName = `${firstName} ${lastName}`
    const notes = ['Self-registered online', heardFrom && `Heard about us: ${heardFrom}`, joinGroup && 'Wants to join WhatsApp group']
      .filter(Boolean).join(' · ')

    const [row] = await sql`
      INSERT INTO customers
        (display_name, first_name, last_name, email, phone, location, status, notes,
         is_internal, whatsapp_group_added, service_goods, source, opening_balance)
      VALUES
        (${displayName}, ${firstName}, ${lastName}, ${email || null}, ${phone}, ${location || null},
         'Active', ${notes}, false, ${joinGroup}, ${services.join(', ') || null}, 'self_register', 0)
      RETURNING id`
    // Customer ID from the row's own id -- no race between two people registering at once.
    const code = `GM${row.id}`
    await sql`UPDATE customers SET customer_id_code = ${code} WHERE id = ${row.id}`
    if (filesConsent) {
      await sql`UPDATE customers SET files_consent = true, files_consent_at = now(), files_consent_version = ${FILES_CONSENT_VERSION}, profile_completed_at = now() WHERE id = ${row.id}`
    } else {
      await sql`UPDATE customers SET profile_completed_at = now() WHERE id = ${row.id}`
    }

    await logActivity('Online form', 'self-registered customer', `${code} – ${displayName}`, 0).catch(() => {})

    // Send registration confirmation email if email provided
    if (email) {
      await sendRegistrationEmail(email, firstName, code).catch(err => {
        console.error('Failed to send registration email:', err)
      })
    }

    return NextResponse.json({ ok: true, code })
  } catch (e) {
    console.error('public register', e)
    return NextResponse.json({ error: 'Something went wrong. Please try again or WhatsApp 053 432 8977.' }, { status: 500 })
  }
}
