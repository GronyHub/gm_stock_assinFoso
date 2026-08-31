import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { effectiveDurationSeconds } from '@/lib/workedDuration'

export const dynamic = 'force-dynamic'

// Backs the "present staff" banner above the mode-switch tabs: shows staff
// who have clocked in today (actual_in set), both currently clocked in
// (actual_out null) and clocked out (actual_out set), along with how much
// of that time was actually spent on recorded work -- summed from today's
// announcements' estimated_duration_seconds (real for live sale taps, a flat
// minute for counts/violation fixes per FLAT_MINUTE_ACTIONS, zero for
// everything else, e.g. a bill/expense entered by hand with no timed
// estimate). Clocked-out staff are shown with reduced opacity and "(out)".
export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const today = new Date().toISOString().slice(0, 10)

    const [present, activity] = await Promise.all([
      sql`
        SELECT staff_name, actual_in, actual_out
        FROM staff_times
        WHERE work_date = ${today} AND staff_name <> '__shop_open__'
          AND actual_in IS NOT NULL
        ORDER BY actual_out ASC NULLS FIRST, staff_name
      `,
      sql`
        SELECT author, category, estimated_duration_seconds
        FROM announcements
        WHERE created_at::date = ${today} AND author IS NOT NULL
      `,
    ])

    // Keyed lowercase -- announcements.author comes from whatever
    // logActivity was passed (some callers prefer session.user.name, others
    // session.user.username, inconsistently across this codebase), while
    // staff_times.staff_name always comes from username (see
    // /api/staff-times/today's own `username ?? name`). Those two aren't
    // guaranteed to be the exact same string, but they're always the same
    // person differing only in case in practice, so an exact-case join here
    // silently matched nobody and always showed 0 worked time.
    const workedSeconds: Record<string, number> = {}
    for (const a of activity as { author: string; category: string | null; estimated_duration_seconds: number | null }[]) {
      const key = a.author.toLowerCase()
      const seconds = effectiveDurationSeconds(a.category, a.estimated_duration_seconds)
      workedSeconds[key] = (workedSeconds[key] ?? 0) + seconds
    }

    const staff = (present as { staff_name: string; actual_in: string; actual_out: string | null }[]).map(r => ({
      staff_name: r.staff_name,
      actual_in: r.actual_in,
      actual_out: r.actual_out,
      worked_seconds: workedSeconds[r.staff_name.toLowerCase()] ?? 0,
    }))

    return success({ staff })
  } catch (e) {
    return handleError('staff-times/worked-today', e)
  }
}
