import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// Get custom law ordering for a specific scope
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({}, { status: 401 })

  const scopeKey = req.nextUrl.searchParams.get('scopeKey')
  if (!scopeKey) return NextResponse.json({ error: 'scopeKey required' }, { status: 400 })

  await sql`CREATE TABLE IF NOT EXISTS law_order (scope_key TEXT, username TEXT, order_json TEXT, PRIMARY KEY (scope_key, username))`.catch(() => {})

  const row = await sql`SELECT order_json FROM law_order WHERE scope_key = ${scopeKey} AND username = ${(session.user as { username?: string } | undefined)?.username || 'anonymous'}`
  if (row.length === 0) return NextResponse.json({ order: [] })

  try {
    const parsed = JSON.parse(row[0].order_json)
    if (Array.isArray(parsed)) return NextResponse.json({ order: parsed })
  } catch { /* ignore malformed row */ }

  return NextResponse.json({ order: [] })
}

// Save custom law ordering for a specific scope
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { scopeKey, order } = await req.json()
  if (!scopeKey) return NextResponse.json({ error: 'scopeKey required' }, { status: 400 })
  if (!Array.isArray(order) || !order.every(k => typeof k === 'string')) {
    return NextResponse.json({ error: 'order must be an array of strings' }, { status: 400 })
  }

  await sql`CREATE TABLE IF NOT EXISTS law_order (scope_key TEXT, username TEXT, order_json TEXT, PRIMARY KEY (scope_key, username))`.catch(() => {})

  const orderJson = JSON.stringify(order)
  const username = (session.user as { username?: string } | undefined)?.username || 'anonymous'
  await sql`
    INSERT INTO law_order (scope_key, username, order_json) VALUES (${scopeKey}, ${username}, ${orderJson})
    ON CONFLICT (scope_key, username) DO UPDATE SET order_json = ${orderJson}
  `

  return NextResponse.json({ ok: true })
}
