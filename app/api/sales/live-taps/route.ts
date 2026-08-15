import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { ensureLiveSaleTapsTable } from '@/lib/liveSales'
import { NextRequest, NextResponse } from 'next/server'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// All taps from all days (not cleared), undone ones included (shown struck-through client
// side rather than hidden) -- this is the raw decomposition of all taps by date
// so staff can refer back to previous days' sales
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const days = req.nextUrl.searchParams.get('days') || '90'

  await ensureLiveSaleTapsTable()
  const rows = await sql`
    SELECT id, item_id, item_name, price, staff_name, tapped_at, undone, receipt_id, quantity
    FROM live_sale_taps
    WHERE tapped_at::date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
    ORDER BY tapped_at DESC
  `
  return NextResponse.json(rows)
}
