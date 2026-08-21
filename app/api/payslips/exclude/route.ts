import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { logActivity } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { once } from '@/lib/once'

const ensureExcludedCol = once(async () => {
  await sql`ALTER TABLE payslips ADD COLUMN IF NOT EXISTS excluded_from_payment BOOLEAN NOT NULL DEFAULT FALSE`.catch(() => {})
})

// Marks an already-generated payslip as excluded from that month's payment
// run -- the payslip record (and its numbers) stays exactly as built, it
// just won't be counted into the total when Confirm Payment sums up the
// Salaries expense for the month. Only possible before that month has
// already been confirmed/paid.
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session || !isOwnerLevel(session.user as any)) {
    return NextResponse.json({ error: 'Only the owner or Joe can change who gets paid' }, { status: 403 })
  }

  const { id, excluded } = await req.json() as { id: number; excluded: boolean }
  if (!id || typeof excluded !== 'boolean') {
    return NextResponse.json({ error: 'id and excluded are required' }, { status: 400 })
  }

  await ensureExcludedCol()

  const [row] = await sql`SELECT staff_name, pay_month::text AS pay_month FROM payslips WHERE id = ${id}`
  if (!row) return NextResponse.json({ error: 'Payslip not found' }, { status: 404 })

  const [confirmed] = await sql`SELECT 1 FROM payslip_payments WHERE pay_month = ${row.pay_month}`
  if (confirmed) {
    return NextResponse.json({ error: 'This month’s payroll has already been confirmed/paid — who’s excluded can’t be changed now.' }, { status: 400 })
  }

  await sql`UPDATE payslips SET excluded_from_payment = ${excluded} WHERE id = ${id}`

  const actor = session.user?.name || (session.user as any)?.username || 'Unknown'
  await logActivity(
    actor,
    excluded ? 'excluded staff from payroll payment' : 'restored staff to payroll payment',
    `${row.staff_name} — ${row.pay_month}`
  )

  return NextResponse.json({ ok: true })
}
