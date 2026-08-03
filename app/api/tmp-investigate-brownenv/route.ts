import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const items = await sql`
      SELECT id, canonical_name, status, track_inventory, product_type, cf_group,
             opening_stock, selling_rate, purchase_rate, converts_to_item_id, units_per_pack, unit_name
      FROM items
      WHERE canonical_name ILIKE '%brown%env%sing%' OR canonical_name ILIKE '%A4 Brown Env%'
      ORDER BY id
    `
    const ids = items.map((i: any) => i.id)

    const stockSummary = ids.length
      ? await sql`SELECT * FROM item_stock_summary WHERE item_id = ANY(${ids})`
      : []

    const aliases = ids.length
      ? await sql`SELECT * FROM item_aliases WHERE item_id = ANY(${ids}) ORDER BY item_id`
      : []

    const stockCounts = ids.length
      ? await sql`
          SELECT id, item_id, item_name, count_date, quantity_counted, notes, source, counted_by
          FROM stock_counts WHERE item_id = ANY(${ids})
          ORDER BY item_id, count_date DESC
        `
      : []

    const saleLines = ids.length
      ? await sql`
          SELECT sl.id, sl.item_id, sl.raw_item_name, sl.resolved_name, sl.quantity, sl.unresolved,
                 sr.receipt_date, sr.receipt_number
          FROM sales_receipt_lines sl
          JOIN sales_receipts sr ON sr.id = sl.receipt_id
          WHERE sl.item_id = ANY(${ids})
          ORDER BY sr.receipt_date DESC
          LIMIT 30
        `
      : []

    const billLines = ids.length
      ? await sql`
          SELECT bl.id, bl.item_id, bl.raw_item_name, bl.resolved_name, bl.quantity, bl.unresolved,
                 b.bill_date, b.bill_number
          FROM bill_lines bl
          JOIN bills b ON b.id = bl.bill_id
          WHERE bl.item_id = ANY(${ids})
          ORDER BY b.bill_date DESC
          LIMIT 30
        `
      : []

    // Any OTHER item whose aliases mention "brown env" wording but resolve to a different item_id
    // (a sign of a split/duplicate item not caught by the alias table above).
    const looseMentions = await sql`
      SELECT DISTINCT resolved_name, item_id, unresolved, 'sale' AS src
      FROM sales_receipt_lines
      WHERE raw_item_name ILIKE '%brown%env%' OR resolved_name ILIKE '%brown%env%'
      UNION
      SELECT DISTINCT resolved_name, item_id, unresolved, 'bill' AS src
      FROM bill_lines
      WHERE raw_item_name ILIKE '%brown%env%' OR resolved_name ILIKE '%brown%env%'
    `

    return NextResponse.json({ items, stockSummary, aliases, stockCounts, saleLines, billLines, looseMentions })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
