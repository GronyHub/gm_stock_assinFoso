import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { success, badRequest, unauthorized } from '@/lib/api'
import { canCaretake, caretakerName, isOwnerSession } from '@/lib/caretaker'
import { notifyRecord } from '@/lib/careAlerts'

// Tile records (routine / night checks) can be corrected or reverted by anyone
// with care access at any time; every other record keeps the 2-minute rule.
const TILE_KINDS = new Set(['routine', 'night'])

// Undo a mistaken tap: the person who made a record can remove it for 2
// minutes; owners can remove any record. After that records are permanent.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!(await canCaretake(session))) return badRequest('Not allowed')
  const id = Number((await params).id)
  if (!id) return badRequest('Bad id')
  const [row] = await sql`SELECT child, kind, extra, recorded_by, recorded_at FROM care_events WHERE id = ${id}`
  if (!row) return success({ ok: true })
  const mine = row.recorded_by === caretakerName(session)
  const recent = Date.now() - new Date(row.recorded_at as string).getTime() < 2 * 60 * 1000
  const tile = TILE_KINDS.has(row.kind as string)
  if (!tile && !isOwnerSession(session) && !(mine && recent)) return badRequest('Too late to undo. Records are permanent after 2 minutes.')
  await sql`DELETE FROM care_events WHERE id = ${id}`
  if (tile) notifyRecord(caretakerName(session), `${row.child ?? ''}: ${(row.extra as { title?: string } | null)?.title ?? (row.kind === 'night' ? 'Night check' : 'Tile')} REVERTED`)
  return success({ ok: true })
}

// PATCH { value?: 'Done' | 'Not done', minutes?: number | null, note?: string | null }
// Corrects a tile record: flip Done / Not done, set how long it took, add a note.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!(await canCaretake(session))) return badRequest('Not allowed')
  const id = Number((await params).id)
  const b = await req.json().catch(() => null)
  if (!id || !b) return badRequest('Bad request')
  const [row] = await sql`SELECT child, kind, value, extra FROM care_events WHERE id = ${id}`
  if (!row || !TILE_KINDS.has(row.kind as string)) return badRequest('This record cannot be edited')
  const who = caretakerName(session)
  const extra = { ...((row.extra as Record<string, unknown> | null) ?? {}), edited_by: who, edited_at: new Date().toISOString() } as Record<string, unknown>
  if ('minutes' in b) {
    const m = Math.round(Number(b.minutes))
    if (b.minutes == null || b.minutes === '') delete extra.minutes
    else if (m >= 1 && m <= 600) extra.minutes = m
    else return badRequest('Time taken must be 1 to 600 minutes')
  }
  let value = row.value as string | null
  if (row.kind === 'routine' && (b.value === 'Done' || b.value === 'Not done')) value = b.value
  const note = 'note' in b ? (b.note ? String(b.note).slice(0, 500) : null) : undefined
  await sql`UPDATE care_events SET value = ${value}, extra = ${JSON.stringify(extra)}::jsonb,
    note = CASE WHEN ${note !== undefined} THEN ${note ?? null} ELSE note END WHERE id = ${id}`
  const title = (extra.title as string | undefined) ?? (row.kind === 'night' ? 'Night check' : 'Tile')
  notifyRecord(who, `${row.child}: ${title} changed to ${value ?? ''}${extra.minutes ? ` (${extra.minutes} min)` : ''}`)
  return success({ ok: true })
}
