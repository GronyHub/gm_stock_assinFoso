import sql from '@/lib/db'
import { once } from '@/lib/once'

// A PO line's qty_received must always equal what its surviving Bills say was
// received. Deleting a bill used to leave qty_received (and the receipt row)
// behind, so the order looked fully received and could never be received again.
export async function recomputePoReceived(poId: number): Promise<number> {
  let changed = 0
  const lines = await sql`SELECT id, item_id, item_name, qty_ordered, qty_received FROM purchase_order_lines WHERE po_id = ${poId} ORDER BY id` as
    { id: number; item_id: number | null; item_name: string; qty_ordered: number; qty_received: number }[]
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
    if (Math.abs(Number(line.qty_received) - got) > 0.0005) {
      await sql`UPDATE purchase_order_lines SET qty_received = ${got} WHERE id = ${line.id}`
      changed++
    }
  }
  return changed
}

// Compares every Purchase Order with the Bills that really exist and takes the
// "received" mark off anything whose bill is gone (or was left empty by a failed
// delete). Returns the POs that were put back to "not received".
export async function reconcileAllPoReceipts(): Promise<{ po_number: string; lines_reset: number }[]> {
  // 1. Empty shells: a PO bill with no lines left (a delete that stopped half way).
  const shells = await sql`SELECT b.id FROM bills b WHERE b.source = 'po' AND NOT EXISTS (SELECT 1 FROM bill_lines bl WHERE bl.bill_id = b.id)` as { id: number }[]
  for (const b of shells) {
    await sql`DELETE FROM purchase_order_receipts WHERE bill_id = ${b.id}`
    await sql`DELETE FROM bills WHERE id = ${b.id}`
  }
  // 2. Receipts pointing at a bill that no longer exists.
  await sql`DELETE FROM purchase_order_receipts r WHERE r.bill_id IS NULL OR NOT EXISTS (SELECT 1 FROM bills b WHERE b.id = r.bill_id)`
  // 3. Every PO's received quantities must equal what its surviving bills say.
  const pos = await sql`SELECT DISTINCT po.id, po.po_number FROM purchase_orders po JOIN purchase_order_lines l ON l.po_id = po.id WHERE l.qty_received > 0` as { id: number; po_number: string }[]
  const report: { po_number: string; lines_reset: number }[] = []
  for (const po of pos) {
    const n = await recomputePoReceived(po.id)
    if (n) report.push({ po_number: po.po_number, lines_reset: n })
  }
  return report
}
export const repairOrphanPoReceipts = once(async () => { await reconcileAllPoReceipts().catch(e => console.error('reconcileAllPoReceipts:', e instanceof Error ? e.message : String(e))) })
