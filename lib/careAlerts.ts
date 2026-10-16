import sql from './db'
import { ensureCaretakerTables } from './caretaker'
import { CHILDREN, HOUSE_AREAS, isSchoolDay } from './caretakerShared'

// Scheduled caretaker reminders and missed-item alerts. Runs from
// instrumentation.ts once a minute, but only touches the database at the
// exact minutes listed below (about 25 times a day), so it never keeps Neon
// awake overnight. Times are GMT (= Ghana). Switch everything off with
// CARETAKER_ALERTS=off on the droplet.

type Day = 'school' | 'weekend' | 'all'
type Ctx = { date: string; nightDate: string; events: Ev[] }
type Ev = { child: string | null; kind: string; value: string | null; extra: { night?: string; slot?: string; routine_id?: number } | null; recorded_at?: string | Date }
type Item = { key: string; time: string; days: Day; to: 'owners' | 'caretaker'; title: string; build: (c: Ctx) => string | null }

const names = (list: string[]) => list.join(', ')
const missingChildren = (c: Ctx, pred: (e: Ev) => boolean) => CHILDREN.filter(ch => !c.events.some(e => e.child === ch && pred(e)))
const houseDone = (c: Ctx, value: string) => c.events.some(e => e.kind === 'house' && e.value === value)

function childMissing(label: string, pred: (e: Ev) => boolean) {
  return (c: Ctx) => { const m = missingChildren(c, pred); return m.length ? `${label}: ${names(m)}` : null }
}
function houseMissing(label: string, value: string) {
  return (c: Ctx) => houseDone(c, value) ? null : label
}
function nightMissing(slot: string) {
  return (c: Ctx) => {
    const m = missingChildren(c, e => e.kind === 'night' && e.extra?.night === c.nightDate && e.extra?.slot === slot)
    return m.length ? `${slot} night check not recorded for: ${names(m)}` : null
  }
}
function cleaningMissing(c: Ctx) {
  const m = HOUSE_AREAS.filter(a => !houseDone(c, `rule:clean:${a}`))
  return m.length ? `Cleaning not ticked: ${names(m)}` : null
}
function rulesMissing(period: string) {
  return (c: Ctx) => {
    const m = ['no_calls', 'sat_with_children'].filter(r => !houseDone(c, `rule:${r}:${period}`))
    return m.length ? `${period} rules not ticked: ${m.map(r => r === 'no_calls' ? 'no calls near children' : 'sat with children').join(', ')}` : null
  }
}

const ITEMS: Item[] = [
  // Reminders to the caretaker herself
  { key: 'remind-2200', time: '21:55', days: 'all', to: 'caretaker', title: 'Night check due', build: () => '10pm night check: go to each child, then record it.' },
  { key: 'remind-0100', time: '00:55', days: 'all', to: 'caretaker', title: 'Night check due', build: () => '1am night check: go to each child, then record it.' },
  { key: 'remind-0400', time: '03:55', days: 'all', to: 'caretaker', title: 'Night check due', build: () => '4am night check: go to each child, then record it.' },
  // (Breakfast and supper are alerted from the editable routine, see routineItems below.)
  // (Waking up is now a tile in the editable routine, so the old fixed wake-up alerts are gone.)
  // School days
  { key: 'car-left', time: '07:55', days: 'school', to: 'owners', title: 'Missed: school car', build: houseMissing('School car departure not recorded', 'car_left') },
  { key: 'cleaning-school', time: '16:30', days: 'school', to: 'owners', title: 'Missed: cleaning', build: cleaningMissing },
  { key: 'school-out', time: '17:00', days: 'school', to: 'owners', title: 'Missed: school out', build: houseMissing('Time children left school not recorded', 'school_out') },
  { key: 'home-back', time: '17:30', days: 'school', to: 'owners', title: 'Missed: back home', build: houseMissing('Time children got home not recorded', 'home_back') },
  { key: 'homework', time: '19:00', days: 'school', to: 'owners', title: 'Missed: homework', build: childMissing('Homework not recorded', e => e.kind === 'homework') },
  // Weekends
  { key: 'cleaning-weekend', time: '16:00', days: 'weekend', to: 'owners', title: 'Missed: cleaning', build: cleaningMissing },
  // Every day
  { key: 'rules-evening', time: '20:00', days: 'all', to: 'owners', title: 'Missed: house rules', build: rulesMissing('Evening') },
  { key: 'sweep', time: '20:15', days: 'all', to: 'owners', title: 'Missed: sweeping', build: houseMissing('House sweeping (8pm) not recorded', 'sweep_done') },
  { key: 'bedtime', time: '21:00', days: 'all', to: 'owners', title: 'Missed: bedtime', build: houseMissing('Children in bed (8:30pm) not recorded', 'bedtime_done') },
  { key: 'night-2200', time: '22:30', days: 'all', to: 'owners', title: 'Missed: night check', build: nightMissing('22:00') },
  { key: 'night-0100', time: '01:30', days: 'all', to: 'owners', title: 'Missed: night check', build: nightMissing('01:00') },
  { key: 'night-0400', time: '04:30', days: 'all', to: 'owners', title: 'Missed: night check', build: nightMissing('04:00') },
]
// Morning rules only matter before school on weekdays / by noon at weekends.
for (const p of ['Morning']) {
  ITEMS.push({ key: `rules-${p}-school`, time: '07:40', days: 'school', to: 'owners', title: 'Missed: house rules', build: rulesMissing(p) })
  ITEMS.push({ key: `rules-${p}-weekend`, time: '12:00', days: 'weekend', to: 'owners', title: 'Missed: house rules', build: rulesMissing(p) })
}

async function pushTo(who: 'owners' | 'caretaker', title: string, body: string, exceptUser = '') {
  const email = process.env.VAPID_EMAIL, pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY
  if (!email || !pub || !priv) { console.error('careAlerts: VAPID keys not set -- alert not sent:', body); return }
  const webpush = (await import('web-push')).default
  webpush.setVapidDetails(email, pub, priv)
  const all = who === 'owners'
    ? await sql`SELECT ps.endpoint, ps.p256dh, ps.auth, ps.username FROM push_subscriptions ps JOIN app_users au ON LOWER(au.username) = LOWER(ps.username) WHERE au.role = 'owner' OR LOWER(au.username) = 'joe' OR au.id IN (SELECT user_id FROM user_permissions WHERE feature_key = 'care_log' AND allowed)`
    : await sql`SELECT ps.endpoint, ps.p256dh, ps.auth, ps.username FROM push_subscriptions ps JOIN app_users au ON LOWER(au.username) = LOWER(ps.username) WHERE au.role = 'children_manager'`
  const subs = all.filter(s => !exceptUser || String(s.username ?? '').toLowerCase() !== exceptUser)
  const payload = JSON.stringify({ title, body })
  const results = await Promise.allSettled(subs.map(s => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)))
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (r.status === 'fulfilled') continue
    const code = (r.reason as { statusCode?: number })?.statusCode
    if (code === 404 || code === 410) await sql`DELETE FROM push_subscriptions WHERE endpoint = ${subs[i].endpoint}`.catch(() => {})
    else console.error('careAlerts: push failed', code ?? '', (r.reason as Error)?.message)
  }
}

export async function careAlertsTick(now = new Date()) {
  if (process.env.CARETAKER_ALERTS === 'off') return
  const hhmm = (d: Date) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
  // Fire anything due in the last 2 minutes (tolerates a late tick); the
  // claim below guarantees each alert is sent only once per day.
  const due = new Set([hhmm(now), hhmm(new Date(now.getTime() - 60000)), hhmm(new Date(now.getTime() - 120000))])
  const school = isSchoolDay(now)
  const todays = ITEMS.filter(i => i.to === 'caretaker' && due.has(i.time) && (i.days === 'all' || (i.days === 'school' && school) || (i.days === 'weekend' && !school)))
  // Missed-item alerts to the owners are switched off for now (owner's choice):
  // owners are notified when a record is made instead, see notifyRecord().
  if (!todays.length) return

  await ensureCaretakerTables()
  const date = now.toISOString().slice(0, 10)
  const prevDate = new Date(now.getTime() - 86400000).toISOString().slice(0, 10)
  // The 01:00 and 04:00 checks belong to the night that began the evening before.
  const nightDate = now.getUTCHours() < 12 ? prevDate : date

  for (const item of todays) {
    try {
      const claimed = await sql`
        INSERT INTO care_alerts_sent (alert_date, alert_key) VALUES (${date}, ${item.key})
        ON CONFLICT DO NOTHING RETURNING alert_key`
      if (!claimed.length) continue
      const rows = await sql`
        SELECT child, kind, value, extra, recorded_at FROM care_events
        WHERE recorded_at >= (${prevDate}::date)::timestamptz AND recorded_at < ((${date}::date) + 1)::timestamptz
      ` as unknown as Ev[]
      // Night checks read the previous evening too; every other check only
      // counts today's records.
      const isNight = item.key.startsWith('night-')
      const events = isNight ? rows : rows.filter(e => new Date(e.recorded_at as string).toISOString().slice(0, 10) === date)
      const text = item.build({ date, nightDate, events })
      if (text) await pushTo(item.to, item.title, text)
    } catch (e) {
      console.error('careAlerts error:', item.key, e instanceof Error ? e.message : String(e))
    }
  }
}

// Tells the owners (and Marian) that someone just recorded or tapped something.
// Never throws and never blocks the save; the person who tapped is not told.
export function notifyRecord(by: string, body: string) {
  if (process.env.CARETAKER_ALERTS === 'off') return
  void pushTo('owners', 'Care record', `${body} (${by})`, by.toLowerCase()).catch(e => console.error('notifyRecord:', e instanceof Error ? e.message : String(e)))
}
