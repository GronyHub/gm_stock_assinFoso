import { cap } from '@/lib/strings'
import { getAuthUser, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { once } from '@/lib/once'
import { actorKey } from '@/lib/clockState'
import { SIGNERS } from '@/lib/signers'
import { notifyOwners } from '@/lib/checklistAlerts'
import { NextRequest } from 'next/server'

const ensure = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS law_video_views (day TEXT NOT NULL, staff TEXT NOT NULL, area TEXT NOT NULL, watched_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (day, staff, area))`.catch(() => {})
})

// POST { area, label } -- a staff member watched a tile's video to the end. The owners get one notification per person, tile and day.
export async function POST(req: NextRequest) {
  const { user, error } = await getAuthUser()
  if (error) return error
  try {
    await ensure()
    const me = actorKey(user as any)
    if (!SIGNERS.includes(me)) return success({ ok: true })
    const b = await req.json().catch(() => ({}))
    const area = String(b.area ?? '').slice(0, 40), label = String(b.label ?? area).slice(0, 60)
    if (!area) return success({ ok: true })
    const day = new Date().toISOString().slice(0, 10)
    const r = await sql`INSERT INTO law_video_views (day, staff, area) VALUES (${day}, ${me}, ${area}) ON CONFLICT DO NOTHING RETURNING area`
    if (r.length) void notifyOwners(`${cap(me)} watched a law video`, `${label}, to the end.`)
    return success({ ok: true })
  } catch (e) { return handleError('law-video POST', e) }
}
