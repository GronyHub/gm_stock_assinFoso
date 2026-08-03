import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const billNumber = `TMP-DELTEST-${Date.now()}`
    const [item] = await sql`SELECT id, canonical_name FROM items LIMIT 1`

    const [bill] = await sql`
      INSERT INTO bills (bill_number, bill_date, vendor_name, total, subtotal, status, source, zoho_bill_id)
      VALUES (${billNumber}, CURRENT_DATE, 'Tmp Test Vendor', 100, 100, 'paid', 'app', ${billNumber})
      RETURNING id
    `
    const [line] = await sql`
      INSERT INTO bill_lines (bill_id, item_id, raw_item_name, resolved_name, quantity, unit_price, item_total, unresolved, source)
      VALUES (${bill.id}, ${item.id}, ${item.canonical_name}, ${item.canonical_name}, 1, 100, 100, false, 'app')
      RETURNING id
    `

    const before = {
      billExists: (await sql`SELECT 1 FROM bills WHERE id = ${bill.id}`).length > 0,
      lineExists: (await sql`SELECT 1 FROM bill_lines WHERE id = ${line.id}`).length > 0,
    }

    // Exact same statements as the real DELETE handler.
    await sql`DELETE FROM bill_lines WHERE bill_id = ${bill.id}`
    await sql`DELETE FROM bills WHERE id = ${bill.id}`

    const after = {
      billExists: (await sql`SELECT 1 FROM bills WHERE id = ${bill.id}`).length > 0,
      lineExists: (await sql`SELECT 1 FROM bill_lines WHERE id = ${line.id}`).length > 0,
      orphanLines: (await sql`SELECT COUNT(*)::int AS n FROM bill_lines WHERE bill_id = ${bill.id}`)[0],
    }

    return NextResponse.json({ testBillId: bill.id, testLineId: line.id, before, after })
  } catch (e) {
    console.error('tmp-test-bill-delete error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
