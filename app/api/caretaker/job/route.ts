import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { success, badRequest, unauthorized } from '@/lib/api'
import { canCaretake, canManageRoutine, canSeeCH } from '@/lib/caretaker'
import { ensureCareJob, JOB_SECTIONS } from '@/lib/careJob'

// GET -> the rules, each with the signatures that still count (same version).
export async function GET() {
  const session = await auth()
  if (!session) return unauthorized()
  if (!(await canCaretake(session))) return success({ rules: [] }, 403)
  try {
    await ensureCareJob()
    const rules = await sql`SELECT id, section, text, position, version FROM care_job_rules WHERE active ORDER BY position, id`
    const signs = await sql`SELECT s.rule_id, s.signed_name, s.signed_by, s.signed_at FROM care_job_signs s
      JOIN care_job_rules r ON r.id = s.rule_id AND r.version = s.rule_version WHERE r.active ORDER BY s.signed_at`
    const u = session.user as { role?: string | null }
    // Private observations about the caretaker: only for people who may see C&H, never her.
    const canObserve = await canSeeCH(session)
    const obs = canObserve ? await sql`SELECT id, rule_id, kind, note, obs_date::text AS obs_date, logged_by FROM care_job_obs ORDER BY obs_date DESC, id DESC` : []
    return success({
      canObserve,
      general: obs.filter(o => o.rule_id == null),
      rules: rules.map(r => ({ ...r, signs: signs.filter(s => s.rule_id === r.id), obs: obs.filter(o => o.rule_id === r.id) })),
      canEdit: await canManageRoutine(session),
      canSign: u.role === 'children_manager',
    })
  } catch (e) {
    console.error('care job GET:', e instanceof Error ? e.message : String(e))
    return success({ rules: [] }, 500)
  }
}

// POST { section, text } -- add a rule (owners / supervisors).
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!(await canManageRoutine(session))) return badRequest('Not allowed')
  await ensureCareJob()
  const b = await req.json().catch(() => ({}))
  const text = String(b.text ?? '').trim().slice(0, 600)
  if (!text || !(JOB_SECTIONS as readonly string[]).includes(b.section)) return badRequest('Need a section and the rule text')
  const [row] = await sql`INSERT INTO care_job_rules (section, text, position) VALUES (${b.section}, ${text}, (SELECT COALESCE(MAX(position), 0) + 1 FROM care_job_rules)) RETURNING id`
  return success({ id: row.id }, 201)
}
