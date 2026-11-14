import { recordPushResults } from '@/lib/pushHealth'
import sql from '@/lib/db'
import { once } from './once'

const ensureSchema = once(async () => {
  await sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS category TEXT`.catch(() => {})
  // Estimated time an activity took, when a caller can actually compute one
  // (currently only live sale taps -- item's Time/unit x Qty, the same
  // figure Live Sale's Log mode used to show in its own Dur column before
  // that moved here). Other activity types leave this null until their own
  // estimate rule is defined. Gap (time since the previous logged activity)
  // needs no stored column -- the Home feed derives it from consecutive
  // rows' created_at.
  await sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS estimated_duration_seconds INTEGER`.catch(() => {})
  // Points at the row in whatever table actually recorded this activity's
  // full detail (currently only live_sale_taps.id, for category='live sale
  // tap') -- lets the Home feed join back to the real Item/Qty/SP/SOH
  // instead of only having the body text's own summary of them.
  await sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS source_id INTEGER`.catch(() => {})
})


// Actions that shouldn't also become a public Announcements post: login/logout
// fire twice a day per staff member with no real info, 'posted announcement'
// is already an announcement itself (posting it again would duplicate the
// feed), and view-as is an owner/Joe-only concern
// that other staff -- including whoever is being viewed as -- shouldn't see.
const ANNOUNCEMENT_EXCLUDED_ACTIONS = new Set([
  'logged in', 'logged out', 'posted announcement',
  'started viewing portal as', 'stopped viewing portal as',
])

// Pushes go to the owner and Joe only (never the actor). The only exception: a message a person
// posted for the whole shop, which every colleague needs to see.
const ALL_STAFF_ACTIONS = new Set(['posted announcement'])

// silent: put it in the Home record without a push (used for the many small events of the day: ticks, signatures, points, approvals).
export const recordActivity = (staffName: string, action: string, details?: string) => logActivity(staffName, action, details, undefined, undefined, true).catch(() => {})

export async function logActivity(staffName: string, action: string, details?: string, estimatedDurationSeconds?: number, sourceId?: number, silent = false) {
  try {
    await sql`
      INSERT INTO activity_logs (staff_name, action, details)
      VALUES (${staffName}, ${action}, ${details ?? null})
    `
  } catch (e) {
    // don't let logging failure break the main action
    console.error('activity_logs insert error:', e)
  }

  if (!ANNOUNCEMENT_EXCLUDED_ACTIONS.has(action)) {
    try {
      const body = details ? `${action} — ${details}` : action
      // category = the raw action string, so the Home feed's type filter can
      // match on it exactly instead of parsing it back out of body text.
      // Manually-typed posts (see /api/announcements POST) leave this null.
      await ensureSchema()
      await sql`
        INSERT INTO announcements (body, author, media_urls, category, estimated_duration_seconds, source_id)
        VALUES (${body}, ${staffName}, '[]'::jsonb, ${action}, ${estimatedDurationSeconds ?? null}, ${sourceId ?? null})
      `
    } catch (e) {
      // don't let this break the main action either
      console.error('auto-announcement insert error:', e)
    }
  }

  // fire push (non-blocking)
  if (!silent) sendPush(staffName, action, details, !ALL_STAFF_ACTIONS.has(action)).catch(() => {})
}

async function sendPush(staffName: string, action: string, details: string | undefined, ownerOnly: boolean) {
  const vapidEmail = process.env.VAPID_EMAIL
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  if (!vapidEmail || !vapidPublic || !vapidPrivate) {
    // Was a silent return -- a missing key on the server looked exactly like "no one to notify".
    console.error('push: VAPID_EMAIL / NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not all set -- no push notifications will be sent')
    return
  }

  try {
    const webpush = (await import('web-push')).default
    webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate)

    const subs = ownerOnly
      ? await sql`
          SELECT ps.endpoint, ps.p256dh, ps.auth
          FROM push_subscriptions ps
          JOIN app_users au ON LOWER(au.username) = LOWER(ps.username)
          WHERE (au.role = 'owner' OR LOWER(au.username) = 'joe') AND LOWER(ps.username) <> LOWER(${staffName})
        `
      : await sql`SELECT ps.endpoint, ps.p256dh, ps.auth FROM push_subscriptions ps JOIN app_users au ON LOWER(au.username) = LOWER(ps.username)
          WHERE au.role <> 'children_manager' AND au.active IS NOT FALSE AND LOWER(ps.username) <> LOWER(${staffName})`
    if (!subs.length) return

    const payload = JSON.stringify({
      title: 'Grony',
      body: `${staffName}: ${action}${details ? ` — ${details}` : ''}`,
    })
    const results = await Promise.allSettled(
      subs.map(s =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        )
      )
    )
    // A phone that uninstalled/blocked notifications answers 404/410 forever;
    // drop those so they stop being retried, and log everything else.
    let failed = 0
    const okEps: string[] = [], goneEps: string[] = []
    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      if (r.status === 'fulfilled') { okEps.push(subs[i].endpoint as string); continue }
      const code = (r.reason as { statusCode?: number })?.statusCode
      if (code === 404 || code === 410) {
        goneEps.push(subs[i].endpoint as string)
        await sql`DELETE FROM push_subscriptions WHERE endpoint = ${subs[i].endpoint}`.catch(() => {})
      } else {
        failed++
        console.error('push send failed:', code ?? '', (r.reason as Error)?.message ?? r.reason)
      }
    }
    await recordPushResults(okEps, goneEps)
    if (failed) console.error(`push: ${failed} of ${subs.length} sends failed`)
  } catch (e) {
    console.error('push error:', e instanceof Error ? e.message : String(e))
  }
}
