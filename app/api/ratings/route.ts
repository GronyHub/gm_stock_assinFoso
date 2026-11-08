import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensureRatings, scorecard } from '@/lib/ratings'
import { isOwnerLevel } from '@/lib/roles'

// GET (owner and manager) -- everyone's average and count over 30 days, this week's Service Star, and the latest comments.
export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as any)) return badRequest('Only the owner and manager can see this.')
  try {
    await ensureRatings()
    const sc = await scorecard(30)
    const week = await scorecard(7)
    const recent = await sql`SELECT staff, stars, comment, customer, rated_at FROM service_ratings WHERE stars IS NOT NULL ORDER BY rated_at DESC LIMIT 25`
    return success({ month: sc.rows, week: week.rows, star: sc.star, recent })
  } catch (e) { return handleError('ratings GET', e) }
}
