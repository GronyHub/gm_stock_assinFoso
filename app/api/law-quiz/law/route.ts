import { cap } from '@/lib/strings'
import { getAuthUser, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { recordActivity } from '@/lib/logger'
import { once } from '@/lib/once'
import { actorKey } from '@/lib/clockState'
import { SIGNERS } from '@/lib/signers'
import { ensureCompanyLaws } from '@/lib/pageLaws'
import { parseQuiz } from '@/lib/lawQuiz'
import { NextRequest } from 'next/server'
import { notifyOwners } from '@/lib/checklistAlerts'

const ensure = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS law_quiz_marks (
    law_id INTEGER NOT NULL, staff TEXT NOT NULL, score INTEGER NOT NULL, total INTEGER NOT NULL, law_hash TEXT NOT NULL,
    taken_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (law_id, staff))`.catch(() => {})
})

// GET ?id= -- the questions of a law's quiz, without the answers.
export async function GET(req: NextRequest) {
  const { error } = await getAuthUser()
  if (error) return error
  try {
    await ensureCompanyLaws(); await ensure()
    const id = Number(req.nextUrl.searchParams.get('id'))
    const [l] = await sql`SELECT code, title, quiz FROM page_laws WHERE id = ${id} AND status = 'live'`
    if (!l) return badRequest('Law not found.')
    return success({ code: l.code, title: l.title, questions: parseQuiz(l.quiz).map(q => ({ q: q.q, options: q.options })) })
  } catch (e) { return handleError('law-quiz law GET', e) }
}

// POST { law_id, answers: number[] } -- marked here; the mark is stored (best attempt kept for the current wording of the law).
export async function POST(req: NextRequest) {
  const { user, error } = await getAuthUser()
  if (error) return error
  try {
    await ensureCompanyLaws(); await ensure()
    const me = actorKey(user as any)
    if (!SIGNERS.includes(me)) return badRequest('You are not on the list of people who take the law quizzes.')
    const b = await req.json().catch(() => ({}))
    const id = Number(b.law_id)
    const [l] = await sql`SELECT quiz, md5(coalesce(text,'') || '|' || coalesce(dos,'') || '|' || coalesce(donts,'')) AS h FROM page_laws WHERE id = ${id} AND status = 'live'`
    const qs = parseQuiz(l?.quiz)
    if (!l || !qs.length || !Array.isArray(b.answers)) return badRequest('Nothing to mark.')
    const results = qs.map((q, i) => ({ correct: Number(b.answers[i]) === q.answer, answer: q.answer, why: q.why }))
    const score = results.filter(r => r.correct).length
    await sql`INSERT INTO law_quiz_marks (law_id, staff, score, total, law_hash) VALUES (${id}, ${me}, ${score}, ${qs.length}, ${l.h})
      ON CONFLICT (law_id, staff) DO UPDATE SET score = GREATEST(CASE WHEN law_quiz_marks.law_hash = ${l.h} THEN law_quiz_marks.score ELSE 0 END, ${score}), total = ${qs.length}, law_hash = ${l.h}, taken_at = now()`
    const [lw] = await sql`SELECT code, title FROM page_laws WHERE id = ${id}`
    void recordActivity(me, 'took a law quiz', `${lw?.code ?? ''} ${String(lw?.title ?? '').slice(0, 60)}: ${score}/${qs.length}`.trim())
    // practice quiz result: no push (it is optional practice)
    return success({ score, total: qs.length, results })
  } catch (e) { return handleError('law-quiz law POST', e) }
}
