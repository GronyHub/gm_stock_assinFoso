import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { itemCountIntervalLabels } from '@/lib/countRules'
import { NextResponse, NextRequest } from 'next/server'

// 'excluded'/'dormant'/'daily'/'7'/'15'/'30'/a custom override -> the
// plain-text label Live Sale shows inline next to price/cost/stock (see
// itemCountIntervalLabels). 'Dormant' also becomes its own filterable row
// in Live Sale's laws panel, via the same count-interval mechanism 'Daily'/
// 'Every 15d'/etc. already use -- see countIntervalFlags there.
function formatCountInterval(label: string | undefined): string | null {
  if (!label) return null
  if (label === 'excluded') return 'Not counted'
  if (label === 'dormant') return 'Dormant'
  if (label === 'daily') return 'Daily'
  return `Every ${label}d`
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const url = new URL(req.url)
  // Every caller (item pickers, aliasing, live sale) fetches this with no
  // limit/offset -- a picker missing an item mid-sale is a live business
  // problem, not just a display gap. Only an explicit ?limit caps it now.
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50000, 50000)
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0)
  const since = url.searchParams.get('since')

  try {
    const [rows, intervals] = await Promise.all([
      sql`
        SELECT i.id, i.canonical_name AS name, i.cf_group AS "group",
               COALESCE(s.calculated_soh, 0) AS soh,
               COALESCE(i.selling_rate, 0) AS selling_price,
               COALESCE(i.purchase_rate, 0) AS cost_price,
               COALESCE(i.product_type, 'goods') AS product_type,
               COALESCE(i.updated_at, NOW()) AS updated_at
        FROM active_items i
        LEFT JOIN item_stock_summary s ON s.item_id = i.id
        WHERE LOWER(COALESCE(i.status, '')) != 'service'
        ORDER BY i.canonical_name
        LIMIT ${limit}
        OFFSET ${offset}
      `,
      itemCountIntervalLabels().catch(e => {
        console.error('itemCountIntervalLabels failed, every item will show no count_interval:', e instanceof Error ? e.message : String(e))
        return new Map<number, string>()
      }),
    ])
    if (rows.length === limit) {
      console.warn(`items/all: hit the ${limit}-row cap -- results may be truncated, raise the cap`)
    }
    const withIntervals = (rows as { id: number }[]).map(r => ({ ...r, count_interval: formatCountInterval(intervals.get(r.id)) }))
    return NextResponse.json(withIntervals)
  } catch {
    try {
      const rows = await sql`
        SELECT id, canonical_name AS name, cf_group AS "group",
               0 AS soh,
               COALESCE(selling_rate, 0) AS selling_price,
               COALESCE(purchase_rate, 0) AS cost_price,
               COALESCE(product_type, 'goods') AS product_type,
               NOW() AS updated_at
        FROM items
        WHERE (status IS NULL OR LOWER(status) NOT IN ('inactive','service'))
        ORDER BY canonical_name
        LIMIT ${limit}
        OFFSET ${offset}
      `
      if (rows.length === limit) {
        console.warn(`items/all fallback: hit the ${limit}-row cap -- results may be truncated, raise the cap`)
      }
      return NextResponse.json(rows)
    } catch (e) {
      console.error('items/all fallback error:', e)
      return NextResponse.json([])
    }
  }
}
