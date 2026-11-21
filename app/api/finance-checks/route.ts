import { NextRequest } from 'next/server'
import { requireAuth, badRequest, success, handleError, getActorName } from '@/lib/api'
import sql from '@/lib/db'
import { actorKey } from '@/lib/clockState'
import { recordActivity } from '@/lib/logger'
import { pushToUsers } from '@/lib/checklistAlerts'
import { ensureFinanceChecks, checksDue, type FinanceKind } from '@/lib/financeChecks'

const dayKey = () => new Date().toISOString().slice(0, 10)

// GET -- which checks are due now for the signed-in manager (Joe): { due: ['expenses'] } or both on Tuesday and Friday. Everyone else: nothing is due.
export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    const isManager = actorKey(session.user as never) === 'joe' && (session.user as { role?: string })?.role !== 'owner'
    return success({ due: isManager ? checksDue() : [] })
  } catch (e) { return handleError('finance-checks GET', e) }
}

// POST { kind: 'expenses' | 'bills', answer: 'yes' | 'no' | 'skip', action?: 'record_now' | 'skip' } -- the answer is recorded in every case.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    const b = await req.json().catch(() => ({}))
    const kind = String(b.kind ?? '') as FinanceKind
    const answer = String(b.answer ?? ''), action = b.action ? String(b.action) : null
    if (kind !== 'expenses' && kind !== 'bills') return badRequest('Say whether this is the expenses or the bills check.')
    if (!['yes', 'no', 'skip'].includes(answer)) return badRequest('Answer yes, no or skip.')
    if (action && !['record_now', 'skip'].includes(action)) return badRequest('Unknown action.')
    await ensureFinanceChecks()
    const who = actorKey(session.user as never)
    await sql`INSERT INTO finance_checks (kind, day, who, answer, action) VALUES (${kind}, ${dayKey()}, ${who}, ${answer}, ${action})`
    const what = kind === 'expenses' ? 'expenses' : 'bills'
    void recordActivity(getActorName(session), `answered the ${what} check: ${answer}`, action ?? undefined)
    // The owner is told when it is not a plain yes.
    if (answer !== 'yes' && who !== 'grony') {
      const text = answer === 'skip' ? `skipped the ${what} question` : action === 'record_now' ? `said some ${what} are not recorded and went to record them` : `said some ${what} are not recorded and skipped`
      void pushToUsers(['grony'], `${getActorName(session)} ${text}`, 'It is on the page under Not done or Done.')
    }
    return success({ ok: true })
  } catch (e) { return handleError('finance-checks POST', e) }
}
