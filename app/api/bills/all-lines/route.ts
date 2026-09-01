import { success } from '@/lib/api'
import sql from '@/lib/db'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  // Callers (BillsTab) fetch this with no limit/offset -- they want every
  // line so it can be grouped by bill_id client-side. A low default cap
  // silently dropped every line past it (ordered oldest-first), so recent
  // bills showed up with no items at all. Only an explicit ?limit caps
  // the result now.
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50000, 50000)
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0)

  try {
    const rows = await sql`
      SELECT
        bl.id,
        bl.bill_id,
        bl.item_id,
        COALESCE(bl.resolved_name, bl.raw_item_name) AS item_name,
        bl.quantity,
        bl.unit_price,
        bl.item_total,
        bl.usage_unit,
        COALESCE(bl.unresolved, false) AS unresolved,
        i.converts_to_item_id,
        COALESCE(i.gmc_type, '') AS gmc_type
      FROM bill_lines bl
      LEFT JOIN items i ON i.id = bl.item_id
      -- Skip lines belonging to /api/sales/live-tap's "Internal
      -- Consumption" bills -- see /api/bills' own GET for why those are
      -- excluded from the Bills tab entirely, same reasoning here.
      JOIN bills b ON b.id = bl.bill_id AND b.source IS DISTINCT FROM 'live_sale'
      ORDER BY bl.bill_id, bl.id
      LIMIT ${limit}
      OFFSET ${offset}
    `
    return success(rows)
  } catch (e) {
    return success([])
  }
}
