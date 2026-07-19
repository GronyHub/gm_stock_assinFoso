import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { aliasMismatchWarning } from '@/lib/aliasSanity'
import { NextResponse } from 'next/server'

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await sql`DELETE FROM item_aliases WHERE id = ${Number(id)}`
  return NextResponse.json({ ok: true })
}

// PATCH { item_id, force? } — move alias to a different canonical item
// force: bypass the singles/pack sanity warning after the caller has seen it
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { item_id, force = false } = await req.json()

  const [alias] = await sql`SELECT alias_name FROM item_aliases WHERE id = ${Number(id)}`
  if (!alias) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [item] = await sql`SELECT canonical_name FROM items WHERE id = ${item_id}`
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  if (!force) {
    const warning = aliasMismatchWarning(alias.alias_name, item.canonical_name)
    if (warning) return NextResponse.json({ requires_confirmation: true, warning }, { status: 409 })
  }

  // Update the alias to point to the new item
  await sql`UPDATE item_aliases SET item_id = ${item_id} WHERE id = ${Number(id)}`

  // Backfill sales lines that used this alias name
  await sql`
    UPDATE sales_receipt_lines
    SET item_id = ${item_id}, resolved_name = ${item.canonical_name}, unresolved = false
    WHERE LOWER(TRIM(raw_item_name)) = LOWER(TRIM(${alias.alias_name}))
  `

  return NextResponse.json({ ok: true })
}
