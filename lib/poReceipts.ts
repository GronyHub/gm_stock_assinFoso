import sql from '@/lib/db'
import { once } from '@/lib/once'

// A PO line's qty_received must always equal what its surviving Bills say was
// received. Deleting a bill used to leave qty_received (and the receipt row)
// behind, so the order looked fully received and could never be received again.
export async function recomputePoReceived(poId: number) {
  const lines = await sql`SELECT id, item_id, item_name, qty_ordered FROM purchase_order_lines WHERE po_id = ${poId} ORDER BY id` as
    { id: number; item_id: number | null; item_name: string; qty_ordered: number }[]
  const billed = await sql`
    SELECT bl.item_id, bl.resolved_name, bl.raw_item_name, bl.quantity
    FROM purchase_order_receipts r JOIN bill_lines bl ON bl.bill_id = r.bill_id
    WHERE r.po_id = ${poId} ORDER BY bl.id` as { item_id: number | null; resolved_name: string | null; raw_item_name: string | null; quantity: number }[]
  const pool = billed.map(b => ({ ...b, left: Number(b.quantity) }))
  for (const line of lines) {
    let need = Number(line.qty_ordered), got = 0
    for (const b of pool) {
      if (need <= 0) break
      const same = line.item_id != null && b.item_id != null ? line.item_id === b.item_id : (b.resolved_name ?? b.raw_item_name) === line.item_name
      if (!same || b.left <= 0) continue
      const take = Math.min(b.left, need)
      b.left -= take; need -= take; got += take
    }
    await sql`UPDATE purchase_order_lines SET qty_received = ${got} WHERE id = ${line.id}`
  }
}

// Heals orders already hit by the bug: receipts whose bill no longer exists.
async function repairImpl() {
  const orphans = await sql`
    SELECT DISTINCT r.po_id FROM purchase_order_receipts r
    LEFT JOIN bills b ON b.id = r.bill_id WHERE b.id IS NULL` as { po_id: number }[]
  for (const o of orphans) {
    await sql`DELETE FROM purchase_order_receipts r WHERE r.po_id = ${o.po_id} AND NOT EXISTS (SELECT 1 FROM bills b WHERE b.id = r.bill_id)`
    await recomputePoReceived(o.po_id)
  }
}
export const repairOrphanPoReceipts = once(async () => { await repairImpl().catch(e => console.error('repairOrphanPoReceipts:', e instanceof Error ? e.message : String(e))) })
