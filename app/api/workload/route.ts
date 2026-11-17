import { NextRequest } from 'next/server'
import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import { actorKey } from '@/lib/clockState'
import { workloadFor } from '@/lib/workload'
import { isOwnerLevel } from '@/lib/roles'

// GET ?date=YYYY-MM-DD -- the workload rule for a day: what each person logged against half of their time at the shop.
// Joe and Grony see everyone; each staff member sees only their own line. A day ahead has nothing to measure.
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest('Bad date')
    if (date > new Date().toISOString().slice(0, 10)) return success({ date, all: false, people: [] })
    const all = isOwnerLevel(session.user as never), me = actorKey(session.user as never)
    const people = (await workloadFor(date)).filter(p => all || p.name === me)
    return success({ date, all, people })
  } catch (e) { return handleError('workload', e) }
}
