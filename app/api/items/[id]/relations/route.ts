import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// PUT { aliases?: string[], matches?: string[] }
// Fully replaces this item's alias list and/or good-service match list with
// the given values. `matches` are counterpart names (Services if this item
// is a Good, or Goods if this item is a Service) -- direction is inferred
// from the item's own product_type.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const itemId = Number(id)
  const { aliases, matches } = await req.json()

  const [item] = await sql`SELECT canonical_name, product_type FROM items WHERE id = ${itemId}`
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  try {
    if (Array.isArray(aliases)) {
      await sql`DELETE FROM item_aliases WHERE item_id = ${itemId}`
      for (const name of aliases) {
        const trimmed = String(name).trim()
        if (!trimmed) continue
        await sql`
          INSERT INTO item_aliases (item_id, alias_name, alias_type, source)
          VALUES (${itemId}, ${trimmed}, 'manual', 'manual_edit')
          ON CONFLICT (item_id, alias_name, alias_type) DO NOTHING
        `
        await sql`
          UPDATE sales_receipt_lines
          SET item_id = ${itemId}, resolved_name = ${item.canonical_name}, unresolved = false
          WHERE LOWER(TRIM(raw_item_name)) = LOWER(TRIM(${trimmed}))
        `
      }
    }

    if (Array.isArray(matches)) {
      const isService = item.product_type === 'service'
      if (isService) {
        await sql`DELETE FROM good_service_matches WHERE LOWER(TRIM(service_name)) = LOWER(TRIM(${item.canonical_name}))`
      } else {
        await sql`DELETE FROM good_service_matches WHERE LOWER(TRIM(good_name)) = LOWER(TRIM(${item.canonical_name}))`
      }
      for (const name of matches) {
        const trimmed = String(name).trim()
        if (!trimmed) continue
        const goodName = isService ? trimmed : item.canonical_name
        const serviceName = isService ? item.canonical_name : trimmed
        await sql`
          INSERT INTO good_service_matches (good_name, service_name)
          VALUES (${goodName}, ${serviceName})
          ON CONFLICT (good_name, service_name) DO NOTHING
        `
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('item relations PUT error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not save: ${detail}` }, { status: 500 })
  }
}
