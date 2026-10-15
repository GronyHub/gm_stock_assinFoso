import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { success, badRequest, unauthorized } from '@/lib/api'
import { canCaretake, ensureCaretakerTables } from '@/lib/caretaker'
import { CHILDREN } from '@/lib/caretakerShared'

export async function GET() {
  const session = await auth()
  if (!session) return unauthorized()
  if (!canCaretake(session)) return success([], 403)
  await ensureCaretakerTables()
  const rows = await sql`SELECT name, photo_url FROM care_children`
  const byName = new Map(rows.map(r => [r.name as string, r.photo_url as string | null]))
  return success(CHILDREN.map(name => ({ name, photo_url: byName.get(name) ?? null })))
}

// PUT { name, photo_url } -- sets a child's tile photo.
export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!canCaretake(session)) return badRequest('Not allowed')
  await ensureCaretakerTables()
  const b = await req.json().catch(() => null)
  if (!b || !(CHILDREN as readonly string[]).includes(b.name)) return badRequest('Unknown child')
  const photo = String(b.photo_url ?? '')
  if (!photo.startsWith('/api/caretaker/media?p=')) return badRequest('Bad photo')
  await sql`
    INSERT INTO care_children (name, photo_url) VALUES (${b.name}, ${photo})
    ON CONFLICT (name) DO UPDATE SET photo_url = ${photo}
  `
  return success({ ok: true })
}
