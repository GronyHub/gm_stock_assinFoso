import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensureDailyChecks } from '@/lib/dailyChecks'
import { isOwnerLevel } from '@/lib/roles'

// GET -- every tile, stopped ones too, with when each was last done (for the Tile Manager). Owner and manager only.
export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as any)) return badRequest('Only the owner and manager can change the checklist.')
  try {
    await ensureDailyChecks()
    const tiles = await sql`
      SELECT t.id, t.section, t.time, t.title, t.icon, t.how, t.kind, t.prop_filter, t.frequency, t.weekday, t.position, t.minutes, t.days,
             t.ask, t.ok_label, t.issue_label, t.log_category, t.needs_photo, t.active, t.category, t.subcategory, t.law_id,
             (SELECT MAX(e.day) FROM daily_check_events e WHERE e.tile_id = t.id AND e.value = 'Done') AS last_done
      FROM daily_check_tiles t ORDER BY t.section, t.position, t.id`
    return success({ tiles })
  } catch (e) { return handleError('daily-checks tiles GET', e) }
}
