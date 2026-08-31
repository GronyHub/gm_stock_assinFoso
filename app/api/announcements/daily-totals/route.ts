import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { effectiveDurationSeconds } from '@/lib/workedDuration'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

// Backs Home's Total column -- a running cumulative sum of a staff member's
// own effectiveDurationSeconds for the day, in chronological order (their
// very first post of the day carries just its own duration; each post
// after that adds its duration on top of the running total so far). Keyed
// by announcement id rather than author, since the client's feed shows
// newest-first while this accumulates oldest-first -- each row just looks
// up its own id's running total, regardless of which order the table
// happens to render them in.
//
// Computed straight from the full announcements table for one calendar day
// at a time (?date=YYYY-MM-DD, interpreted as GMT to match created_at::date,
// same as staff_times) rather than summed from the client's own `posts`
// list, which is only ever a paginated window (the latest 30, or however
// many "load more" has pulled in) -- summing that alone under-counted a
// busy staff member's day until every one of today's announcements
// happened to have been scrolled into view.
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  const date = req.nextUrl.searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest('date must be YYYY-MM-DD')

  try {
    const rows = await sql`
      SELECT id, author, category, estimated_duration_seconds
      FROM announcements
      WHERE created_at::date = ${date} AND author IS NOT NULL
      ORDER BY author, created_at ASC, id ASC
    ` as { id: number; author: string; category: string | null; estimated_duration_seconds: number | null }[]

    const runningByAuthor: Record<string, number> = {}
    const runningTotals: Record<number, number> = {}
    for (const r of rows) {
      const seconds = effectiveDurationSeconds(r.category, r.estimated_duration_seconds)
      const total = (runningByAuthor[r.author] ?? 0) + seconds
      runningByAuthor[r.author] = total
      runningTotals[r.id] = total
    }

    return success(runningTotals)
  } catch (e) {
    return handleError('announcements/daily-totals', e)
  }
}
