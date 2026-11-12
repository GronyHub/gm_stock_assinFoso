import { requireAuth, badRequest, success, handleError, getActorName } from '@/lib/api'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { listGroups, saveGroup, removeGroup, type SaveGroup } from '@/lib/questionGroups'
import { NextRequest } from 'next/server'

// The owner and Joe build the groups. GET returns every group plus the laws a question can point to; POST saves one (id = update); DELETE ?id= removes one (its laws get their own tiles back).
export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as never)) return badRequest('Only the owner and the manager build question groups.')
  try {
    const laws = await sql`SELECT id, category, subcategory, law_type, status, tile_id, assignment, LEFT(COALESCE(NULLIF(title, ''), text), 200) AS text FROM page_laws WHERE status = 'live' ORDER BY category, subcategory, id` as unknown as Record<string, unknown>[]
    return success({ groups: await listGroups(), laws })
  } catch (e) { return handleError('question groups list', e) }
}
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as never)) return badRequest('Only the owner and the manager build question groups.')
  try {
    const b = await req.json().catch(() => ({})) as SaveGroup
    try { return success({ id: await saveGroup(b, getActorName(session)) }, 201) } catch (e) { return badRequest(e instanceof Error ? e.message : 'Could not save.') }
  } catch (e) { return handleError('question groups save', e) }
}
export async function DELETE(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as never)) return badRequest('Only the owner and the manager build question groups.')
  try { await removeGroup(Number(req.nextUrl.searchParams.get('id'))); return success({ ok: true }) } catch (e) { return handleError('question groups remove', e) }
}
