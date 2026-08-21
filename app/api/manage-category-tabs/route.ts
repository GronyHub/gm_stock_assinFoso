import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { NextRequest, NextResponse } from 'next/server'
import { initializeDatabase } from '@/lib/dbInitialize'
import { once } from '@/lib/once'

// The internal tabs inside a user-added Grony Manage category (see
// manage-categories) -- each one is built from one of a small set of
// reusable content types rather than bespoke code:
//   'log'            -- a dated notes+photo checklist (ManageLogPanel)
//   'notes'          -- a free-text reference page (ContentPage)
//   'tasks'          -- a simple to-do list scoped to this tab (DynamicTasksSection)
//   'payslip_flags'  -- missing-payslip checklist (PayslipFlagsPanel)
// Anyone can read; only owner-level can add/remove a tab, matching
// manage-categories' own gating.
const ensureTable = once(async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS manage_category_tabs (
      id SERIAL PRIMARY KEY,
      category_id INTEGER NOT NULL,
      label TEXT NOT NULL,
      content_type TEXT NOT NULL,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.catch(() => {})
})

const VALID_TYPES = new Set(['log', 'notes', 'tasks', 'payslip_flags'])

export async function GET(req: NextRequest) {
  await initializeDatabase()
  await ensureTable()
  const categoryId = req.nextUrl.searchParams.get('category_id')
  if (!categoryId) return NextResponse.json({ error: 'Missing category_id' }, { status: 400 })

  try {
    const rows = await sql`
      SELECT id, category_id, label, content_type, created_by, created_at
      FROM manage_category_tabs
      WHERE category_id = ${Number(categoryId)}
      ORDER BY created_at ASC
    `
    return NextResponse.json(rows)
  } catch (e) {
    console.error('manage-category-tabs GET error:', e)
    return NextResponse.json([])
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!isOwnerLevel(session?.user as any)) {
    return NextResponse.json({ error: 'Only the owner or Joe can add a tab' }, { status: 403 })
  }
  await initializeDatabase()
  await ensureTable()

  const { category_id, label, content_type } = await req.json()
  const text = typeof label === 'string' ? label.trim() : ''
  if (!category_id) return NextResponse.json({ error: 'Missing category_id' }, { status: 400 })
  if (!text) return NextResponse.json({ error: 'Label is required' }, { status: 400 })
  if (!VALID_TYPES.has(content_type)) return NextResponse.json({ error: 'Invalid content type' }, { status: 400 })

  const actor = (session!.user as any)?.username || session!.user?.name || 'Unknown'
  try {
    const [row] = await sql`
      INSERT INTO manage_category_tabs (category_id, label, content_type, created_by)
      VALUES (${Number(category_id)}, ${text}, ${content_type}, ${actor})
      RETURNING id, category_id, label, content_type, created_by, created_at
    `
    return NextResponse.json(row, { status: 201 })
  } catch (e) {
    console.error('manage-category-tabs POST error:', e)
    return NextResponse.json({ error: 'Could not save tab' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!isOwnerLevel(session?.user as any)) {
    return NextResponse.json({ error: 'Only the owner or Joe can delete a tab' }, { status: 403 })
  }
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  try {
    await sql`DELETE FROM manage_category_tabs WHERE id = ${Number(id)}`
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('manage-category-tabs DELETE error:', e)
    return NextResponse.json({ error: 'Could not delete tab' }, { status: 500 })
  }
}
