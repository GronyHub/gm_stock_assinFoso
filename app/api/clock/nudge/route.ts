import { requireAuth, success, badRequest, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { actorKey } from '@/lib/clockState'
import { ensureAttendance } from '@/lib/attendance'
import { pushToUsers } from '@/lib/checklistAlerts'
import { NextRequest } from 'next/server'

// POST { what?: string } -- Grony is in the UK, so Joe does the checking at the shop. Grony taps this to prompt Joe to do what is waiting
// (CCTV reviews, clock-out times) or any task she names. Joe gets a push with the list.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (actorKey(session.user as any) !== 'grony') return badRequest('Only Grony prompts Joe.')
  try {
    await ensureAttendance()
    const b = await req.json().catch(() => ({}))
    const custom = String(b.what ?? '').trim().slice(0, 200)
    const [{ r }] = await sql`SELECT COUNT(*)::int AS r FROM cctv_reviews WHERE status = 'pending'`
    const [{ c }] = await sql`SELECT COUNT(*)::int AS c FROM clock_corrections WHERE status = 'pending' AND staff <> 'joe' AND COALESCE(against, '') <> 'joe'`
    const [{ sn }] = await sql`SELECT COUNT(*)::int AS sn FROM penalty_sanctions WHERE status = 'proposed' AND staff <> 'joe'`.catch(() => [{ sn: 0 }])
    const [{ dp }] = await sql`SELECT COUNT(*)::int AS dp FROM staff_penalties WHERE status IN ('pending', 'disputed') AND staff <> 'joe'`.catch(() => [{ dp: 0 }])
    const parts = [custom, Number(sn) ? `${sn} sanction${Number(sn) === 1 ? '' : 's'} to approve` : '', Number(dp) ? `${dp} violation${Number(dp) === 1 ? '' : 's'} to confirm or review` : '', Number(r) ? `${r} CCTV review${Number(r) === 1 ? '' : 's'}` : '', Number(c) ? `${c} clock-out time${Number(c) === 1 ? '' : 's'} to approve` : ''].filter(Boolean)
    if (!parts.length) return success({ ok: true, sent: false })
    await pushToUsers(['joe'], 'Grony asks you to check', parts.join(' · '))
    return success({ ok: true, sent: true })
  } catch (e) { return handleError('clock nudge', e) }
}
