import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { logActivity } from '@/lib/logger'
import { NextRequest } from 'next/server'
import { once } from '@/lib/once'

const ensureSchema = once(async () => {
  await sql`ALTER TABLE payslips ADD COLUMN IF NOT EXISTS excluded_from_payment BOOLEAN NOT NULL DEFAULT FALSE`.catch(() => {})
})


export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error

  const username = (session.user as any)?.username

  // owner and joe see all; others see only their own
  const canSeeAll = isOwnerLevel(session.user as any)

  // Map username → staff_name in payslips table
  const nameMap: Record<string, string> = {
    joe: 'Joe', bino: 'Bino', james: 'James', rawlings: 'Rawlings',
  }

  await ensureSchema()

  let rows
  if (canSeeAll) {
    rows = await sql`
      SELECT id, staff_name, pay_month::text AS pay_month, payment_period,
             hours_worked, pay_for_hours, overtime_hours, pay_for_overtime,
             longevity_days, pay_for_longevity, duty_allowance, data_allowance,
             childcare_allowance, ssnit, total_salary, excluded_from_payment
      FROM payslips
      ORDER BY pay_month DESC, staff_name
    `
  } else {
    const staffName = nameMap[username] ?? null
    if (!staffName) return success([])
    rows = await sql`
      SELECT id, staff_name, pay_month::text AS pay_month, payment_period,
             hours_worked, pay_for_hours, overtime_hours, pay_for_overtime,
             longevity_days, pay_for_longevity, duty_allowance, data_allowance,
             childcare_allowance, ssnit, total_salary, excluded_from_payment
      FROM payslips
      WHERE LOWER(staff_name) = LOWER(${staffName})
      ORDER BY pay_month DESC
    `
  }

  return success(rows)
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
  // Built and saved as normal, just marked hidden from that month's Confirm
  // Payment total from the moment it's created -- see the Build view's
  // "Hide from Payment" toggle (StaffClient.tsx) and /api/payslips/exclude,
  // which flips this same column on an already-saved payslip later.
  excluded_from_payment?: boolean
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as any)) {
    return badRequest('Only the owner or Joe can save payslips')
  }

  try {
    const { pay_month, entries } = await req.json() as { pay_month: string; entries: PayslipEntry[] }
    if (!pay_month || !Array.isArray(entries) || !entries.length) {
      return badRequest('pay_month and entries are required')
    }

    await ensureSchema()

    for (const e of entries) {
      if (!e.staff_name) continue
      const excluded = !!e.excluded_from_payment
      await sql`
        INSERT INTO payslips (
          staff_name, pay_month, payment_period, hours_worked, pay_for_hours,
          overtime_hours, pay_for_overtime, longevity_days, pay_for_longevity,
          duty_allowance, data_allowance, childcare_allowance, ssnit, total_salary, excluded_from_payment
        ) VALUES (
          ${e.staff_name}, ${pay_month}, ${e.payment_period ?? null}, ${e.hours_worked ?? null}, ${e.pay_for_hours ?? null},
          ${e.overtime_hours ?? null}, ${e.pay_for_overtime ?? null}, ${e.longevity_days ?? null}, ${e.pay_for_longevity ?? null},
          ${e.duty_allowance ?? null}, ${e.data_allowance ?? null}, ${e.childcare_allowance ?? null}, ${e.ssnit ?? null}, ${e.total_salary ?? null}, ${excluded}
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
          total_salary = EXCLUDED.total_salary,
          excluded_from_payment = EXCLUDED.excluded_from_payment
      `
    }

    const actor = session.user?.name || (session.user as any)?.username || 'Unknown'
    await logActivity(actor, 'built payslips', `${entries.length} staff for ${pay_month}`)

    return success({ ok: true })
  } catch (e) {
    return handleError('payslips POST', e)
  }
}
