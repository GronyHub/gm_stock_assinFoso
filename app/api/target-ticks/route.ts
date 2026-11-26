import { NextRequest } from 'next/server'
import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import { actorKey } from '@/lib/clockState'
import sql from '@/lib/db'
import { clearMyDayCache } from '@/lib/myDay'
import { ensureTicks, itemsOf, tickLaws, thisWeek } from '@/lib/ticks'

// POST { lawId, item } -- the signed-in person says they did it this week (for example posted the TikTok live video). A supervisor then confirms it.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    const me = actorKey(session.user as never).toLowerCase()
    const b = await req.json().catch(() => ({}))
    const lawId = Number(b.lawId), item = String(b.item ?? '').trim()
    if (b.for && String(b.for).toLowerCase() !== me) return badRequest(`This one is for ${String(b.for)} to tick.`)
    const law = (await tickLaws()).find(l => l.id === lawId)
    if (!law || !itemsOf(law).includes(item)) return badRequest('That is not one of the things to tick.')
    await ensureTicks()
    const ws = thisWeek()
    // A tick that was sent back can be ticked again; one that is waiting or confirmed stays as it is.
    await sql`INSERT INTO target_ticks (law_id, staff, week_start, item, status) VALUES (${lawId}, ${me}, ${ws}, ${item}, 'pending')
      ON CONFLICT (law_id, staff, week_start, item) DO UPDATE SET status = 'pending', recorded_at = now(), note = NULL WHERE target_ticks.status = 'rejected'`
    clearMyDayCache()
    return success({ ok: true })
  } catch (e) { return handleError('target-ticks POST', e) }
}
