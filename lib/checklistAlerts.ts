import { recordPushResults } from '@/lib/pushHealth'
import sql from './db'
import { once } from './once'
import { MANAGERS } from './signers'
import { getClockState } from './clockState'
import { effectiveDue, appliesOn } from './dailyChecksShared'
import { isShopDay } from './rota'

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

// A reminder is shown inside the app (the Now box, the Waiting for me list and its bar), never pushed to the phone: a push is only for something a person did.
// The system's own timed nudges call this and do nothing here.
export function reminder(..._args: unknown[]): void {}

// Push to specific logins (never throws).
export async function pushToUsers(usernames: string[], title: string, body: string) {
  try {
    const names = usernames.map(u => u.toLowerCase())
    if (!names.length) return
    const subs = await sql`SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE LOWER(username) = ANY(${names})` as unknown as Sub[]
    await send(subs, title, body)
  } catch (e) { console.error('pushToUsers failed:', e instanceof Error ? e.message : String(e)) }
}
// Push to every shop login (everyone except the children's-section accounts).
export async function pushToShop(title: string, body: string) {
  try {
    const subs = await sql`SELECT ps.endpoint, ps.p256dh, ps.auth FROM push_subscriptions ps JOIN app_users au ON LOWER(au.username) = LOWER(ps.username)
      WHERE au.role <> 'children_manager' AND au.active IS NOT FALSE` as unknown as Sub[]
    await send(subs, title, body)
  } catch (e) { console.error('pushToShop failed:', e instanceof Error ? e.message : String(e)) }
}

// Tells the owner and Joe something needs their attention (never throws).
export async function notifyOwners(title: string, body: string) {
  try { await send(await ownerSubs(), title, body) } catch (e) { console.error('notifyOwners failed:', e instanceof Error ? e.message : String(e)) }
}

export async function checklistAlertsTick(now = new Date()) {
  // Due / late / end-of-day summaries are reminders: shown in the app, not pushed. Set CHECKLIST_PUSH=on to bring the pushes back.
  if (process.env.CHECKLIST_PUSH !== 'on') return
  if (process.env.CHECKLIST_ALERTS === 'off') return
  if (!(await isShopDay(now.toISOString().slice(0, 10)))) return // Sunday is a shop day only when the rota has someone working it
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes()
  if (nowMin < 6 * 60 || nowMin > 21 * 60) return // nothing to do outside the shop's working day
  const day = now.toISOString().slice(0, 10)

  // The day starts when the first staff member clocks in. Before that nothing is due and nothing is sent.
  const clock = await getClockState(day)
  if (clock.dayStart == null) return
  await ensureTable()

  const tiles = await sql`
    SELECT id, title, time, minutes, frequency, kind, days, (assignment = 'managers' OR (law_id IS NOT NULL AND law_id IN (SELECT id FROM page_laws WHERE audience = 'managers'))) AS mgr FROM daily_check_tiles
    WHERE active AND frequency = 'daily' AND kind <> 'properties' AND time ~ '^[0-2][0-9]:[0-5][0-9]$'` as unknown as { id: number; title: string; time: string; minutes: number | null; frequency: string; kind: string; mgr: boolean; days: string | null }[]
  const todaysTiles = tiles.filter(t => appliesOn(t, day))
  const doneRows = await sql`SELECT tile_id, value FROM daily_check_events WHERE day = ${day}` as unknown as { tile_id: number; value: string }[]
  const handled = new Set(doneRows.map(r => r.tile_id))
  const doneOnly = new Set(doneRows.filter(r => r.value === 'Done').map(r => r.tile_id))
  const due = effectiveDue(todaysTiles, clock.dayStart)

  // Tiles whose due time was 0, 15 or 30 minutes ago (2-minute grace; the claim stops repeats).
  const stages: [number, number][] = [[0, 0], [15, 1], [30, 2]]
  for (const [ago, stage] of stages) {
    const candidates = todaysTiles.filter(t => !handled.has(t.id) && due.has(t.id) && nowMin - ago - due.get(t.id)! >= 0 && nowMin - ago - due.get(t.id)! <= 2)
      .sort((a, b) => due.get(a.id)! - due.get(b.id)! || a.id - b.id)
    const fresh: { id: number; title: string }[] = []
    for (const t of candidates) {
      const c = await sql`INSERT INTO daily_check_alerts_sent (day, tile_id, stage) VALUES (${day}, ${t.id}, ${stage}) ON CONFLICT DO NOTHING RETURNING tile_id`
      if (c.length) fresh.push(t)
    }
    if (!fresh.length) continue
    const list = names(fresh.map(t => t.title))
    try {
      const mgrTiles = fresh.filter(t => (todaysTiles.find(x => x.id === t.id) as { mgr?: boolean } | undefined)?.mgr), staffTiles = fresh.filter(t => !mgrTiles.includes(t))
      if (stage === 0 || stage === 1) {
        if (staffTiles.length) await send(await presentSubs(day), stage === 0 ? `Checklist: ${staffTiles.length} due now` : `Checklist: ${staffTiles.length} late`, stage === 0 ? names(staffTiles.map(t => t.title)) : `Still not done: ${names(staffTiles.map(t => t.title))}`)
        if (mgrTiles.length) await pushToUsers(MANAGERS.filter(m => clock.present.includes(m)), stage === 0 ? `Managers: ${mgrTiles.length} due now` : `Managers: ${mgrTiles.length} late`, names(mgrTiles.map(t => t.title)))
      } else await send(await ownerSubs(), `Checklist: ${fresh.length} not done after 30 minutes`, list)
    } catch (e) { console.error('checklistAlerts send failed:', e instanceof Error ? e.message : String(e)) }
  }

  // End-of-day summary at 19:15, only on a day someone worked.
  if (nowMin === 19 * 60 + 15 || nowMin === 19 * 60 + 16) {
    const c = await sql`INSERT INTO daily_check_alerts_sent (day, tile_id, stage) VALUES (${day}, 0, 99) ON CONFLICT DO NOTHING RETURNING tile_id`
    if (!c.length) return
    const missed = todaysTiles.filter(t => !doneOnly.has(t.id))
    const total = todaysTiles.length, done = total - missed.length
    await send(await ownerSubs(), `Checklist today: ${done} of ${total} done`, missed.length ? `Missed ${missed.length}. First: ${names(missed.slice(0, 3).map(m => m.title))}` : 'Everything was done.').catch(() => {})
  }
}
