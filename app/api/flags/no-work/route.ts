import { requireAuth, getActorName, badRequest, success } from '@/lib/api'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { work_date, reason } = await req.json()
  if (!work_date || !reason) return badRequest('Missing fields')

  const actor = getActorName(session)

  await sql`
    INSERT INTO no_work_days (work_date, reason, recorded_by)
    VALUES (${work_date}, ${reason}, ${actor})
    ON CONFLICT (work_date) DO UPDATE SET reason = ${reason}, recorded_by = ${actor}
  `

  await logActivity(actor, 'marked no-work day', `${work_date} — ${reason}`)
  return success({ ok: true })
}
