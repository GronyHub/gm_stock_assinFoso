import { requireAuth, badRequest, notFound, success } from '@/lib/api'
import { getIdParam } from '@/lib/api/params'
import sql from '@/lib/db'
import { ensureCompanyLaws, cleanLawBody } from '@/lib/pageLaws'
import { LAW_CATEGORIES, LAW_TYPES, DAY_CODES, LAW_FREQUENCIES } from '@/lib/lawCategories'
import { isOwnerLevel } from '@/lib/roles'
import { syncLawTile } from '@/lib/lawTiles'
import { NextRequest } from 'next/server'

const denied = 'Only the owner and manager can change laws.'

// PUT { text } (the old inline edit) or the full law from the Company Laws screen.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session?.user as any)) return badRequest(denied)

  const lawId = await getIdParam(params)
  const b = await req.json()
  await ensureCompanyLaws()
  if (b.category === undefined && b.law_type === undefined) {
    const trimmed = typeof b.text === 'string' ? b.text.trim() : ''
    if (!trimmed) return badRequest('text is required')
    const [row] = await sql`UPDATE page_laws SET text = ${trimmed} WHERE id = ${lawId} RETURNING id, text, created_at`
    if (!row) return notFound()
    return success(row)
  }
  const law = cleanLawBody(b, { categories: LAW_CATEGORIES.map(c => c.key), types: LAW_TYPES.map(t => t.key as string), days: [...DAY_CODES] as string[], freqs: [...LAW_FREQUENCIES] as string[] })
  if (!law.text) return badRequest('The law needs its wording.')
  if (!law.category) return badRequest('Choose a category.')
  if (!law.violations.length) return badRequest('Add at least one violation: what exactly breaks this law, and its points.')
  const [row] = await sql`UPDATE page_laws SET text = ${law.text}, category = ${law.category}, subcategory = ${law.subcategory}, law_type = ${law.law_type},
    days = ${law.days}, law_time = ${law.law_time}, frequency = ${law.frequency}, minutes = ${law.minutes}, dos = ${law.dos}, donts = ${law.donts}, proof = ${law.proof}, points = ${law.points}, violations = ${JSON.stringify(law.violations)}, not_violation = ${law.not_violation}, title = ${law.title}, audience = ${law.audience} WHERE id = ${lawId} RETURNING id`
  if (!row) return notFound()
  await syncLawTile(lawId).catch(e => console.error('law tile sync failed:', e instanceof Error ? e.message : String(e)))
  return success(row)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session?.user as any)) return badRequest(denied)

  const lawId = await getIdParam(params)
  const [gone] = await sql`DELETE FROM page_laws WHERE id = ${lawId} RETURNING tile_id`
  if (gone?.tile_id) await sql`UPDATE daily_check_tiles SET active = false WHERE id = ${gone.tile_id}`
  return success({ ok: true })
}
