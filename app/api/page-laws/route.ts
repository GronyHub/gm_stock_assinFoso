import { requireAuth, badRequest, success, unauthorized, handleError } from '@/lib/api'
import { ensureDbInitialized } from '@/lib/api/dbInitCache'
import sql from '@/lib/db'
import { ensurePageLawsTable } from '@/lib/pageLaws'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return unauthorized()

  const scopeKey = req.nextUrl.searchParams.get('scopeKey')
  if (!scopeKey) return badRequest('Missing scopeKey')

  try {
    await ensureDbInitialized()
    await ensurePageLawsTable()
    const rows = await sql`SELECT id, text, created_at, display_in_carousel, carousel_message, carousel_order, carousel_type FROM page_laws WHERE scope_key = ${scopeKey} ORDER BY id`
    return success(rows)
  } catch (e) {
    return handleError('page-laws GET', e)
  }
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  const { scopeKey, text } = await req.json()
  if (!scopeKey || !text?.trim()) return badRequest('Missing scopeKey or text')

  try {
    await ensureDbInitialized()
    await ensurePageLawsTable()
    const [row] = await sql`
      INSERT INTO page_laws (scope_key, text, display_in_carousel, carousel_type)
      VALUES (${scopeKey}, ${text.trim()}, false, 'law')
      RETURNING id, text, created_at, display_in_carousel, carousel_message, carousel_order, carousel_type
    `
    return success(row)
  } catch (e) {
    return handleError('page-laws POST', e)
  }
}
