import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { NextRequest } from 'next/server'
import { once } from '@/lib/once'

// on_break is a lightweight, display-only status flag (drives the red dot
// on PresentStaffBar/StaffTimesView, alongside "clocked out") -- it does NOT
// pause worked-time accrual, which is derived from logged activity
// durations (see /api/staff-times/worked-today), not a continuous clock.
// Self-service only, same as Clock In/Out itself -- staff_name is always the
// session's own username, never a request param, so nobody can toggle
// anyone else's break status.
const ensureBreakCol = once(async () => {
  await sql`ALTER TABLE staff_times ADD COLUMN IF NOT EXISTS on_break BOOLEAN NOT NULL DEFAULT FALSE`.catch(() => {})
})

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { on_break } = await req.json()
  if (typeof on_break !== 'boolean') return badRequest('Missing on_break')

  const sessionUser = session?.user as any
  const username = sessionUser?.username ?? sessionUser?.name
  const today = new Date().toISOString().slice(0, 10)

  await ensureBreakCol()

  try {
    const [existing] = await sql`
      SELECT id, actual_in, actual_out FROM staff_times WHERE staff_name = ${username} AND work_date = ${today}
    `
    if (!existing?.actual_in) return badRequest('Clock in first before taking a break')
    if (existing.actual_out) return badRequest('You have already clocked out for today')

    await sql`UPDATE staff_times SET on_break = ${on_break} WHERE id = ${existing.id}`

    return success({ on_break })
  } catch (e) {
    return handleError('staff-times/break POST', e)
  }
}
