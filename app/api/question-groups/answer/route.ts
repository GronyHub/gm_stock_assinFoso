import { requireAuth, badRequest, success, handleError, getActorName } from '@/lib/api'
import sql from '@/lib/db'
import { ensureDailyChecks, dayKey, creditWork } from '@/lib/dailyChecks'
import { getClockState, actorKey } from '@/lib/clockState'
import { suspendedMessage } from '@/lib/penalties'
import { recordActivity } from '@/lib/logger'
import { clearMyDayCache } from '@/lib/myDay'
import { groupForTile, saveAnswers, bridgeClosing, type AnswerIn } from '@/lib/questionGroups'
import { lockStateForManager } from '@/lib/managerLock'
import { isOwnerLevel } from '@/lib/roles'
import { isManagerName } from '@/lib/signers'
import { notifyManagement } from '@/lib/checklistAlerts'
import { NextRequest } from 'next/server'

// POST { tile_id, answers: [{ item_id, answer, detail? }] } -- answers for today. When every required question has an answer the tile is recorded as done (once); answers can be changed afterwards.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await ensureDailyChecks()
    const me = actorKey(session.user as never), isOwner = (session.user as { role?: string })?.role === 'owner'
    const b = await req.json().catch(() => ({}))
    // The manager may answer the previous working day's closing questions (the block asks for exactly that); every other answer is for today.
    const lock = me === 'joe' && !isOwner && b.day ? await lockStateForManager(undefined, true) : null
    const forLockDay = !!lock?.questions && b.day === lock.day
    const day = forLockDay ? String(b.day) : dayKey(), clock = await getClockState(dayKey())
    if (!isOwner && !forLockDay && !clock.present.includes(me)) return badRequest('Clock in first. You can answer only while you are clocked in at the shop.')
    { const msg = await suspendedMessage(me, day); if (!isOwner && msg) return badRequest(msg) }
    const g = await groupForTile(Number(b.tile_id))
    if (!g) return badRequest('Unknown question group.')
    { const [tl] = await sql`SELECT assignment FROM daily_check_tiles WHERE id = ${g.tile_id}`
      if (tl?.assignment === 'managers' && !isOwner && !isOwnerLevel(session.user as never) && !isManagerName(me)) return badRequest('This one is for the manager. Ask Joe or Bino.') }
    const actor = getActorName(session)
    let complete = false
    const ansIn = Array.isArray(b.answers) ? b.answers as AnswerIn[] : []
    try { complete = (await saveAnswers(g, day, actor, ansIn)).complete } catch (e) { return badRequest(e instanceof Error ? e.message : 'Could not save.') }
    if (complete) {
      const [have] = await sql`SELECT id FROM daily_check_events WHERE tile_id = ${g.tile_id} AND day = ${day} AND value = 'Done' LIMIT 1`
      if (!have) {
      // A "yes, something happened" answer with its explanation (lost property, an unfortunate event, a new customer...) is told to the owner and Joe straight away.
      for (const a of ansIn) {
        const it = g.items.find(i => i.id === Number(a.item_id))
        if (it && it.kind === 'yesno' && it.detail_on && String(a.answer) === it.detail_on && String(a.detail ?? '').trim().length >= 3) void notifyManagement(me, `${g.name}: ${it.text.slice(0, 60)}`, `${actor}: ${String(a.detail).trim().slice(0, 140)}`)
      }
        const [row] = await sql`INSERT INTO daily_check_events (tile_id, day, value, note, extra, recorded_by) VALUES (${g.tile_id}, ${day}, 'Done', NULL, ${JSON.stringify({ group: g.id })}::jsonb, ${actor}) RETURNING id`
        void recordActivity(actor, 'answered a question group', g.name.slice(0, 120))
        await creditWork(actor, g.name, Number(g.minutes ?? 5), Number(row.id))
      }
      await bridgeClosing(day).catch(e => console.error('closing bridge failed:', e instanceof Error ? e.message : String(e)))
    }
    clearMyDayCache()
    return success({ complete })
  } catch (e) { return handleError('question group answer', e) }
}
