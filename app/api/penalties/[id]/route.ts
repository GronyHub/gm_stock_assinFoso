import { requireAuth, badRequest, getActorName, success, handleError } from '@/lib/api'
import { confirmPending, reversePoint, ensurePenalties } from '@/lib/penalties'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { NextRequest } from 'next/server'

// PATCH { action: 'confirm' | 'dismiss' | 'reverse' } -- decide a pending report, or take a point back (owner and manager).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as any)) return badRequest('Only the owner and manager can do this.')
  try {
    await ensurePenalties()
    const id = Number((await params).id), who = getActorName(session)
    const { action } = await req.json().catch(() => ({}))
    if (action === 'confirm') return success({ ok: await confirmPending(id, who) })
    if (action === 'dismiss') { await sql`UPDATE staff_penalties SET status = 'dismissed', note = ${'Dismissed by ' + who} WHERE id = ${id} AND status = 'pending'`; return success({ ok: true }) }
    if (action === 'reverse') return success({ ok: await reversePoint(id, who) })
    return badRequest('Unknown action.')
  } catch (e) { return handleError('penalties PATCH', e) }
}
