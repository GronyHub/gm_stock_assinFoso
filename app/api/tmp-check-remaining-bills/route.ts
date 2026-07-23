import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const unresolved = await sql`
    SELECT bl.raw_item_name AS name, COUNT(*)::int AS cnt,
           MIN(b.bill_date)::date::text AS earliest, MAX(b.bill_date)::date::text AS latest
    FROM bill_lines bl
    JOIN bills b ON b.id = bl.bill_id
    WHERE bl.item_id IS NULL OR bl.unresolved = true
    GROUP BY bl.raw_item_name
    ORDER BY cnt DESC
  `
  const candidates = await sql`
    SELECT id, canonical_name, product_type, status
    FROM items
    WHERE canonical_name ILIKE '%exv%' OR canonical_name ILIKE '%cardboard%'
       OR canonical_name ILIKE '%3ft%' OR canonical_name ILIKE '%4ft%'
       OR canonical_name ILIKE '%sav%' OR canonical_name ILIKE '%fs %'
       OR canonical_name ILIKE '%banner%' OR canonical_name ILIKE '%sticker%'
    ORDER BY canonical_name
  `
  return NextResponse.json({ unresolvedCount: unresolved.length, unresolved, candidates })
}
