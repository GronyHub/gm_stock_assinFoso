import { recordPushResults } from '@/lib/pushHealth'
import sql from './db'
import { once } from './once'
import { ruleOfDay } from './customerServiceCode'

// Customer-service reminders pushed to every shop login at set times (GMT = Ghana), Monday to Saturday.
// Runs from instrumentation.ts once a minute; it only touches the database at the minutes listed below.
// Each reminder is sent once per day (claimed in service_reminders_sent). Switch off with SERVICE_REMINDERS=off.
type Item = { key: string; time: string; title: string; build: (date: string) => string }

const ITEMS: Item[] = [
  { key: 'morning', time: '08:30', title: 'Customer service: tag on?', build: d => { const r = ruleOfDay(d); return `Wear your tag. Rule of the day ${r.code}: ${r.text}` } },
  { key: 'greet', time: '11:00', title: 'Customer service check', build: () => 'Are you greeting every customer within 10 seconds? Stop, look up, smile. (CS-6, CS-7)' },
  { key: 'agree', time: '14:30', title: 'Customer service check', build: () => 'Price, time and work agreed before you start every job? Check the work before they pay. (CS-12, CS-21)' },
  { key: 'closing', time: '17:30', title: 'Customer service: closing', build: () => 'Log any complaints, reply to WhatsApp messages, give every customer a receipt and a thank-you. (CS-28, CS-29, CS-31)' },
]

const ensureTable = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS service_reminders_sent (alert_date DATE NOT NULL, alert_key TEXT NOT NULL, PRIMARY KEY (alert_date, alert_key))`.catch(() => {})
})

async function pushToShop(title: string, body: string) {
  const email = process.env.VAPID_EMAIL, pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY
  if (!email || !pub || !priv) { console.error('serviceReminders: VAPID keys not set -- not sent:', body); return }
  const webpush = (await import('web-push')).default
  webpush.setVapidDetails(email, pub, priv)
  const subs = await sql`
    SELECT ps.endpoint, ps.p256dh, ps.auth FROM push_subscriptions ps
    JOIN app_users au ON LOWER(au.username) = LOWER(ps.username)
    WHERE au.role <> 'children_manager' AND au.active IS NOT FALSE`
  const payload = JSON.stringify({ title, body })
  const results = await Promise.allSettled(subs.map(s => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)))
  const okEps: string[] = [], goneEps: string[] = []
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (r.status === 'fulfilled') { okEps.push(subs[i].endpoint as string); continue }
    const code = (r.reason as { statusCode?: number })?.statusCode
    if (code === 404 || code === 410) { goneEps.push(subs[i].endpoint as string); await sql`DELETE FROM push_subscriptions WHERE endpoint = ${subs[i].endpoint}`.catch(() => {}) }
    else console.error('serviceReminders: push failed', code ?? '', (r.reason as Error)?.message)
  }
  await recordPushResults(okEps, goneEps)
}

export async function serviceRemindersTick(now = new Date()) {
  if (process.env.SERVICE_REMINDERS === 'off') return
  const day = now.getUTCDay()
  if (day === 0) return // Sunday: shop closed
  const hhmm = (d: Date) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
  const due = new Set([hhmm(now), hhmm(new Date(now.getTime() - 60000)), hhmm(new Date(now.getTime() - 120000))])
  const todays = ITEMS.filter(i => due.has(i.time))
  if (!todays.length) return
  await ensureTable()
  const date = now.toISOString().slice(0, 10)
  for (const item of todays) {
    try {
      const claimed = await sql`INSERT INTO service_reminders_sent (alert_date, alert_key) VALUES (${date}, ${item.key}) ON CONFLICT DO NOTHING RETURNING alert_key`
      if (!claimed.length) continue
      await pushToShop(item.title, item.build(date))
    } catch (e) {
      console.error('serviceReminders error:', item.key, e instanceof Error ? e.message : String(e))
    }
  }
}
