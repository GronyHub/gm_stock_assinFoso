import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { aliasMismatchWarning } from '@/lib/aliasSanity'
import { NextResponse } from 'next/server'

// POST { alias_name, item_id, alias_type?, source?, force? }
// source: 'sales' (default) | 'bills'
// force: bypass the singles/pack sanity warning after the caller has seen it
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { alias_name, item_id, alias_type = 'sr_variant', source = 'sales', force = false } = await req.json()
  if (!alias_name || !item_id) return NextResponse.json({ error: 'alias_name and item_id required' }, { status: 400 })

  const [target] = await sql`SELECT canonical_name FROM items WHERE id = ${item_id}`
  if (!target) return NextResponse.json({ error: 'Item not found' }, { status: 404 })
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
  } else {
    await sql`
      UPDATE sales_receipt_lines
      SET item_id = ${item_id}, resolved_name = ${target.canonical_name}, unresolved = false
      WHERE (item_id IS NULL OR unresolved = true)
        AND LOWER(TRIM(raw_item_name)) = LOWER(TRIM(${alias_name}))
    `
  }

  return NextResponse.json({ ok: true })
}
