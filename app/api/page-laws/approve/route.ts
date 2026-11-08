import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import { ensureCompanyLaws } from '@/lib/pageLaws'
import { approveDrafts } from '@/lib/lawTiles'
import { isOwnerLevel } from '@/lib/roles'
import { NextRequest } from 'next/server'

// POST { id } or { category } -- approve draft laws (owner and manager). Recurring laws get their checklist tiles.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session?.user as any)) return badRequest('Only the owner and manager can approve laws.')
  try {
    await ensureCompanyLaws()
    const b = await req.json().catch(() => ({}))
    const id = Number(b.id), category = String(b.category ?? '')
    if (!id && !category) return badRequest('Say which law or category.')
    const n = await approveDrafts(id ? { id } : { category })
    return success({ approved: n })
  } catch (e) { return handleError('page-laws approve', e) }
}
