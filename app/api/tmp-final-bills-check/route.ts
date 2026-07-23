import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const unresolved = await sql`
    SELECT bl.raw_item_name AS name, COUNT(*)::int AS cnt, MIN(b.bill_date)::date::text AS date
    FROM bill_lines bl
    JOIN bills b ON b.id = bl.bill_id
    WHERE bl.item_id IS NULL OR bl.unresolved = true
    GROUP BY bl.raw_item_name
    ORDER BY date
  `
  return NextResponse.json({ count: unresolved.length, unresolved })
}
