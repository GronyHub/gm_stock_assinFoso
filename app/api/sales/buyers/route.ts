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
    // Buyers recorded with the sale, plus older Live Sale taps that carried a customer ID but predate this
    // table (negative id: shown in the CUSTOMER column only).
    const rows = await sql`
      SELECT * FROM (
        SELECT b.id, b.receipt_id, b.item_id, b.item_name, b.qty, b.price, b.customer_id_code, b.customer_name,
               b.customer_phone, b.source, b.created_by, b.created_at,
               c.phone AS saved_phone, c.display_name AS saved_name
        FROM sale_buyers b
        LEFT JOIN live_sale_taps t ON t.id = b.tap_id
        LEFT JOIN customers c ON c.customer_id_code = b.customer_id_code
        WHERE b.receipt_id IS NOT NULL AND (b.tap_id IS NULL OR t.undone IS NOT TRUE)
        UNION ALL
        SELECT -t.id, t.receipt_id, t.item_id, t.item_name, t.quantity, t.price, t.customer_id_code, NULL,
               NULL, 'tap', t.staff_name, t.tapped_at,
               c.phone, c.display_name
        FROM live_sale_taps t
        JOIN customers c ON c.customer_id_code = t.customer_id_code
        WHERE t.customer_id_code IS NOT NULL AND t.undone IS NOT TRUE AND t.receipt_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM sale_buyers b WHERE b.tap_id = t.id)
      ) x ORDER BY created_at DESC LIMIT 8000`
    return success(rows)
  } catch (e) {
    console.error('sales/buyers GET:', e instanceof Error ? e.message : String(e))
    return success([], 500)
  }
}
