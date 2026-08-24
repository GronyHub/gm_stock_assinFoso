import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { ensureCashAtBankDeficitColumn } from '@/lib/cashAtBank'
import { NextRequest } from 'next/server'
import { ensureDbInitialized } from '@/lib/api/dbInitCache'

export async function GET() {
  const { session, error } = await requireAuth()
  const role = (session?.user as any)?.role
  if (error || role === 'staff') return error || badRequest('Forbidden')

  const rows = await sql`
    SELECT entry_date, cash_counted, grony_personal_cash_in, debtors_cash_in,
           bills, expenses, grony_personal_expenses,
           daily_net, running_cash_at_bank,
           cab_bank, cab_momo, cab_physical, cab_total, deficit
    FROM cash_at_bank_view
    ORDER BY entry_date DESC
    LIMIT 90
  `

  return success(rows)
}

// Records a Cash at Bank confirmation for a single day -- cab_bank/cab_momo/
// cab_physical/deficit are plain stored columns on cash_at_bank (see
// /api/flags's uncheckedCab query, which reads cab_total straight off this
// table, not the view), so this writes them directly. cab_total itself is a
// generated column (cab_bank + cab_momo + cab_physical) and recomputes on
// its own. deficit needs that day's computed running_cash_at_bank, which
// only the view exposes.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  const role = (session?.user as any)?.role
  if (error || role === 'staff') return error || badRequest('Forbidden')

  const { entry_date, cab_bank, cab_momo, cab_physical } = await req.json()
  if (!entry_date || cab_bank == null || cab_momo == null || cab_physical == null) {
    return badRequest('Missing required fields')
  }

  const bank = Number(cab_bank), momo = Number(cab_momo), physical = Number(cab_physical)
  if ([bank, momo, physical].some(Number.isNaN)) {
    return badRequest('Bank, MoMo, and Physical must be numbers')
  }
  const total = parseFloat((bank + momo + physical).toFixed(2))

  try {
    await ensureDbInitialized()
    await ensureCashAtBankDeficitColumn()

    const [existing] = await sql`SELECT 1 FROM cash_at_bank WHERE entry_date = ${entry_date}`
    if (!existing) await sql`INSERT INTO cash_at_bank (entry_date) VALUES (${entry_date})`

    const [viewRow] = await sql`SELECT running_cash_at_bank FROM cash_at_bank_view WHERE entry_date = ${entry_date}`
    const running = viewRow?.running_cash_at_bank != null ? Number(viewRow.running_cash_at_bank) : null
    const deficit = running != null ? parseFloat((total - running).toFixed(2)) : null

    // cab_total is a generated column (cab_bank + cab_momo + cab_physical),
    // so Postgres rejects any attempt to set it directly -- it recomputes on
    // its own once the three source columns below are written.
    await sql`
      UPDATE cash_at_bank SET cab_bank = ${bank}, cab_momo = ${momo}, cab_physical = ${physical},
        deficit = ${deficit}
      WHERE entry_date = ${entry_date}
    `

    const actor = session!.user?.name || (session!.user as any)?.username || 'Unknown'
    await logActivity(actor, 'confirmed cash at bank', `₵${total.toFixed(2)} on ${entry_date}`)

    return success({ ok: true, entry_date, cab_bank: bank, cab_momo: momo, cab_physical: physical, cab_total: total, deficit })
  } catch (e) {
    return handleError('cash-at-bank POST', e)
  }
}
