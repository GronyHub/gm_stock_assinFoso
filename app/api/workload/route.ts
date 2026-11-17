import { NextRequest } from 'next/server'
import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import { actorKey, getClockState } from '@/lib/clockState'
import { dutiesForDate } from '@/lib/duties'
import { rotaShifts } from '@/lib/allocation'
import { isOwnerLevel } from '@/lib/roles'

// GET ?date=YYYY-MM-DD -- each person's workload for the day. The rule: the minutes of the tasks that fall on a person (their share of the checklist)
// should be at least half of the time they are at the shop. Shift = their clock times when they have them, else the rota.
// Joe and Grony see everyone; each staff member sees only their own line.
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest('Bad date')
    const all = isOwnerLevel(session.user as never), me = actorKey(session.user as never)
    const now = new Date(), nowMin = now.getUTCHours() * 60 + now.getUTCMinutes(), isToday = date === now.toISOString().slice(0, 10)
    const [duties, shifts, clock] = await Promise.all([dutiesForDate(date), rotaShifts(date), getClockState(date).catch(() => null)])
    const names = Array.from(new Set([...shifts.map(s => s.n), ...(clock?.everIn ?? [])])).filter(n => n !== 'grony')
    const people = names.filter(n => all || n === me).map(n => {
      const sh = shifts.find(s => s.n === n)
      const from = clock?.ins[n] ?? sh?.from ?? null
      const to = clock?.outs[n] ?? sh?.to ?? (isToday && from != null ? Math.max(from, nowMin) : null)
      const shift = from != null && to != null ? Math.max(0, to - from) : 0
      const mine = duties.filter(d => d.kind === 'task' && d.owner === n && d.mins)
      const assigned = mine.reduce((t, d) => t + (d.mins ?? 0), 0)
      const done = mine.filter(d => d.state === 'done').reduce((t, d) => t + (d.mins ?? 0), 0)
      const target = Math.round(shift / 2)
      return { name: n, shift, target, assigned, done, short: Math.max(0, target - assigned) }
    }).sort((a, b) => a.name.localeCompare(b.name))
    return success({ date, all, people })
  } catch (e) { return handleError('workload', e) }
}
