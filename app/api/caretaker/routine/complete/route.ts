import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { success, badRequest, unauthorized } from '@/lib/api'
import { canCaretake, caretakerName, ensureCaretakerTables } from '@/lib/caretaker'
import { CHILDREN } from '@/lib/caretakerShared'

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
  let item: { id: number | null; title: string } = { id: null, title: adhocTitle }
  if (routineId) {
    const [r] = await sql`SELECT id, title FROM care_routine WHERE id = ${routineId}`
    if (!r) return badRequest('Unknown routine item')
    item = { id: r.id as number, title: r.title as string }
  }
  const who = caretakerName(session)
  try {
    const inserted = []
    for (const [children, value] of [[done, 'Done'], [notDone, 'Not done']] as const) {
      for (const child of children) {
        const [row] = await sql`
          INSERT INTO care_events (child, kind, value, note, extra, recorded_by)
          VALUES (${child}, 'routine', ${value}, ${note}, ${JSON.stringify(item.id ? { routine_id: item.id, title: item.title } : { adhoc: true, title: item.title })}::jsonb, ${who})
          RETURNING id, child, kind, value, note, photo_url, extra, recorded_by, recorded_at`
        inserted.push(row)
      }
    }
    return success(inserted, 201)
  } catch (e) {
    console.error('routine complete error:', e instanceof Error ? e.message : String(e))
    return success({ error: 'Could not save' }, 500)
  }
}
