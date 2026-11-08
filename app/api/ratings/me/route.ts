import { getAuthUser, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensureRatings, scorecard } from '@/lib/ratings'
import { actorKey } from '@/lib/clockState'

// GET -- my customer ratings: average and count over 30 days, the recent comments, and whether I am this week's Service Star.
export async function GET() {
  const { user, error } = await getAuthUser()
  if (error) return error
  try {
    await ensureRatings()
    const me = actorKey(user as any)
    const sc = await scorecard(30)
    const mine = sc.rows.find(r => r.staff === me) ?? null
    const recent = await sql`SELECT stars, comment, rated_at FROM service_ratings WHERE staff = ${me} AND stars IS NOT NULL ORDER BY rated_at DESC LIMIT 8`
    return success({ n: mine?.n ?? 0, avg: mine?.avg ?? null, low: mine?.low ?? 0, star: sc.star === me, recent })
  } catch (e) { return handleError('ratings me', e) }
}
