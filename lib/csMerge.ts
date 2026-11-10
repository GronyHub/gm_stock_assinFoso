import sql from '@/lib/db'
import { CUSTOMER_SERVICE_CODE } from '@/lib/customerServiceCode'

// Merges the Customer Service Code (lib/customerServiceCode.ts) into Company Laws. Each code rule is compared with the laws that already exist (any category) by
// the words they share. A rule that an existing law already says is NOT added again (the existing law stays, and the merge is noted). Every other rule becomes a
// DRAFT law in "Customer service" (one violation line, 1 point), so the owner approves them together with one tap and nobody is asked to sign 25 new laws overnight.
// When they are approved, the three umbrella laws "Customer Service Code: CS-x apply here" are removed, because the individual laws replace them.
const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'is', 'are', 'it', 'at', 'with', 'your', 'you', 'their', 'them', 'they', 'that', 'this', 'be', 'by', 'as', 'every', 'any', 'all', 'never', 'always', 'before', 'after', 'when', 'if', 'do', 'not', 'no', 'will', 'can', 'so', 'we', 'our', 'us', 'from', 'has', 'have', 'had', 'must', 'should'])
const stem = (w: string) => w.length > 4 ? w.replace(/(ing|ed|es|s)$/, '') : w
export const sigTokens = (t: string) => Array.from(new Set(t.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)).map(stem)))
// How much of the SMALLER text is contained in the other (0..1).
export function similarity(a: string, b: string): number {
  const x = sigTokens(a), y = sigTokens(b); if (!x.length || !y.length) return 0
  const sy = new Set(y), shared = x.filter(w => sy.has(w)).length
  return shared / Math.min(x.length, y.length)
}
const THRESHOLD = 0.6

export async function mergeCustomerServiceCode() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS law_migrations (key TEXT PRIMARY KEY, done_at TIMESTAMPTZ NOT NULL DEFAULT now())`
    const c = await sql`INSERT INTO law_migrations (key) VALUES ('cs-merge-v1') ON CONFLICT DO NOTHING RETURNING key`
    if (!c.length) return
    const existing = await sql`SELECT id, text FROM page_laws WHERE status IN ('live', 'draft') AND text NOT LIKE 'Customer Service Code: CS-%'` as unknown as { id: number; text: string }[]
    let added = 0
    const covered: string[] = []
    for (const sec of CUSTOMER_SERVICE_CODE) for (const r of sec.rules) {
      const full = `${r.title ? r.title + ' ' : ''}${r.text}`
      const hit = existing.map(e => ({ id: e.id, s: similarity(full, e.text) })).sort((p, q) => q.s - p.s)[0]
      if (hit && hit.s >= THRESHOLD) { covered.push(`${r.code}=law ${hit.id} (${Math.round(hit.s * 100)}%)`); continue }
      const title = (r.title ?? r.text.split(/[.!?]/)[0]).replace(/\.$/, '').slice(0, 80)
      const v = [{ text: `A staff member does not follow ${r.code}: ${r.text}`.slice(0, 300), points: 1, by: 'manager', how: r.text, record: 'A manager sees it in the shop or on CCTV and logs it with a note' }]
      await sql`INSERT INTO page_laws (scope_key, text, display_in_carousel, carousel_type, category, subcategory, law_type, status, seed, proof, points, violations, title, audience)
        VALUES ('Customer service', ${r.text}, false, 'law', 'Customer service', ${sec.title}, 'standing', 'draft', 'cs-merge-v1', 'tick', 1, ${JSON.stringify(v)}, ${title}, 'staff')`
      added++
    }
    await sql`INSERT INTO law_migrations (key) VALUES (${'cs-merge-v1-report: added ' + added + '; already covered: ' + covered.join(', ')}) ON CONFLICT DO NOTHING`
  } catch (e) { console.error('cs merge failed:', e instanceof Error ? e.message : String(e)) }
}

// Called when drafts of the seed are approved: the umbrella laws are replaced by the individual ones.
export async function retireCsUmbrella() {
  await sql`DELETE FROM page_laws WHERE category = 'Customer service' AND text LIKE 'Customer Service Code: CS-%'`.catch(() => {})
}
