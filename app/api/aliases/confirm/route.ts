import { requireAuth, badRequest, notFound, success } from '@/lib/api'
import sql from '@/lib/db'
import { aliasMismatchWarning } from '@/lib/aliasSanity'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { error } = await requireAuth()
  if (error) return error

  const { alias_name, item_id, alias_type = 'sr_variant', source = 'sales', force = false } = await req.json()
  if (!alias_name || !item_id) return badRequest('alias_name and item_id required')

  const [target] = await sql`SELECT canonical_name FROM items WHERE id = ${item_id}`
  if (!target) return notFound()
  if (!force) {
    const warning = aliasMismatchWarning(alias_name, target.canonical_name)
    if (warning) return NextResponse.json({ requires_confirmation: true, warning }, { status: 409 })
  }

  await sql`
    INSERT INTO item_aliases (item_id, alias_name, alias_type, source)
    VALUES (${item_id}, ${alias_name}, ${alias_type}, 'manual_review')
    ON CONFLICT (item_id, alias_name, alias_type) DO NOTHING
  `

  if (source === 'bills') {
    await sql`
      UPDATE bill_lines
      SET item_id = ${item_id}, resolved_name = ${target.canonical_name}, unresolved = false
      WHERE (item_id IS NULL OR unresolved = true)
        AND LOWER(TRIM(raw_item_name)) = LOWER(TRIM(${alias_name}))
    `
  } else if (source === 'invoices') {
    await sql`
      UPDATE invoice_lines
      SET item_id = ${item_id}, resolved_name = ${target.canonical_name}, unresolved = false
      WHERE (item_id IS NULL OR unresolved = true)
        AND LOWER(TRIM(raw_item_name)) = LOWER(TRIM(${alias_name}))
    `
  } else {
    await sql`
      UPDATE sales_receipt_lines
      SET item_id = ${item_id}, resolved_name = ${target.canonical_name}, unresolved = false
      WHERE (item_id IS NULL OR unresolved = true)
        AND LOWER(TRIM(raw_item_name)) = LOWER(TRIM(${alias_name}))
    `
  }

  return success({ ok: true })
}
