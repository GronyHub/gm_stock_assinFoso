import { requireAuth, notFound, success } from '@/lib/api'
import { getIdParam } from '@/lib/api/params'
import sql from '@/lib/db'
import { aliasMismatchWarning } from '@/lib/aliasSanity'
import { NextResponse } from 'next/server'

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth()
  if (error) return error
  const aliasId = await getIdParam(params)
  await sql`DELETE FROM item_aliases WHERE id = ${aliasId}`
  return success({ ok: true })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth()
  if (error) return error
  const aliasId = await getIdParam(params)
  const { item_id, force = false } = await req.json()

  const [alias] = await sql`SELECT alias_name FROM item_aliases WHERE id = ${aliasId}`
  if (!alias) return notFound()

  const [item] = await sql`SELECT canonical_name FROM items WHERE id = ${item_id}`
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  if (!force) {
    const warning = aliasMismatchWarning(alias.alias_name, item.canonical_name)
    if (warning) return NextResponse.json({ requires_confirmation: true, warning }, { status: 409 })
  }

  await sql`UPDATE item_aliases SET item_id = ${item_id} WHERE id = ${aliasId}`

  await sql`
    UPDATE sales_receipt_lines
    SET item_id = ${item_id}, resolved_name = ${item.canonical_name}, unresolved = false
    WHERE LOWER(TRIM(raw_item_name)) = LOWER(TRIM(${alias.alias_name}))
  `
  await sql`
    UPDATE bill_lines
    SET item_id = ${item_id}, resolved_name = ${item.canonical_name}, unresolved = false
    WHERE LOWER(TRIM(raw_item_name)) = LOWER(TRIM(${alias.alias_name}))
  `

  return success({ ok: true })
}
