import { requireAuth, badRequest, notFound, success } from '@/lib/api'
import sql from '@/lib/db'
import { aliasMismatchWarning } from '@/lib/aliasSanity'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { error } = await requireAuth()
  if (error) return error

  const { raw_name, item_id, source, force = false } = await req.json()
  if (!raw_name || !item_id || !source)
    return badRequest('raw_name, item_id and source required')

  const [item] = await sql`SELECT canonical_name FROM items WHERE id = ${item_id}`
  if (!item) return notFound()

  if (!force) {
    const warning = aliasMismatchWarning(raw_name, item.canonical_name)
    if (warning) return NextResponse.json({ requires_confirmation: true, warning }, { status: 409 })
  }

  if (source === 'zoho_bills') {
    await sql`
      UPDATE bill_lines
      SET item_id = ${item_id}, resolved_name = ${item.canonical_name}, unresolved = false
      WHERE source = 'zoho_historical'
        AND LOWER(TRIM(raw_item_name)) = LOWER(TRIM(${raw_name}))
    `
  } else {
    await sql`
      UPDATE sales_receipt_lines
      SET item_id = ${item_id}, resolved_name = ${item.canonical_name}, unresolved = false
      WHERE source = 'zoho_historical'
        AND LOWER(TRIM(raw_item_name)) = LOWER(TRIM(${raw_name}))
    `
  }

  await sql`
    INSERT INTO item_aliases (item_id, alias_name, alias_type, source)
    VALUES (${item_id}, ${raw_name}, 'sr_variant', 'zoho_correction')
    ON CONFLICT (item_id, alias_name, alias_type) DO NOTHING
  `

  return success({ ok: true })
}
