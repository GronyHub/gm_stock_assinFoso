import sql from '@/lib/db'
import { addPoint } from '@/lib/penalties'
import { pushToUsers, notifyOwners } from '@/lib/checklistAlerts'
import { SIGNERS, OWNER_SIGNERS } from '@/lib/signers'
import { LAW_AREAS, lawInArea } from '@/lib/lawAreas'
import { AREA_VIDEO } from '@/lib/lawVideo'

// Laws about the laws. Each is checked by the app once a day (19:25) and costs 1 point. Penalties already treats the first two weeks
// as a learning period (a warning, not a point), so these start counting then. A law's clock starts when it went live (page_laws.live_at).
export const META = [
  { title: 'Sign each new law within 24 hours', violation: 'A new law stays unsigned for more than 24 hours after it goes live', how: 'Open Company Laws, read the law, tick to sign it\nThe app checks every evening\nYou get a reminder before the deadline' },
  { title: 'Pass each law quiz within 7 days', violation: 'The quiz of a tile is not passed (75% or more) within 7 days of its laws going live', how: 'Open the tile in Company Laws and take its quiz\nYou can retake it until you pass' },
  { title: 'Watch each tile video to the end within 7 days', violation: 'The video of a tile is not watched to the end within 7 days of its laws going live', how: 'Open the tile in Company Laws and play its video to the end' },
  { title: 'Confirm the laws shown before work', violation: 'The login reminder of laws is not confirmed before work starts on a day you are clocked in', how: 'After you log in the reminder appears\nRead it, tick once to agree, and confirm' },
]
const SEED = 'meta-v1', REMIND_FRACTION = 5 // quiz and video: reminder on day 5 of 7

export async function seedMetaLaws() {
  try {
    await sql`ALTER TABLE page_laws ADD COLUMN IF NOT EXISTS live_at TIMESTAMPTZ`
    await sql`CREATE TABLE IF NOT EXISTS law_migrations (key TEXT PRIMARY KEY, done_at TIMESTAMPTZ NOT NULL DEFAULT now())`
    const c = await sql`INSERT INTO law_migrations (key) VALUES ('meta-laws-v1') ON CONFLICT DO NOTHING RETURNING key`
    if (!c.length) return
    await sql`UPDATE page_laws SET live_at = now() WHERE live_at IS NULL AND status = 'live'` // everything already live starts its clock now
    for (const d of META) {
      const v = [{ text: d.violation, points: 1, by: 'app', how: d.how, record: 'The app checks every evening and adds the point itself' }]
      await sql`INSERT INTO page_laws (scope_key, text, display_in_carousel, carousel_type, category, subcategory, law_type, status, seed, proof, points, violations, title, live_at)
        VALUES ('Staff management', ${d.title}, false, 'law', 'Staff management', 'Company laws', 'app', 'live', ${SEED}, 'tick', 1, ${JSON.stringify(v)}, ${d.title}, now())`
    }
  } catch (e) { console.error('meta laws seed failed:', e instanceof Error ? e.message : String(e)) }
}

const claim = async (key: string) => (await sql`INSERT INTO penalty_claims (key) VALUES (${key}) ON CONFLICT DO NOTHING RETURNING key`).length > 0
const hours = (since: string | Date) => (Date.now() - new Date(since).getTime()) / 3600000
type L = { id: number; code: string | null; title: string | null; category: string | null; subcategory: string | null; live_at: string }

export async function metaTick(day: string) {
  try {
    await sql`UPDATE page_laws SET live_at = now() WHERE live_at IS NULL AND status = 'live'`
    await sql`CREATE TABLE IF NOT EXISTS law_signatures (law_id INTEGER NOT NULL, staff TEXT NOT NULL, signed_at TIMESTAMPTZ NOT NULL DEFAULT now(), law_hash TEXT NOT NULL, PRIMARY KEY (law_id, staff))`
    await sql`CREATE TABLE IF NOT EXISTS law_quiz_results (id SERIAL PRIMARY KEY, staff TEXT NOT NULL, category TEXT NOT NULL, score INTEGER NOT NULL, total INTEGER NOT NULL, passed BOOLEAN NOT NULL, taken_at TIMESTAMPTZ NOT NULL DEFAULT now())`
    await sql`CREATE TABLE IF NOT EXISTS law_video_views (day TEXT NOT NULL, staff TEXT NOT NULL, area TEXT NOT NULL, watched_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (day, staff, area))`
    await sql`CREATE TABLE IF NOT EXISTS law_reminder_confirms (day TEXT NOT NULL, staff TEXT NOT NULL, law_id INTEGER NOT NULL, confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (day, staff, law_id))`
    await sql`CREATE TABLE IF NOT EXISTS penalty_claims (key TEXT PRIMARY KEY, done_at TIMESTAMPTZ NOT NULL DEFAULT now())`
  } catch (e) { console.error('meta tick setup failed:', e instanceof Error ? e.message : String(e)); return }
  const staff = SIGNERS.filter(s => !OWNER_SIGNERS.includes(s))
  const laws = await sql`SELECT id, code, title, category, subcategory, live_at FROM page_laws WHERE status = 'live' AND audience = 'staff' AND seed IS DISTINCT FROM ${SEED} AND live_at IS NOT NULL` as unknown as L[]
  const metaCode = async (i: number) => (await sql`SELECT code FROM page_laws WHERE seed = ${SEED} ORDER BY id OFFSET ${i} LIMIT 1`)[0]?.code as string | undefined
  const [cSign, cQuiz, cVid, cLogin] = [await metaCode(0), await metaCode(1), await metaCode(2), await metaCode(3)]
  const metaId = async (i: number) => Number((await sql`SELECT id FROM page_laws WHERE seed = ${SEED} ORDER BY id OFFSET ${i} LIMIT 1`)[0]?.id) || null
  const ids = [await metaId(0), await metaId(1), await metaId(2), await metaId(3)]
  for (const s of staff) {
    const clocked = (await sql`SELECT 1 FROM staff_times WHERE LOWER(staff_name) = ${s} AND work_date = ${day} AND actual_in IS NOT NULL`).length > 0
    if (!clocked) continue
    let awarded = 0
    const award = async (i: number, code: string | undefined, ref: string, why: string, pts = 1) => {
      if (awarded >= 3) return
      const r = await addPoint({ staff: s, points: pts, reason: `${code ? code + ': ' : ''}${why}`, source: 'meta', ref, lawId: ids[i], by: 'system', lawCode: code ?? null, violation: why })
      if (r) { awarded++; void notifyOwners(`Automatic point: ${s}`, why) }
    }
    // 1. signatures: 24 hours
    const signed = new Set((await sql`SELECT law_id FROM law_signatures WHERE staff = ${s}`).map(r => Number(r.law_id)))
    for (const l of laws) {
      if (signed.has(l.id)) continue
      const h = hours(l.live_at)
      if (h >= 24) await award(0, cSign, `sign:${l.id}`, `${l.code ?? 'A law'} was not signed within 24 hours of going live`)
      else if (h >= 16 && await claim(`signrem:${l.id}:${s}`)) void pushToUsers([s], 'Sign the new law', `${l.code ?? ''} ${l.title ?? ''} must be signed within 24 hours. Open Company Laws.`)
    }
    // 2 + 3. quiz and video per tile, 7 days after the tile's first law went live
    for (const a of LAW_AREAS) {
      const inArea = laws.filter(l => lawInArea(a, l))
      if (!inArea.length) continue
      const first = inArea.map(l => l.live_at).sort()[0], d = hours(first) / 24
      if (d < REMIND_FRACTION - 1) continue
      if (a.training) {
        const [p] = await sql`SELECT 1 FROM law_quiz_results WHERE staff = ${s} AND category = ${a.training} AND passed LIMIT 1`
        if (!p) { if (d >= 7) await award(1, cQuiz, `quiz:${a.key}`, `The ${a.label} quiz was not passed within 7 days`); else if (await claim(`quizrem:${a.key}:${s}`)) void pushToUsers([s], 'Quiz due tomorrow', `Pass the ${a.label} quiz in Company Laws.`) }
      }
      if (AREA_VIDEO[a.key] || a.video || a.training) {
        const [w] = await sql`SELECT 1 FROM law_video_views WHERE staff = ${s} AND area = ${a.key} LIMIT 1`
        if (!w) { if (d >= 7) await award(2, cVid, `video:${a.key}`, `The ${a.label} video was not watched to the end within 7 days`); else if (await claim(`videorem:${a.key}:${s}`)) void pushToUsers([s], 'Video due tomorrow', `Watch the ${a.label} video to the end in Company Laws.`) }
      }
    }
    // 4. login reminders on a day worked
    const login = await sql`SELECT id FROM page_laws WHERE status = 'live' AND audience = 'staff' AND reminder = 'login'` as unknown as { id: number }[]
    if (login.length) {
      const done = new Set((await sql`SELECT law_id FROM law_reminder_confirms WHERE staff = ${s} AND day = ${day}`).map(r => Number(r.law_id)))
      if (login.some(l => !done.has(l.id))) await award(3, cLogin, `login:${day}`, `The login law reminder was not confirmed on ${day}`)
    }
  }
}
