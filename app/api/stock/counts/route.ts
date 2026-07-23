import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await sql`
    SELECT sc.id, sc.item_id, sc.item_name, sc.count_date::text AS count_date,
           sc.quantity_counted, sc.notes, sc.counted_by, sc.source,
           i.cf_group
    FROM stock_counts sc
    LEFT JOIN items i ON i.id = sc.item_id
    ORDER BY sc.count_date DESC, sc.id DESC
  `
  return NextResponse.json(rows)
}
