import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  const role = (session?.user as any)?.role
  if (!session || role === 'staff') return NextResponse.json([], { status: 401 })

  const rows = await sql`
    SELECT entry_date, cash_counted, grony_personal_cash_in, debtors_cash_in,
           bills, expenses, grony_personal_expenses,
           daily_net, running_cash_at_bank,
           cab_bank, cab_momo, cab_physical, cab_total, deficit
    FROM cash_at_bank_view
    ORDER BY entry_date DESC
    LIMIT 90
  `

  return NextResponse.json(rows)
}

// Records a Cash at Bank confirmation for a single day -- cab_bank/cab_momo/
// cab_physical/cab_total/deficit are plain stored columns on cash_at_bank
// (see /api/flags's uncheckedCab query, which reads cab_total straight off
// this table, not the view), so this writes them directly. deficit needs
// that day's computed running_cash_at_bank, which only the view exposes.
export async function POST(req: NextRequest) {
  const session = await auth()
  const role = (session?.user as any)?.role
  if (!session || role === 'staff') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { entry_date, cab_bank, cab_momo, cab_physical } = await req.json()
  if (!entry_date || cab_bank == null || cab_momo == null || cab_physical == null) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const bank = Number(cab_bank), momo = Number(cab_momo), physical = Number(cab_physical)
  if ([bank, momo, physical].some(Number.isNaN)) {
    return NextResponse.json({ error: 'Bank, MoMo, and Physical must be numbers' }, { status: 400 })
  }
  const total = parseFloat((bank + momo + physical).toFixed(2))

  try {
    const [existing] = await sql`SELECT 1 FROM cash_at_bank WHERE entry_date = ${entry_date}`
    if (!existing) await sql`INSERT INTO cash_at_bank (entry_date) VALUES (${entry_date})`

    const [viewRow] = await sql`SELECT running_cash_at_bank FROM cash_at_bank_view WHERE entry_date = ${entry_date}`
    const running = viewRow?.running_cash_at_bank != null ? Number(viewRow.running_cash_at_bank) : null
    const deficit = running != null ? parseFloat((total - running).toFixed(2)) : null

    await sql`
      UPDATE cash_at_bank SET cab_bank = ${bank}, cab_momo = ${momo}, cab_physical = ${physical},
        cab_total = ${total}, deficit = ${deficit}
      WHERE entry_date = ${entry_date}
    `

    const actor = session.user?.name || (session.user as any)?.username || 'Unknown'
    await logActivity(actor, 'confirmed cash at bank', `₵${total.toFixed(2)} on ${entry_date}`)

    return NextResponse.json({ ok: true, entry_date, cab_bank: bank, cab_momo: momo, cab_physical: physical, cab_total: total, deficit })
  } catch (e) {
    console.error('cash-at-bank confirm error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not save confirmation: ${detail}` }, { status: 500 })
  }
}
