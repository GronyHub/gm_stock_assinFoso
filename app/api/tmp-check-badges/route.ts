import sql from '@/lib/db'
import { aliasMismatchWarning } from '@/lib/aliasSanity'
import { NextResponse } from 'next/server'

export async function GET() {
  const [salesUnresolved, billsUnresolved, confirmed] = await Promise.all([
    sql`SELECT raw_item_name AS name, COUNT(*)::int AS cnt FROM sales_receipt_lines WHERE item_id IS NULL OR unresolved = true GROUP BY raw_item_name`,
    sql`SELECT raw_item_name AS name, COUNT(*)::int AS cnt FROM bill_lines WHERE item_id IS NULL OR unresolved = true GROUP BY raw_item_name`,
    sql`SELECT alias_name FROM item_aliases`,
  ])
  const confirmedSet = new Set(confirmed.map((r: any) => r.alias_name.toLowerCase().trim()))
  const pendingSales = salesUnresolved.filter((r: any) => !confirmedSet.has(r.name.toLowerCase().trim())).length
  const pendingBills = billsUnresolved.filter((r: any) => !confirmedSet.has(r.name.toLowerCase().trim())).length

  const auditRows = await sql`
    SELECT raw_name, item_id, canonical_name FROM (
      SELECT srl.raw_item_name AS raw_name, srl.item_id, i.canonical_name
      FROM sales_receipt_lines srl JOIN items i ON i.id = srl.item_id
      WHERE srl.raw_item_name IS NOT NULL AND TRIM(srl.raw_item_name) <> ''
      GROUP BY srl.raw_item_name, srl.item_id, i.canonical_name
      UNION ALL
      SELECT bl.raw_item_name, bl.item_id, i.canonical_name
      FROM bill_lines bl JOIN items i ON i.id = bl.item_id
      WHERE bl.raw_item_name IS NOT NULL AND TRIM(bl.raw_item_name) <> ''
      GROUP BY bl.raw_item_name, bl.item_id, i.canonical_name
    ) combined
  `
  const flaggedCount = (auditRows as { raw_name: string; canonical_name: string }[])
    .filter(r => aliasMismatchWarning(r.raw_name, r.canonical_name) !== null).length

  const ambiguousRows = await sql`
    SELECT LOWER(TRIM(alias_name)) AS norm_name FROM item_aliases
    GROUP BY LOWER(TRIM(alias_name)) HAVING COUNT(DISTINCT item_id) > 1
  `

  const [advertRows] = await Promise.all([
    sql`
      SELECT COUNT(*)::int AS n
      FROM active_items i
      LEFT JOIN item_audio_advert_status s ON s.item_id = i.id AND s.has_advert = true
      WHERE s.item_id IS NULL
    `,
  ])

  return NextResponse.json({
    alias_prezoho_sales: pendingSales,
    alias_prezoho_bills: pendingBills,
    alias_flagged: flaggedCount,
    alias_ambiguous: ambiguousRows.length,
    no_advert: advertRows[0].n,
    itemsFlagsCount_missing_total: pendingSales + pendingBills + flaggedCount + ambiguousRows.length,
  })
}
