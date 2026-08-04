import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST() {
  const id = 353
  const newName = 'A4 sticker 2'
  const [current] = await sql`SELECT canonical_name FROM items WHERE id = ${id}`
  if (!current) return NextResponse.json({ error: 'not found' }, { status: 404 })

  await sql`UPDATE items SET canonical_name = ${newName}, zoho_item_name = ${newName} WHERE id = ${id}`
  await sql`
    INSERT INTO item_aliases (item_id, alias_name, alias_type, source)
    VALUES (${id}, ${current.canonical_name}, 'canonical', 'rename')
    ON CONFLICT (item_id, alias_name, alias_type) DO NOTHING
  `
  await sql`UPDATE sales_receipt_lines SET resolved_name = ${newName} WHERE item_id = ${id}`
  await sql`UPDATE bill_lines SET resolved_name = ${newName} WHERE item_id = ${id}`
  await sql`UPDATE stock_counts SET item_name = ${newName} WHERE item_id = ${id}`

  return NextResponse.json({ ok: true, from: current.canonical_name, to: newName })
}
