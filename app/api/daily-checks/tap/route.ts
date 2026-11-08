import { requireAuth, badRequest, getActorName, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensureDailyChecks, dayKey, creditWork } from '@/lib/dailyChecks'
import { ensureManageLogs } from '@/lib/manageLogs'
import { notifyOwners } from '@/lib/checklistAlerts'
import { getClockState, actorKey } from '@/lib/clockState'
import { NextRequest } from 'next/server'

const HM = /^([01]\d|2[0-3]):[0-5]\d$/

// POST { tile_id, value?: 'Done' | 'Not done', done_at?, note?, answer?, persons?, about_staff?, photo_url? }
// Always recorded for today, with the server's clock and the signed-in person's name. Question, person and entry
// tiles carry their answer in `extra` and are also written into the matching Grony Manage log, so those pages keep
// their history. Only someone clocked in at the shop can tick tasks (the owner is exempt).
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await ensureDailyChecks()
    const clock = await getClockState(dayKey())
    if ((session.user as { role?: string })?.role !== 'owner' && !clock.present.includes(actorKey(session.user as any))) {
      return badRequest('Clock in first. You can tick tasks only while you are clocked in at the shop.')
    }
    const b = await req.json().catch(() => ({}))
    const id = Number(b.tile_id)
    const [t] = await sql`SELECT id, title, minutes, kind, log_category, needs_photo, section FROM daily_check_tiles WHERE id = ${id} AND active`
    if (!t) return badRequest('Unknown tile.')
    const actor = getActorName(session)
    const now = new Date()
    const doneAt = typeof b.done_at === 'string' && HM.test(b.done_at) && Number(b.done_at.slice(0, 2)) * 60 + Number(b.done_at.slice(3)) <= now.getUTCHours() * 60 + now.getUTCMinutes() ? b.done_at : null
    const extra: Record<string, unknown> = doneAt ? { done_at: doneAt } : {}
    let note: string | null = b.note ? String(b.note).slice(0, 500) : null
    const photo = typeof b.photo_url === 'string' && b.photo_url ? String(b.photo_url).slice(0, 500) : null
    const aboutStaff = typeof b.about_staff === 'string' && b.about_staff.trim() ? String(b.about_staff).trim().slice(0, 60) : null
    const logs: { notes: string | null; photo: string | null; about: string | null }[] = []
    let problem = ''

    if (b.value !== 'Not done') {
      if (t.kind === 'question') {
        const answer = b.answer === 'issue' ? 'issue' : 'ok'
        extra.answer = answer
        if (answer === 'issue') {
          if (!note) return badRequest('Write what happened.')
          if (t.log_category === 'team_behaviour_log' && !aboutStaff) return badRequest('Choose the staff member.')
          if (aboutStaff) extra.about_staff = aboutStaff
          if (photo) extra.photo_url = photo
          logs.push({ notes: note, photo, about: aboutStaff }); problem = note
        }
      } else if (t.kind === 'persons') {
        const persons = (b.persons && typeof b.persons === 'object') ? b.persons as Record<string, string> : {}
        const clean: Record<string, 'ok' | 'not'> = {}
        for (const name of clock.present) { if (persons[name] !== 'ok' && persons[name] !== 'not') return badRequest('Mark every person who is at work.'); clean[name] = persons[name] as 'ok' | 'not' }
        extra.persons = clean
        for (const [name, v] of Object.entries(clean)) if (v === 'not') { logs.push({ notes: `${t.title.split(':')[0]}: not complying${note ? ` (${note})` : ''}`, photo: null, about: name }); problem += `${problem ? ', ' : ''}${name}` }
        if (problem) problem = `Not wearing: ${problem}`
      } else if (t.kind === 'entry') {
        if (!note && !photo) return badRequest('Write a note or add a photo.')
        if (t.needs_photo && !photo) return badRequest('A photo is needed for this one.')
        if (photo) extra.photo_url = photo
        logs.push({ notes: note, photo, about: null })
      }
    }

    const [row] = await sql`INSERT INTO daily_check_events (tile_id, day, value, note, extra, recorded_by)
      VALUES (${id}, ${dayKey(now)}, ${b.value === 'Not done' ? 'Not done' : 'Done'}, ${note},
              ${JSON.stringify(extra)}::jsonb, ${actor})
      RETURNING id, tile_id, day, value, note, extra, recorded_by, recorded_at`

    // Mirror into the Grony Manage log that matches this tile, so that page's history keeps filling.
    if (t.log_category && logs.length) {
      try {
        await ensureManageLogs()
        for (const l of logs) {
          await sql`INSERT INTO manage_logs (category, notes, photo_url, logged_by, about_staff) VALUES (${t.log_category}, ${l.notes}, ${l.photo}, ${actor}, ${l.about})`
        }
      } catch (e) { console.error('daily-checks mirror to manage_logs failed:', e instanceof Error ? e.message : String(e)) }
    }
    if (problem) void notifyOwners(`Checklist: ${String(t.title).split(':')[0]}`, `${actor} reported: ${problem}`)
    if (row.value === 'Done') await creditWork(actor, String(t.title), Number(t.minutes ?? 5), Number(row.id))
    return success(row, 201)
  } catch (e) { return handleError('daily-checks tap', e) }
}
