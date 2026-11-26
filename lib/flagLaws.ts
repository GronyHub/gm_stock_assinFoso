import sql from '@/lib/db'
import { FLAGS } from '@/lib/flagRegistry'
import { parseViolations } from '@/lib/lawViolations'
import { addPoint, ensurePenalties } from '@/lib/penalties'
import { keyOf, managerWorked, FLAG_MANAGER } from '@/lib/flagQuota'

// THE OPEN ITEMS BEHIND EVERY FLAG, as stable keys (an item id, a receipt, a day...). `ok` lists the flags whose source could be read this time:
// some sources need a signed-in request, so in a background job they are left out (never counted as "nothing open").
export type OpenKeys = { keys: Record<string, string[]>; ok: Set<string> }
let cache: { at: number; data: OpenKeys } | null = null
const asArr = async (res: Response) => { if (!res.ok) throw new Error(`status ${res.status}`); const j = await res.json(); return Array.isArray(j) ? j : [] }

export async function openKeysAll(): Promise<OpenKeys> {
  if (cache && Date.now() - cache.at < 2 * 60 * 1000) return cache.data
  const keys: Record<string, string[]> = {}, ok = new Set<string>()
  const put = (k: string, list: string[]) => { keys[k] = list; ok.add(k) }
  try { put('neg_soh', (await sql`SELECT s.item_id AS id FROM item_stock_summary s JOIN active_items i ON i.id = s.item_id WHERE s.calculated_soh < 0 AND COALESCE(i.product_type, 'goods') <> 'service'`).map(r => `neg:${r.id}`)) } catch { /* left out */ }
  try { put('no_sp', (await sql`SELECT id FROM active_items WHERE COALESCE(selling_rate, 0) = 0`).map(r => `sp:${r.id}`)) } catch { /* left out */ }
  try { put('no_cp', (await sql`SELECT id FROM active_items WHERE COALESCE(product_type, 'goods') <> 'service' AND COALESCE(purchase_rate, 0) = 0`).map(r => `cp:${r.id}`)) } catch { /* left out */ }
  try {
    const lists = await (await (await import('@/app/api/flags/route')).GET()).json() as Record<string, unknown>
    for (const f of FLAGS) if (f.list.startsWith('flags:')) { const name = f.list.slice(6), v = lists[name]; if (Array.isArray(v)) put(f.key, v.map(e => keyOf(name, e))) }
  } catch (e) { console.error('flag lists failed:', e instanceof Error ? e.message : String(e)) }
  try {
    const d = await asArr(await (await import('@/app/api/stock/daily/route')).GET()), o = await asArr(await (await import('@/app/api/stock/overdue/route')).GET())
    put('to_count', [...d, ...o].map(e => keyOf('count', e)))
  } catch { /* left out */ }
  // The ones read from routes that need a signed-in request.
  const route = async (load: () => Promise<{ GET: () => Promise<Response> }>, key: string, pick?: (rows: unknown[]) => unknown[]) => {
    try { const rows = await asArr(await (await load()).GET()); put(key, (pick ? pick(rows) : rows).map(e => keyOf(key, e))) } catch { /* left out */ }
  }
  const pending = (rows: unknown[]) => rows.filter(r => !(r as { confirmed?: boolean }).confirmed)
  await route(() => import('@/app/api/aliases/unresolved/route'), 'alias_prezoho_sales', pending)
  await route(() => import('@/app/api/aliases/unresolved-bills/route'), 'alias_prezoho_bills', pending)
  await route(() => import('@/app/api/aliases/unresolved-receipts/route'), 'alias_prezoho_receipts', pending)
  await route(() => import('@/app/api/aliases/audit/route'), 'alias_flagged')
  await route(() => import('@/app/api/aliases/ambiguous/route'), 'alias_ambiguous')
  await route(() => import('@/app/api/aliases/leaks/route'), 'alias_name_conflicts')
  await route(() => import('@/app/api/losses/summary/route'), 'service_violation', rows => rows.filter(r => { const x = r as { product_type?: string; cnt?: number; gmc?: number; bl?: number }; return x.product_type === 'service' && (Number(x.cnt) !== 0 || Number(x.gmc) !== 0 || Number(x.bl) !== 0) }).map(r => ({ id: (r as { item_id?: number }).item_id })))
  try { put('needs_review', (await sql`SELECT id FROM active_items WHERE needs_review IS TRUE`).map(r => `nr:${r.id}`)) } catch { /* left out */ }
  const data = { keys, ok }
  if (ok.size >= FLAGS.length) cache = { at: Date.now(), data }   // a partial read is not kept
  return data
}

// FIX N A DAY. A flag law with a daily number (flag_per_day): in the morning the app writes down what is open on that flag; each one no longer open counts as fixed.
let ready = false
async function ensure() {
  if (ready) return
  await ensurePenalties()
  await sql`CREATE TABLE IF NOT EXISTS flag_law_quota (day TEXT NOT NULL, law_id INTEGER NOT NULL, start_n INTEGER NOT NULL, fixed INTEGER, assessed_at TIMESTAMPTZ, PRIMARY KEY (day, law_id))`
  await sql`CREATE TABLE IF NOT EXISTS flag_law_snap (day TEXT NOT NULL, law_id INTEGER NOT NULL, key TEXT NOT NULL, PRIMARY KEY (day, law_id, key))`
  ready = true
}
type FlagLaw = { id: number; flag_key: string; flag_per_day: string | number; violations: string | null; points: number | null }
const dailyLaws = async () => await sql`SELECT id, flag_key, flag_per_day, violations, points FROM page_laws WHERE law_type = 'flag' AND status = 'live' AND flag_key IS NOT NULL AND flag_per_day IS NOT NULL AND flag_per_day > 0` as unknown as FlagLaw[]

export type FlagProgress = { fixed: number; needed: number; start: number }
// Where each daily flag law stands today (the morning list is written the first time it is asked for, once the flag could be read).
export async function flagLawProgress(day: string): Promise<Record<number, FlagProgress>> {
  const laws = await dailyLaws(), out: Record<number, FlagProgress> = {}
  if (!laws.length) return out
  await ensure()
  const open = await openKeysAll()
  for (const l of laws) {
    let [q] = await sql`SELECT start_n FROM flag_law_quota WHERE day = ${day} AND law_id = ${l.id}`
    if (!q) {
      if (!open.ok.has(l.flag_key)) continue
      const list = open.keys[l.flag_key] ?? []
      const [ins] = await sql`INSERT INTO flag_law_quota (day, law_id, start_n) VALUES (${day}, ${l.id}, ${list.length}) ON CONFLICT DO NOTHING RETURNING start_n`
      if (ins) for (const k of list) await sql`INSERT INTO flag_law_snap (day, law_id, key) VALUES (${day}, ${l.id}, ${k}) ON CONFLICT DO NOTHING`
      q = { start_n: list.length }
    }
    if (!open.ok.has(l.flag_key)) continue
    const now = new Set(open.keys[l.flag_key] ?? [])
    const before = (await sql`SELECT key FROM flag_law_snap WHERE day = ${day} AND law_id = ${l.id}`).map(r => String(r.key))
    out[l.id] = { fixed: before.filter(k => !now.has(k)).length, needed: Math.min(Number(l.flag_per_day), Number(q.start_n)), start: Number(q.start_n) }
  }
  return out
}
export async function snapshotFlagLaws(day: string) { await flagLawProgress(day) }

// Day end: the manager gets the law's points for each daily flag law where fewer than the number needed were fixed (only for a day he worked).
export async function assessFlagLaws(day: string) {
  const laws = await dailyLaws(); if (!laws.length) return
  await ensure()
  if (!(await managerWorked(day))) return
  const prog = await flagLawProgress(day)
  for (const l of laws) {
    const p = prog[l.id]; if (!p) continue   // the flag could not be read: no point on a guess
    const [done] = await sql`SELECT assessed_at FROM flag_law_quota WHERE day = ${day} AND law_id = ${l.id}`
    if (done?.assessed_at) continue
    await sql`UPDATE flag_law_quota SET fixed = ${p.fixed}, assessed_at = now() WHERE day = ${day} AND law_id = ${l.id}`
    if (p.fixed >= p.needed) continue
    const pts = parseViolations(l.violations)[0]?.points ?? l.points ?? 1
    const f = FLAGS.find(x => x.key === l.flag_key)
    await addPoint({ staff: FLAG_MANAGER, points: pts, lawId: l.id, reason: `${f?.label ?? l.flag_key}: only ${p.fixed} of ${p.needed} fixed on ${day} (the law: fix at least ${Number(l.flag_per_day)} a day)`, source: 'flaglaw', ref: `flaglaw:${l.id}:${day}`, day, by: 'system' })
  }
}
