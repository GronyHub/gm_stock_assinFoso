import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const username = (session.user as any)?.username

  // owner and joe see all; others see only their own
  const canSeeAll = isOwnerLevel(session.user as any)

  // Map username → staff_name in payslips table
  const nameMap: Record<string, string> = {
    joe: 'Joe', bino: 'Bino', james: 'James', rawlings: 'Rawlings',
  }

  let rows
  if (canSeeAll) {
    rows = await sql`
      SELECT id, staff_name, pay_month::text AS pay_month, payment_period,
             hours_worked, pay_for_hours, overtime_hours, pay_for_overtime,
             longevity_days, pay_for_longevity, duty_allowance, data_allowance,
             ssnit, total_salary
      FROM payslips
      ORDER BY pay_month DESC, staff_name
    `
  } else {
    const staffName = nameMap[username] ?? null
    if (!staffName) return NextResponse.json([])
    rows = await sql`
      SELECT id, staff_name, pay_month::text AS pay_month, payment_period,
             hours_worked, pay_for_hours, overtime_hours, pay_for_overtime,
             longevity_days, pay_for_longevity, duty_allowance, data_allowance,
             ssnit, total_salary
      FROM payslips
      WHERE LOWER(staff_name) = LOWER(${staffName})
      ORDER BY pay_month DESC
    `
  }

  return NextResponse.json(rows)
}
