import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// Which receipt dates have every sale line recorded correctly (linked to a
// real, active item, positive quantity, amount present) -- the same rule as
// lib/saleVerify.verifySaleLine, expressed directly in SQL here since this
// only needs a per-date boolean, not per-item detail. A date with no lines
// at all (an empty receipt) is left out, so it reads as unverified.
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  try {
    const rows = await sql`
      SELECT sr.receipt_date::date::text AS date,
        BOOL_AND(
          srl.item_id IS NOT NULL
          AND COALESCE(i.status, 'Active') <> 'Inactive'
          AND srl.quantity IS NOT NULL AND srl.quantity > 0
          AND srl.item_total IS NOT NULL
        ) AS verified
      FROM sales_receipt_lines srl
      JOIN sales_receipts sr ON sr.id = srl.receipt_id
      LEFT JOIN items i ON i.id = srl.item_id
      GROUP BY sr.receipt_date::date
    `
    return NextResponse.json(
      rows.filter((r: any) => r.verified).map((r: any) => r.date)
    )
  } catch (e) {
    console.error('sales verified-dates error:', e)
    return NextResponse.json([])
  }
}
