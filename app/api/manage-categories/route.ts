import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { NextRequest, NextResponse } from 'next/server'
import { initializeDatabase } from '@/lib/dbInitialize'
import { once } from '@/lib/once'

// User-added Grony Manage categories -- sit alongside the fixed ones
// (Advert, Training, etc.) in the drawer, but their content is entirely
// built from tabs the owner/Joe adds (see manage-category-tabs), not a
// bespoke component. Anyone can read; only owner-level can create/delete,
// same gating as everything else that shapes the app's own structure.
const ensureTable = once(async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS manage_categories (
      id SERIAL PRIMARY KEY,
      label TEXT NOT NULL,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.catch(() => {})
})

export async function GET() {
  await initializeDatabase()
  await ensureTable()
  try {
    const rows = await sql`SELECT id, label, created_by, created_at FROM manage_categories ORDER BY created_at ASC`
    return NextResponse.json(rows)
  } catch (e) {
    console.error('manage-categories GET error:', e)
    return NextResponse.json([])
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!isOwnerLevel(session?.user as any)) {
    return NextResponse.json({ error: 'Only the owner or Joe can add a category' }, { status: 403 })
  }
  await initializeDatabase()
  await ensureTable()

  const { label } = await req.json()
  const text = typeof label === 'string' ? label.trim() : ''
  if (!text) return NextResponse.json({ error: 'Label is required' }, { status: 400 })

  const actor = (session!.user as any)?.username || session!.user?.name || 'Unknown'
  try {
    const [row] = await sql`
      INSERT INTO manage_categories (label, created_by)
      VALUES (${text}, ${actor})
      RETURNING id, label, created_by, created_at
    `
    return NextResponse.json(row, { status: 201 })
  } catch (e) {
    console.error('manage-categories POST error:', e)
    return NextResponse.json({ error: 'Could not save category' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!isOwnerLevel(session?.user as any)) {
    return NextResponse.json({ error: 'Only the owner or Joe can delete a category' }, { status: 403 })
  }
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  try {
    await sql`DELETE FROM manage_category_tabs WHERE category_id = ${Number(id)}`.catch(() => {})
    await sql`DELETE FROM manage_categories WHERE id = ${Number(id)}`
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('manage-categories DELETE error:', e)
    return NextResponse.json({ error: 'Could not delete category' }, { status: 500 })
  }
}
