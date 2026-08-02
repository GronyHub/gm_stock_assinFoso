import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST() {
  // Did deleting "A4 SHEETS MAMBO" (id 388) earlier tonight remove the only
  // candidate for the unresolved invoice_line "A4 SHEET MAMBO"?
  const mamboCandidates = await sql`
    SELECT id, canonical_name, status FROM items WHERE canonical_name ILIKE '%mambo%'
  `
  const deleteLog = await sql`
    SELECT id, staff_name, action, details, created_at FROM activity_logs
    WHERE details ILIKE '%mambo%' ORDER BY created_at
  `
  return NextResponse.json({ mamboCandidates, deleteLog })
}

export async function GET() {
  const invoiceLinesCols = await sql`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'invoice_lines'
  `

  const salesUnresolved = await sql`
    SELECT COUNT(*)::int AS n FROM sales_receipt_lines WHERE item_id IS NULL OR unresolved = true
  `
  const salesUnresolvedSample = await sql`
    SELECT id, receipt_id, raw_item_name, resolved_name, item_id, unresolved
    FROM sales_receipt_lines WHERE item_id IS NULL OR unresolved = true
    ORDER BY id DESC LIMIT 15
  `

  const billsUnresolved = await sql`
    SELECT COUNT(*)::int AS n FROM bill_lines WHERE item_id IS NULL OR unresolved = true
  `
  const billsUnresolvedSample = await sql`
    SELECT id, bill_id, raw_item_name, resolved_name, item_id, unresolved
    FROM bill_lines WHERE item_id IS NULL OR unresolved = true
    ORDER BY id DESC LIMIT 15
  `

  const invoiceLinesUnresolved = await sql`SELECT COUNT(*)::int AS n FROM invoice_lines WHERE item_id IS NULL`.catch(() => [{ n: null }])
  const invoiceLinesUnresolvedSample = await sql`
    SELECT il.id, il.invoice_id, il.raw_item_name, il.item_id, iv.invoice_date::text, iv.customer_name
    FROM invoice_lines il LEFT JOIN invoices iv ON iv.id = il.invoice_id
    WHERE il.item_id IS NULL
    ORDER BY il.id DESC LIMIT 15
  `.catch(() => [])
  const invoiceLinesTotal = await sql`SELECT COUNT(*)::int AS n FROM invoice_lines`

  // Text matches an item name but item_id link is missing (name exists, just not linked)
  const salesNameExistsButUnlinked = await sql`
    SELECT COUNT(*)::int AS n
    FROM sales_receipt_lines srl
    JOIN items i ON LOWER(i.canonical_name) = LOWER(COALESCE(srl.resolved_name, srl.raw_item_name))
    WHERE srl.item_id IS NULL
  `
  const billsNameExistsButUnlinked = await sql`
    SELECT COUNT(*)::int AS n
    FROM bill_lines bl
    JOIN items i ON LOWER(i.canonical_name) = LOWER(COALESCE(bl.resolved_name, bl.raw_item_name))
    WHERE bl.item_id IS NULL
  `

  // Text doesn't match any item canonical_name AND doesn't match any alias either
  const salesNoMatchAtAll = await sql`
    SELECT DISTINCT COALESCE(resolved_name, raw_item_name) AS name, COUNT(*)::int AS cnt
    FROM sales_receipt_lines srl
    WHERE NOT EXISTS (SELECT 1 FROM items i WHERE LOWER(i.canonical_name) = LOWER(COALESCE(srl.resolved_name, srl.raw_item_name)))
      AND NOT EXISTS (SELECT 1 FROM item_aliases a WHERE LOWER(a.alias_name) = LOWER(COALESCE(srl.resolved_name, srl.raw_item_name)))
    GROUP BY COALESCE(resolved_name, raw_item_name)
    ORDER BY cnt DESC LIMIT 20
  `
  const billsNoMatchAtAll = await sql`
    SELECT DISTINCT COALESCE(resolved_name, raw_item_name) AS name, COUNT(*)::int AS cnt
    FROM bill_lines bl
    WHERE NOT EXISTS (SELECT 1 FROM items i WHERE LOWER(i.canonical_name) = LOWER(COALESCE(bl.resolved_name, bl.raw_item_name)))
      AND NOT EXISTS (SELECT 1 FROM item_aliases a WHERE LOWER(a.alias_name) = LOWER(COALESCE(bl.resolved_name, bl.raw_item_name)))
    GROUP BY COALESCE(resolved_name, raw_item_name)
    ORDER BY cnt DESC LIMIT 20
  `

  return NextResponse.json({
    invoiceLinesCols,
    salesUnresolved: salesUnresolved[0].n, salesUnresolvedSample,
    billsUnresolved: billsUnresolved[0].n, billsUnresolvedSample,
    invoiceLinesTotal: invoiceLinesTotal[0].n,
    invoiceLinesUnresolved: invoiceLinesUnresolved[0].n, invoiceLinesUnresolvedSample,
    salesNameExistsButUnlinked: salesNameExistsButUnlinked[0].n,
    billsNameExistsButUnlinked: billsNameExistsButUnlinked[0].n,
    salesNoMatchAtAll,
    billsNoMatchAtAll,
  })
}
