import { requireAuth, notFound, badRequest, success, handleError } from '@/lib/api'
import { getIdParam } from '@/lib/api/params'
import sql from '@/lib/db'
import { aliasMismatchWarning } from '@/lib/aliasSanity'
import { NextRequest } from 'next/server'

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const aliasId = await getIdParam(params)
    await sql`DELETE FROM item_aliases WHERE id = ${aliasId}`
    return success({ ok: true })
  } catch (e) {
    return handleError('aliases/[id]', e)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const aliasId = await getIdParam(params)
    const { item_id, force = false } = await req.json()

    const [alias] = await sql`SELECT alias_name FROM item_aliases WHERE id = ${aliasId}`
    if (!alias) return notFound()

    const [item] = await sql`SELECT canonical_name FROM items WHERE id = ${item_id}`
    if (!item) return notFound()

    if (!force) {
      const warning = aliasMismatchWarning(alias.alias_name, item.canonical_name)
      if (warning) return success({ requires_confirmation: true, warning }, 409)
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
  } catch (e) {
    return handleError('aliases/[id]', e)
  }
}
