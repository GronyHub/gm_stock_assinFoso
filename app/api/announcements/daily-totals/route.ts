import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { effectiveDurationSeconds } from '@/lib/workedDuration'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

// Backs Home's Total column -- the client's own `posts` list is only ever a
// paginated window (the latest 30, or however many "load more" has pulled
// in), so summing durations from it alone under-counts a busy staff
// member's day until every one of today's announcements happens to have
// been scrolled into view. This computes the real total straight from the
// full announcements table for one calendar day at a time (?date=YYYY-MM-DD,
// interpreted as GMT to match created_at::date, same as staff_times), so it
// stays correct regardless of how much of the feed the client has loaded.
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  const date = req.nextUrl.searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest('date must be YYYY-MM-DD')

  try {
    const rows = await sql`
      SELECT author, category, estimated_duration_seconds
      FROM announcements
      WHERE created_at::date = ${date} AND author IS NOT NULL
    ` as { author: string; category: string | null; estimated_duration_seconds: number | null }[]

    const totals: Record<string, number> = {}
    for (const r of rows) {
      const seconds = effectiveDurationSeconds(r.category, r.estimated_duration_seconds)
      totals[r.author] = (totals[r.author] ?? 0) + seconds
    }

    return success(totals)
  } catch (e) {
    return handleError('announcements/daily-totals', e)
  }
}
