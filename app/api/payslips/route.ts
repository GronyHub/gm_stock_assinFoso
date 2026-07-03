import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { logActivity } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'

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
             childcare_allowance, ssnit, total_salary
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
             childcare_allowance, ssnit, total_salary
      FROM payslips
      WHERE LOWER(staff_name) = LOWER(${staffName})
      ORDER BY pay_month DESC
    `
  }

  return NextResponse.json(rows)
}

type PayslipEntry = {
  staff_name: string
  payment_period?: string | null
  hours_worked?: number | null
  pay_for_hours?: number | null
  overtime_hours?: number | null
  pay_for_overtime?: number | null
  longevity_days?: number | null
  pay_for_longevity?: number | null
  duty_allowance?: number | null
  data_allowance?: number | null
  childcare_allowance?: number | null
  ssnit?: number | null
  total_salary?: number | null
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isOwnerLevel(session.user as any)) {
    return NextResponse.json({ error: 'Only the owner or Joe can save payslips' }, { status: 403 })
  }

  try {
    const { pay_month, entries } = await req.json() as { pay_month: string; entries: PayslipEntry[] }
    if (!pay_month || !Array.isArray(entries) || !entries.length) {
      return NextResponse.json({ error: 'pay_month and entries are required' }, { status: 400 })
    }

    for (const e of entries) {
      if (!e.staff_name) continue
      await sql`
        INSERT INTO payslips (
          staff_name, pay_month, payment_period, hours_worked, pay_for_hours,
          overtime_hours, pay_for_overtime, longevity_days, pay_for_longevity,
          duty_allowance, data_allowance, childcare_allowance, ssnit, total_salary
        ) VALUES (
          ${e.staff_name}, ${pay_month}, ${e.payment_period ?? null}, ${e.hours_worked ?? null}, ${e.pay_for_hours ?? null},
          ${e.overtime_hours ?? null}, ${e.pay_for_overtime ?? null}, ${e.longevity_days ?? null}, ${e.pay_for_longevity ?? null},
          ${e.duty_allowance ?? null}, ${e.data_allowance ?? null}, ${e.childcare_allowance ?? null}, ${e.ssnit ?? null}, ${e.total_salary ?? null}
        )
        ON CONFLICT (staff_name, pay_month) DO UPDATE SET
          payment_period = EXCLUDED.payment_period,
          hours_worked = EXCLUDED.hours_worked,
          pay_for_hours = EXCLUDED.pay_for_hours,
          overtime_hours = EXCLUDED.overtime_hours,
          pay_for_overtime = EXCLUDED.pay_for_overtime,
          longevity_days = EXCLUDED.longevity_days,
          pay_for_longevity = EXCLUDED.pay_for_longevity,
          duty_allowance = EXCLUDED.duty_allowance,
          data_allowance = EXCLUDED.data_allowance,
          childcare_allowance = EXCLUDED.childcare_allowance,
          ssnit = EXCLUDED.ssnit,
          total_salary = EXCLUDED.total_salary
      `
    }

    const actor = session.user?.name || (session.user as any)?.username || 'Unknown'
    await logActivity(actor, 'built payslips', `${entries.length} staff for ${pay_month}`)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('payslips POST error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not save: ${detail}` }, { status: 500 })
  }
}
