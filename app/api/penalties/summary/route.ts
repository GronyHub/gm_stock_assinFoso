import { getAuthUser, success, handleError } from '@/lib/api'
import { ensurePenalties, totalPoints, isCounting } from '@/lib/penalties'
import sql from '@/lib/db'
import { SIGNERS } from '@/lib/signers'

// GET -- every staff member's penalty points so far, for the staff bar at the top (everyone can see it).
export async function GET() {
  const { error } = await getAuthUser()
  if (error) return error
  try {
    await ensurePenalties()
    const points: Record<string, number> = {}
    // During the pilot the bar shows the pilot points, the same numbers as the Penalty Points page (counted points are all 0 until counting starts).
    const pilot = !(await isCounting())
    for (const n of SIGNERS) {
      if (!pilot) { points[n] = await totalPoints(n); continue }
      const [r] = await sql`SELECT COALESCE(SUM(points), 0)::int AS t FROM staff_penalties WHERE staff = ${n} AND status = 'active' AND NOT counted AND kind = 'violation'`
      points[n] = Number(r?.t ?? 0)
    }
    return success({ points, pilot })
  } catch (e) { return handleError('penalties summary', e) }
}
