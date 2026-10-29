import { requireAuth, badRequest, success, handleError, getActorName } from '@/lib/api'
import sql from '@/lib/db'
import { ensurePushHealth, runPushWatchdog } from '@/lib/pushHealth'
import { NextRequest } from 'next/server'

const OK = new Set(['on', 'off', 'blocked', 'unsupported', 'needs-install'])

// POST { deviceId, status, platform?, endpoint? } -- each phone/computer reports whether its notifications are on.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await ensurePushHealth()
    const b = await req.json().catch(() => ({}))
    const deviceId = typeof b.deviceId === 'string' ? b.deviceId.slice(0, 64) : ''
    const status = String(b.status ?? '')
    if (!deviceId || !OK.has(status)) return badRequest('Bad heartbeat.')
    const platform = typeof b.platform === 'string' ? b.platform.slice(0, 60) : null
    const endpoint = typeof b.endpoint === 'string' && b.endpoint ? b.endpoint : null
    const ua = (req.headers.get('user-agent') ?? '').slice(0, 300)
    const user = getActorName(session)
    await sql`
      INSERT INTO push_devices (device_id, username, status, platform, user_agent, endpoint)
      VALUES (${deviceId}, ${user}, ${status}, ${platform}, ${ua}, ${endpoint})
      ON CONFLICT (device_id) DO UPDATE SET
        username = ${user}, platform = ${platform}, user_agent = ${ua}, endpoint = ${endpoint}, last_seen = now(),
        status_since = CASE WHEN push_devices.status = ${status} THEN push_devices.status_since ELSE now() END,
        alerted_at = CASE WHEN ${status} = 'on' THEN NULL ELSE push_devices.alerted_at END,
        status = ${status}`
    void runPushWatchdog()
    return success({ ok: true })
  } catch (e) { return handleError('push/heartbeat', e) }
}
