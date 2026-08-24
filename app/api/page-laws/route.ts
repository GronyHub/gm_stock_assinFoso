import { requireAuth, badRequest, success, unauthorized } from '@/lib/api'
import { ensureDbInitialized } from '@/lib/api/dbInitCache'
import sql from '@/lib/db'
import { ensurePageLawsTable } from '@/lib/pageLaws'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return unauthorized()

  const scopeKey = req.nextUrl.searchParams.get('scopeKey')
  if (!scopeKey) return badRequest('Missing scopeKey')

  await ensureDbInitialized()
  await ensurePageLawsTable()
  const rows = await sql`SELECT id, text, created_at FROM page_laws WHERE scope_key = ${scopeKey} ORDER BY id`
  return success(rows)
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  const { scopeKey, text } = await req.json()
  if (!scopeKey || !text?.trim()) return badRequest('Missing scopeKey or text')

  await ensureDbInitialized()
  await ensurePageLawsTable()
  const [row] = await sql`
    INSERT INTO page_laws (scope_key, text) VALUES (${scopeKey}, ${text.trim()})
    RETURNING id, text, created_at
  `
  return success(row)
}
