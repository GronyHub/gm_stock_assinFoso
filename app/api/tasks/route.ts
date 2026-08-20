import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { initializeDatabase } from '@/lib/dbInitialize'
import { NextRequest, NextResponse } from 'next/server'

async function ensureCustomTasksTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS custom_tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      notes TEXT,
      due_date DATE,
      submenu TEXT,
      view TEXT,
      done BOOLEAN NOT NULL DEFAULT false,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at TIMESTAMPTZ
    )
  `.catch(() => {})
  await sql`ALTER TABLE custom_tasks ADD COLUMN IF NOT EXISTS submenu TEXT`.catch(() => {})
  await sql`ALTER TABLE custom_tasks ADD COLUMN IF NOT EXISTS view TEXT`.catch(() => {})
  await sql`ALTER TABLE custom_tasks ADD COLUMN IF NOT EXISTS law_id INTEGER`.catch(() => {})
  await sql`ALTER TABLE custom_tasks ADD COLUMN IF NOT EXISTS flag_key TEXT`.catch(() => {})
  await sql`ALTER TABLE custom_tasks ADD COLUMN IF NOT EXISTS assigned_to TEXT`.catch(() => {})
  await sql`ALTER TABLE custom_tasks ADD COLUMN IF NOT EXISTS completed_by TEXT`.catch(() => {})
  await sql`ALTER TABLE custom_tasks ADD COLUMN IF NOT EXISTS task_type TEXT DEFAULT 'General task'`.catch(() => {})
  await sql`ALTER TABLE custom_tasks ADD COLUMN IF NOT EXISTS recurrence_type TEXT`.catch(() => {})
  await sql`ALTER TABLE custom_tasks ADD COLUMN IF NOT EXISTS recurrence_days JSONB`.catch(() => {})
}

export async function GET(req: NextRequest) {
  await initializeDatabase()
  await initializeDatabase()
  await ensureCustomTasksTable()
  try {
    const lawId = req.nextUrl.searchParams.get('lawId')
    const flagKey = req.nextUrl.searchParams.get('flagKey')
    const submenu = req.nextUrl.searchParams.get('submenu')
    const lawIds = req.nextUrl.searchParams.get('lawIds')
    const flagKeys = req.nextUrl.searchParams.get('flagKeys')

    if (lawIds || flagKeys) {
      // Batched form for PageLawsList, which otherwise fires one request per
      // law/flag on every mount (34 mount sites x dozens of laws each was a
      // meaningful chunk of Vercel's Observability Events volume).
      const lawIdList = lawIds ? lawIds.split(',').map(s => parseInt(s, 10)).filter(n => !isNaN(n)) : []
      const flagKeyList = flagKeys ? flagKeys.split(',').filter(Boolean) : []
      const rows = await sql`
        SELECT id, title, notes, due_date, submenu, view, law_id, flag_key, task_type, recurrence_type, recurrence_days, done, created_by, created_at, completed_at, assigned_to, completed_by
        FROM custom_tasks
        WHERE (law_id = ANY(${lawIdList}::int[]) OR flag_key = ANY(${flagKeyList}::text[]))
        ORDER BY done ASC, created_at DESC
      `
      return NextResponse.json(rows)
    } else if (lawId) {
      const rows = await sql`
        SELECT id, title, notes, due_date, submenu, view, law_id, flag_key, task_type, recurrence_type, recurrence_days, done, created_by, created_at, completed_at, assigned_to, completed_by
        FROM custom_tasks
        WHERE law_id = ${parseInt(lawId)}
        ORDER BY done ASC, created_at DESC
      `
      return NextResponse.json(rows)
    } else if (flagKey) {
      const rows = await sql`
        SELECT id, title, notes, due_date, submenu, view, law_id, flag_key, task_type, recurrence_type, recurrence_days, done, created_by, created_at, completed_at, assigned_to, completed_by
        FROM custom_tasks
        WHERE flag_key = ${flagKey}
        ORDER BY done ASC, created_at DESC
      `
      return NextResponse.json(rows)
    } else if (submenu) {
      const rows = await sql`
        SELECT id, title, notes, due_date, submenu, view, law_id, flag_key, task_type, recurrence_type, recurrence_days, done, created_by, created_at, completed_at, assigned_to, completed_by
        FROM custom_tasks
        WHERE submenu = ${submenu} AND law_id IS NULL AND flag_key IS NULL
        ORDER BY done ASC, due_date NULLS LAST, created_at DESC
      `
      return NextResponse.json(rows)
    } else {
      const rows = await sql`
        SELECT id, title, notes, due_date, submenu, view, law_id, flag_key, task_type, recurrence_type, recurrence_days, done, created_by, created_at, completed_at, assigned_to, completed_by
        FROM custom_tasks
        ORDER BY done ASC, due_date NULLS LAST, created_at DESC
      `
      return NextResponse.json(rows)
    }
  } catch (e) {
    console.error('tasks GET error:', e)
    return NextResponse.json([])
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await initializeDatabase()
  await initializeDatabase()
  await ensureCustomTasksTable()

  const { title, notes, due_date, submenu, view, law_id, flag_key, assigned_to, task_type, recurrence_type, recurrence_days } = await req.json()
  const text = typeof title === 'string' ? title.trim() : ''
  const submenuText = typeof submenu === 'string' ? submenu.trim() : ''
  const viewText = typeof view === 'string' ? view.trim() : ''
  const assignedToText = typeof assigned_to === 'string' ? assigned_to.trim() : null
  if (!text) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  if (!submenuText) return NextResponse.json({ error: 'Submenu is required' }, { status: 400 })

  const actor = (session.user as any)?.username || session.user?.name || 'Unknown'

  try {
    const [row] = await sql`
      INSERT INTO custom_tasks (title, notes, due_date, submenu, view, law_id, flag_key, assigned_to, task_type, recurrence_type, recurrence_days, created_by)
      VALUES (${text}, ${typeof notes === 'string' && notes.trim() ? notes.trim() : null}, ${due_date || null}, ${submenuText}, ${viewText || null}, ${law_id || null}, ${flag_key || null}, ${assignedToText}, ${task_type || 'General +'}, ${recurrence_type || null}, ${recurrence_days ? JSON.stringify(recurrence_days) : null}, ${actor})
      RETURNING id, title, notes, due_date, submenu, view, law_id, flag_key, task_type, recurrence_type, recurrence_days, assigned_to, done, created_by, created_at, completed_at, completed_by
    `
    return NextResponse.json(row, { status: 201 })
  } catch (e) {
    console.error('tasks POST error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not save task: ${detail}` }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await initializeDatabase()
  await initializeDatabase()
  await ensureCustomTasksTable()

  const { id, done } = await req.json()
  if (!id) return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })

  const actor = (session.user as any)?.username || session.user?.name || 'Unknown'

  try {
    const [row] = await sql`
      UPDATE custom_tasks
      SET done = ${done}, ${done ? sql`completed_at = now(), completed_by = ${actor}` : sql`completed_at = NULL, completed_by = NULL`}
      WHERE id = ${id}
      RETURNING id, title, notes, due_date, submenu, view, law_id, flag_key, task_type, recurrence_type, recurrence_days, assigned_to, done, created_by, created_at, completed_at, completed_by
    `
    return NextResponse.json(row)
  } catch (e) {
    console.error('tasks PATCH error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not update task: ${detail}` }, { status: 500 })
  }
}

// PUT/DELETE for a single task live in ./[id]/route.ts -- Next.js always
// routes /api/tasks/<id> to that dynamic segment, never here, so a same-
// named handler in this file would be unreachable dead code.
