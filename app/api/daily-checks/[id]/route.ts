import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensureDailyChecks, parseTileBody } from '@/lib/dailyChecks'
import { isOwnerLevel } from '@/lib/roles'
import { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ id: string }> }
const denied = 'Only the owner and manager can change the checklist.'

// PUT -- edit a tile (owner and manager). Body fields: see parseTileBody in lib/dailyChecks.ts.
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as any)) return badRequest(denied)
  try {
    await ensureDailyChecks()
    const id = Number((await params).id)
    const t = parseTileBody(await req.json().catch(() => ({})))
    if (!t.title || !t.section) return badRequest('Need a group and a title.')
    await sql`UPDATE daily_check_tiles SET title = ${t.title}, section = ${t.section}, time = ${t.time}, icon = ${t.icon}, frequency = ${t.frequency},
      weekday = ${t.weekday}, days = ${t.days}, how = ${t.how}, minutes = ${t.minutes}, kind = ${t.kind}, ask = ${t.ask}, ok_label = ${t.ok_label},
      issue_label = ${t.issue_label}, log_category = ${t.log_category}, needs_photo = ${t.needs_photo},
      prop_filter = CASE WHEN ${t.kind} = 'properties' THEN ${t.prop_filter ?? ''} ELSE NULL END WHERE id = ${id}`
    return success({ ok: true })
  } catch (e) { return handleError('daily-checks PUT', e) }
}

// PATCH { active?: boolean, move?: 'up' | 'down' } -- stop or restore a tile, or move it in the order.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as any)) return badRequest(denied)
  try {
    await ensureDailyChecks()
    const id = Number((await params).id)
    const b = await req.json().catch(() => ({}))
    if (typeof b.active === 'boolean') await sql`UPDATE daily_check_tiles SET active = ${b.active} WHERE id = ${id}`
    if (b.move === 'up' || b.move === 'down') {
      const [me] = await sql`SELECT position, section FROM daily_check_tiles WHERE id = ${id}`
      if (me) {
        const [other] = b.move === 'up'
          ? await sql`SELECT id, position FROM daily_check_tiles WHERE section = ${me.section} AND (position < ${me.position} OR (position = ${me.position} AND id < ${id})) ORDER BY position DESC, id DESC LIMIT 1`
          : await sql`SELECT id, position FROM daily_check_tiles WHERE section = ${me.section} AND (position > ${me.position} OR (position = ${me.position} AND id > ${id})) ORDER BY position ASC, id ASC LIMIT 1`
        if (other) {
          const a = Number(me.position), c = Number(other.position)
          await sql`UPDATE daily_check_tiles SET position = ${a === c ? (b.move === 'up' ? c - 1 : c + 1) : c} WHERE id = ${id}`
          if (a !== c) await sql`UPDATE daily_check_tiles SET position = ${a} WHERE id = ${other.id}`
        }
      }
    }
    return success({ ok: true })
  } catch (e) { return handleError('daily-checks PATCH', e) }
}

// DELETE -- takes the tile off the checklist (past records are kept; it can be restored from the Tile Manager)
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as any)) return badRequest(denied)
  try {
    await sql`UPDATE daily_check_tiles SET active = false WHERE id = ${Number((await params).id)}`
    return success({ ok: true })
  } catch (e) { return handleError('daily-checks DELETE', e) }
}
