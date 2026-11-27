import sql from '@/lib/db'
import { reconciliationByCount } from '@/lib/lossEvents'
import { getCached } from '@/lib/cacheStore'

// Every count with how it reconciled (expected, short or gain), kept for 5 minutes and cleared whenever a count is added, edited or deleted.
export type CountRec = { id: number; item_id: number | null; item_name: string; date: string; qty: number; notes: string | null; by: string | null; source: string | null; at: string | null; expected: number | null; loss_qty: number | null; kind: 'loss' | 'gain' | null }
export async function countRecords(): Promise<CountRec[]> {
  return await getCached('count-records', 300, async () => {
    const [rows, rec] = await Promise.all([
      sql`SELECT id, item_id, item_name, count_date::text AS count_date, quantity_counted, notes, counted_by, source, counted_at::text AS counted_at FROM stock_counts ORDER BY count_date DESC, id DESC` as unknown as Promise<{ id: number; item_id: number | null; item_name: string; count_date: string; quantity_counted: string; notes: string | null; counted_by: string | null; source: string | null; counted_at: string | null }[]>,
      reconciliationByCount(),
    ])
    return rows.map(r => {
      const x = r.item_id != null ? rec.get(`${r.item_id}|${r.count_date}`) : undefined
      return { id: Number(r.id), item_id: r.item_id, item_name: r.item_name, date: String(r.count_date).slice(0, 10), qty: Number(r.quantity_counted), notes: r.notes, by: r.counted_by, source: r.source, at: r.counted_at, expected: x?.expected ?? null, loss_qty: x?.lossQty != null ? Math.abs(x.lossQty) : null, kind: x?.kind ?? null }
    })
  })
}
