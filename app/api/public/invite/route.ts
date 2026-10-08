// PUBLIC (no login): a customer opens the link we sent on WhatsApp, confirms
// their phone number, and completes their details. Nothing about the record is
// revealed until the phone check passes.
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import {
  ensureCustomerInviteColumns, normalizeGhPhone, FILES_CONSENT_VERSION, MAX_ATTEMPTS, LOCK_MINUTES,
} from '@/lib/customerInvite'
import { NextRequest, NextResponse } from 'next/server'

const hits = new Map<string, number[]>()
function ipLimited(ip: string) {
  const now = Date.now(), win = 10 * 60 * 1000
  const list = (hits.get(ip) ?? []).filter(t => now - t < win)
  list.push(now); hits.set(ip, list)
  return list.length > 30
}
const clean = (v: unknown, max = 120) => String(v ?? '').trim().slice(0, max)
const fail = (error: string, status: number) => NextResponse.json({ error }, { status })

type Row = {
  id: number; customer_id_code: string; display_name: string; phone: string | null
  email: string | null; location: string | null; invite_attempts: number; invite_locked_until: string | null
  profile_completed_at: string | null; invite_opened_at: string | null
}

async function check(token: string, phoneRaw: unknown): Promise<{ row: Row; phone: string; sharedWith: string | null } | NextResponse> {
  if (!/^[a-z0-9]{6,20}$/.test(token)) return fail('This link is not valid. Please ask us on WhatsApp for a new one.', 404)
  const [row] = await sql`
    SELECT id, customer_id_code, display_name, phone, email, location, invite_attempts,
           invite_locked_until::text AS invite_locked_until, profile_completed_at::text AS profile_completed_at,
           invite_opened_at::text AS invite_opened_at
    FROM customers WHERE invite_token = ${token}` as Row[]
  if (!row) return fail('This link is not valid. Please ask us on WhatsApp for a new one.', 404)
  if (row.invite_locked_until && new Date(row.invite_locked_until) > new Date()) {
    return fail('Too many wrong tries. Please wait a little and try again, or message us on WhatsApp.', 429)
  }
  const phone = normalizeGhPhone(phoneRaw)
  if (!phone) return fail('Please enter a valid Ghana phone number, for example 024 123 4567.', 400)

  const onFile = row.phone ? normalizeGhPhone(row.phone) : null
  if (onFile && onFile !== phone) {
    const attempts = (row.invite_attempts ?? 0) + 1
    if (attempts >= MAX_ATTEMPTS) {
      await sql`UPDATE customers SET invite_attempts = 0, invite_locked_until = now() + (${LOCK_MINUTES} * interval '1 minute') WHERE id = ${row.id}`
    } else {
      await sql`UPDATE customers SET invite_attempts = ${attempts} WHERE id = ${row.id}`
    }
    return fail('That number does not match the one we have for you. Please check it and try again.', 403)
  }

  let sharedWith: string | null = null
  if (!onFile) {
    const [other] = await sql`
      SELECT customer_id_code FROM customers
      WHERE id <> ${row.id} AND regexp_replace(coalesce(phone,''), '\D', '', 'g') IN (${phone}, ${'233' + phone.slice(1)})
      ORDER BY id ASC LIMIT 1`
    if (other) sharedWith = other.customer_id_code
  }
  return { row, phone, sharedWith }
}

export async function POST(req: NextRequest) {
  try {
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
    if (ipLimited(ip)) return fail('Too many attempts. Please try again later.', 429)
    await ensureCustomerInviteColumns()
    const body = await req.json().catch(() => ({}))
    const token = clean(body.token, 30).toLowerCase()
    const result = await check(token, body.phone)
    if (result instanceof NextResponse) return result
    const { row, phone, sharedWith } = result

    if (body.action === 'verify') {
      await sql`UPDATE customers SET invite_attempts = 0, invite_opened_at = coalesce(invite_opened_at, now()) WHERE id = ${row.id}`
      if (sharedWith) {
        return NextResponse.json({ ok: true, alreadyRegistered: true, code: sharedWith })
      }
      return NextResponse.json({
        ok: true, code: row.customer_id_code, completed: !!row.profile_completed_at,
        prefill: {
          display_name: /^WhatsApp contact/i.test(row.display_name) ? '' : row.display_name,
          email: row.email ?? '', location: row.location ?? '',
        },
      })
    }

    if (body.action === 'complete') {
      if (sharedWith) return fail('This number is already registered. Please message us on WhatsApp.', 409)
      const display = clean(body.display_name, 120)
      const email = clean(body.email, 120).toLowerCase()
      const location = clean(body.location, 80)
      const consent = body.files_consent === true
      if (!display) return fail('Please enter your name, or your organisation name.', 400)
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Please check your email address.', 400)
      await sql`
        UPDATE customers SET
          display_name = ${display},
          email = ${email || null},
          location = ${location || null},
          phone = coalesce(phone, ${phone}),
          files_consent = ${consent},
          files_consent_at = ${consent ? new Date().toISOString() : null},
          files_consent_version = ${consent ? FILES_CONSENT_VERSION : null},
          profile_completed_at = now(),
          invite_attempts = 0
        WHERE id = ${row.id}`
      await logActivity('Online form', 'customer completed details', `${row.customer_id_code} ${display}${consent ? ' (files consent)' : ''}`, 0).catch(() => {})
      return NextResponse.json({ ok: true, code: row.customer_id_code })
    }
    return fail('Unknown request.', 400)
  } catch (e) {
    console.error('public invite', e)
    return fail('Something went wrong. Please try again or WhatsApp 053 432 8977.', 500)
  }
}
