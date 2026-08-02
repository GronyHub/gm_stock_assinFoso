import sql from '@/lib/db'
import { mergeItems } from '@/lib/mergeItems'
import { NextResponse } from 'next/server'

export async function POST() {
  const before = await sql`
    SELECT i.id, i.canonical_name, i.status, s.calculated_soh
    FROM items i LEFT JOIN item_stock_summary s ON s.item_id = i.id
    WHERE i.id IN (4, 382)
  `
  const result = await mergeItems(382, 4)

  const after = await sql`
    SELECT i.id, i.canonical_name, i.status, s.calculated_soh
    FROM items i LEFT JOIN item_stock_summary s ON s.item_id = i.id
    WHERE i.id IN (4, 382)
  `
  const billLine = await sql`SELECT id, bill_id, item_id, resolved_name FROM bill_lines WHERE id = 518`

  return NextResponse.json({ before, result, after, billLine })
}
