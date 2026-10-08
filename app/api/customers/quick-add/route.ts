import { requireAuth, badRequest, success, handleError, getActorName } from '@/lib/api'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { initializeDatabase } from '@/lib/dbInitialize'
import {
  ensureCustomerInviteColumns, normalizeGhPhone, waNumber, newInviteToken,
  inviteLink, inviteMessage, jobCard,
} from '@/lib/customerInvite'
import { NextRequest } from 'next/server'

function shape(c: { id: number; customer_id_code: string; invite_token: string; phone: string | null; display_name: string }, existing: boolean) {
  const hasPhone = !!c.phone
  const message = inviteMessage(c.customer_id_code, c.invite_token, hasPhone)
  return {
    id: c.id,
    code: c.customer_id_code,
    display_name: c.display_name,
    phone: c.phone,
    existing,
    link: inviteLink(c.invite_token),
    message,
    jobCard: jobCard(c.customer_id_code, c.phone),
    waUrl: c.phone ? `https://wa.me/${waNumber(c.phone)}?text=${encodeURIComponent(message)}` : null,
  }
}

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error
  try {
    await initializeDatabase()
    await ensureCustomerInviteColumns()
    const rows = await sql`
      SELECT id, customer_id_code, display_name, phone, invite_token,
             invited_at::text AS invited_at, invite_opened_at::text AS opened_at,
             profile_completed_at::text AS completed_at, files_consent
      FROM customers
      WHERE invite_token IS NOT NULL
      ORDER BY invited_at DESC NULLS LAST
      LIMIT 40`
    return success(rows.map(r => ({
      ...shape({ id: r.id, customer_id_code: r.customer_id_code, invite_token: r.invite_token, phone: r.phone, display_name: r.display_name }, true),
      status: r.completed_at ? 'completed' : r.opened_at ? 'opened' : 'invited',
      files_consent: r.files_consent,
      invited_at: r.invited_at,
    })))
  } catch (e) {
    return handleError('quick-add list', e)
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await initializeDatabase()
    await ensureCustomerInviteColumns()
    const body = await req.json().catch(() => ({}))
    const rawPhone = String(body.phone ?? '').trim()
    const name = String(body.name ?? '').trim().slice(0, 120)
    const phone = rawPhone ? normalizeGhPhone(rawPhone) : null
    if (rawPhone && !phone) return badRequest('That phone number does not look right. Use a Ghana number like 024 123 4567, or leave it empty for an @username contact.')

    // Already in the app? Reuse the record instead of creating a duplicate.
    if (phone) {
      const [found] = await sql`
        SELECT id, customer_id_code, display_name, phone, invite_token FROM customers
        WHERE regexp_replace(coalesce(phone,''), '\D', '', 'g') IN (${phone}, ${waNumber(phone)})
        ORDER BY id ASC LIMIT 1`
      if (found) {
        let token = found.invite_token as string | null
        if (!token) {
          token = newInviteToken()
          await sql`UPDATE customers SET invite_token = ${token}, invited_at = now() WHERE id = ${found.id}`
        }
        return success(shape({ ...(found as { id: number; customer_id_code: string; phone: string | null; display_name: string }), invite_token: token }, true))
      }
    }

    const token = newInviteToken()
    const [row] = await sql`
      INSERT INTO customers
        (display_name, first_name, last_name, phone, status, is_internal, whatsapp_group_added, source, opening_balance, invite_token, invited_at, notes)
      VALUES
        (${name || 'WhatsApp contact'}, NULL, NULL, ${phone}, 'Active', false, false, 'whatsapp_quick_add', 0, ${token}, now(),
         ${'Added from WhatsApp by ' + getActorName(session)})
      RETURNING id, display_name, phone`
    const code = `GM${row.id}`
    const display = name || `WhatsApp contact ${code}`
    await sql`UPDATE customers SET customer_id_code = ${code}, display_name = ${display} WHERE id = ${row.id}`
    await logActivity(getActorName(session), 'quick-added customer from WhatsApp', `${code} ${display}`, 120)
    return success(shape({ id: row.id, customer_id_code: code, invite_token: token, phone: row.phone, display_name: display }, false))
  } catch (e) {
    return handleError('quick-add create', e)
  }
}
