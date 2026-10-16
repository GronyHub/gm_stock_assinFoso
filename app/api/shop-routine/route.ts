import { requireAuth, badRequest, getActorName, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensureShopRoutine, ROUTINE_SECTIONS } from '@/lib/shopRoutine'
import { NextRequest } from 'next/server'

// GET -> { tiles, events (today) }
export async function GET() {
  const { error } = await requireAuth()
  if (error) return error
  try {
    await ensureShopRoutine()
    const day = new Date().toISOString().slice(0, 10)
    const tiles = await sql`SELECT id, section, time, title, position FROM shop_routine WHERE active ORDER BY position, id`
    const events = await sql`SELECT id, routine_id, value, note, extra, recorded_by, recorded_at FROM shop_routine_events
      WHERE recorded_at >= ${day + 'T00:00:00Z'}::timestamptz AND recorded_at < (${day + 'T00:00:00Z'}::timestamptz + interval '1 day') ORDER BY recorded_at, id`
    return success({ tiles, events })
  } catch (e) { return handleError('shop-routine GET', e) }
}

// POST { section, title, time? } -- managers only
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if ((session.user as { role?: string })?.role === 'staff') return badRequest('Only managers can change the routine.')
  try {
    await ensureShopRoutine()
    const b = await req.json().catch(() => ({}))
    const title = String(b.title ?? '').trim().slice(0, 200)
    const section = String(b.section ?? '')
    const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(b.time ?? '') ? b.time : null
    if (!title || !(ROUTINE_SECTIONS as readonly string[]).includes(section)) return badRequest('Need a section and a title.')
    const [row] = await sql`INSERT INTO shop_routine (section, time, title, position, created_by)
      VALUES (${section}, ${time}, ${title}, (SELECT COALESCE(MAX(position), 0) + 1 FROM shop_routine), ${getActorName(session)}) RETURNING id`
    return success({ id: row.id }, 201)
  } catch (e) { return handleError('shop-routine POST', e) }
}
