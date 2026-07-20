import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { ensureTrainingTables } from '../quizzes/route'
import { NextResponse } from 'next/server'

// Attempt history -- everyone sees their own; owner-level (Grony/Joe) sees
// everyone's, so they can tell who has (and hasn't) taken a given quiz.
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const staffName = (session.user as any)?.username || session.user?.name || 'Unknown'
  const seeAll = isOwnerLevel(session.user as any)

  try {
    await ensureTrainingTables()
    const rows = seeAll
      ? await sql`
          SELECT a.id, a.quiz_id, q.title AS quiz_title, a.staff_name, a.score, a.total, a.taken_at::text
          FROM training_attempts a
          JOIN training_quizzes q ON q.id = a.quiz_id
          ORDER BY a.taken_at DESC
          LIMIT 200
        `
      : await sql`
          SELECT a.id, a.quiz_id, q.title AS quiz_title, a.staff_name, a.score, a.total, a.taken_at::text
          FROM training_attempts a
          JOIN training_quizzes q ON q.id = a.quiz_id
          WHERE a.staff_name = ${staffName}
          ORDER BY a.taken_at DESC
          LIMIT 200
        `
    return NextResponse.json(rows)
  } catch (e) {
    console.error('training attempts GET error:', e)
    return NextResponse.json([])
  }
}
