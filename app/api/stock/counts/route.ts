import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { reconciliationByCount } from '@/lib/lossEvents'
import { NextRequest, NextResponse } from 'next/server'

let cachedStockCounts: any = null
let cachedStockCountsTime = 0
const STOCK_COUNTS_CACHE_TTL = 30 * 60 * 1000 // 30 minutes

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = Date.now()
  if (cachedStockCounts && now - cachedStockCountsTime < STOCK_COUNTS_CACHE_TTL) {
    return NextResponse.json(cachedStockCounts)
  }

  const [rows, reconciliation] = await Promise.all([
    sql`
      SELECT sc.id, sc.item_id, sc.item_name, sc.count_date::text AS count_date,
             sc.quantity_counted, sc.notes, sc.counted_by, sc.source, sc.counted_at::text AS counted_at,
             i.cf_group
      FROM stock_counts sc
      LEFT JOIN items i ON i.id = sc.item_id
      ORDER BY sc.count_date DESC, sc.id DESC
    ` as unknown as Promise<{ item_id: number | null; count_date: string }[]>,
    reconciliationByCount(),
  ])

  // Loss by Date used to be a separate tab computing the same reconciliation
  // over the same stock_counts rows -- folded in here as extra columns
  // instead, so Count Records doubles as the loss/gain feed.
  const enriched = rows.map(r => {
    const rec = r.item_id != null ? reconciliation.get(`${r.item_id}|${r.count_date}`) : undefined
    return {
      ...r,
      expected: rec?.expected ?? null,
      loss_qty: rec?.lossQty ?? null,
      loss_amt: rec?.lossAmt ?? null,
      kind: rec?.kind ?? null,
    }
  })
  cachedStockCounts = enriched
  cachedStockCountsTime = Date.now()
  return NextResponse.json(enriched)
}
