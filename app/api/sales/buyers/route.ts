import { requireAuth, success } from '@/lib/api'
import sql from '@/lib/db'
import { ensureSaleBuyers } from '@/lib/saleBuyers'
import { ensureLiveSaleTapsTable } from '@/lib/liveSales'

// Every recorded buyer (undone taps hidden), for the Sales Log to show under each day's receipt.
export async function GET() {
  const { error } = await requireAuth()
  if (error) return error
  try {
    await ensureSaleBuyers(); await ensureLiveSaleTapsTable()
    const rows = await sql`
      SELECT b.id, b.receipt_id, b.item_id, b.item_name, b.qty, b.price, b.customer_id_code, b.customer_name,
             b.customer_phone, b.source, b.created_by, b.created_at,
             c.phone AS saved_phone, c.display_name AS saved_name
      FROM sale_buyers b
      LEFT JOIN live_sale_taps t ON t.id = b.tap_id
      LEFT JOIN customers c ON c.customer_id_code = b.customer_id_code
      WHERE b.receipt_id IS NOT NULL AND (b.tap_id IS NULL OR t.undone IS NOT TRUE)
      ORDER BY b.created_at DESC LIMIT 5000`
    return success(rows)
  } catch (e) {
    console.error('sales/buyers GET:', e instanceof Error ? e.message : String(e))
    return success([], 500)
  }
}
