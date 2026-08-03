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

    const looseMentions = await sql`
      SELECT DISTINCT resolved_name, item_id, unresolved, 'sale' AS src
      FROM sales_receipt_lines
      WHERE raw_item_name ILIKE '%brown%env%' OR resolved_name ILIKE '%brown%env%'
      UNION
      SELECT DISTINCT resolved_name, item_id, unresolved, 'bill' AS src
      FROM bill_lines
      WHERE raw_item_name ILIKE '%brown%env%' OR resolved_name ILIKE '%brown%env%'
    `

    const convTables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND (table_name ILIKE '%convert%' OR table_name ILIKE '%tradeoff%' OR table_name ILIKE '%conversion%')
    `

    // What SOH would 367 have shown right before the July 24 manager count?
    // (previous count was June 19, qty 37 -- see stock_counts dump.)
    const preCountActivity = await sql`
      SELECT
        (SELECT COALESCE(SUM(quantity), 0) FROM sales_receipt_lines sl
          JOIN sales_receipts sr ON sr.id = sl.receipt_id
          WHERE sl.item_id = 367 AND sr.receipt_date > '2026-06-19' AND sr.receipt_date <= '2026-07-24') AS sold_between,
        (SELECT COALESCE(SUM(quantity), 0) FROM bill_lines bl
          JOIN bills b ON b.id = bl.bill_id
          WHERE bl.item_id = 367 AND b.bill_date > '2026-06-19' AND b.bill_date <= '2026-07-24') AS bought_between
    `

    // Every stock_counts row for item 100 (the pack) around the same window,
    // to see if a pack count drop lines up with a singles conversion that
    // never got recorded as a "purchase" for 367.
    const packCounts = await sql`
      SELECT count_date, quantity_counted, notes FROM stock_counts
      WHERE item_id = 100 AND count_date BETWEEN '2026-06-01' AND '2026-08-01'
      ORDER BY count_date
    `

    // "Sing." (Singles) in the name matches this app's pack->singles
    // conversion pattern (see pack_tradeoffs/converts_to_item_id) -- pull
    // both directions of that relationship for every candidate item: what
    // it converts INTO, and any PACK item that converts into it, plus that
    // partner's own summary/counts, since a pack/singles pairing gap is a
    // recurring, already-documented cause of SOH not matching a physical
    // count for exactly this kind of item.
    const convertsTo = ids.length
      ? await sql`
          SELECT id, canonical_name, converts_to_item_id
          FROM items WHERE id = ANY(${ids}) AND converts_to_item_id IS NOT NULL
        `
      : []
    const convertsFrom = ids.length
      ? await sql`
          SELECT id, canonical_name, converts_to_item_id
          FROM items WHERE converts_to_item_id = ANY(${ids})
        `
      : []
    const partnerIds = Array.from(new Set([
      ...(convertsTo as { converts_to_item_id: number }[]).map(r => r.converts_to_item_id),
      ...(convertsFrom as { id: number }[]).map(r => r.id),
    ].filter(Boolean)))
    const partnerSummary = partnerIds.length
      ? await sql`
          SELECT i.id, i.canonical_name, s.calculated_soh
          FROM items i LEFT JOIN item_stock_summary s ON s.item_id = i.id
          WHERE i.id = ANY(${partnerIds})
        `
      : []
    const partnerRecentCounts = partnerIds.length
      ? await sql`
          SELECT id, item_id, item_name, count_date, quantity_counted, source, counted_by
          FROM stock_counts WHERE item_id = ANY(${partnerIds})
          ORDER BY item_id, count_date DESC LIMIT 20
        `
      : []

    // Anything a count was silently changed/dropped for on this item --
    // e.g. during the July 19 reactivate+merge of this exact item's
    // duplicate rows (see mergeItems.ts, which keeps the winner's count and
    // discards the loser's on any date both had one).
    const countRevisions = ids.length
      ? await sql`
          SELECT * FROM stock_count_revisions WHERE item_id = ANY(${ids}) ORDER BY changed_at DESC
        `.catch(() => [])
      : []

    const tradeoffs = ids.length
      ? await sql`SELECT * FROM pack_tradeoffs WHERE item_id = ANY(${ids}) ORDER BY row_date DESC`.catch(() => [])
      : []

    return NextResponse.json({
      items, stockSummary, aliases, stockCounts, saleLines, billLines, looseMentions,
      convTables, preCountActivity, packCounts,
      convertsTo, convertsFrom, partnerSummary, partnerRecentCounts, countRevisions, tradeoffs,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
