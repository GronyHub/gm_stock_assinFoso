import { requireAuth, badRequest, notFound, success, handleError, getActorName } from '@/lib/api'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { normalizeGhPhone } from '@/lib/customerProfile'
import { ensureCustomerPhones, extraPhones, phoneOwner } from '@/lib/customerPhones'
import { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ id: string }> }
const view = async (id: number) => {
  const [c] = await sql`SELECT phone FROM customers WHERE id = ${id}`
  return { main: (c?.phone as string | null) ?? null, extras: await extraPhones(id) }
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { error } = await requireAuth()
  if (error) return error
  try { return success(await view(Number((await params).id))) } catch (e) { return handleError('customer phones GET', e) }
}

// POST { phone, label? } -- add another number
export async function POST(req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await ensureCustomerPhones()
    const id = Number((await params).id)
    const [cust] = await sql`SELECT display_name FROM customers WHERE id = ${id}`
    if (!cust) return notFound()
    const b = await req.json().catch(() => ({}))
    const phone = normalizeGhPhone(b.phone)
    if (!phone) return badRequest('Enter a Ghana number: 10 digits starting with 0.')
    const owner = await phoneOwner(phone, id)
    if (owner) return badRequest(`${phone} already belongs to ${owner.display_name}.`)
    const [mine] = await sql`SELECT 1 AS x FROM customers WHERE id = ${id} AND RIGHT(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'), 9) = ${phone.slice(-9)}`
    if (mine) return badRequest('That is already this customer\'s main number.')
    await sql`INSERT INTO customer_phones (customer_id, phone, label, added_by) VALUES (${id}, ${phone}, ${String(b.label ?? '').trim().slice(0, 30) || null}, ${getActorName(session)})
      ON CONFLICT (customer_id, phone) DO NOTHING`
    await logActivity(getActorName(session), 'added customer number', `${cust.display_name} · ${phone}`, 300)
    return success(await view(id), 201)
  } catch (e) { return handleError('customer phones POST', e) }
}

// PATCH { phoneId, label?, makeMain? } -- rename a number, or make it the main one (the old main becomes an extra)
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await ensureCustomerPhones()
    const id = Number((await params).id)
    const b = await req.json().catch(() => ({}))
    const phoneId = Number(b.phoneId)
    const [p] = await sql`SELECT id, phone, label FROM customer_phones WHERE id = ${phoneId} AND customer_id = ${id}`
    if (!p) return notFound()
    if ('label' in b) await sql`UPDATE customer_phones SET label = ${String(b.label ?? '').trim().slice(0, 30) || null} WHERE id = ${phoneId}`
    if (b.makeMain) {
      const [c] = await sql`SELECT phone, display_name FROM customers WHERE id = ${id}`
      const oldMain = normalizeGhPhone(c?.phone)
      await sql`UPDATE customers SET phone = ${p.phone} WHERE id = ${id}`
      await sql`DELETE FROM customer_phones WHERE id = ${phoneId}`
      if (oldMain) await sql`INSERT INTO customer_phones (customer_id, phone, label, added_by) VALUES (${id}, ${oldMain}, 'Previous main', ${getActorName(session)}) ON CONFLICT (customer_id, phone) DO NOTHING`
      await logActivity(getActorName(session), 'changed main number', `${c?.display_name} · ${p.phone}`, 300)
    }
    return success(await view(id))
  } catch (e) { return handleError('customer phones PATCH', e) }
}

// DELETE ?phoneId=  -- remove an extra number
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await ensureCustomerPhones()
    const id = Number((await params).id)
    const phoneId = Number(req.nextUrl.searchParams.get('phoneId'))
    const [p] = await sql`DELETE FROM customer_phones WHERE id = ${phoneId} AND customer_id = ${id} RETURNING phone`
    if (p) await logActivity(getActorName(session), 'removed customer number', `${id} · ${p.phone}`, 300)
    return success(await view(id))
  } catch (e) { return handleError('customer phones DELETE', e) }
}
