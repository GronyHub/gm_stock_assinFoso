import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensureAdhoc, ADHOC_CATEGORY } from '@/lib/dailyChecks'
import { isOwnerLevel } from '@/lib/roles'
import { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ id: string }> }

// PATCH { credited } -- the owner or manager adjusts the work minutes an ad hoc entry earned. DELETE removes the entry and its time.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as any)) return badRequest('Only the owner and manager can adjust this.')
  try {
    await ensureAdhoc()
    const id = Number((await params).id)
    const n = Math.round(Number((await req.json().catch(() => ({}))).credited))
    if (!Number.isFinite(n) || n < 0 || n > 240) return badRequest('Give the minutes, 0 to 240.')
    await sql`UPDATE daily_adhoc SET credited = ${n} WHERE id = ${id}`
    if (n === 0) await sql`DELETE FROM announcements WHERE category = ${ADHOC_CATEGORY} AND source_id = ${id}`
    else await sql`UPDATE announcements SET estimated_duration_seconds = ${n * 60} WHERE category = ${ADHOC_CATEGORY} AND source_id = ${id}`
    return success({ ok: true })
  } catch (e) { return handleError('daily-checks adhoc PATCH', e) }
}
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as any)) return badRequest('Only the owner and manager can remove this.')
  try {
    await ensureAdhoc()
    const id = Number((await params).id)
    await sql`DELETE FROM announcements WHERE category = ${ADHOC_CATEGORY} AND source_id = ${id}`
    await sql`DELETE FROM daily_adhoc WHERE id = ${id}`
    return success({ ok: true })
  } catch (e) { return handleError('daily-checks adhoc DELETE', e) }
}
