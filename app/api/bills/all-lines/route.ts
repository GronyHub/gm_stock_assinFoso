import sql from '@/lib/db'
import { NextResponse, NextRequest } from 'next/server'

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
        id,
        bill_id,
        item_id,
        COALESCE(resolved_name, raw_item_name) AS item_name,
        quantity,
        unit_price,
        item_total,
        usage_unit,
        COALESCE(unresolved, false) AS unresolved
      FROM bill_lines
      ORDER BY bill_id, id
      LIMIT ${limit}
      OFFSET ${offset}
    `
    // A full row equal to `limit` means the cap (not the data) decided where
    // the list stopped -- exactly how the "No items" regression happened
    // last time, silently. Surface it in the logs instead.
    if (rows.length === limit) {
      console.warn(`bills/all-lines: hit the ${limit}-row cap -- results may be truncated, raise the cap`)
    }
    return NextResponse.json(rows)
  } catch (e) {
    console.error('bills/all-lines error:', e instanceof Error ? e.message : String(e))
    return NextResponse.json([])
  }
}
