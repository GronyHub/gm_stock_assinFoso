import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { success, badRequest, unauthorized } from '@/lib/api'
import { caretakerName } from '@/lib/caretaker'
import { notifyRecord } from '@/lib/careAlerts'
import { ensureCareJob } from '@/lib/careJob'

// POST { rule_ids: number[], name } -- only the caretaker signs, with her full name.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return unauthorized()
  if ((session.user as { role?: string | null }).role !== 'children_manager') return badRequest('Only the caretaker signs these rules')
  await ensureCareJob()
  const b = await req.json().catch(() => ({}))
  const name = String(b.name ?? '').trim().slice(0, 80)
  const ids = Array.isArray(b.rule_ids) ? b.rule_ids.map(Number).filter(Number.isInteger) : []
  if (name.length < 3 || !ids.length) return badRequest('Type your full name and choose the rules to sign')
  const rules = await sql`SELECT id, version, text FROM care_job_rules WHERE active AND id = ANY(${ids})`
  const who = caretakerName(session)
  for (const r of rules) {
    const [done] = await sql`SELECT 1 AS x FROM care_job_signs WHERE rule_id = ${r.id} AND rule_version = ${r.version} AND signed_by = ${who} LIMIT 1`
    if (!done) await sql`INSERT INTO care_job_signs (rule_id, rule_version, rule_text, signed_name, signed_by) VALUES (${r.id}, ${r.version}, ${r.text}, ${name}, ${who})`
  }
  notifyRecord(who, `${name} signed ${rules.length} job rule${rules.length === 1 ? '' : 's'}`)
  return success({ ok: true, signed: rules.length })
}
