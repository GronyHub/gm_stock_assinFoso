import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const rows = await sql`
    SELECT s.item_id, COALESCE(i.canonical_name, s.item_name) AS item_name, s.cf_group, s.calculated_soh,
           i.selling_rate, i.purchase_rate
    FROM item_stock_summary s
    LEFT JOIN items i ON i.id = s.item_id
    WHERE s.item_name NOT ILIKE 'old stop%'
      AND s.item_name NOT ILIKE 'old- stop%'
    ORDER BY COALESCE(i.canonical_name, s.item_name) ASC
  `
  return NextResponse.json(rows)
}
