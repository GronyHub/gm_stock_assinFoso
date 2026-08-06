import sql from '@/lib/db'
import { NextResponse } from 'next/server'

const NEW_ITEMS = ['Website Design', 'App Development']

export async function GET() {
  try {
    const existing = await sql`
      SELECT id, canonical_name, cf_group, product_type, status FROM items
      WHERE canonical_name = ANY(${NEW_ITEMS})
    `
    const created: unknown[] = []
    for (const name of NEW_ITEMS) {
      const already = (existing as { canonical_name: string }[]).some(e => e.canonical_name === name)
      if (already) continue
      const [row] = await sql`
        INSERT INTO items (zoho_item_id, zoho_item_name, canonical_name, cf_group, product_type, source)
        VALUES (
          ${'INTERNAL_' + name.toUpperCase().replace(/\s+/g, '_')},
          ${name}, ${name}, ${'Software Development'}, ${'service'}, 'internal'
        )
        RETURNING id, canonical_name, cf_group, product_type
      `
      created.push(row)
    }
    return NextResponse.json({ existingBefore: existing, created })
  } catch (e) {
    return NextResponse.json({ tmpError: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
