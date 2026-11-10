import { pushToShop } from '@/lib/checklistAlerts'
import sql from './db'
import { once } from './once'

// (The 08:30 "rule of the day" push was dropped: the strip on every page and the start-of-day card already show it.)
// Customer-service reminders pushed to every shop login at set times (GMT = Ghana), Monday to Saturday.
// Runs from instrumentation.ts once a minute; it only touches the database at the minutes listed below.
// Each reminder is sent once per day (claimed in service_reminders_sent). Switch off with SERVICE_REMINDERS=off.
type Item = { key: string; time: string; title: string; build: (date: string) => string }

const ITEMS: Item[] = [
  { key: 'greet', time: '11:00', title: 'Customer service check', build: () => 'Are you greeting every customer within 10 seconds? Stop, look up, smile. (CS-6, CS-7)' },
  { key: 'agree', time: '14:30', title: 'Customer service check', build: () => 'Price, time and work agreed before you start every job? Check the work before they pay. (CS-12, CS-21)' },
  { key: 'closing', time: '17:30', title: 'Customer service: closing', build: () => 'Log any complaints, reply to WhatsApp messages, give every customer a receipt and a thank-you. (CS-28, CS-29, CS-31)' },
]

const ensureTable = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS service_reminders_sent (alert_date DATE NOT NULL, alert_key TEXT NOT NULL, PRIMARY KEY (alert_date, alert_key))`.catch(() => {})
})

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
