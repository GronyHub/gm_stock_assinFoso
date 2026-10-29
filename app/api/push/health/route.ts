import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensurePushHealth } from '@/lib/pushHealth'
import { isOwnerLevel } from '@/lib/roles'

// GET -- every phone/computer that has opened the app in the last 60 days (owner / manager only).
export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as never)) return badRequest('Only the owner or manager can see this.')
  try {
    await ensurePushHealth()
    const rows = await sql`
      SELECT d.device_id, d.username, d.status, d.platform, d.last_seen, d.status_since, d.last_ok,
             EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.endpoint = d.endpoint) AS subscribed
      FROM push_devices d
      WHERE d.last_seen > now() - interval '60 days'
      ORDER BY (d.status = 'on') ASC, d.username, d.last_seen DESC`
    return success(rows)
  } catch (e) { return handleError('push/health', e) }
}
