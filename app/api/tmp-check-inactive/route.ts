import sql from '@/lib/db'
import { NextResponse } from 'next/server'

const NAMES = ['A4 210 grams', 'A4 Brown Env. Sing. Ori']

export async function GET() {
  const statusCounts = await sql`
    SELECT DISTINCT status, COUNT(*)::int AS cnt
    FROM items
    GROUP BY status
    ORDER BY cnt DESC
  `

  const exact = await sql`
    SELECT id, canonical_name, status, product_type, converts_to_item_id
    FROM items
    WHERE canonical_name = ANY(${NAMES})
    ORDER BY canonical_name, id
  `

  const fuzzy = await sql`
    SELECT id, canonical_name, status, product_type, converts_to_item_id
    FROM items
    WHERE canonical_name ILIKE '%A4%210%' OR canonical_name ILIKE '%Brown%Env%Sing%'
    ORDER BY canonical_name, id
  `

  const ids = Array.from(new Set([...(exact as any[]), ...(fuzzy as any[])].map(r => r.id)))
  const activity = ids.length
    ? await sql`
        SELECT
          i.id, i.canonical_name, i.status,
          (SELECT COUNT(*) FROM sales_receipt_lines srl WHERE srl.item_id = i.id) AS sales_lines,
          (SELECT MAX(sr.receipt_date)::date::text FROM sales_receipt_lines srl JOIN sales_receipts sr ON sr.id = srl.receipt_id WHERE srl.item_id = i.id) AS last_sale,
          (SELECT COUNT(*) FROM bill_lines bl WHERE bl.item_id = i.id) AS bill_lines,
          (SELECT MAX(b.bill_date)::date::text FROM bill_lines bl JOIN bills b ON b.id = bl.bill_id WHERE bl.item_id = i.id) AS last_bill,
          (SELECT COUNT(*) FROM stock_counts sc WHERE sc.item_id = i.id) AS counts,
          (SELECT MAX(sc.count_date)::date::text FROM stock_counts sc WHERE sc.item_id = i.id) AS last_count,
          (SELECT COUNT(*) FROM item_aliases ia WHERE ia.item_id = i.id) AS aliases
        FROM items i
        WHERE i.id = ANY(${ids})
        ORDER BY i.canonical_name, i.id
      `
    : []

  return NextResponse.json({ statusCounts, activity })
}
