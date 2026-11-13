import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { actorKey } from '@/lib/clockState'
import { myDay } from '@/lib/myDay'

// GET -- the signed-in person's checklist tasks that are due now or overdue (the same list as their Waiting for team view), with each tile's kind, for the "It's time for..." prompt.
export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    const me = actorKey(session.user as never)
    const items = await myDay(me, session.user, {})
    const due = items.filter(i => /^task-\d+$/.test(i.key)).map(i => ({ id: Number(i.key.slice(5)), title: i.title, time: i.time ?? null }))
    if (!due.length) return success({ due: [] })
    const kinds = await sql`SELECT id, kind FROM daily_check_tiles WHERE id = ANY(${due.map(d => d.id)})` as unknown as { id: number; kind: string }[]
    const k = new Map(kinds.map(r => [Number(r.id), String(r.kind)]))
    return success({ due: due.map(d => ({ ...d, kind: k.get(d.id) ?? 'tap' })) })
  } catch (e) { return handleError('due now', e) }
}
