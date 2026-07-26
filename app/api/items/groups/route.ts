import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// Every group name the Items table (LossTab) can actually show as a
// heading -- built from the exact same base/JOIN/COALESCE as
// /api/losses/summary, which is what that table renders. The Group filter
// dropdown (page.tsx) used to derive its options from /api/items instead,
// which is a different query (items as the base table, not
// item_stock_summary) -- any item that's in item_stock_summary but has no
// matching items row (or has one with a different/blank cf_group) could
// then show up as a heading in the table without ever being a selectable
// filter option. Deriving the list from this identical base guarantees the
// two can't diverge.
export async function GET() {
  try {
    const rows = await sql`
      SELECT DISTINCT COALESCE(i.cf_group, s.cf_group) AS cf_group
      FROM item_stock_summary s
      LEFT JOIN items i ON i.id = s.item_id
      WHERE s.item_name NOT ILIKE 'old stop%'
        AND s.item_name NOT ILIKE 'old- stop%'
      ORDER BY cf_group NULLS LAST
    `
    return NextResponse.json(rows.map((r: any) => r.cf_group))
  } catch (e) {
    console.error('items/groups GET error:', e)
    return NextResponse.json([])
  }
}
