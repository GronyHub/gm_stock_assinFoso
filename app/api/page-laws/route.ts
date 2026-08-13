import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { ensurePageLawsTable } from '@/lib/pageLaws'
import { NextRequest, NextResponse } from 'next/server'
import { initializeDatabase } from '@/lib/dbInitialize'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const scopeKey = req.nextUrl.searchParams.get('scopeKey')
  if (!scopeKey) return NextResponse.json({ error: 'Missing scopeKey' }, { status: 400 })

  await initializeDatabase()
  await ensurePageLawsTable()
  const rows = await sql`SELECT id, text, created_at FROM page_laws WHERE scope_key = ${scopeKey} ORDER BY id`
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { scopeKey, text } = await req.json()
  if (!scopeKey || !text?.trim()) return NextResponse.json({ error: 'Missing scopeKey or text' }, { status: 400 })

  await initializeDatabase()
  await ensurePageLawsTable()
  const [row] = await sql`
    INSERT INTO page_laws (scope_key, text) VALUES (${scopeKey}, ${text.trim()})
    RETURNING id, text, created_at
  `
  return NextResponse.json(row, { status: 201 })
}
