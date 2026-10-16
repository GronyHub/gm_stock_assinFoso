import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { success, badRequest, unauthorized } from '@/lib/api'
import { canManageRoutine } from '@/lib/caretaker'
import { JOB_SECTIONS } from '@/lib/careJob'

type Ctx = { params: Promise<{ id: string }> }

// PUT { section, text } -- changing the wording bumps the version, so the rule must be signed again.
export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!(await canManageRoutine(session))) return badRequest('Not allowed')
  const id = Number((await params).id)
  const b = await req.json().catch(() => ({}))
  const text = String(b.text ?? '').trim().slice(0, 600)
  if (!id || !text || !(JOB_SECTIONS as readonly string[]).includes(b.section)) return badRequest('Need a section and the rule text')
  await sql`UPDATE care_job_rules SET section = ${b.section}, text = ${text},
    version = version + (CASE WHEN text <> ${text} THEN 1 ELSE 0 END) WHERE id = ${id}`
  return success({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!(await canManageRoutine(session))) return badRequest('Not allowed')
  await sql`UPDATE care_job_rules SET active = FALSE WHERE id = ${Number((await params).id)}`
  return success({ ok: true })
}
