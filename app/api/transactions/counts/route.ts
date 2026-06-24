import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const date = req.nextUrl.searchParams.get('date')
  const by = req.nextUrl.searchParams.get('by')
  if (!date) return NextResponse.json([], { status: 400 })

  const rows = await sql`
    SELECT sc.id, sc.item_name, sc.quantity_counted, sc.notes, i.id AS item_id
    FROM stock_counts sc
    LEFT JOIN items i ON i.id = sc.item_id
    WHERE sc.count_date = ${date}
      AND (${by ?? null} IS NULL OR sc.counted_by = ${by ?? ''})
    ORDER BY sc.id
  `
  return NextResponse.json(rows)
}
