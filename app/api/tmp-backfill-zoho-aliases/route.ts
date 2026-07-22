import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// One-off: the Zoho Sales/Bills review tabs grouped directly from
// sales_receipt_lines/bill_lines (source = 'zoho_historical') instead of
// item_aliases, so most of those raw-name-to-item matches never got their
// own alias row -- which is why Wide Table didn't already show them.
// Backfilling one here for every distinct (item, raw name) pair still
// resolved that way makes Wide Table's existing per-item alias list cover
// them too, so the dedicated Zoho tabs can be retired without losing
// anything.
export async function POST() {
  const salesInserted = await sql`
    INSERT INTO item_aliases (item_id, alias_name, alias_type, source)
    SELECT DISTINCT item_id, raw_item_name, 'sr_variant', 'zoho_backfill'
    FROM sales_receipt_lines
    WHERE source = 'zoho_historical' AND item_id IS NOT NULL
      AND raw_item_name IS NOT NULL AND TRIM(raw_item_name) <> ''
    ON CONFLICT (item_id, alias_name, alias_type) DO NOTHING
    RETURNING id
  `
  const billsInserted = await sql`
    INSERT INTO item_aliases (item_id, alias_name, alias_type, source)
    SELECT DISTINCT item_id, raw_item_name, 'sr_variant', 'zoho_backfill'
    FROM bill_lines
    WHERE source = 'zoho_historical' AND item_id IS NOT NULL
      AND raw_item_name IS NOT NULL AND TRIM(raw_item_name) <> ''
    ON CONFLICT (item_id, alias_name, alias_type) DO NOTHING
    RETURNING id
  `

  return NextResponse.json({
    salesAliasesInserted: salesInserted.length,
    billAliasesInserted: billsInserted.length,
  })
}
