import sql from '@/lib/db'

// The owner asked (2026-11-13) for conflicting information to be fixed. Runs once. Laws whose text no longer matched how the app works are corrected (staff sign the
// new wording again), and the clock-in rules that had no law get one.
const SANCTIONS = 'Sanctions: every violation of the Company Laws costs the penalty points shown on that law (most cost 1; absence without notice costs 2). Your points are always shown at the top of your profile and in Penalty Points. 20 points is a 3-day suspension with 10 hours deducted. 30 points is a 1-week suspension with 20 hours deducted. 50 points is dismissal. The owner approves every sanction. After a suspension your points drop to half the level. Points reduce by 5 after a clean week. A checklist task left undone at the end of the day costs 1 point to the person it falls on (at most 3 points a day each); if someone else did it, it counts as done. Until counting starts (the date is on the Penalty Points page and is set by the owner) points are a pilot: they are shown, but they reset and never count.'
const CLOCKIN = 'Clock in with the Clock In button, at the shop, with GPS on, at the real time. You clock in once and out once a day. A time you write that is 30 minutes or more earlier than the moment you clock in is a violation: every 5 of them cost 1 penalty point. If GPS is not working you may still clock in without it: your time then waits for the manager (Joe; Joe\'s own by Grony), who checks the CCTV and approves or rejects it, and you are told the decision.'
const CLOCKIN_V = [
  { text: 'A clock-in time written 30 minutes or more before the moment of clocking in', points: 0, by: 'app', record: 'Recorded by the app; every 5 cost 1 point', how: 'Use Clock In (Now). If you really arrived earlier and could not clock in, tell Joe' },
  { text: 'A fifth clock-in time written 30 minutes or more early', points: 1, by: 'app', record: 'Added automatically by the app' },
]

export async function conflictFixesOnce() {
  try {
    const c = await sql`INSERT INTO law_migrations (key) VALUES ('conflict-fixes-2026-11-13') ON CONFLICT DO NOTHING RETURNING key`
    if (!c.length) return
    await sql`UPDATE page_laws SET text = ${SANCTIONS} WHERE id = 148 AND title = 'Sanctions'`
    // Text-only corrections inside the violation lines (the recording place was renamed; the clock-out how-to gained the 6pm check and the once-a-day rule).
    await sql`UPDATE page_laws SET violations = REPLACE(violations, 'Logged against the manager in Violations', 'Logged against the manager in Penalty Points') WHERE violations LIKE '%Logged against the manager in Violations%'`
    await sql`UPDATE page_laws SET violations = REPLACE(violations, 'Open your profile (Waiting for me) and the Shop Violations tab', 'Open Waiting for team (Today, Everyone) and the Shop Penalty Points tab') WHERE violations LIKE '%Shop Violations tab%'`
    await sql`UPDATE page_laws SET violations = REPLACE(violations, 'Clock out when you leave the shop\\nAt 7pm', 'Clock out when you leave the shop. You clock in once and out once a day\\nFrom 6pm, when a colleague clocks out and says nobody else is at the shop, you have 1 minute to confirm you are still there, or you are clocked out at your last action\\nAt 7pm') WHERE id = 185`
    const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM page_laws WHERE seed = 'clockin-v1'`
    if (!n) await sql`INSERT INTO page_laws (scope_key, text, display_in_carousel, carousel_type, category, subcategory, law_type, status, seed, points, violations, title, live_at)
      VALUES ('Staff management', ${CLOCKIN}, false, 'law', 'Staff management', 'Attendance', 'standing', 'live', 'clockin-v1', 1, ${JSON.stringify(CLOCKIN_V)}, 'Clock in at the shop, at the real time', now())`
  } catch (e) { console.error('conflict fixes failed:', e instanceof Error ? e.message : String(e)) }
}

// The daily flags law (2026-11-13): the manager fixes at least 5 flags a day, starting with the negative stock.
export async function flagsLawOnce() {
  try {
    const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM page_laws WHERE seed = 'flagquota-v1'`
    const [r] = await sql`SELECT 1 FROM law_migrations WHERE key = 'seed-retired:flagquota-v1'`
    if (n || r) return
    // The older "every flag is fixed as soon as it appears" law (everyone, 09:30) contradicts this one, and staff no longer see flags: it is replaced.
    const { deleteLaw } = await import('@/lib/lawDelete')
    const old = await sql`SELECT id FROM page_laws WHERE text ILIKE 'Fix flags: every flag on Live% is fixed as soon as it appears%'` as unknown as { id: number }[]
    for (const o of old) await deleteLaw(o.id)
    const text = 'Every working day the manager fixes at least 5 flags (all of them, if there are fewer), starting with the negative stock. Flags are on the Flags page in the left sidebar only, never on the Grony Cash pages. The app writes down the open flags in the morning, counts how many are fixed by 19:25, and reminds the manager through the day. Each day fewer than 5 are fixed costs the manager 1 penalty point. Anyone may fix a flag; making sure 5 are fixed is the manager\'s duty.'
    const v = [{ text: 'Fewer than 5 flags fixed in a working day (or fewer than all, when there were fewer than 5)', points: 1, by: 'app', record: 'Added automatically by the app at 19:25', how: 'Open Flags in the left sidebar\nStart with Negative Stock: count the items and correct them\nThen fix any other flag until 5 are done' }]
    await sql`INSERT INTO page_laws (scope_key, text, display_in_carousel, carousel_type, category, subcategory, law_type, status, seed, points, violations, title, audience, live_at)
      VALUES ('Stock & records', ${text}, false, 'law', 'Stock & records', 'Flags', 'standing', 'live', 'flagquota-v1', 1, ${JSON.stringify(v)}, 'Fix at least 5 flags a day', 'managers', now())`
  } catch (e) { console.error('flags law failed:', e instanceof Error ? e.message : String(e)) }
}

// The daily counts law (2026-11-13): standalone, not part of the flags.
export async function countsLawOnce() {
  try {
    const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM page_laws WHERE seed = 'countquota-v1'`
    const [r] = await sql`SELECT 1 FROM law_migrations WHERE key = 'seed-retired:countquota-v1'`
    if (n || r) return
    const text = 'Every working day the manager makes sure at least 10 items are counted in Counts (a stock count saved for each). Anyone may do the counting; making sure 10 are done is the manager\'s duty. Each day fewer than 10 are counted costs the manager 1 penalty point, checked at 19:25. The app reminds the manager through the day.'
    const v = [{ text: 'Fewer than 10 items counted in a working day', points: 1, by: 'app', record: 'Added automatically by the app at 19:25', how: 'Open Counts\nCount the items that are due first\nSave each count' }]
    await sql`INSERT INTO page_laws (scope_key, text, display_in_carousel, carousel_type, category, subcategory, law_type, status, seed, points, violations, title, audience, live_at)
      VALUES ('Stock & records', ${text}, false, 'law', 'Stock & records', 'Counts', 'standing', 'live', 'countquota-v1', 1, ${JSON.stringify(v)}, 'Count at least 10 items a day', 'managers', now())`
  } catch (e) { console.error('counts law failed:', e instanceof Error ? e.message : String(e)) }
}

// The owner moved the start of counting (to 21 Nov) on the Penalty Points page: the law no longer names a date, it points to that setting.
export async function sanctionsDateOnce() {
  try {
    const c = await sql`INSERT INTO law_migrations (key) VALUES ('sanctions-date-2026-11-13') ON CONFLICT DO NOTHING RETURNING key`
    if (!c.length) return
    await sql`UPDATE page_laws SET text = REPLACE(text, 'Until counting starts (Monday 16 November 2026) points are a pilot', 'Until counting starts (the date is on the Penalty Points page and is set by the owner) points are a pilot') WHERE id = 148`
  } catch (e) { console.error('sanctions date fix failed:', e instanceof Error ? e.message : String(e)) }
}

// Signing dropped (2026-11-13): the "sign each new law within 24 hours" law is taken out of force (kept as a row so the other app-checked laws keep their order),
// and the pilot points given for unsigned laws are withdrawn.
export async function dropSigningOnce() {
  try {
    const c = await sql`INSERT INTO law_migrations (key) VALUES ('drop-signing-2026-11-13') ON CONFLICT DO NOTHING RETURNING key`
    if (!c.length) return
    const laws = await sql`UPDATE page_laws SET status = 'retired' WHERE (title = 'Sign each new law within 24 hours' OR text ILIKE 'Sign each new law within 24 hours%') RETURNING id, tile_id` as unknown as { id: number; tile_id: number | null }[]
    for (const l of laws) if (l.tile_id) await sql`UPDATE daily_check_tiles SET active = false WHERE id = ${l.tile_id}`
    await sql`UPDATE staff_penalties SET status = 'dismissed', note = 'Withdrawn: the laws are no longer signed' WHERE status IN ('active', 'pending') AND source = 'meta' AND reason ILIKE '%was not signed within 24 hours%'`
  } catch (e) { console.error('drop signing failed:', e instanceof Error ? e.message : String(e)) }
}
