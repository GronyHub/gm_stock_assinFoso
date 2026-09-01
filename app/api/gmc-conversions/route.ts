import { success, handleError } from '@/lib/api'
import sql from '@/lib/db'

interface ConversionRecord {
  target_item_id: string | number
  date: string
  target_item: string
  quantity: number
}

export async function GET() {
  try {
    const conversions = await sql`
      SELECT
        bl.item_id AS target_item_id,
        b.bill_date::date AS date,
        i.canonical_name AS target_item,
        ABS(bl.quantity::numeric) AS quantity
      FROM bill_lines bl
      JOIN bills b ON bl.bill_id = b.id
      JOIN items i ON bl.item_id = i.id
      WHERE b.vendor_name = 'Internal Consumption'
        AND bl.source = 'live_sale'
        AND bl.quantity < 0
      ORDER BY b.bill_date DESC, bl.item_id
    ` as ConversionRecord[]

    const groupedByTarget: Record<string, Array<{ date: string; targetItem: string; quantity: number }>> = {}

    conversions.forEach(record => {
      const key = String(record.target_item_id)
      if (!groupedByTarget[key]) {
        groupedByTarget[key] = []
      }
      groupedByTarget[key].push({
        date: record.date,
        targetItem: record.target_item,
        quantity: Math.abs(Number(record.quantity))
      })
    })

    return success(groupedByTarget)
  } catch (e) {
    return handleError('gmc-conversions', e)
  }
}
