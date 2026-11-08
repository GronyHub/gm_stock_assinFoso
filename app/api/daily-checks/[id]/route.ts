import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensureDailyChecks, CHECK_SECTIONS, FREQUENCIES } from '@/lib/dailyChecks'
import { NextRequest } from 'next/server'

const cleanMinutes = (v: unknown) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 && n <= 240 ? n : 5 }
const HM = /^([01]\d|2[0-3]):[0-5]\d$/
type Ctx = { params: Promise<{ id: string }> }

// PUT { title, section, time, icon, frequency, prop_filter, how } -- managers only
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireAuth()
  if (error) return error
  if ((session.user as { role?: string })?.role === 'staff') return badRequest('Only managers can change the checklist.')
  try {
    await ensureDailyChecks()
    const id = Number((await params).id)
    const b = await req.json().catch(() => ({}))
    const title = String(b.title ?? '').trim().slice(0, 240)
    const section = String(b.section ?? '')
    if (!title || !(CHECK_SECTIONS as readonly string[]).includes(section)) return badRequest('Need a section and a title.')
    const frequency = (FREQUENCIES as readonly string[]).includes(b.frequency) ? b.frequency : 'daily'
    await sql`UPDATE daily_check_tiles SET title = ${title}, section = ${section}, time = ${HM.test(b.time ?? '') ? b.time : null},
      icon = ${String(b.icon || '✅').slice(0, 8)}, frequency = ${frequency}, minutes = ${cleanMinutes(b.minutes)}, how = ${b.how ? String(b.how).slice(0, 600) : null},
      prop_filter = CASE WHEN kind = 'properties' THEN ${String(b.prop_filter ?? '').slice(0, 200)} ELSE prop_filter END WHERE id = ${id}`
    return success({ ok: true })
  } catch (e) { return handleError('daily-checks PUT', e) }
}

// DELETE -- takes the tile out of the checklist (past records are kept)
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireAuth()
  if (error) return error
  if ((session.user as { role?: string })?.role === 'staff') return badRequest('Only managers can change the checklist.')
  try {
    await sql`UPDATE daily_check_tiles SET active = false WHERE id = ${Number((await params).id)}`
    return success({ ok: true })
  } catch (e) { return handleError('daily-checks DELETE', e) }
}
