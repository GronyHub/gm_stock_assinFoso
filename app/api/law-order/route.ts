import { requireAuth, badRequest, success } from '@/lib/api'
import sql from '@/lib/db'
import { once } from '@/lib/once'
import { NextRequest } from 'next/server'

const ensureLawOrderTable = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS law_order (scope_key TEXT, username TEXT, order_json TEXT, PRIMARY KEY (scope_key, username))`.catch(() => {})
})

// Get custom law ordering for a specific scope
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const scopeKey = req.nextUrl.searchParams.get('scopeKey')
  if (!scopeKey) return badRequest('scopeKey required')

  await ensureLawOrderTable()

  const row = await sql`SELECT order_json FROM law_order WHERE scope_key = ${scopeKey} AND username = ${(session.user as { username?: string } | undefined)?.username || 'anonymous'}`
  if (row.length === 0) return success({ order: [] })

  try {
    const parsed = JSON.parse(row[0].order_json)
    if (Array.isArray(parsed)) return success({ order: parsed })
  } catch { /* ignore malformed row */ }

  return success({ order: [] })
}

// Save custom law ordering for a specific scope
export async function PATCH(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { scopeKey, order } = await req.json()
  if (!scopeKey) return badRequest('scopeKey required')
  if (!Array.isArray(order) || !order.every(k => typeof k === 'string')) {
    return badRequest('order must be an array of strings')
  }

  await ensureLawOrderTable()

  const orderJson = JSON.stringify(order)
  const username = (session.user as { username?: string } | undefined)?.username || 'anonymous'
  await sql`
    INSERT INTO law_order (scope_key, username, order_json) VALUES (${scopeKey}, ${username}, ${orderJson})
    ON CONFLICT (scope_key, username) DO UPDATE SET order_json = ${orderJson}
  `

  return success({ ok: true })
}
