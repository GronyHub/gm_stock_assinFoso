import { NextRequest } from 'next/server'
import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import { actorKey } from '@/lib/clockState'
import { addDays, dayKey } from '@/lib/dailyChecksShared'
import sql from '@/lib/db'
import { clearMyDayCache } from '@/lib/myDay'
import { canConfirmTick, ensureTicks } from '@/lib/ticks'

// Tasks whose law says a supervisor must confirm they were really done. Joe confirms what the staff did; the owner confirms Joe's. Nobody confirms their own.
const canConfirm = (me: string, by: string) => by !== me && (me === 'joe' ? by !== 'grony' : me === 'grony' ? by === 'joe' : false)

type Row = { id: number; tile_id: number; title: string; day: string; recorded_by: string; recorded_at: string; note: string | null }

// GET -- the ticks waiting for the signed-in supervisor (today and yesterday).
export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    const me = actorKey(session.user as never).toLowerCase()
    const rows = await sql`SELECT e.id, e.tile_id, t.title, e.day, e.recorded_by, e.recorded_at, e.note FROM daily_check_events e JOIN daily_check_tiles t ON t.id = e.tile_id
      WHERE e.extra->>'confirm' = 'pending' AND e.day >= ${addDays(dayKey(), -1)} ORDER BY e.day DESC, e.recorded_at DESC LIMIT 100` as unknown as Row[]
    // Weekly ticks (for example "TikTok live video") waiting for a supervisor come in the same list, with a negative id.
    await ensureTicks()
    const tk = await sql`SELECT t.id, t.item, t.week_start, t.staff, t.recorded_at::text AS recorded_at, l.text AS law FROM target_ticks t JOIN page_laws l ON l.id = t.law_id
      WHERE t.status = 'pending' AND t.week_start >= ${addDays(dayKey(), -13)} ORDER BY t.recorded_at DESC LIMIT 100` as unknown as { id: number; item: string; week_start: string; staff: string; recorded_at: string; law: string }[]
    const tickRows: Row[] = tk.map(t => ({ id: -t.id, tile_id: 0, title: `${t.item} (week of ${t.week_start}). Confirm it was really posted or done.`, day: t.recorded_at.slice(0, 10), recorded_by: t.staff, recorded_at: t.recorded_at.replace(' ', 'T'), note: null }))
    return success({ rows: [...rows, ...tickRows].filter(r => canConfirm(me, String(r.recorded_by).toLowerCase())) })
  } catch (e) { return handleError('daily-checks confirm GET', e) }
}

// POST { id, ok, note } -- confirm it was done, or say it was not (a note is needed): the task goes back to waiting, with no point for it.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    const me = actorKey(session.user as never).toLowerCase()
    const b = await req.json().catch(() => ({}))
    const id = Number(b.id), ok = !!b.ok, note = String(b.note ?? '').trim().slice(0, 300)
    if (!id) return badRequest('Which task?')
    if (id < 0) {
      await ensureTicks()
      const [t] = await sql`SELECT id, staff, status FROM target_ticks WHERE id = ${-id}`
      if (!t || t.status !== 'pending') return badRequest('That one is not waiting for confirmation.')
      if (!canConfirmTick(me, String(t.staff).toLowerCase())) return badRequest('You cannot confirm this one.')
      if (!ok && note.length < 4) return badRequest('Write what was not done.')
      await sql`UPDATE target_ticks SET status = ${ok ? 'confirmed' : 'rejected'}, decided_by = ${me}, decided_at = now(), note = ${ok ? null : note} WHERE id = ${-id}`
      clearMyDayCache()
      return success({ ok: true })
    }
    const [ev] = await sql`SELECT id, recorded_by, extra FROM daily_check_events WHERE id = ${id}`
    if (!ev || ev.extra?.confirm !== 'pending') return badRequest('That one is not waiting for confirmation.')
    if (!canConfirm(me, String(ev.recorded_by).toLowerCase())) return badRequest('You cannot confirm this one.')
    if (!ok && note.length < 4) return badRequest('Write what was not done.')
    const patch = ok ? { confirm: 'confirmed', confirmed_by: me, confirmed_at: new Date().toISOString() } : { confirm: 'rejected', rejected_by: me, reject_note: note, rejected_at: new Date().toISOString() }
    await sql`UPDATE daily_check_events SET extra = COALESCE(extra, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb WHERE id = ${id}`
    clearMyDayCache()
    return success({ ok: true })
  } catch (e) { return handleError('daily-checks confirm POST', e) }
}
