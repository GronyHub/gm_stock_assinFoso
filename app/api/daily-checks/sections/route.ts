import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensureDailyChecks } from '@/lib/dailyChecks'
import { isOwnerLevel } from '@/lib/roles'
import { NextRequest } from 'next/server'

// PUT { from, to } -- rename a group (every tile in it moves). Owner and manager only.
export async function PUT(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as any)) return badRequest('Only the owner and manager can change the checklist.')
  try {
    await ensureDailyChecks()
    const b = await req.json().catch(() => ({}))
    const from = String(b.from ?? '').trim(), to = String(b.to ?? '').trim().slice(0, 40)
    if (!from || !to) return badRequest('Need the old and new group name.')
    await sql`UPDATE daily_check_tiles SET section = ${to} WHERE section = ${from}`
    return success({ ok: true })
  } catch (e) { return handleError('daily-checks sections PUT', e) }
}
