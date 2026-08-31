import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { effectiveDurationSeconds } from '@/lib/workedDuration'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

// Backs the time-details modal opened by tapping a name in PresentStaffBar
// -- one staff member's own activity for one day, itemized, plus their
// clock-in/out for that day. `staff` is matched case-insensitively against
// announcements.author, same reasoning as /api/staff-times/worked-today's
// own lowercase join (staff_times.staff_name and announcements.author can
// differ only in case for the same person -- see that route's comment).
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  const staff = req.nextUrl.searchParams.get('staff')
  if (!staff) return badRequest('staff is required')
  const date = req.nextUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest('date must be YYYY-MM-DD')

  try {
    const [rowsRaw, [times]] = await Promise.all([
      sql`
        SELECT id, body, category, estimated_duration_seconds, created_at
        FROM announcements
        WHERE created_at::date = ${date} AND LOWER(author) = LOWER(${staff})
        ORDER BY created_at ASC, id ASC
      `,
      sql`
        SELECT actual_in, actual_out
        FROM staff_times
        WHERE work_date = ${date} AND LOWER(staff_name) = LOWER(${staff})
      `,
    ])
    const rows = rowsRaw as unknown as { id: number; body: string; category: string | null; estimated_duration_seconds: number | null; created_at: string }[]

    let runningTotal = 0
    const activity = rows.map(r => {
      const durationSeconds = effectiveDurationSeconds(r.category, r.estimated_duration_seconds)
      runningTotal += durationSeconds
      return {
        id: r.id, body: r.body, created_at: r.created_at,
        duration_seconds: durationSeconds, running_total_seconds: runningTotal,
      }
    }).reverse() // newest-first, matching Home's own feed order

    return success({
      staff, date,
      actual_in: times?.actual_in ?? null,
      actual_out: times?.actual_out ?? null,
      total_seconds: runningTotal,
      activity,
    })
  } catch (e) {
    return handleError('staff-times/worked-detail', e)
  }
}
