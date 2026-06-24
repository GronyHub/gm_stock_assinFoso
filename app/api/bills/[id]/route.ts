import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const lines = await sql`
    SELECT
      COALESCE(resolved_name, raw_item_name) AS item_name,
      quantity,
      unit_price,
      item_total,
      usage_unit
    FROM bill_lines
    WHERE bill_id = ${Number(id)}
    ORDER BY id
  `
  return NextResponse.json(lines)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { bill_date, vendor_name, status } = await req.json()

  const [row] = await sql`
    UPDATE bills
    SET
      bill_date = COALESCE(${bill_date ?? null}, bill_date),
      vendor_name = COALESCE(${vendor_name ?? null}, vendor_name),
      status = COALESCE(${status ?? null}, status)
    WHERE id = ${Number(id)}
    RETURNING id, bill_number, bill_date::date AS bill_date, vendor_name, total, status, entered_by
  `
  return NextResponse.json(row)
}
