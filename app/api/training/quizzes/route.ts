import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { once } from '@/lib/once'
import { NextRequest } from 'next/server'

// Multiple-choice quizzes for Grony Manage > Training > Assessment. Owner-
// level (Grony/Joe) creates them; any logged-in staff member can take one.
// Correct answers never leave this route -- /api/training/quizzes/[id]
// strips them before sending questions to be taken.
export const ensureTrainingTables = once(async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS training_quizzes (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.catch(() => {})
  await sql`
    CREATE TABLE IF NOT EXISTS training_questions (
      id SERIAL PRIMARY KEY,
      quiz_id INTEGER NOT NULL REFERENCES training_quizzes(id) ON DELETE CASCADE,
      question TEXT NOT NULL,
      options JSONB NOT NULL,
      correct_index INTEGER NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `.catch(() => {})
  await sql`
    CREATE TABLE IF NOT EXISTS training_attempts (
      id SERIAL PRIMARY KEY,
      quiz_id INTEGER NOT NULL REFERENCES training_quizzes(id) ON DELETE CASCADE,
      staff_name TEXT NOT NULL,
      score INTEGER NOT NULL,
      total INTEGER NOT NULL,
      taken_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.catch(() => {})
})

export async function GET() {
  const { error } = await requireAuth()
  if (error) return success([])

  try {
    await ensureTrainingTables()
    const rows = await sql`
      SELECT q.id, q.title, q.created_by, q.created_at::text,
        (SELECT COUNT(*) FROM training_questions tq WHERE tq.quiz_id = q.id)::int AS question_count
      FROM training_quizzes q
      ORDER BY q.created_at DESC
    `
    return success(rows)
  } catch (e) {
    console.error('training quizzes GET error:', e)
    return success([])
  }
}

type QuestionInput = { question: string; options: string[]; correct_index: number }

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session?.user as any)) {
    return badRequest('Only the owner or Joe can create quizzes')
  }

  const { title, questions } = await req.json() as { title?: string; questions?: QuestionInput[] }
  if (!title?.trim()) return badRequest('Title is required')
  if (!Array.isArray(questions) || questions.length === 0) {
    return badRequest('Add at least one question')
  }
  for (const q of questions) {
    if (!q.question?.trim() || !Array.isArray(q.options) || q.options.filter(o => o.trim()).length < 2) {
      return badRequest('Each question needs text and at least 2 options')
    }
    if (q.correct_index == null || q.correct_index < 0 || q.correct_index >= q.options.length) {
      return badRequest('Each question needs a valid correct answer')
    }
  }

  const createdBy = (session!.user as any)?.username || session!.user?.name || 'Unknown'

  try {
    await ensureTrainingTables()
    const [quiz] = await sql`
      INSERT INTO training_quizzes (title, created_by) VALUES (${title.trim()}, ${createdBy})
      RETURNING id
    `
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      await sql`
        INSERT INTO training_questions (quiz_id, question, options, correct_index, sort_order)
        VALUES (${quiz.id}, ${q.question.trim()}, ${JSON.stringify(q.options.map(o => o.trim()))}, ${q.correct_index}, ${i})
      `
    }
    return success({ ok: true, id: quiz.id })
  } catch (e) {
    return handleError('training quizzes POST', e)
  }
}
