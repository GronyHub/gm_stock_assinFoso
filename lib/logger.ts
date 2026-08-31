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
// feed), and view-as is an owner/Joe-only concern (see OWNER_ONLY_ACTIONS)
// that other staff -- including whoever is being viewed as -- shouldn't see.
const ANNOUNCEMENT_EXCLUDED_ACTIONS = new Set([
  'logged in', 'logged out', 'posted announcement',
  'started viewing portal as', 'stopped viewing portal as',
])

// Notified to owner-level (Grony/Joe) only, never broadcast to all staff.
const OWNER_ONLY_ACTIONS = new Set(['started viewing portal as', 'stopped viewing portal as'])

export async function logActivity(staffName: string, action: string, details?: string, estimatedDurationSeconds?: number, sourceId?: number) {
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
  sendPush(staffName, action, details, OWNER_ONLY_ACTIONS.has(action)).catch(() => {})
}

async function sendPush(staffName: string, action: string, details: string | undefined, ownerOnly: boolean) {
  const vapidEmail = process.env.VAPID_EMAIL
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  if (!vapidEmail || !vapidPublic || !vapidPrivate) return

  try {
    const webpush = (await import('web-push')).default
    webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate)

    const subs = ownerOnly
      ? await sql`
          SELECT ps.endpoint, ps.p256dh, ps.auth
          FROM push_subscriptions ps
          JOIN app_users au ON LOWER(au.username) = LOWER(ps.username)
          WHERE au.role = 'owner' OR LOWER(au.username) = 'joe'
        `
      : await sql`SELECT endpoint, p256dh, auth FROM push_subscriptions`
    if (!subs.length) return

    const payload = JSON.stringify({
      title: 'Grony',
      body: `${staffName}: ${action}${details ? ` — ${details}` : ''}`,
    })
    await Promise.allSettled(
      subs.map(s =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        )
      )
    )
  } catch {
    // silent
  }
}
