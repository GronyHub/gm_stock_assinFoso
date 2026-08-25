import { success } from '@/lib/api'
import sql from '@/lib/db'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  // Callers (SalesTab) fetch this with no limit/offset -- they want every
  // line so it can be grouped by receipt_id client-side. A low default cap
  // silently dropped every line past it (ordered oldest-first), so recent
  // receipts showed up with no items at all. Only an explicit ?limit caps
  // the result now.
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50000, 50000)
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0)

  try {
    const rows = await sql`
      SELECT
        srl.id,
        srl.receipt_id,
        srl.item_id,
        COALESCE(i.canonical_name, srl.resolved_name, srl.raw_item_name) AS item_name,
        srl.quantity,
        srl.item_price,
        srl.item_total,
        srl.usage_unit
      FROM sales_receipt_lines srl
      LEFT JOIN items i ON i.id = srl.item_id
      ORDER BY srl.receipt_id, srl.id
      LIMIT ${limit}
      OFFSET ${offset}
    `
    // A full row equal to `limit` means the cap (not the data) decided where
    // the list stopped -- exactly how the "No items" regression happened
    // last time, silently. Surface it in the logs instead.
    if (rows.length === limit) {
      console.warn(`sales/all-lines: hit the ${limit}-row cap -- results may be truncated, raise the cap`)
    }
    return success(rows)
  } catch (e) {
    console.error('sales/all-lines error:', e instanceof Error ? e.message : String(e))
    return success([])
  }
}
