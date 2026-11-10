import { requireAuth, badRequest, getActorName, success, handleError } from '@/lib/api'
import { approveSanction, rejectSanction, canDecideFor } from '@/lib/penalties'
import { isOwnerLevel } from '@/lib/roles'
import { actorKey } from '@/lib/clockState'
import sql from '@/lib/db'
import { NextRequest } from 'next/server'

// POST { action: 'approve' | 'reject', start_date? } -- the owner or manager decides a recommended sanction.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as any)) return badRequest('Only the owner and manager can decide a sanction.')
  try {
    const id = Number((await params).id), who = getActorName(session)
    const b = await req.json().catch(() => ({}))
    const [sn] = await sql`SELECT staff FROM penalty_sanctions WHERE id = ${id}`
    if (sn && !canDecideFor(actorKey(session.user as any), String(sn.staff))) return badRequest('Joe decides for the other staff and Grony decides for Joe. Nobody decides their own.')
    if (b.action === 'approve') { const r = await approveSanction(id, who, b.start_date); return r ? success(r) : badRequest('That sanction was already decided.') }
    if (b.action === 'reject') { await rejectSanction(id, who); return success({ ok: true }) }
    return badRequest('Unknown action.')
  } catch (e) { return handleError('penalties sanction', e) }
}
