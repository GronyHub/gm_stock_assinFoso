import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import { ensureCompanyLaws } from '@/lib/pageLaws'
import sql from '@/lib/db'
import { approveDrafts } from '@/lib/lawTiles'
import { isOwnerLevel } from '@/lib/roles'
import { NextRequest } from 'next/server'
import { pushToUsers } from '@/lib/checklistAlerts'
import { SIGNERS } from '@/lib/signers'

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
    const bare = id
      ? await sql`SELECT code, left(text, 60) AS t FROM page_laws WHERE id = ${id} AND status = 'draft' AND (violations IS NULL OR violations = '' OR violations = '[]')`
      : await sql`SELECT code, left(text, 60) AS t FROM page_laws WHERE category = ${category ?? ''} AND status = 'draft' AND (violations IS NULL OR violations = '' OR violations = '[]')`
    if (bare.length) return badRequest(`Every law needs at least one violation before it goes live. Missing: ${bare.map(b => b.code ?? b.t).join('; ')}. Edit the law and add what breaks it.`)
    const n = await approveDrafts(id ? { id } : { category })
    if (n > 0) void pushToUsers(['grony', 'joe'], 'Company Laws updated', `${n} new law${n === 1 ? ' is' : 's are'} in force. Read them in Laws.`)
    return success({ approved: n })
  } catch (e) { return handleError('page-laws approve', e) }
}
