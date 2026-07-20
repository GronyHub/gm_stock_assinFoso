import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { NextRequest, NextResponse } from 'next/server'

// Multiple-choice quizzes for Grony Manage > Training > Assessment. Owner-
// level (Grony/Joe) creates them; any logged-in staff member can take one.
// Correct answers never leave this route -- /api/training/quizzes/[id]
// strips them before sending questions to be taken.
export async function ensureTrainingTables() {
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
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  try {
    await ensureTrainingTables()
    const rows = await sql`
      SELECT q.id, q.title, q.created_by, q.created_at::text,
        (SELECT COUNT(*) FROM training_questions tq WHERE tq.quiz_id = q.id)::int AS question_count
      FROM training_quizzes q
      ORDER BY q.created_at DESC
    `
    return NextResponse.json(rows)
  } catch (e) {
    console.error('training quizzes GET error:', e)
    return NextResponse.json([])
  }
}

type QuestionInput = { question: string; options: string[]; correct_index: number }

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!isOwnerLevel(session?.user as any)) {
    return NextResponse.json({ error: 'Only the owner or Joe can create quizzes' }, { status: 403 })
  }

  const { title, questions } = await req.json() as { title?: string; questions?: QuestionInput[] }
  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  if (!Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json({ error: 'Add at least one question' }, { status: 400 })
  }
  for (const q of questions) {
    if (!q.question?.trim() || !Array.isArray(q.options) || q.options.filter(o => o.trim()).length < 2) {
      return NextResponse.json({ error: 'Each question needs text and at least 2 options' }, { status: 400 })
    }
    if (q.correct_index == null || q.correct_index < 0 || q.correct_index >= q.options.length) {
      return NextResponse.json({ error: 'Each question needs a valid correct answer' }, { status: 400 })
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
    return NextResponse.json({ ok: true, id: quiz.id })
  } catch (e) {
    console.error('training quizzes POST error:', e)
    return NextResponse.json({ error: 'Failed to create quiz' }, { status: 500 })
  }
}
