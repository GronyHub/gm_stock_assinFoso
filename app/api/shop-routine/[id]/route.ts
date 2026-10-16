import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ROUTINE_SECTIONS } from '@/lib/shopRoutine'
import { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ id: string }> }
async function manager() {
  const { session, error } = await requireAuth()
  if (error) return { error }
  if ((session.user as { role?: string })?.role === 'staff') return { error: badRequest('Only managers can change the routine.') }
  return {}
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const m = await manager(); if (m.error) return m.error
  try {
    const id = Number((await params).id)
    const b = await req.json().catch(() => ({}))
    const title = String(b.title ?? '').trim().slice(0, 200)
    const section = String(b.section ?? '')
    const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(b.time ?? '') ? b.time : null
    if (!id || !title || !(ROUTINE_SECTIONS as readonly string[]).includes(section)) return badRequest('Need a section and a title.')
    await sql`UPDATE shop_routine SET title = ${title}, section = ${section}, time = ${time} WHERE id = ${id}`
    return success({ ok: true })
  } catch (e) { return handleError('shop-routine PUT', e) }
}

// Soft delete: past records keep pointing at a real row.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const m = await manager(); if (m.error) return m.error
  try {
    await sql`UPDATE shop_routine SET active = FALSE WHERE id = ${Number((await params).id)}`
    return success({ ok: true })
  } catch (e) { return handleError('shop-routine DELETE', e) }
}
