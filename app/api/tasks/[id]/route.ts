import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// Several real callers send a partial body -- the checkbox toggle sends
// only { done }, the edit form could send only { title } -- so only
// override keys actually present, same pattern as PUT /api/items/[id].
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const taskId = Number(id)
  const body = await req.json()
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k)

  const [current] = await sql`SELECT title, notes, due_date, submenu, done FROM custom_tasks WHERE id = ${taskId}`
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const title    = has('title') ? body.title : current.title
  const notes    = has('notes') ? body.notes : current.notes
  const due_date = has('due_date') ? body.due_date : current.due_date
  const submenu  = has('submenu') ? body.submenu : current.submenu
  const done     = has('done') ? !!body.done : current.done

  const [row] = await sql`
    UPDATE custom_tasks SET
      title = ${title}, notes = ${notes || null}, due_date = ${due_date || null}, submenu = ${submenu || null},
      done = ${done}, completed_at = ${done ? new Date().toISOString() : null}
    WHERE id = ${taskId}
    RETURNING id, title, notes, due_date, submenu, done, created_by, created_at, completed_at
  `
  return NextResponse.json(row)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await sql`DELETE FROM custom_tasks WHERE id = ${Number(id)}`
  return NextResponse.json({ ok: true })
}
