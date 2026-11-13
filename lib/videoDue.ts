import sql from '@/lib/db'
import { LAW_AREAS, lawInArea } from '@/lib/lawAreas'
import { OWNER_SIGNERS, SIGNERS } from '@/lib/signers'

export type DueVideo = { key: string; label: string; src: string; dueDate: string; overdue: boolean }

// The tile videos a staff member still has to watch to the end: tiles staff use that have a video and live laws, not yet watched by them.
// Due 7 days after the tile's first law went live (the same clock as the law "Watch each tile video to the end within 7 days"). Most overdue first.
export async function videosDue(me: string): Promise<DueVideo[]> {
  if (!SIGNERS.includes(me) || OWNER_SIGNERS.includes(me)) return []
  await sql`CREATE TABLE IF NOT EXISTS law_video_views (day TEXT NOT NULL, staff TEXT NOT NULL, area TEXT NOT NULL, watched_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (day, staff, area))`.catch(() => {})
  const laws = await sql`SELECT category, subcategory, live_at FROM page_laws WHERE status = 'live' AND audience = 'staff' AND live_at IS NOT NULL` as unknown as { category: string | null; subcategory: string | null; live_at: string }[]
  const seen = new Set((await sql`SELECT DISTINCT area FROM law_video_views WHERE staff = ${me}`).map(r => String(r.area)))
  const out: DueVideo[] = []
  for (const a of LAW_AREAS) {
    if (!a.video || a.ownerOnly || seen.has(a.key)) continue
    const first = laws.filter(l => lawInArea(a, l)).map(l => new Date(l.live_at).getTime()).sort((x, y) => x - y)[0]
    if (!first) continue
    const due = first + 7 * 86400000
    out.push({ key: a.key, label: a.label, src: a.video, dueDate: new Date(due).toISOString().slice(0, 10), overdue: Date.now() > due })
  }
  return out.sort((x, y) => x.dueDate.localeCompare(y.dueDate))
}

// The video of the tile a law belongs to (for the question of the day: a wrong answer offers it).
export function videoForLaw(l: { category: string | null; subcategory: string | null }): { key: string; label: string; src: string } | null {
  const a = LAW_AREAS.find(x => x.video && !x.ownerOnly && lawInArea(x, l))
  return a ? { key: a.key, label: a.label, src: a.video! } : null
}
