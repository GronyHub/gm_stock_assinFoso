import { requireAuth, badRequest, success, unauthorized, handleError } from '@/lib/api'
import { ensureDbInitialized } from '@/lib/api/dbInitCache'
import sql from '@/lib/db'
import { ensureCompanyLaws, cleanLawBody } from '@/lib/pageLaws'
import { LAW_CATEGORIES, LAW_TYPES, DAY_CODES, LAW_FREQUENCIES, CATEGORY_FOR_SCOPE } from '@/lib/lawCategories'
import { isOwnerLevel } from '@/lib/roles'
import { syncLawTile } from '@/lib/lawTiles'
import { NextRequest } from 'next/server'
import { isManagerName } from '@/lib/signers'
import { actorKey } from '@/lib/clockState'
import { appliesOn } from '@/lib/dailyChecksShared'

// Staff see only the all-staff laws; managers and owners see both sections. Staff never see drafts.
const visibleLaws = (rows: { status?: string; audience?: string }[], owner: boolean, manager: boolean) =>
  rows.filter(r => (owner || r.status !== 'draft') && (manager || owner || r.audience !== 'managers'))

// For laws that have a checklist tile: how often it was really done lately, so the law shows how well it is kept.
async function withKept<T extends { tile_id?: number | null }>(rows: T[]): Promise<(T & { kept?: { done: number; of: number; last: string | null; missed_last: boolean } })[]> {
  const ids = rows.map(r => r.tile_id).filter((x): x is number => !!x)
  if (!ids.length) return rows
  try {
    const ev = await sql`SELECT tile_id, day::text AS day FROM daily_check_events WHERE tile_id = ANY(${ids}) AND value = 'Done' AND day >= (CURRENT_DATE - 13)::text ORDER BY day` as unknown as { tile_id: number; day: string }[]
    const tl = await sql`SELECT id, frequency, days FROM daily_check_tiles WHERE id = ANY(${ids})` as unknown as { id: number; frequency: string; days: string | null }[]
    const today = new Date()
    return rows.map(r => {
      const t = tl.find(x => x.id === r.tile_id); if (!t) return r
      const mine = ev.filter(e => e.tile_id === r.tile_id)
      const doneDays = new Set(mine.map(e => e.day.slice(0, 10)))
      const last = mine.length ? mine[mine.length - 1].day.slice(0, 10) : null
      if (t.frequency !== 'daily') return { ...r, kept: { done: doneDays.size, of: 0, last, missed_last: false } }
      let of = 0, done = 0, missedLast = false
      for (let i = 1; i <= 7; i++) {
        const d = new Date(today); d.setUTCDate(d.getUTCDate() - i)
        const k = d.toISOString().slice(0, 10)
        if (d.getUTCDay() === 0 || !appliesOn(t, k)) continue
        of++; if (doneDays.has(k)) done++; else if (of === 1) missedLast = true
      }
      return { ...r, kept: { done, of, last, missed_last: missedLast } }
    })
  } catch { return rows }
}

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
      const rows = await sql`SELECT id, text, scope_key, created_at, display_in_carousel, carousel_message, carousel_order, carousel_type, category, subcategory, code, title, audience, reminder, violations, not_violation, COALESCE(jsonb_array_length(NULLIF(quiz, '')::jsonb), 0) AS quiz_n, law_type, days, law_time, frequency, minutes, dos, donts, status, tile_id, proof, points FROM page_laws WHERE scope_key = ${scopeKey} ORDER BY id`
      return success(await withKept(visibleLaws(rows as { status?: string; audience?: string; tile_id?: number | null }[], owner, isManagerName(actorKey(me?.user as any))) as { tile_id?: number | null }[]))
    } else {
      // Fetch all laws across all scopes
      const rows = await sql`SELECT id, text, scope_key, created_at, display_in_carousel, carousel_message, carousel_order, carousel_type, category, subcategory, code, title, audience, reminder, violations, not_violation, COALESCE(jsonb_array_length(NULLIF(quiz, '')::jsonb), 0) AS quiz_n, law_type, days, law_time, frequency, minutes, dos, donts, status, tile_id, proof, points FROM page_laws ORDER BY scope_key, id`
      return success(await withKept(visibleLaws(rows as { status?: string; audience?: string; tile_id?: number | null }[], owner, isManagerName(actorKey(me?.user as any))) as { tile_id?: number | null }[]))
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
      INSERT INTO page_laws (scope_key, text, display_in_carousel, carousel_type, category, subcategory, law_type, days, law_time, frequency, minutes, dos, donts, proof, points, violations, not_violation, title, audience, reminder)
      VALUES (${scopeKey}, ${law.text}, false, 'law', ${category}, ${law.subcategory}, ${law.law_type}, ${law.days}, ${law.law_time}, ${law.frequency}, ${law.minutes}, ${law.dos}, ${law.donts}, ${law.proof}, ${law.points}, ${JSON.stringify(law.violations)}, ${law.not_violation}, ${law.title}, ${law.audience}, ${law.reminder})
      RETURNING id, text, scope_key, created_at, display_in_carousel, carousel_message, carousel_order, carousel_type, category, subcategory, code, title, audience, reminder, violations, not_violation, COALESCE(jsonb_array_length(NULLIF(quiz, '')::jsonb), 0) AS quiz_n, law_type, days, law_time, frequency, minutes, dos, donts, status, tile_id, proof, points
    `
    await syncLawTile(row.id).catch(e => console.error('law tile sync failed:', e instanceof Error ? e.message : String(e)))
    return success(row)
  } catch (e) {
    return handleError('page-laws POST', e)
  }
}
