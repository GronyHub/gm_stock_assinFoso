import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { ensureLiveSaleTapsTable } from '@/lib/liveSales'
import { NextRequest, NextResponse } from 'next/server'

// Create a daily sale summary entry for a specific date
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { date } = await req.json()
  if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 })

  const staffName = session.user?.name || (session.user as { username?: string })?.username || 'Unknown'

  try {
    await ensureLiveSaleTapsTable()

    // Calculate total sales for the day (excluding undone taps)
    const [result] = await sql`
      SELECT COALESCE(SUM(price::NUMERIC * quantity), 0) as total
      FROM live_sale_taps
      WHERE tapped_at::date = ${date} AND undone = false
    `
    const dailyTotal = Number(result?.total || 0)

    // Check if a sale entry already exists for this date
    const [existing] = await sql`
      SELECT id FROM live_sale_taps
      WHERE tapped_at::date = ${date} AND item_name = 'Sale'
    `

    let tap
    if (existing) {
      // Update existing sale entry
      await sql`
        UPDATE live_sale_taps
        SET price = ${dailyTotal}, quantity = 1, staff_name = ${staffName}
        WHERE id = ${existing.id}
      `
      tap = { ...existing, price: dailyTotal, quantity: 1, item_name: 'Sale' }
    } else {
      // Create new sale entry
      const [newTap] = await sql`
        INSERT INTO live_sale_taps (item_id, item_name, price, staff_name, tapped_at, quantity)
        VALUES (0, 'Sale', ${dailyTotal}, ${staffName}, ${date}::DATE, 1)
        RETURNING id, item_id, item_name, price, staff_name, tapped_at, undone, receipt_id, quantity
      `
      tap = newTap
    }

    await logActivity(staffName, 'created daily sale summary', `${date} · ₵${dailyTotal.toFixed(2)}`)
    return NextResponse.json({ tap })
  } catch (e) {
    console.error('live-sale POST error:', e)
    return NextResponse.json({ error: 'Failed to create daily sale' }, { status: 500 })
  }
}
