import sql from '@/lib/db'
import { addPoint } from '@/lib/penalties'
import { notifyOwners } from '@/lib/checklistAlerts'
import { SIGNERS, OWNER_SIGNERS, isManagerName } from '@/lib/signers'
import { videosDue } from '@/lib/videoDue'
import { featureOn } from '@/lib/featuresServer'

// Laws about the laws. Each is checked by the app once a day (19:25) and costs 1 point. Penalties already treats the first two weeks
// as a learning period (a warning, not a point), so these start counting then. A law's clock starts when it went live (page_laws.live_at).
export const META = [
  { title: 'Sign each new law within 24 hours', violation: 'A new law stays unsigned for more than 24 hours after it goes live', how: 'Open Company Laws, read the law, tick to sign it\nThe app checks every evening\nYou get a reminder before the deadline' },
  { title: 'Pass each law quiz within 7 days', violation: 'The quiz of a tile is not passed (75% or more) within 7 days of its laws going live', how: 'Open the tile in Company Laws and take its quiz\nYou can retake it until you pass' },
  { title: 'Watch each tile video to the end within 7 days', violation: 'The video of a tile is not watched to the end within 7 days of its laws going live', how: 'Open the tile in Company Laws and play its video to the end' },
  { title: 'Confirm the laws shown before work', violation: 'The login reminder of laws is not confirmed before work starts on a day you are clocked in', how: 'After you log in the reminder appears\nRead it, tick once to agree, and confirm' },
]
export const META_JOE = [
  { title: 'Complete each CCTV review within 48 hours', violation: 'A CCTV review of a day staff worked without the manager clocked in is still not done 48 hours after it was raised', how: 'Open the CCTV review from the pop-up or Waiting for team\nWatch the times shown, confirm sales and laws, and complete it' },
  { title: 'Decide waiting approvals within 48 hours', violation: 'A clock-out time, sanction or violation waiting for the manager is still undecided 48 hours after it was raised', how: 'Open Waiting for team (Today, Everyone) and the Shop Penalty Points tab\nApprove or reject each one, or ask the staff member a question' },
]
const SEED = 'meta-v1'

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

export async function seedMetaJoe() {
  try {
    const c = await sql`INSERT INTO law_migrations (key) VALUES ('meta-laws-joe-v1') ON CONFLICT DO NOTHING RETURNING key`
    if (!c.length) return
    for (const d of META_JOE) {
      const v = [{ text: d.violation, points: 1, by: 'app', how: d.how, record: 'The app checks every evening and adds the point itself' }]
      await sql`INSERT INTO page_laws (scope_key, text, display_in_carousel, carousel_type, category, subcategory, law_type, status, seed, proof, points, violations, title, live_at, audience)
        VALUES ('Staff management', ${d.title}, false, 'law', 'Staff management', 'Company laws', 'app', 'live', 'meta-v2', 'tick', 1, ${JSON.stringify(v)}, ${d.title}, now(), 'managers')`
    }
  } catch (e) { console.error('meta joe seed failed:', e instanceof Error ? e.message : String(e)) }
}

// Plain rules the app follows itself. They carry no penalty (points 0): they are written down so staff can read and sign them.
const RULES = [
  { title: 'Clock out when you leave', audience: 'staff', violation: 'You leave without clocking out. No penalty: the app clocks you out at the time of your last action at the shop (a Live tap or a checklist tick, even after 7pm), tells you, and you tap OK, send the correct time for approval, or tap Remind me later',
    how: 'Clock out when you leave the shop. You clock in once and out once a day\nWhen a colleague clocks out, they are asked whether you are still at the shop. If they say No, you have 1 minute to confirm, or you are clocked out at your last action\nAt 7pm the app asks: are you still at the shop?\nIf you forget, the app clocks you out using your last shop-only action and sends you a prompt\nA time you send is approved by Joe (Joe\'s is approved by Grony)\nWith no shop action to go on, you must enter your time out before you carry on' },
  { title: 'Review the CCTV when staff work without the manager', audience: 'managers', violation: 'Days when staff were at work and the manager had not clocked in are not reviewed on CCTV. No penalty here: the 48-hour law carries the point',
    how: 'The app lists the days and the times staff worked without the manager\nWatch the CCTV for those times\nConfirm that every sale was entered and every law was kept\nIf not, log a violation or send a question to the staff member' },
]
export async function seedRules() {
  try {
    const c = await sql`INSERT INTO law_migrations (key) VALUES ('rules-v1') ON CONFLICT DO NOTHING RETURNING key`
    if (!c.length) return
    for (const d of RULES) {
      const v = [{ text: d.violation, points: 0, by: 'app', how: d.how, record: 'The app does this itself and keeps the record' }]
      await sql`INSERT INTO page_laws (scope_key, text, display_in_carousel, carousel_type, category, subcategory, law_type, status, seed, proof, points, violations, title, live_at, audience)
        VALUES ('Staff management', ${d.title}, false, 'law', 'Staff management', 'Company laws', 'app', 'live', 'rules-v1', 'tick', 0, ${JSON.stringify(v)}, ${d.title}, now(), ${d.audience})`
    }
  } catch (e) { console.error('rules seed failed:', e instanceof Error ? e.message : String(e)) }
}

// Joe's app-enforced points: reviews and decisions left waiting more than 48 hours. One point per item.
export async function metaTickJoe(day: string) {
  const rows = await sql`SELECT id, code FROM page_laws WHERE seed = 'meta-v2' ORDER BY id` as unknown as { id: number; code: string | null }[]
  if (rows.length < 2) return
  const [cctv, dec] = rows
  const reviews = await sql`SELECT work_date::text AS d FROM cctv_reviews WHERE status = 'pending' AND created_at < now() - interval '48 hours'` as unknown as { d: string }[]
  for (const r of reviews) await addPoint({ staff: 'joe', reason: `${cctv.code ?? ''}: the CCTV review of ${r.d} was not done within 48 hours`, source: 'meta', ref: `cctv:${r.d}`, lawId: cctv.id, lawCode: cctv.code, violation: 'CCTV review not done within 48 hours', by: 'system', day })
  const waiting = [
    ...(await sql`SELECT 'clock:' || id AS k, 'a clock-out time' AS w FROM clock_corrections WHERE status = 'pending' AND staff <> 'joe' AND COALESCE(against, '') <> 'joe' AND requested_at < now() - interval '48 hours'`),
    ...(await sql`SELECT 'sanction:' || id AS k, 'a sanction' AS w FROM penalty_sanctions WHERE status = 'proposed' AND staff <> 'joe' AND created_at < now() - interval '48 hours'`),
    ...(await sql`SELECT 'viol:' || id AS k, 'a violation' AS w FROM staff_penalties WHERE status IN ('pending', 'disputed') AND staff <> 'joe' AND created_at < now() - interval '48 hours'`),
  ] as unknown as { k: string; w: string }[]
  let n = 0
  for (const x of waiting) { if (n >= 3) break; if (await addPoint({ staff: 'joe', reason: `${dec.code ?? ''}: ${x.w} was left waiting for more than 48 hours`, source: 'meta', ref: x.k, lawId: dec.id, lawCode: dec.code, violation: 'Approval left waiting 48 hours', by: 'system', day })) n++ }
}

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
  // A prompt switched off in Settings > Switches is never shown, so it cannot cost a point.
  const [loginOn, videoOn] = [await featureOn('law_reminder'), await featureOn('video_gate')]
  const metaCode = async (i: number) => (await sql`SELECT code FROM page_laws WHERE seed = ${SEED} ORDER BY id OFFSET ${i} LIMIT 1`)[0]?.code as string | undefined
  const [cVid, cLogin] = [await metaCode(2), await metaCode(3)]
  const metaId = async (i: number) => Number((await sql`SELECT id FROM page_laws WHERE seed = ${SEED} ORDER BY id OFFSET ${i} LIMIT 1`)[0]?.id) || null
  const ids = [await metaId(0), await metaId(1), await metaId(2), await metaId(3)]
  await metaTickJoe(day).catch(e => console.error('meta joe failed:', e instanceof Error ? e.message : String(e)))
  for (const s of staff) {
    const clocked = (await sql`SELECT 1 FROM staff_times WHERE LOWER(staff_name) = ${s} AND work_date = ${day} AND actual_in IS NOT NULL`).length > 0
    if (!clocked) continue
    let awarded = 0
    const award = async (i: number, code: string | undefined, ref: string, why: string, pts = 1) => {
      if (awarded >= 3) return
      const r = await addPoint({ staff: s, points: pts, reason: `${code ? code + ': ' : ''}${why}`, source: 'meta', ref, lawId: ids[i], by: 'system', lawCode: code ?? null, violation: why })
      if (r) { awarded++; void notifyOwners(`Automatic point: ${s}`, why) }
    }
    // 1. signatures and 2. quizzes: dropped (2026-11-13) -- the laws are statutory, nobody signs them; the daily law question replaces the quizzes.
    // 3. videos: only the tile videos the person is actually shown (videosDue: staff tiles with a video, not owner-only), overdue 7 days after going live.
    if (videoOn) {
      for (const v of await videosDue(s)) if (v.overdue) await award(2, cVid, `video:${v.key}`, `The ${v.label} video was not watched to the end within 7 days`)
    }
    // 4. login reminders on a day worked: the same laws the reminder screen shows this person (app/api/law-reminders GET).
    const login = loginOn ? await sql`SELECT id FROM page_laws WHERE status = 'live' AND law_type = 'standing' AND reminder = 'login' AND (audience <> 'managers' OR ${isManagerName(s)}) ORDER BY id` as unknown as { id: number }[] : []
    if (login.length) {
      const done = new Set((await sql`SELECT law_id FROM law_reminder_confirms WHERE staff = ${s} AND day = ${day}`).map(r => Number(r.law_id)))
      if (login.some(l => !done.has(l.id))) await award(3, cLogin, `login:${day}`, `The login law reminder was not confirmed on ${day}`)
    }
  }
}
