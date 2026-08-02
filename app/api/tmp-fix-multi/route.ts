import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const billLineCounts = await sql`
    SELECT bill_id, COUNT(*)::int AS n FROM bill_lines WHERE bill_id IN (86, 197, 212) GROUP BY bill_id
  `
  return NextResponse.json({ billLineCounts })
}

export async function PATCH() {
  const remainingUnresolvedBills = await sql`
    SELECT raw_item_name, COUNT(*)::int AS cnt FROM bill_lines
    WHERE item_id IS NULL OR unresolved = true GROUP BY raw_item_name
  `
  const remainingUnresolvedReceipts = await sql`
    SELECT raw_item_name, COUNT(*)::int AS cnt FROM invoice_lines
    WHERE item_id IS NULL OR unresolved = true GROUP BY raw_item_name
  `
  const [inv51] = await sql`SELECT iv.total, COALESCE(SUM(il.item_total),0) AS lines_sum FROM invoices iv LEFT JOIN invoice_lines il ON il.invoice_id = iv.id WHERE iv.id = 51 GROUP BY iv.total`
  const [inv63] = await sql`SELECT iv.total, COALESCE(SUM(il.item_total),0) AS lines_sum FROM invoices iv LEFT JOIN invoice_lines il ON il.invoice_id = iv.id WHERE iv.id = 63 GROUP BY iv.total`
  const [colored] = await sql`SELECT id, canonical_name, cf_group, status FROM items WHERE id = 429`
  return NextResponse.json({ remainingUnresolvedBills, remainingUnresolvedReceipts, invoice51: inv51, invoice63: inv63, colored })
}

export async function POST() {
  const results: Record<string, unknown> = {}

  // A. Delivery-charge bills -> Expenses, whole bill removed (each has
  // exactly one line: the charge itself, confirmed by GET above)
  const bills = [
    { billId: 86, lineId: 382 },
    { billId: 197, lineId: 493 },
    { billId: 212, lineId: 508 },
  ]
  const billResults = []
  for (const { billId, lineId } of bills) {
    const [bill] = await sql`SELECT id, bill_number, bill_date::text, vendor_name, total FROM bills WHERE id = ${billId}`
    const [line] = await sql`SELECT raw_item_name FROM bill_lines WHERE id = ${lineId}`
    if (!bill || !line) { billResults.push({ billId, error: 'not found' }); continue }

    const entry = await sql`SELECT COALESCE(MAX(entry_number::int), 0) + 1 AS next FROM expenses WHERE entry_number ~ '^[0-9]+$'`
    const entryNumber = String(entry[0].next)
    const zohoExpenseId = `MIGRATED-DELIVERY-BILL-${billId}-${Date.now()}`
    const [expense] = await sql`
      INSERT INTO expenses (zoho_expense_id, expense_date, expense_account, description, vendor_name, amount, total,
                            source, entry_number, entered_by)
      VALUES (${zohoExpenseId}, ${bill.bill_date}, 'Delivery',
              ${'Moved from bill ' + bill.bill_number + ' (' + line.raw_item_name + ')'},
              ${bill.vendor_name}, ${bill.total}, ${bill.total}, 'app', ${entryNumber}, 'system-migration')
      RETURNING id, expense_date::date AS expense_date, amount
    `
    await sql`DELETE FROM bill_lines WHERE id = ${lineId}`
    await sql`DELETE FROM bills WHERE id = ${billId}`
    billResults.push({ billId, billNumber: bill.bill_number, deleted: true, expense })
  }
  results.bills = billResults

  // B. Fix the 2 "Delivery" invoices' stale totals from earlier tonight
  const invoiceFixes = []
  for (const invoiceId of [51, 63]) {
    const [before] = await sql`
      SELECT iv.id, iv.total, COALESCE(SUM(il.item_total), 0) AS lines_sum
      FROM invoices iv LEFT JOIN invoice_lines il ON il.invoice_id = iv.id
      WHERE iv.id = ${invoiceId} GROUP BY iv.id, iv.total
    `
    await sql`UPDATE invoices SET total = ${before.lines_sum} WHERE id = ${invoiceId}`
    invoiceFixes.push({ invoiceId, oldTotal: before.total, newTotal: before.lines_sum })
  }
  results.invoiceTotalFixes = invoiceFixes

  // C. BESTPRINT 250G TONER REFILL -> Best print 250g Toner Toner Refil (id 241)
  const [bpTarget] = await sql`SELECT canonical_name FROM items WHERE id = 241`
  await sql`
    INSERT INTO item_aliases (item_id, alias_name, alias_type, source)
    VALUES (241, 'BESTPRINT 250G TONER REFILL', 'sr_variant', 'manual_review')
    ON CONFLICT (item_id, alias_name, alias_type) DO NOTHING
  `
  const bpUpdated = await sql`
    UPDATE invoice_lines SET item_id = 241, resolved_name = ${bpTarget.canonical_name}, unresolved = false
    WHERE (item_id IS NULL OR unresolved = true) AND LOWER(TRIM(raw_item_name)) = LOWER(TRIM('BESTPRINT 250G TONER REFILL'))
    RETURNING id
  `
  results.bestPrintResolved = { itemId: 241, matchedTo: bpTarget.canonical_name, linesUpdated: bpUpdated.length }

  // D. Coloured A4 Sheet (Blue) -> new standalone item
  const zohoId = 'INTERNAL_COLOURED_A4_SHEET_BLUE'
  const [newItem] = await sql`
    INSERT INTO items (zoho_item_id, zoho_item_name, canonical_name, cf_group, selling_rate, product_type, source)
    VALUES (${zohoId}, 'Coloured A4 Sheet (Blue)', 'Coloured A4 Sheet (Blue)', 'Plain Papers', 160, 'goods', 'internal')
    RETURNING id, canonical_name
  `
  const coloredUpdated = await sql`
    UPDATE invoice_lines SET item_id = ${newItem.id}, resolved_name = ${newItem.canonical_name}, unresolved = false
    WHERE LOWER(TRIM(raw_item_name)) = LOWER(TRIM('Coloured A4 Sheet (Blue)'))
    RETURNING id
  `
  results.colouredA4NewItem = { itemId: newItem.id, canonicalName: newItem.canonical_name, linesUpdated: coloredUpdated.length }

  return NextResponse.json(results)
}
