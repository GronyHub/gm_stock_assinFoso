import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensurePenalties } from '@/lib/penalties'
import { isOwnerLevel } from '@/lib/roles'
import { NextRequest } from 'next/server'

// PATCH { start_counting: 'YYYY-MM-DD' } -- the day penalty points start to count (end of the learning period). Owner only.
export async function PATCH(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if ((session.user as { role?: string })?.role !== 'owner') return badRequest('Only the owner can change this.')
  try {
    await ensurePenalties()
    const d = String((await req.json().catch(() => ({}))).start_counting ?? '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return badRequest('Give a date.')
    await sql`INSERT INTO penalty_settings (key, value) VALUES ('start_counting', ${d}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
    return success({ ok: true })
  } catch (e) { return handleError('penalties settings', e) }
}
