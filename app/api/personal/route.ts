import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

function isAllowed(session: any) {
  const role     = (session?.user as any)?.role     as string | undefined
  const username = ((session?.user as any)?.username as string | undefined)?.toLowerCase()
  return role === 'owner' || username === 'joe'
}

export async function GET() {
  const session = await auth()
  if (!session || !isAllowed(session)) return NextResponse.json([], { status: 403 })

  const entries = await sql`
    SELECT id, entry_date, description, amount, direction, category, notes, needs_review
    FROM grony_personal_ledger
    ORDER BY entry_date DESC, id DESC
  `
  return NextResponse.json(entries)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session || !isAllowed(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { entry_date, description, amount, direction, category, notes } = await req.json()
  if (!entry_date || !description || !amount || !direction) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  const [row] = await sql`
    INSERT INTO grony_personal_ledger (entry_date, description, amount, direction, category, notes, source)
    VALUES (${entry_date}, ${description}, ${amount}, ${direction}, ${category ?? 'Other'}, ${notes ?? null}, 'app')
    RETURNING id
  `
  return NextResponse.json({ id: row.id })
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session || !isAllowed(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, category, notes, description } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await sql`
    UPDATE grony_personal_ledger
    SET category    = COALESCE(${category ?? null}, category),
        notes       = COALESCE(${notes ?? null}, notes),
        description = COALESCE(${description ?? null}, description)
    WHERE id = ${id}
  `
  return NextResponse.json({ ok: true })
}
