import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensureLiveSaleTapsTable } from '@/lib/liveSales'

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  try {
    await ensureLiveSaleTapsTable()
    const rows = await sql`
      SELECT
        DATE(tapped_at) AS day,
        COUNT(*) FILTER (WHERE undone = false) AS taps,
        COUNT(*) FILTER (WHERE undone = true) AS undone_taps,
        SUM(quantity) FILTER (WHERE undone = false)::numeric AS qty,
        SUM(price * quantity) FILTER (WHERE undone = false)::numeric AS total
      FROM live_sale_taps
      WHERE tapped_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY 1
      ORDER BY 1 DESC
    `
    return success(rows)
  } catch (e) {
    return handleError('analysis/live-sale', e)
  }
}
