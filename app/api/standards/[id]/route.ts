import { requireAuth, badRequest, notFound, getActorName, success, handleError } from '@/lib/api'
import { getIdParam } from '@/lib/api/params'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { ensureStandardsTables, FREQUENCIES } from '@/lib/standards'
import { NextRequest } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth()
  if (error) return error
  if ((session.user as { role?: string })?.role === 'staff') return badRequest('Only managers can edit standards.')
  try {
    await ensureStandardsTables()
    const id = await getIdParam(params)
    const b = await req.json()
    const [cur] = await sql`SELECT * FROM standards_items WHERE id = ${id}`
    if (!cur) return notFound()
    const text = b.text !== undefined ? String(b.text).trim() : cur.text
    const how = b.how !== undefined ? (String(b.how).trim() || null) : cur.how
    const frequency = b.frequency !== undefined ? String(b.frequency) : cur.frequency
    const active = b.active !== undefined ? Boolean(b.active) : cur.active
    if (!text) return badRequest('Text cannot be empty.')
    if (!(FREQUENCIES as readonly string[]).includes(frequency)) return badRequest('Invalid frequency.')
    await sql`UPDATE standards_items SET text = ${text}, how = ${how}, frequency = ${frequency}, active = ${active} WHERE id = ${id}`
    await logActivity(getActorName(session), active ? 'edited standard' : 'removed standard', `#${id}: ${text.slice(0, 80)}`)
    return success({ ok: true })
  } catch (e) {
    return handleError('standards PATCH', e)
  }
}
