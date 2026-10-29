import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { recordPushResults } from '@/lib/pushHealth'
import { isOwnerLevel } from '@/lib/roles'
import { NextRequest } from 'next/server'

// POST { deviceId } -- send one test notification to that phone (owner / manager only).
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as never)) return badRequest('Only the owner or manager can send a test.')
  try {
    const { deviceId } = await req.json().catch(() => ({}))
    const [row] = await sql`
      SELECT ps.endpoint, ps.p256dh, ps.auth FROM push_devices d
      JOIN push_subscriptions ps ON ps.endpoint = d.endpoint WHERE d.device_id = ${String(deviceId ?? '')}`
    if (!row) return badRequest('This phone has no active notification link. Ask them to open the app and tap Turn on notifications.')
    const email = process.env.VAPID_EMAIL, pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY
    if (!email || !pub || !priv) return badRequest('Notification keys are not set on the server.')
    const webpush = (await import('web-push')).default
    webpush.setVapidDetails(email, pub, priv)
    try {
      await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, JSON.stringify({ title: 'Grony', body: 'Test notification: your notifications are working.' }))
      await recordPushResults([row.endpoint as string], [])
      return success({ ok: true })
    } catch (e) {
      const code = (e as { statusCode?: number })?.statusCode
      if (code === 404 || code === 410) {
        await recordPushResults([], [row.endpoint as string])
        await sql`DELETE FROM push_subscriptions WHERE endpoint = ${row.endpoint}`.catch(() => {})
        return badRequest('That phone is no longer reachable. It must open the app and turn notifications on again.')
      }
      return badRequest(`Could not send: ${(e as Error).message}`)
    }
  } catch (e) { return handleError('push/test', e) }
}
