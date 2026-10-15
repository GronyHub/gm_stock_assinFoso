import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { success, badRequest, unauthorized } from '@/lib/api'
import { canCaretake, caretakerName, ensureCaretakerTables } from '@/lib/caretaker'
import { CHILDREN } from '@/lib/caretakerShared'

const KINDS = new Set(['wake', 'health', 'meal', 'behaviour', 'school_need', 'homework', 'skin', 'hair', 'activity', 'night', 'house'])

// GET ?date=YYYY-MM-DD  -> that Ghana (UTC) day's events, oldest first.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!canCaretake(session)) return success([], 403)
  await ensureCaretakerTables()
  const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest('Bad date')
  try {
    const rows = await sql`
      SELECT id, child, kind, value, note, photo_url, extra, recorded_by, recorded_at
      FROM care_events
      WHERE recorded_at >= ${date + 'T00:00:00Z'}::timestamptz
        AND recorded_at <  (${date + 'T00:00:00Z'}::timestamptz + interval '1 day')
      ORDER BY recorded_at ASC, id ASC
    `
    return success(rows)
  } catch (e) {
    console.error('caretaker events GET error:', e instanceof Error ? e.message : String(e))
    return success([], 500)
  }
}

// POST { child?, kind, value?, note?, photo_url?, extra? }
// The time is the SERVER's clock (default now()) -- never sent by the client,
// so a record always shows when it was really made. Records are never edited.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!canCaretake(session)) return badRequest('Not allowed')
  await ensureCaretakerTables()
  const b = await req.json().catch(() => null)
  if (!b || !KINDS.has(b.kind)) return badRequest('Unknown record type')
  const child = b.child == null || b.child === '' ? null : String(b.child)
  if (child && !(CHILDREN as readonly string[]).includes(child)) return badRequest('Unknown child')
  const value = b.value == null ? null : String(b.value).slice(0, 120)
  const note = b.note == null || b.note === '' ? null : String(b.note).slice(0, 1000)
  const photo = b.photo_url == null || b.photo_url === '' ? null : String(b.photo_url).slice(0, 500)
  if (photo && !photo.startsWith('/api/caretaker/media?p=')) return badRequest('Bad photo')
  const extra = b.extra && typeof b.extra === 'object' ? JSON.stringify(b.extra) : null
  try {
    const [row] = await sql`
      INSERT INTO care_events (child, kind, value, note, photo_url, extra, recorded_by)
      VALUES (${child}, ${b.kind}, ${value}, ${note}, ${photo}, ${extra}::jsonb, ${caretakerName(session)})
      RETURNING id, child, kind, value, note, photo_url, extra, recorded_by, recorded_at
    `
    return success(row, 201)
  } catch (e) {
    console.error('caretaker events POST error:', e instanceof Error ? e.message : String(e))
    return success({ error: 'Could not save' }, 500)
  }
}
