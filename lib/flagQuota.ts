import sql from '@/lib/db'
import { once } from '@/lib/once'
import { addPoint, ensurePenalties } from '@/lib/penalties'
import { pushToUsers } from '@/lib/checklistAlerts'

// THE DAILY FLAGS LAW. Every working day the manager (Joe) fixes at least FLAGS_PER_DAY flags (or every flag, when there are fewer), starting with the negative stock.
// How it is counted: in the morning the app writes down every flag that is open (each item with negative stock, and each entry of the other flag lists); a flag counts as
// fixed when it is no longer open. Anyone may fix them; the count is the manager's to make sure of. Each day short costs the manager 1 penalty point.
export const FLAGS_PER_DAY = 5
export const FLAG_MANAGER = 'joe'

export const ensureFlagQuota = once(async () => {
  await ensurePenalties()
  await sql`CREATE TABLE IF NOT EXISTS flag_snapshots (day TEXT NOT NULL, key TEXT NOT NULL, PRIMARY KEY (day, key))`.catch(() => {})
  await sql`CREATE TABLE IF NOT EXISTS flag_quota (day TEXT PRIMARY KEY, start_n INTEGER NOT NULL, neg_n INTEGER NOT NULL DEFAULT 0, fixed INTEGER, assessed_at TIMESTAMPTZ)`.catch(() => {})
})

const keyOf = (list: string, e: unknown) => {
  const o = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>
  const id = o.id ?? o.item_id ?? o.receipt_id ?? o.bill_id ?? o.day ?? o.date ?? o.work_date ?? o.staff_name ?? o.name
  return `${list}:${id != null ? String(id) : JSON.stringify(o).slice(0, 120)}`
}

// Every flag open right now, as stable keys. Negative stock first (its own keys start with "neg:").
export async function currentFlagKeys(): Promise<{ keys: Set<string>; neg: number }> {
  const keys = new Set<string>()
  const neg = await sql`SELECT s.item_id FROM item_stock_summary s JOIN active_items i ON i.id = s.item_id WHERE s.calculated_soh < 0 AND COALESCE(i.product_type, 'goods') <> 'service'`.catch(() => []) as unknown as { item_id: number }[]
  for (const r of neg) keys.add(`neg:${r.item_id}`)
  try {
    const { GET } = await import('@/app/api/flags/route')
    const data = await (await GET()).json() as Record<string, unknown>
    for (const [k, v] of Object.entries(data)) if (Array.isArray(v) && k !== 'groupNames') for (const e of v) keys.add(keyOf(k, e))
  } catch (e) { console.error('flag list failed:', e instanceof Error ? e.message : String(e)) }
  return { keys, neg: neg.length }
}

// The morning list for a day (taken the first time it is asked for).
export async function snapshot(day: string): Promise<{ startN: number; negN: number }> {
  await ensureFlagQuota()
  const [q] = await sql`SELECT start_n, neg_n FROM flag_quota WHERE day = ${day}`
  if (q) return { startN: Number(q.start_n), negN: Number(q.neg_n) }
  const { keys, neg } = await currentFlagKeys()
  const [ins] = await sql`INSERT INTO flag_quota (day, start_n, neg_n) VALUES (${day}, ${keys.size}, ${neg}) ON CONFLICT (day) DO NOTHING RETURNING day`
  if (ins) for (const k of keys) await sql`INSERT INTO flag_snapshots (day, key) VALUES (${day}, ${k}) ON CONFLICT DO NOTHING`
  return { startN: keys.size, negN: neg }
}

// Today's progress: flags fixed since the morning, how many are needed, and the negative stock still open.
export async function progress(day: string) {
  const { startN, negN } = await snapshot(day)
  const before = (await sql`SELECT key FROM flag_snapshots WHERE day = ${day}` as unknown as { key: string }[]).map(r => r.key)
  const { keys, neg } = await currentFlagKeys()
  const fixedKeys = before.filter(k => !keys.has(k))
  const needed = Math.min(FLAGS_PER_DAY, startN)
  return { day, startN, needed, fixed: fixedKeys.length, negFixed: fixedKeys.filter(k => k.startsWith('neg:')).length, negStart: negN, negOpen: neg, open: keys.size }
}

const msg = (p: Awaited<ReturnType<typeof progress>>) => `${p.fixed} of ${p.needed} flags fixed today. ${p.negOpen > 0 ? `Start with the negative stock: ${p.negOpen} item${p.negOpen === 1 ? '' : 's'} below zero. ` : ''}Open Flags in the left sidebar.`

// During the day: a reminder to the manager while fewer than the needed number are fixed (sent by the minute tick at set times).
export async function remind(day: string) {
  const p = await progress(day)
  if (p.fixed >= p.needed) return
  await pushToUsers([FLAG_MANAGER], 'Fix today\'s flags', msg(p))
}

// Day end: 1 point to the manager if fewer than the needed number were fixed.
export async function assess(day: string) {
  await ensureFlagQuota()
  const [done] = await sql`SELECT assessed_at FROM flag_quota WHERE day = ${day}`
  if (done?.assessed_at) return
  const p = await progress(day)
  await sql`UPDATE flag_quota SET fixed = ${p.fixed}, assessed_at = now() WHERE day = ${day}`
  if (p.fixed < p.needed) {
    await addPoint({ staff: FLAG_MANAGER, points: 1, reason: `Only ${p.fixed} of ${p.needed} flags fixed on ${day} (the law: at least ${FLAGS_PER_DAY} a day, starting with the negative stock)`, source: 'flags', ref: `flags:${day}`, day, by: 'system' })
    void pushToUsers([FLAG_MANAGER], 'Flags: 1 penalty point', `Only ${p.fixed} of ${p.needed} flags were fixed today.`)
  }
}
export const progressText = msg
