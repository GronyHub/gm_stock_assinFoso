import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { ensureDbInitialized } from '@/lib/api/dbInitCache'
import { NextRequest } from 'next/server'
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
  await ensureDbInitialized()
  await ensureTable()
  try {
    const rows = await sql`SELECT id, label, created_by, created_at FROM manage_categories ORDER BY created_at ASC`
    return success(rows)
  } catch (e) {
    console.error('manage-categories GET error:', e)
    return success([])
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session?.user as any)) {
    return badRequest('Only the owner or Joe can add a category')
  }
  await ensureDbInitialized()
  await ensureTable()

  const { label } = await req.json()
  const text = typeof label === 'string' ? label.trim() : ''
  if (!text) return badRequest('Label is required')

  const actor = (session!.user as any)?.username || session!.user?.name || 'Unknown'
  try {
    const [row] = await sql`
      INSERT INTO manage_categories (label, created_by)
      VALUES (${text}, ${actor})
      RETURNING id, label, created_by, created_at
    `
    return success(row)
  } catch (e) {
    return handleError('manage-categories POST', e)
  }
}

export async function DELETE(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session?.user as any)) {
    return badRequest('Only the owner or Joe can delete a category')
  }
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return badRequest('Missing id')

  try {
    await sql`DELETE FROM manage_category_tabs WHERE category_id = ${Number(id)}`.catch(() => {})
    await sql`DELETE FROM manage_categories WHERE id = ${Number(id)}`
    return success({ ok: true })
  } catch (e) {
    return handleError('manage-categories DELETE', e)
  }
}
