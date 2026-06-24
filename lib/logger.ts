import sql from '@/lib/db'

export async function logActivity(staffName: string, action: string, details?: string) {
  try {
    await sql`
      INSERT INTO activity_logs (staff_name, action, details)
      VALUES (${staffName}, ${action}, ${details ?? null})
    `
  } catch {
    // don't let logging failure break the main action
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
