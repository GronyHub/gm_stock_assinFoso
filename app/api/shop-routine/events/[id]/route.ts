import { requireAuth, badRequest, getActorName, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ id: string }> }
const HM = /^([01]\d|2[0-3]):[0-5]\d$/

// PATCH { value?, minutes?, support?, done_at?, note? } -- correct a record.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    const id = Number((await params).id)
    const b = await req.json().catch(() => null)
    const [row] = await sql`SELECT value, extra, recorded_at FROM shop_routine_events WHERE id = ${id}`
    if (!row || !b) return badRequest('Unknown record.')
    const extra = { ...((row.extra as Record<string, unknown> | null) ?? {}), edited_by: getActorName(session) } as Record<string, unknown>
    if ('minutes' in b) {
      const m = Math.round(Number(b.minutes))
      if (b.minutes == null || b.minutes === '') delete extra.minutes
      else if (m >= 1 && m <= 600) extra.minutes = m
      else return badRequest('Time taken must be 1 to 600 minutes.')
    }
    if ('support' in b) { if (b.support === 'alone' || b.support === 'support') extra.support = b.support; else delete extra.support }
    if ('done_at' in b) {
      if (!b.done_at) delete extra.done_at
      else {
        const rec = new Date(row.recorded_at as string)
        if (!HM.test(b.done_at) || Number(b.done_at.slice(0, 2)) * 60 + Number(b.done_at.slice(3)) > rec.getUTCHours() * 60 + rec.getUTCMinutes()) return badRequest('The time done cannot be later than when it was logged.')
        extra.done_at = b.done_at
      }
    }
    const value = b.value === 'Done' || b.value === 'Not done' ? b.value : row.value
    const noteSet = 'note' in b
    await sql`UPDATE shop_routine_events SET value = ${value}, extra = ${JSON.stringify(extra)}::jsonb,
      note = CASE WHEN ${noteSet} THEN ${b.note ? String(b.note).slice(0, 500) : null} ELSE note END WHERE id = ${id}`
    return success({ ok: true })
  } catch (e) { return handleError('shop-routine event PATCH', e) }
}

// Revert: puts the tile back to waiting.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { error } = await requireAuth()
  if (error) return error
  try {
    await sql`DELETE FROM shop_routine_events WHERE id = ${Number((await params).id)}`
    return success({ ok: true })
  } catch (e) { return handleError('shop-routine event DELETE', e) }
}
