import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// User-created tasks -- separate from the auto-generated violation flags
// RoleFlagsTable already surfaces. Self-migrating table, same convention
// as the rest of this app's ad-hoc schema changes.
async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS custom_tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      notes TEXT,
      due_date DATE,
      done BOOLEAN NOT NULL DEFAULT false,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at TIMESTAMPTZ
    )
  `.catch(() => {})
}

export async function GET() {
  await ensureTable()
  try {
    const rows = await sql`
      SELECT id, title, notes, due_date, done, created_by, created_at, completed_at
      FROM custom_tasks
      ORDER BY done ASC, due_date NULLS LAST, created_at DESC
    `
    return NextResponse.json(rows)
  } catch (e) {
    console.error('tasks GET error:', e)
    return NextResponse.json([])
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await ensureTable()

  const { title, notes, due_date } = await req.json()
  const text = typeof title === 'string' ? title.trim() : ''
  if (!text) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  const actor = (session.user as any)?.username || session.user?.name || 'Unknown'

  try {
    const [row] = await sql`
      INSERT INTO custom_tasks (title, notes, due_date, created_by)
      VALUES (${text}, ${typeof notes === 'string' && notes.trim() ? notes.trim() : null}, ${due_date || null}, ${actor})
      RETURNING id, title, notes, due_date, done, created_by, created_at, completed_at
    `
    return NextResponse.json(row, { status: 201 })
  } catch (e) {
    console.error('tasks POST error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not save task: ${detail}` }, { status: 500 })
  }
}
