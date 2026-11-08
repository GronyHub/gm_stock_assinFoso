import { getAuthUser, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { once } from '@/lib/once'
import { actorKey } from '@/lib/clockState'
import { isOwnerLevel } from '@/lib/roles'
import { NextRequest } from 'next/server'
import training from '@/lib/lawTraining.json'

const ensure = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS law_quiz_results (
    id SERIAL PRIMARY KEY, staff TEXT NOT NULL, category TEXT NOT NULL, score INTEGER NOT NULL, total INTEGER NOT NULL,
    passed BOOLEAN NOT NULL, taken_at TIMESTAMPTZ NOT NULL DEFAULT now())`.catch(() => {})
  await sql`CREATE INDEX IF NOT EXISTS law_quiz_results_staff ON law_quiz_results (staff, category)`.catch(() => {})
})

// GET -- my best result per category; the owner and manager also get everyone's (?all=1).
export async function GET(req: NextRequest) {
  const { user, error } = await getAuthUser()
  if (error) return error
  try {
    await ensure()
    const me = actorKey(user as any)
    const mine = await sql`SELECT category, MAX(score) AS score, MAX(total) AS total, BOOL_OR(passed) AS passed FROM law_quiz_results WHERE staff = ${me} GROUP BY category`
    if (req.nextUrl.searchParams.get('all') && isOwnerLevel(user as any)) {
      const all = await sql`SELECT staff, category, MAX(score) AS score, MAX(total) AS total, BOOL_OR(passed) AS passed, MAX(taken_at) AS last FROM law_quiz_results GROUP BY staff, category ORDER BY staff, category`
      return success({ mine, all })
    }
    return success({ mine })
  } catch (e) { return handleError('law-quiz GET', e) }
}

// POST { category, answers: number[] } -- the answers are marked here, so the result cannot be faked. Pass mark: 75%.
export async function POST(req: NextRequest) {
  const { user, error } = await getAuthUser()
  if (error) return error
  try {
    await ensure()
    const b = await req.json().catch(() => ({}))
    const t = (training as Record<string, { quiz: { answer: number }[] }>)[String(b.category)]
    if (!t || !Array.isArray(b.answers)) return badRequest('Unknown category.')
    const total = t.quiz.length
    const score = t.quiz.filter((q, i) => Number(b.answers[i]) === q.answer).length
    const passed = score / total >= 0.75
    await sql`INSERT INTO law_quiz_results (staff, category, score, total, passed) VALUES (${actorKey(user as any)}, ${String(b.category)}, ${score}, ${total}, ${passed})`
    return success({ score, total, passed })
  } catch (e) { return handleError('law-quiz POST', e) }
}
