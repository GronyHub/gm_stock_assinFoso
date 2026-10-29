import sql from '@/lib/db'
import { once } from '@/lib/once'
import { sendOwnerAlertEmail } from '@/lib/mailer'

// One row per phone/computer that has opened the app: whether its notifications are on, and
// when we last heard from it and last delivered something to it. Fed by the app itself
// (heartbeat) and by every push send (delivered / gone).
export const ensurePushHealth = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS push_devices (
    device_id TEXT PRIMARY KEY, username TEXT, status TEXT NOT NULL DEFAULT 'on', platform TEXT, user_agent TEXT,
    endpoint TEXT, first_seen TIMESTAMPTZ NOT NULL DEFAULT now(), last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
    status_since TIMESTAMPTZ NOT NULL DEFAULT now(), last_ok TIMESTAMPTZ, alerted_at TIMESTAMPTZ)`.catch(() => {})
  await sql`CREATE INDEX IF NOT EXISTS push_devices_endpoint ON push_devices (endpoint)`.catch(() => {})
  await sql`CREATE TABLE IF NOT EXISTS push_meta (key TEXT PRIMARY KEY, value TIMESTAMPTZ NOT NULL)`.catch(() => {})
})

export type DeviceStatus = 'on' | 'off' | 'blocked' | 'unsupported' | 'needs-install' | 'expired'
export const STATUS_LABEL: Record<string, string> = {
  on: 'On', off: 'Not turned on', blocked: 'Blocked', unsupported: 'Not supported', 'needs-install': 'Not installed to home screen', expired: 'Stopped working',
}

// Called by the senders: which endpoints took the message, and which answered "gone".
export async function recordPushResults(okEndpoints: string[], goneEndpoints: string[]) {
  try {
    await ensurePushHealth()
    if (okEndpoints.length) await sql`UPDATE push_devices SET last_ok = now(), status = CASE WHEN status = 'expired' THEN 'on' ELSE status END WHERE endpoint = ANY(${okEndpoints})`
    if (goneEndpoints.length) await sql`UPDATE push_devices SET status = 'expired', status_since = now() WHERE endpoint = ANY(${goneEndpoints}) AND status <> 'expired'`
  } catch (e) { console.error('recordPushResults:', e instanceof Error ? e.message : String(e)) }
}

// Once a day (whichever phone checks in first runs it): tell the owner about phones whose notifications are
// off / blocked / stopped for more than a day, or that have not opened the app for 3+ days. Each phone is
// reported at most once every 3 days.
export async function runPushWatchdog() {
  try {
    await ensurePushHealth()
    const [claimed] = await sql`
      INSERT INTO push_meta (key, value) VALUES ('watchdog', now())
      ON CONFLICT (key) DO UPDATE SET value = now() WHERE push_meta.value < now() - interval '20 hours'
      RETURNING key`
    if (!claimed) return
    const rows = await sql`
      SELECT d.device_id, d.username, d.status, d.platform, d.last_seen, d.status_since
      FROM push_devices d JOIN app_users au ON LOWER(au.username) = LOWER(d.username) AND au.active IS NOT FALSE
      WHERE (d.alerted_at IS NULL OR d.alerted_at < now() - interval '3 days')
        AND (
          (d.status IN ('off', 'blocked', 'expired', 'needs-install', 'unsupported') AND d.status_since < now() - interval '1 day' AND d.last_seen > now() - interval '14 days')
          OR (d.status = 'on' AND d.last_seen < now() - interval '3 days' AND d.last_seen > now() - interval '14 days')
        )
      ORDER BY d.username`
    if (!rows.length) return
    const day = 86400000
    const lines = rows.map(r => {
      const seen = Math.max(0, Math.floor((Date.now() - new Date(r.last_seen as string).getTime()) / day))
      const what = r.status === 'on' ? `has not opened the app for ${seen} days` : `notifications: ${STATUS_LABEL[r.status as string] ?? r.status}`
      return `${r.username} (${r.platform ?? 'unknown device'}) - ${what}`
    })
    await sql`UPDATE push_devices SET alerted_at = now() WHERE device_id = ANY(${rows.map(r => r.device_id as string)})`
    await sendOwnerAlertEmail('Grony: some phones are not getting notifications',
      `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:20px"><h3>Notifications need attention</h3><ul>${lines.map(l => `<li>${l.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</li>`).join('')}</ul>
      <p>Open the app, Notifications page, to see every phone and send a test.</p></div>`).catch(e => console.error('watchdog email:', e instanceof Error ? e.message : String(e)))
  } catch (e) { console.error('runPushWatchdog:', e instanceof Error ? e.message : String(e)) }
}
