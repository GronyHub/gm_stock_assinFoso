import { requireAuth, badRequest, success, unauthorized, handleError } from '@/lib/api'
import { ensureDbInitialized } from '@/lib/api/dbInitCache'
import sql from '@/lib/db'
import { ensureCompanyLaws, cleanLawBody } from '@/lib/pageLaws'
import { LAW_CATEGORIES, LAW_TYPES, DAY_CODES, LAW_FREQUENCIES, CATEGORY_FOR_SCOPE } from '@/lib/lawCategories'
import { isOwnerLevel } from '@/lib/roles'
import { syncLawTile } from '@/lib/lawTiles'
import { NextRequest } from 'next/server'


export async function GET(req: NextRequest) {
  const { session: me, error } = await requireAuth()
  if (error) return unauthorized()
  const owner = isOwnerLevel(me?.user as any)

  const scopeKey = req.nextUrl.searchParams.get('scopeKey')

  try {
    await ensureDbInitialized()
    await ensureCompanyLaws()
    if (scopeKey) {
      // Fetch laws for a specific scope
      const rows = await sql`SELECT id, text, scope_key, created_at, display_in_carousel, carousel_message, carousel_order, carousel_type, category, subcategory, code, violations, not_violation, law_type, days, law_time, frequency, minutes, dos, donts, status, tile_id, proof, points FROM page_laws WHERE scope_key = ${scopeKey} ORDER BY id`
      return success(owner ? rows : (rows as { status?: string }[]).filter(r => r.status !== 'draft'))
    } else {
      // Fetch all laws across all scopes
      const rows = await sql`SELECT id, text, scope_key, created_at, display_in_carousel, carousel_message, carousel_order, carousel_type, category, subcategory, code, violations, not_violation, law_type, days, law_time, frequency, minutes, dos, donts, status, tile_id, proof, points FROM page_laws ORDER BY scope_key, id`
      return success(owner ? rows : (rows as { status?: string }[]).filter(r => r.status !== 'draft'))
    }
  } catch (e) {
    return handleError('page-laws GET', e)
  }
}

// Only the owner and manager add laws -- laws now decide what the Daily Checklist asks of staff. A law added from a
// page's own flag icon is put in the category that matches that page (or "Needs a category").
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session?.user as any)) return badRequest('Only the owner and manager can add laws.')

  const b = await req.json()
  const valid = { categories: LAW_CATEGORIES.map(c => c.key), types: LAW_TYPES.map(t => t.key as string), days: [...DAY_CODES] as string[], freqs: [...LAW_FREQUENCIES] as string[] }
  const law = cleanLawBody(b, valid)
  const scopeKey = String(b.scopeKey ?? law.category ?? '').trim()
  if (!scopeKey || !law.text) return badRequest('Missing scopeKey or text')
  const category = law.category ?? CATEGORY_FOR_SCOPE[scopeKey] ?? null
  if (!law.violations.length) return badRequest('Add at least one violation: what exactly breaks this law, and its points.')

  try {
    await ensureDbInitialized()
    await ensureCompanyLaws()
    const [row] = await sql`
      INSERT INTO page_laws (scope_key, text, display_in_carousel, carousel_type, category, subcategory, law_type, days, law_time, frequency, minutes, dos, donts, proof, points, violations, not_violation)
      VALUES (${scopeKey}, ${law.text}, false, 'law', ${category}, ${law.subcategory}, ${law.law_type}, ${law.days}, ${law.law_time}, ${law.frequency}, ${law.minutes}, ${law.dos}, ${law.donts}, ${law.proof}, ${law.points}, ${JSON.stringify(law.violations)}, ${law.not_violation})
      RETURNING id, text, scope_key, created_at, display_in_carousel, carousel_message, carousel_order, carousel_type, category, subcategory, code, violations, not_violation, law_type, days, law_time, frequency, minutes, dos, donts, status, tile_id, proof, points
    `
    await syncLawTile(row.id).catch(e => console.error('law tile sync failed:', e instanceof Error ? e.message : String(e)))
    return success(row)
  } catch (e) {
    return handleError('page-laws POST', e)
  }
}
