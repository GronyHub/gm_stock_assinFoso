import { requireAuth, badRequest, getActorName, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { ensureStandardsTables, periodKeys, FREQUENCIES } from '@/lib/standards'
import { NextRequest } from 'next/server'

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error
  try {
    await ensureStandardsTables()
    const k = periodKeys()
    // Not cached: a tick must show up for everyone immediately.
    const rows = await sql`
      SELECT i.id, i.station, i.section, i.section_note, i.position, i.text, i.how, i.tag, i.frequency, i.kind,
             t.ticked_by, t.ticked_at
      FROM standards_items i
      LEFT JOIN standards_ticks t ON t.item_id = i.id AND t.period_key = CASE i.frequency
        WHEN 'daily' THEN ${k.daily} WHEN 'weekly' THEN ${k.weekly} WHEN 'monthly' THEN ${k.monthly}
        WHEN 'yearly' THEN ${k.yearly} ELSE ${k.once} END
      WHERE i.active
      ORDER BY i.id`
    return success(rows)
  } catch (e) {
    return handleError('standards GET', e)
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if ((session.user as { role?: string })?.role === 'staff') return badRequest('Only managers can add standards.')
  try {
    await ensureStandardsTables()
    const b = await req.json()
    const text = String(b.text ?? '').trim()
    const station = String(b.station ?? '').trim()
    const section = String(b.section ?? '').trim()
    const frequency = String(b.frequency ?? 'daily')
    if (!text || !station || !section) return badRequest('Station, section and text are required.')
    if (!(FREQUENCIES as readonly string[]).includes(frequency)) return badRequest('Invalid frequency.')
    const [row] = await sql`
      INSERT INTO standards_items (station, section, text, how, tag, frequency)
      VALUES (${station}, ${section}, ${text}, ${String(b.how ?? '').trim() || null}, ${String(b.tag ?? '').trim() || null}, ${frequency})
      RETURNING id`
    await logActivity(getActorName(session), 'added standard', `${station} / ${section}: ${text.slice(0, 80)}`)
    return success({ id: row.id }, 201)
  } catch (e) {
    return handleError('standards POST', e)
  }
}
