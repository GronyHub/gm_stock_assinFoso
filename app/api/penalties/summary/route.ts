import { getAuthUser, success, handleError } from '@/lib/api'
import { ensurePenalties, totalPoints } from '@/lib/penalties'
import { SIGNERS } from '@/lib/signers'

// GET -- every staff member's penalty points so far, for the staff bar at the top (everyone can see it).
export async function GET() {
  const { error } = await getAuthUser()
  if (error) return error
  try {
    await ensurePenalties()
    const points: Record<string, number> = {}
    for (const n of SIGNERS) points[n] = await totalPoints(n)
    return success({ points })
  } catch (e) { return handleError('penalties summary', e) }
}
