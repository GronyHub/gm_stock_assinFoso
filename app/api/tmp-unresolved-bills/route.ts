import sql from '@/lib/db'
import { NextResponse } from 'next/server'

const CANONICAL_NAME = 'Goods - Unspecified (Pre-Zoho)'
const ZOHO_ITEM_ID = 'INTERNAL_GOODS_-_UNSPECIFIED_(PRE-ZOHO)'
const TARGET_LINE_IDS = [355, 357] // "Goods ordered from Gentle = 1545" and "15.45* Goods ordered from Gentle = 15.45", both 2025-05-30

export async function GET() {
  const existingItem = await sql`SELECT id, canonical_name, status FROM items WHERE canonical_name = ${CANONICAL_NAME}`
  const lines = await sql`
    SELECT id, bill_id, raw_item_name, item_id, resolved_name, unresolved
    FROM bill_lines WHERE id = ANY(${TARGET_LINE_IDS})
  `
  return NextResponse.json({ existingItem, lines })
}

export async function POST() {
  try {
    const existing = await sql`SELECT id FROM items WHERE canonical_name = ${CANONICAL_NAME}`
    let itemId: number
    if (existing.length > 0) {
      itemId = existing[0].id as number
    } else {
      const inserted = await sql`
        INSERT INTO items (zoho_item_id, zoho_item_name, canonical_name, product_type, status, source, is_legacy)
        VALUES (${ZOHO_ITEM_ID}, ${CANONICAL_NAME}, ${CANONICAL_NAME}, 'goods', 'Active', 'internal', false)
        RETURNING id
      `
      itemId = inserted[0].id as number
    }

    const updated = await sql`
      UPDATE bill_lines
      SET item_id = ${itemId}, resolved_name = ${CANONICAL_NAME}, unresolved = false
      WHERE id = ANY(${TARGET_LINE_IDS})
      RETURNING id, bill_id, raw_item_name
    `

    return NextResponse.json({ itemId, updated })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}
