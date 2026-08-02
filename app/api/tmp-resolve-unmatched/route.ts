import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// Replicates exactly what POST /api/aliases/confirm does per row, for the
// confident matches found while auditing unmatched sales/bills/receipts.
const RECEIPT_MATCHES: { rawName: string; itemId: number }[] = [
  { rawName: '26A Toner Cartridge', itemId: 121 },   // exact match, x2 invoice lines
  { rawName: 'A4 SHEET MAMBO', itemId: 6 },
  { rawName: 'Dell Ms11 Mouse', itemId: 65 },
  { rawName: 'A4 120 PHOTOPAPER', itemId: 15 },
  { rawName: 'HDMI 30M', itemId: 221 },
  { rawName: 'WHITE DL PACK', itemId: 102 },
  { rawName: '55A TONER CATRIDGE', itemId: 52 },
  { rawName: 'HDMI Display Cable Mini', itemId: 235 },
]

const SALES_MATCHES: { rawName: string; itemId: number }[] = [
  { rawName: 'Fueral Invitation Cards', itemId: 87 },
  { rawName: 'Invitation Card all others', itemId: 87 },
]

async function resolveOne(rawName: string, itemId: number, table: 'invoice_lines' | 'sales_receipt_lines') {
  const [target] = await sql`SELECT canonical_name FROM items WHERE id = ${itemId}`
  if (!target) return { rawName, itemId, error: 'item not found' }

  await sql`
    INSERT INTO item_aliases (item_id, alias_name, alias_type, source)
    VALUES (${itemId}, ${rawName}, 'sr_variant', 'manual_review')
    ON CONFLICT (item_id, alias_name, alias_type) DO NOTHING
  `

  let updated
  if (table === 'invoice_lines') {
    updated = await sql`
      UPDATE invoice_lines
      SET item_id = ${itemId}, resolved_name = ${target.canonical_name}, unresolved = false
      WHERE (item_id IS NULL OR unresolved = true)
        AND LOWER(TRIM(raw_item_name)) = LOWER(TRIM(${rawName}))
      RETURNING id
    `
  } else {
    updated = await sql`
      UPDATE sales_receipt_lines
      SET item_id = ${itemId}, resolved_name = ${target.canonical_name}, unresolved = false
      WHERE (item_id IS NULL OR unresolved = true)
        AND LOWER(TRIM(raw_item_name)) = LOWER(TRIM(${rawName}))
      RETURNING id
    `
  }

  return { rawName, itemId, matchedTo: target.canonical_name, linesUpdated: updated.length }
}

export async function POST() {
  const receiptResults = []
  for (const m of RECEIPT_MATCHES) {
    receiptResults.push(await resolveOne(m.rawName, m.itemId, 'invoice_lines'))
  }
  const salesResults = []
  for (const m of SALES_MATCHES) {
    salesResults.push(await resolveOne(m.rawName, m.itemId, 'sales_receipt_lines'))
  }

  const remainingUnresolvedReceipts = await sql`
    SELECT raw_item_name, COUNT(*)::int AS cnt FROM invoice_lines
    WHERE item_id IS NULL OR unresolved = true
    GROUP BY raw_item_name ORDER BY cnt DESC
  `

  return NextResponse.json({ receiptResults, salesResults, remainingUnresolvedReceipts })
}
