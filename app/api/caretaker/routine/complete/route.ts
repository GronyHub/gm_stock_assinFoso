import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { success, badRequest, unauthorized } from '@/lib/api'
import { canCaretake, caretakerName, ensureCaretakerTables } from '@/lib/caretaker'
import { CHILDREN } from '@/lib/caretakerShared'
import { notifyRecord } from '@/lib/careAlerts'

// POST { routine_id, done: string[], not_done?: string[], note? }
// Writes one care_events row per child (value 'Done' or 'Not done'), stamped
// with the server's clock, so every child's own page shows what applied to them.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!(await canCaretake(session))) return badRequest('Not allowed')
  await ensureCaretakerTables()
  const b = await req.json().catch(() => null)
  const routineId = Number(b?.routine_id)
  const adhocTitle = typeof b?.adhoc_title === 'string' ? b.adhoc_title.trim().slice(0, 150) : ''
  const valid = (a: unknown) => Array.isArray(a) ? a.filter((n): n is string => typeof n === 'string' && (CHILDREN as readonly string[]).includes(n)) : []
  const done = valid(b?.done), notDone = valid(b?.not_done).filter(n => !done.includes(n))
  if ((!routineId && !adhocTitle) || done.length + notDone.length === 0) return badRequest('Choose at least one child' + (routineId || adhocTitle ? '' : ' and an activity'))
  const note = b?.note ? String(b.note).slice(0, 500) : null
  // Either a planned tile (routine_id) or an extra, unplanned activity (adhoc_title).
  let plannedTime = '12:00'
  let item: { id: number | null; title: string } = { id: null, title: adhocTitle }
  if (routineId) {
    const [r] = await sql`SELECT id, title, time FROM care_routine WHERE id = ${routineId}`
    if (!r) return badRequest('Unknown routine item')
    item = { id: r.id as number, title: r.title as string }
    plannedTime = r.time as string
  }
  const mins = Math.round(Number(b?.minutes))
  const minutes = mins >= 1 && mins <= 600 ? mins : null
  const support = b?.support === 'alone' || b?.support === 'support' ? b.support : null
  // Optional "it was really done at HH:MM" (not later than now). The tap time stays on the record.
  const nowD = new Date()
  const doneAt = typeof b?.done_at === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(b.done_at) && Number(b.done_at.slice(0, 2)) * 60 + Number(b.done_at.slice(3)) <= nowD.getUTCHours() * 60 + nowD.getUTCMinutes() ? b.done_at : null
  // Back-filling an earlier day (past 31 days): the record is dated that day, at the time done (or the planned time).
  const today = nowD.toISOString().slice(0, 10)
  const pastDate = typeof b?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.date) && b.date < today && Date.parse(b.date) > nowD.getTime() - 31 * 86400000 ? b.date : null
  const recAt = pastDate ? `${pastDate}T${(typeof b?.done_at === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(b.done_at) ? b.done_at : plannedTime)}:00Z` : null
  const doneAtFinal = pastDate && typeof b?.done_at === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(b.done_at) ? b.done_at : doneAt
  const who = caretakerName(session)
  try {
    const inserted = []
    for (const [children, value] of [[done, 'Done'], [notDone, 'Not done']] as const) {
      for (const child of children) {
        const [row] = await sql`
          INSERT INTO care_events (child, kind, value, note, extra, recorded_by, recorded_at)
          VALUES (${child}, 'routine', ${value}, ${note}, ${JSON.stringify({ ...(item.id ? { routine_id: item.id } : { adhoc: true }), title: item.title, ...(minutes ? { minutes } : {}), ...(support ? { support } : {}), ...(doneAtFinal ? { done_at: doneAtFinal } : {}), ...(pastDate ? { backfilled: true } : {}) })}::jsonb, ${who}, COALESCE(${recAt}::timestamptz, now()))
          RETURNING id, child, kind, value, note, photo_url, extra, recorded_by, recorded_at`
        inserted.push(row)
      }
    }
    const parts = [done.length ? `${item.title} done: ${done.join(', ')}` : '', notDone.length ? `${item.title} NOT done: ${notDone.join(', ')}` : ''].filter(Boolean)
    notifyRecord(who, parts.join('; '))
    return success(inserted, 201)
  } catch (e) {
    console.error('routine complete error:', e instanceof Error ? e.message : String(e))
    return success({ error: 'Could not save' }, 500)
  }
}
