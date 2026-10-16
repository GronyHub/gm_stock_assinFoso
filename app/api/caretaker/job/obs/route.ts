import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { success, badRequest, unauthorized } from '@/lib/api'
import { canSeeCH, caretakerName } from '@/lib/caretaker'
import { ensureCareJob } from '@/lib/careJob'

// POST { rule_id?: number | null, note, kind?: 'concern'|'good'|'note', date?: YYYY-MM-DD }
// Private observations about the caretaker -- owners and Marian, never her.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!(await canSeeCH(session))) return badRequest('Not allowed')
  await ensureCareJob()
  const b = await req.json().catch(() => ({}))
  const note = String(b.note ?? '').trim().slice(0, 1000)
  if (!note) return badRequest('Write the observation')
  const kind = b.kind === 'concern' || b.kind === 'good' ? b.kind : 'note'
  const ruleId = Number.isInteger(Number(b.rule_id)) && Number(b.rule_id) > 0 ? Number(b.rule_id) : null
  const date = typeof b.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.date) && b.date <= new Date().toISOString().slice(0, 10) ? b.date : new Date().toISOString().slice(0, 10)
  const [row] = await sql`INSERT INTO care_job_obs (rule_id, kind, note, obs_date, logged_by) VALUES (${ruleId}, ${kind}, ${note}, ${date}::date, ${caretakerName(session)}) RETURNING id`
  return success({ id: row.id }, 201)
}
