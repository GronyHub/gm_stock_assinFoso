import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { ensureTrainingTables } from '../route'
import { NextResponse } from 'next/server'

// Questions for taking a quiz -- correct_index is deliberately left out so a
// staff member can't read the answer key from the network response.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  try {
    await ensureTrainingTables()
    const [quiz] = await sql`SELECT id, title FROM training_quizzes WHERE id = ${id}`
    if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })
    const questions = await sql`
      SELECT id, question, options FROM training_questions
      WHERE quiz_id = ${id} ORDER BY sort_order
    `
    return NextResponse.json({ ...quiz, questions })
  } catch (e) {
    console.error('training quiz GET error:', e)
    return NextResponse.json({ error: 'Failed to load quiz' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!isOwnerLevel(session?.user as any)) {
    return NextResponse.json({ error: 'Only the owner or Joe can delete quizzes' }, { status: 403 })
  }
  const { id } = await params

  try {
    await sql`DELETE FROM training_quizzes WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('training quiz DELETE error:', e)
    return NextResponse.json({ error: 'Failed to delete quiz' }, { status: 500 })
  }
}
