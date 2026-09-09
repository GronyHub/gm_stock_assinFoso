import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { effectiveDurationSeconds } from '@/lib/workedDuration'
import { getActivityDurationOverrides } from '@/lib/activityDurations'
import { once } from '@/lib/once'

export const dynamic = 'force-dynamic'

// See /api/staff-times/break's own comment -- on_break is a lightweight,
// display-only flag, ensured independently here (same duplicated-per-route
// pattern already used for in_source/out_source/opening_count_confirmed
// across the other staff-times routes) so this route works even if break's
// own route hasn't run first in this process.
const ensureBreakCol = once(async () => {
  await sql`ALTER TABLE staff_times ADD COLUMN IF NOT EXISTS on_break BOOLEAN NOT NULL DEFAULT FALSE`.catch(() => {})
})

// Backs PresentStaffBar: shows every active staff member (see the `roster`
// prop, sourced from /api/staff/status), not just today's clocked-in ones --
// this route itself still only returns who's clocked in today (actual_in
// set), both currently clocked in (actual_out null) and clocked out (actual_out
// set); PresentStaffBar merges that against the full roster client-side to
// mark anyone missing here as absent. Also carries how much of a present
// person's time was actually spent on recorded work -- summed from today's
// announcements' estimated_duration_seconds (real for live sale taps, an
// owner-configurable default -- see lib/activityDurations.ts -- for
// everything else, e.g. a bill/expense entered by hand with no timed
// estimate). on_break is a separate, purely-display status flag (see
// /api/staff-times/break) -- it doesn't affect this worked-time math at all.
export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  await ensureBreakCol()

  try {
    const today = new Date().toISOString().slice(0, 10)

    const [present, activity, durationOverrides] = await Promise.all([
      sql`
        SELECT staff_name, actual_in, actual_out, on_break
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
      getActivityDurationOverrides(),
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
      const seconds = effectiveDurationSeconds(a.category, a.estimated_duration_seconds, durationOverrides)
      workedSeconds[key] = (workedSeconds[key] ?? 0) + seconds
    }

    const staff = (present as { staff_name: string; actual_in: string; actual_out: string | null; on_break: boolean }[]).map(r => ({
      staff_name: r.staff_name,
      actual_in: r.actual_in,
      actual_out: r.actual_out,
      on_break: r.on_break,
      worked_seconds: workedSeconds[r.staff_name.toLowerCase()] ?? 0,
    }))

    return success({ staff })
  } catch (e) {
    return handleError('staff-times/worked-today', e)
  }
}
