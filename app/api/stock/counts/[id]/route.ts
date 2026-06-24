import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { quantity_counted, notes } = await req.json()
  if (quantity_counted == null) return NextResponse.json({ error: 'Missing qty' }, { status: 400 })

  const rows = await sql`
    UPDATE stock_counts
    SET quantity_counted = ${quantity_counted}, notes = ${notes || null}
    WHERE id = ${params.id}
    RETURNING id, item_name, count_date::text AS count_date, quantity_counted, notes, counted_by, source
  `
  return NextResponse.json(rows[0])
}
