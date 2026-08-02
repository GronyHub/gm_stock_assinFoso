import sql from '@/lib/db'
import { NextResponse } from 'next/server'

const ITEM_ID = 378

export async function GET() {
  const [item] = await sql`SELECT id, canonical_name, status FROM items WHERE id = ${ITEM_ID}`
  const lines = await sql`
    SELECT il.id, il.invoice_id, il.item_id, il.quantity, il.item_total, iv.invoice_date::text, iv.customer_name
    FROM invoice_lines il LEFT JOIN invoices iv ON iv.id = il.invoice_id
    WHERE il.item_id = ${ITEM_ID} ORDER BY iv.invoice_date
  `
  const [[sales], [bills], [counts], [aliases]] = await Promise.all([
    sql`SELECT COUNT(*)::int AS n FROM sales_receipt_lines WHERE item_id = ${ITEM_ID}`,
    sql`SELECT COUNT(*)::int AS n FROM bill_lines WHERE item_id = ${ITEM_ID}`,
    sql`SELECT COUNT(*)::int AS n FROM stock_counts WHERE item_id = ${ITEM_ID}`,
    sql`SELECT COUNT(*)::int AS n FROM item_aliases WHERE item_id = ${ITEM_ID}`,
  ])
  return NextResponse.json({ item, invoiceLines: lines, sales: sales.n, bills: bills.n, counts: counts.n, aliases: aliases.n })
}

export async function POST() {
  const [item] = await sql`SELECT id, canonical_name FROM items WHERE id = ${ITEM_ID}`
  if (!item) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const lines = await sql`
    SELECT il.id, il.item_total, iv.invoice_date::text AS invoice_date, iv.customer_name
    FROM invoice_lines il LEFT JOIN invoices iv ON iv.id = il.invoice_id
    WHERE il.item_id = ${ITEM_ID}
  ` as { id: number; item_total: string; invoice_date: string | null; customer_name: string | null }[]

  const createdExpenses = []
  for (const l of lines) {
    const entry = await sql`SELECT COALESCE(MAX(entry_number::int), 0) + 1 AS next FROM expenses WHERE entry_number ~ '^[0-9]+$'`
    const entryNumber = String(entry[0].next)
    const zohoExpenseId = `MIGRATED-DELIVERY-${l.id}-${Date.now()}`
    const date = l.invoice_date ?? new Date().toISOString().slice(0, 10)
    const [row] = await sql`
      INSERT INTO expenses (zoho_expense_id, expense_date, expense_account, description, vendor_name, amount, total,
                            source, entry_number, entered_by)
      VALUES (${zohoExpenseId}, ${date}, 'Delivery', ${'Moved from item "Delivery" (was invoice line ' + l.id + (l.customer_name ? ', invoiced to ' + l.customer_name : '') + ')'},
              ${l.customer_name}, ${l.item_total}, ${l.item_total}, 'app', ${entryNumber}, 'system-migration')
      RETURNING id, expense_date::date AS expense_date, amount
    `
    createdExpenses.push(row)
  }

  await sql`DELETE FROM invoice_lines WHERE item_id = ${ITEM_ID}`
  await sql`DELETE FROM item_aliases WHERE item_id = ${ITEM_ID}`
  await sql`DELETE FROM dismissed_duplicates WHERE item_id1 = ${ITEM_ID} OR item_id2 = ${ITEM_ID}`
  await sql`DELETE FROM items WHERE id = ${ITEM_ID}`

  return NextResponse.json({ deletedItem: item.canonical_name, movedInvoiceLines: lines.length, createdExpenses })
}
