import { getAuthUser, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { actorKey } from '@/lib/clockState'
import { ensureClosingReports, saveClosingReport, validClosing } from '@/lib/closingReports'
import { hasClosingGroups } from '@/lib/questionGroups'
import { NextRequest } from 'next/server'

const today = () => new Date().toISOString().slice(0, 10)

// GET -- today's closing report: { done, by, present } (present = everyone clocked in today, for the "no T-shirt" question).
// POST { closing_report } -- anyone clocked in today can answer it (it is part of the Daily Checklist now, not of clocking out).
export async function GET() {
  const { error } = await getAuthUser()
  if (error) return error
  try {
    await ensureClosingReports()
    const [r] = await sql`SELECT closer_name FROM closing_reports WHERE work_date = ${today()}`
    const present = await sql`SELECT DISTINCT staff_name FROM staff_times WHERE work_date = ${today()} AND actual_in IS NOT NULL AND staff_name <> '__shop_open__' ORDER BY staff_name`
    return success({ replaced: await hasClosingGroups(), done: !!r, by: r?.closer_name ?? null, present: present.map(p => String(p.staff_name)) })
  } catch (e) { return handleError('closing-report GET', e) }
}
export async function POST(req: NextRequest) {
  const { user, error } = await getAuthUser()
  if (error) return error
  try {
    const b = await req.json().catch(() => ({}))
    if (!validClosing(b.closing_report)) return badRequest('Please answer every question (Yes or No).')
    const me = actorKey(user as never)
    const [t] = await sql`SELECT 1 FROM staff_times WHERE LOWER(staff_name) = ${me} AND work_date = ${today()} AND actual_in IS NOT NULL`
    if (!t) return badRequest('Only someone clocked in today can answer the closing report.')
    const saved = await saveClosingReport(today(), me, b.closing_report)
    return success({ ok: true, saved })
  } catch (e) { return handleError('closing-report POST', e) }
}
