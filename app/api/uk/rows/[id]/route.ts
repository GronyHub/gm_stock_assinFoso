import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

function isAllowed(session: any) {
  const username = ((session?.user as any)?.username as string | undefined)?.toLowerCase()
  return username === 'grony'
}

// Upserts whichever cells are included in `values` -- a single cell edit
// sends just that one column, not the whole row.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !isAllowed(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const rowId = Number(id)
  const { values } = await req.json()
  const entries: [string, string][] = values && typeof values === 'object' ? Object.entries(values) : []

  for (const [columnId, value] of entries) {
    const text = typeof value === 'string' ? value : String(value ?? '')
    await sql`
      INSERT INTO uk_cells (row_id, column_id, value) VALUES (${rowId}, ${Number(columnId)}, ${text})
      ON CONFLICT (row_id, column_id) DO UPDATE SET value = ${text}
    `
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !isAllowed(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  await sql`DELETE FROM uk_rows WHERE id = ${Number(id)}`
  return NextResponse.json({ ok: true })
}
