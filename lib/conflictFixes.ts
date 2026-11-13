import sql from '@/lib/db'

// The owner asked (2026-11-13) for conflicting information to be fixed. Runs once. Laws whose text no longer matched how the app works are corrected (staff sign the
// new wording again), and the clock-in rules that had no law get one.
const SANCTIONS = 'Sanctions: every violation of the Company Laws costs the penalty points shown on that law (most cost 1; absence without notice costs 2). Your points are always shown at the top of your profile and in Penalty Points. 20 points is a 3-day suspension with 10 hours deducted. 30 points is a 1-week suspension with 20 hours deducted. 50 points is dismissal. The owner approves every sanction. After a suspension your points drop to half the level. Points reduce by 5 after a clean week. A checklist task left undone at the end of the day costs 1 point to the person it falls on (at most 3 points a day each); if someone else did it, it counts as done. Until counting starts (Monday 16 November 2026) points are a pilot: they are shown, but they reset and never count.'
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
