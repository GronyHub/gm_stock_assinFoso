import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import { isOwnerLevel } from '@/lib/roles'
import { actorKey } from '@/lib/clockState'
import { setSetting, timesDisplay } from '@/lib/shopSettings'
import { EVER_STAFF } from '@/lib/staffList'
import { NextRequest } from 'next/server'

// GET -- the shop-wide display settings everyone's pages follow. PATCH { times: { hidden: [names], hideEmpty } } -- the owner and Joe set them.
export async function GET() {
  const { error } = await requireAuth()
  if (error) return error
  try { return success({ times: await timesDisplay() }) } catch (e) { return handleError('shop-settings GET', e) }
}
export async function PATCH(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as never)) return badRequest('Only the owner and Joe change what the team sees.')
  try {
    const b = await req.json().catch(() => ({}))
    const hidden = (Array.isArray(b.times?.hidden) ? b.times.hidden : []).map((x: unknown) => String(x).toLowerCase()).filter((x: string) => EVER_STAFF.includes(x))
    await setSetting('times_display', { hidden, hideEmpty: !!b.times?.hideEmpty }, actorKey(session.user as never))
    return success({ times: await timesDisplay() })
  } catch (e) { return handleError('shop-settings PATCH', e) }
}
