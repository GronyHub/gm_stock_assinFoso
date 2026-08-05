import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST() {
  const [item] = await sql`SELECT id, canonical_name FROM items WHERE id = 315`
  await sql`UPDATE item_aliases SET item_id = 315 WHERE id = 100`
  await sql`
    UPDATE sales_receipt_lines SET item_id = 315, resolved_name = ${item.canonical_name}, unresolved = false
    WHERE LOWER(TRIM(raw_item_name)) = 'a4 lamination'
  `
  await sql`
    UPDATE bill_lines SET item_id = 315, resolved_name = ${item.canonical_name}, unresolved = false
    WHERE LOWER(TRIM(raw_item_name)) = 'a4 lamination'
  `
  return NextResponse.json({ ok: true })
}
