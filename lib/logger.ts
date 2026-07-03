import sql from '@/lib/db'

// Actions that shouldn't also become a public Announcements post: login/logout
// fire twice a day per staff member with no real info, and 'posted announcement'
// is already an announcement itself (posting it again would duplicate the feed).
const ANNOUNCEMENT_EXCLUDED_ACTIONS = new Set(['logged in', 'logged out', 'posted announcement'])

export async function logActivity(staffName: string, action: string, details?: string) {
  try {
    await sql`
      INSERT INTO activity_logs (staff_name, action, details)
      VALUES (${staffName}, ${action}, ${details ?? null})
    `
  } catch {
    // don't let logging failure break the main action
  }

  if (!ANNOUNCEMENT_EXCLUDED_ACTIONS.has(action)) {
    try {
      const body = details ? `${action} — ${details}` : action
      await sql`
        INSERT INTO announcements (body, author, media_urls)
        VALUES (${body}, ${staffName}, '[]'::jsonb)
      `
    } catch {
      // don't let this break the main action either
    }
  }

  // fire push to all subscribers (non-blocking)
  sendPushToAll(staffName, action, details).catch(() => {})
}

async function sendPushToAll(staffName: string, action: string, details?: string) {
  const vapidEmail = process.env.VAPID_EMAIL
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  if (!vapidEmail || !vapidPublic || !vapidPrivate) return

  try {
    const webpush = (await import('web-push')).default
    webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate)

    const subs = await sql`SELECT endpoint, p256dh, auth FROM push_subscriptions`
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
