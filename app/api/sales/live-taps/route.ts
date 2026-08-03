import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { ensureLiveSaleTapsTable } from '@/lib/liveSales'
import { NextRequest, NextResponse } from 'next/server'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// Every tap for one day, undone ones included (shown struck-through client
// side rather than hidden) -- this is the raw decomposition of that day's
// WIC receipt: who tapped what, and when.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const date = req.nextUrl.searchParams.get('date') || todayStr()

  await ensureLiveSaleTapsTable()
  const rows = await sql`
    SELECT id, item_id, item_name, price, staff_name, tapped_at, undone, receipt_id, quantity
    FROM live_sale_taps
    WHERE tapped_at::date = ${date}
    ORDER BY tapped_at DESC
  `
  return NextResponse.json(rows)
}
