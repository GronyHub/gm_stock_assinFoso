import { getAuthUser, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensurePenalties, getSettings, totalPoints, TIERS, FADE_DAYS } from '@/lib/penalties'
import { actorKey } from '@/lib/clockState'

const today = () => new Date().toISOString().slice(0, 10)
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)

// GET -- the signed-in person's penalty points: total, band, next level, when the next clean-week reduction comes, and recent entries.
export async function GET() {
  const { user, error } = await getAuthUser()
  if (error) return error
  try {
    await ensurePenalties()
    const me = actorKey(user as any)
    const st = await getSettings()
    const points = await totalPoints(me)
    const entries = await sql`
      SELECT id, points, kind, reason, source, day, counted, status FROM staff_penalties
      WHERE staff = ${me} AND status <> 'reversed' ORDER BY day DESC, id DESC LIMIT 40`
    const [w] = await sql`SELECT COUNT(*)::int AS n FROM staff_penalties WHERE staff = ${me} AND status = 'active' AND NOT counted AND kind = 'violation'`
    const [lr] = await sql`SELECT MAX(day) FILTER (WHERE kind IN ('violation', 'fade') AND counted AND status = 'active') AS last FROM staff_penalties WHERE staff = ${me}`
    const sanctions = await sql`SELECT id, tier, status, days, hours, start_date, end_date FROM penalty_sanctions WHERE staff = ${me} AND status IN ('proposed', 'approved') ORDER BY id DESC LIMIT 3`
    const next = TIERS.find(t => points < t.points) ?? null
    const learning = today() < st.startCounting
    const fadeIn = points > 0 && lr?.last ? Math.max(0, FADE_DAYS - daysBetween(String(lr.last), today())) : null
    return success({ points, learning, countingFrom: st.startCounting, warnings: Number(w?.n ?? 0), next, fadeIn, entries, sanctions })
  } catch (e) { return handleError('penalties me', e) }
}
