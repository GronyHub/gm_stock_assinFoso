import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { logActivity } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session || !isOwnerLevel(session.user as any)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const rows = await sql`
    SELECT pay_month::text AS pay_month, confirmed_by, confirmed_at, total_amount, expense_id
    FROM payslip_payments
    ORDER BY pay_month DESC
  `
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !isOwnerLevel(session.user as any)) {
    return NextResponse.json({ error: 'Only the owner or Joe can confirm payroll payment' }, { status: 403 })
  }

  try {
    const { pay_month } = await req.json() as { pay_month: string }
    if (!pay_month) return NextResponse.json({ error: 'pay_month is required' }, { status: 400 })

    const [already] = await sql`SELECT confirmed_by, confirmed_at FROM payslip_payments WHERE pay_month = ${pay_month}`
    if (already) {
      return NextResponse.json({
        error: `Already confirmed by ${already.confirmed_by} on ${String(already.confirmed_at).slice(0, 10)}`,
      }, { status: 400 })
    }

    const totals = await sql`SELECT COALESCE(SUM(total_salary), 0) AS total FROM payslips WHERE pay_month = ${pay_month}`
    const total = parseFloat(totals[0].total)
    if (!total || total <= 0) {
      return NextResponse.json({ error: 'No payslips found for this month — save them first' }, { status: 400 })
    }

    const actor = session.user?.name || (session.user as any)?.username || 'Unknown'
    const monthLabel = new Date(pay_month + 'T00:00:00').toLocaleString('default', { month: 'long', year: 'numeric' })

    const entry = await sql`
      SELECT COALESCE(MAX(entry_number::int), 0) + 1 AS next FROM expenses WHERE entry_number ~ '^[0-9]+$'
    `
    const entryNumber = String(entry[0].next)
    const zohoExpenseId = `APP-PAYROLL-${Date.now()}`

    const [expense] = await sql`
      INSERT INTO expenses (zoho_expense_id, expense_date, expense_account, cf_justify, amount, total, is_property, source, entry_number, entered_by)
      VALUES (${zohoExpenseId}, ${pay_month}, 'Salaries', ${`Staff salaries for ${monthLabel}`}, ${total}, ${total}, false, 'app', ${entryNumber}, ${actor})
      RETURNING id
    `

    await sql`
      INSERT INTO payslip_payments (pay_month, confirmed_by, total_amount, expense_id)
      VALUES (${pay_month}, ${actor}, ${total}, ${expense.id})
    `

    try {
      const [existing] = await sql`SELECT 1 FROM cash_at_bank WHERE entry_date = ${pay_month}`
      if (!existing) await sql`INSERT INTO cash_at_bank (entry_date) VALUES (${pay_month})`
    } catch (e) {
      console.error('cash_at_bank ensure-row error (non-fatal):', e)
    }

    // No amount in the activity log/announcement -- salary totals stay confidential to owner-level.
    await logActivity(actor, 'confirmed payroll payment', monthLabel)

    return NextResponse.json({ ok: true, expense_id: expense.id, total_amount: total })
  } catch (e) {
    console.error('payslips confirm POST error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not confirm payment: ${detail}` }, { status: 500 })
  }
}
