import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { ensureTrainingTables } from '../../route'
import { NextResponse } from 'next/server'

// Grades server-side against the stored correct_index (never sent to the
// client while taking the quiz) and records the attempt.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const { answers } = await req.json() as { answers?: (number | null)[] }
  if (!Array.isArray(answers)) return NextResponse.json({ error: 'Missing answers' }, { status: 400 })

  const staffName = (session.user as any)?.username || session.user?.name || 'Unknown'

  try {
    await ensureTrainingTables()
    const questions = await sql`
      SELECT id, question, options, correct_index FROM training_questions
      WHERE quiz_id = ${id} ORDER BY sort_order
    `
    if (questions.length === 0) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })

    let score = 0
    const results = questions.map((q: any, i: number) => {
      const chosen = answers[i] ?? null
      const isCorrect = chosen === q.correct_index
      if (isCorrect) score++
      return {
        question: q.question, options: q.options,
        chosen, correct_index: q.correct_index, isCorrect,
      }
    })

    await sql`
      INSERT INTO training_attempts (quiz_id, staff_name, score, total)
      VALUES (${id}, ${staffName}, ${score}, ${questions.length})
    `

    return NextResponse.json({ score, total: questions.length, results })
  } catch (e) {
    console.error('training quiz submit error:', e)
    return NextResponse.json({ error: 'Failed to submit quiz' }, { status: 500 })
  }
}
