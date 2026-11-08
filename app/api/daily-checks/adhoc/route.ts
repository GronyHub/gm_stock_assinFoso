import { requireAuth, badRequest, getActorName, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { dayKey, ensureAdhoc, ADHOC_CATEGORY, ADHOC_DAILY_CAP_MIN, ADHOC_ENTRY_MAX_MIN } from '@/lib/dailyChecks'
import { LAW_CATEGORIES } from '@/lib/lawCategories'
import { getClockState, actorKey } from '@/lib/clockState'
import { NextRequest } from 'next/server'

// POST { category, note, minutes?, photo_url? } -- an ad hoc activity: work that was not slated for the day. It is saved
// under its category and adds its minutes to the person's work time, up to a daily cap (the owner can adjust it).
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await ensureAdhoc()
    const clock = await getClockState(dayKey())
    if ((session.user as { role?: string })?.role !== 'owner' && !clock.present.includes(actorKey(session.user as any))) {
      return badRequest('Clock in first. You can log work only while you are clocked in at the shop.')
    }
    const b = await req.json().catch(() => ({}))
    const category = String(b.category ?? '')
    if (!LAW_CATEGORIES.some(c => c.key === category)) return badRequest('Choose a category.')
    const note = String(b.note ?? '').trim().slice(0, 600)
    if (note.length < 4) return badRequest('Write what you did.')
    const asked = Math.round(Number(b.minutes))
    const minutes = Number.isFinite(asked) ? Math.min(Math.max(asked, 1), ADHOC_ENTRY_MAX_MIN) : 10
    const photo = typeof b.photo_url === 'string' && b.photo_url ? String(b.photo_url).slice(0, 500) : null
    const who = getActorName(session), day = dayKey()
    const [{ used }] = await sql`SELECT COALESCE(SUM(credited), 0)::int AS used FROM daily_adhoc WHERE day = ${day} AND LOWER(recorded_by) = LOWER(${who})`
    const credited = Math.max(0, Math.min(minutes, ADHOC_DAILY_CAP_MIN - Number(used)))
    const [row] = await sql`INSERT INTO daily_adhoc (day, category, note, photo_url, minutes, credited, recorded_by) VALUES (${day}, ${category}, ${note}, ${photo}, ${minutes}, ${credited}, ${who})
      RETURNING id, day, category, note, photo_url, minutes, credited, recorded_by, recorded_at`
    if (credited > 0) {
      await sql`INSERT INTO announcements (body, author, media_urls, category, estimated_duration_seconds, source_id)
        VALUES (${`Ad hoc (${category}): ${note}`}, ${who}, '[]'::jsonb, ${ADHOC_CATEGORY}, ${credited * 60}, ${row.id})`.catch(() => {})
    }
    return success({ ...row, capped: credited < minutes }, 201)
  } catch (e) { return handleError('daily-checks adhoc POST', e) }
}
