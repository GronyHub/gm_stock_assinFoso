import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { effectiveDurationSeconds } from '@/lib/workedDuration'

export const dynamic = 'force-dynamic'

// Backs the "present staff" banner above the mode-switch tabs: who's
// currently clocked in (actual_in set, actual_out not yet set today) and
// how much of that time was actually spent on recorded work -- summed from
// today's announcements' estimated_duration_seconds (real for live sale
// taps, a flat minute for counts/violation fixes per FLAT_MINUTE_ACTIONS
// above, zero for everything else, e.g. a bill/expense entered by hand with
// no timed estimate).
export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const today = new Date().toISOString().slice(0, 10)

    const [present, activity] = await Promise.all([
      sql`
        SELECT staff_name, actual_in
        FROM staff_times
        WHERE work_date = ${today} AND staff_name <> '__shop_open__'
          AND actual_in IS NOT NULL AND actual_out IS NULL
        ORDER BY staff_name
      `,
      sql`
        SELECT author, category, estimated_duration_seconds
        FROM announcements
        WHERE created_at::date = ${today} AND author IS NOT NULL
      `,
    ])

    const workedSeconds: Record<string, number> = {}
    for (const a of activity as { author: string; category: string | null; estimated_duration_seconds: number | null }[]) {
      const seconds = effectiveDurationSeconds(a.category, a.estimated_duration_seconds)
      workedSeconds[a.author] = (workedSeconds[a.author] ?? 0) + seconds
    }

    const staff = (present as { staff_name: string; actual_in: string }[]).map(r => ({
      staff_name: r.staff_name,
      actual_in: r.actual_in,
      worked_seconds: workedSeconds[r.staff_name] ?? 0,
    }))

    return success({ staff })
  } catch (e) {
    return handleError('staff-times/worked-today', e)
  }
}
