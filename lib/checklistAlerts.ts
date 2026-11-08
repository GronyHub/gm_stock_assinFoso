import { recordPushResults } from '@/lib/pushHealth'
import sql from './db'
import { once } from './once'

// Daily Checklist alerts, run from instrumentation.ts once a minute (GMT = Ghana, Monday to Saturday).
//  - at a tile's time, and again 15 minutes later: staff who are clocked in get a push naming what is due/late
//  - 30 minutes late: the owner and Joe are told
//  - 19:15: an end-of-day summary goes to the owner and Joe
// Each alert is sent once (claimed in daily_check_alerts_sent). Switch off with CHECKLIST_ALERTS=off.
const ensureTable = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS daily_check_alerts_sent (day TEXT NOT NULL, tile_id INTEGER NOT NULL, stage INTEGER NOT NULL, PRIMARY KEY (day, tile_id, stage))`.catch(() => {})
})

type Sub = { endpoint: string; p256dh: string; auth: string }
async function send(subs: Sub[], title: string, body: string) {
  if (!subs.length) return
  const email = process.env.VAPID_EMAIL, pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY
  if (!email || !pub || !priv) { console.error('checklistAlerts: VAPID keys not set -- not sent:', body); return }
  const webpush = (await import('web-push')).default
  webpush.setVapidDetails(email, pub, priv)
  const payload = JSON.stringify({ title, body })
  const results = await Promise.allSettled(subs.map(s => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)))
  const ok: string[] = [], gone: string[] = []
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (r.status === 'fulfilled') { ok.push(subs[i].endpoint); continue }
    const code = (r.reason as { statusCode?: number })?.statusCode
    if (code === 404 || code === 410) { gone.push(subs[i].endpoint); await sql`DELETE FROM push_subscriptions WHERE endpoint = ${subs[i].endpoint}`.catch(() => {}) }
    else console.error('checklistAlerts: push failed', code ?? '', (r.reason as Error)?.message)
  }
  await recordPushResults(ok, gone)
}

const presentSubs = (day: string) => sql`
  SELECT endpoint, p256dh, auth FROM push_subscriptions
  WHERE LOWER(username) IN (SELECT LOWER(staff_name) FROM staff_times WHERE work_date = ${day} AND staff_name <> '__shop_open__' AND actual_in IS NOT NULL AND actual_out IS NULL)` as unknown as Promise<Sub[]>
const ownerSubs = () => sql`
  SELECT ps.endpoint, ps.p256dh, ps.auth FROM push_subscriptions ps JOIN app_users au ON LOWER(au.username) = LOWER(ps.username)
  WHERE au.role = 'owner' OR LOWER(au.username) = 'joe'` as unknown as Promise<Sub[]>

const names = (titles: string[]) => {
  const short = titles.slice(0, 3).map(t => t.length > 60 ? t.slice(0, 57) + '…' : t)
  return short.join(' · ') + (titles.length > 3 ? ` · +${titles.length - 3} more` : '')
}

export async function checklistAlertsTick(now = new Date()) {
  if (process.env.CHECKLIST_ALERTS === 'off') return
  if (now.getUTCDay() === 0) return // Sunday: shop closed
  const hm = (d: Date) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
  const day = now.toISOString().slice(0, 10)
  await ensureTable()

  // Tiles whose time was 0, 15 or 30 minutes ago (a 2-minute grace so a late tick still fires; the claim stops repeats).
  const stages: [number, number][] = [[0, 0], [15, 1], [30, 2]]
  for (const [ago, stage] of stages) {
    const times = [0, 1, 2].map(k => hm(new Date(now.getTime() - (ago + k) * 60000)))
    const tiles = await sql`
      SELECT t.id, t.title FROM daily_check_tiles t
      WHERE t.active AND t.frequency = 'daily' AND t.kind = 'tap' AND t.time = ANY(${times})
        AND NOT EXISTS (SELECT 1 FROM daily_check_events e WHERE e.tile_id = t.id AND e.day = ${day})
      ORDER BY t.time, t.id`
    const fresh: { id: number; title: string }[] = []
    for (const t of tiles as { id: number; title: string }[]) {
      const c = await sql`INSERT INTO daily_check_alerts_sent (day, tile_id, stage) VALUES (${day}, ${t.id}, ${stage}) ON CONFLICT DO NOTHING RETURNING tile_id`
      if (c.length) fresh.push(t)
    }
    if (!fresh.length) continue
    const list = names(fresh.map(t => t.title))
    try {
      if (stage === 0) await send(await presentSubs(day), `Checklist: ${fresh.length} due now`, list)
      else if (stage === 1) await send(await presentSubs(day), `Checklist: ${fresh.length} late`, `Still not done: ${list}`)
      else await send(await ownerSubs(), `Checklist: ${fresh.length} not done after 30 minutes`, list)
    } catch (e) { console.error('checklistAlerts send failed:', e instanceof Error ? e.message : String(e)) }
  }

  // End-of-day summary at 19:15.
  if (hm(now) === '19:15' || hm(new Date(now.getTime() - 60000)) === '19:15') {
    const c = await sql`INSERT INTO daily_check_alerts_sent (day, tile_id, stage) VALUES (${day}, 0, 99) ON CONFLICT DO NOTHING RETURNING tile_id`
    if (!c.length) return
    const [{ total, done }] = await sql`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM daily_check_events e WHERE e.tile_id = t.id AND e.day = ${day} AND e.value = 'Done'))::int AS done
      FROM daily_check_tiles t WHERE t.active AND t.frequency = 'daily' AND t.kind = 'tap'` as unknown as { total: number; done: number }[]
    const missed = await sql`
      SELECT t.title FROM daily_check_tiles t
      WHERE t.active AND t.frequency = 'daily' AND t.kind = 'tap'
        AND NOT EXISTS (SELECT 1 FROM daily_check_events e WHERE e.tile_id = t.id AND e.day = ${day} AND e.value = 'Done')
      ORDER BY t.time NULLS LAST, t.id LIMIT 3`
    await send(await ownerSubs(), `Checklist today: ${done} of ${total} done`, total - done ? `Missed ${total - done}. First: ${names((missed as { title: string }[]).map(m => m.title))}` : 'Everything was done.').catch(() => {})
  }
}
