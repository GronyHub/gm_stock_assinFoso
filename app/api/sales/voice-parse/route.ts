import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { parseVoiceSale, queryTokens } from '@/lib/voiceSale'
import { NextRequest } from 'next/server'

// POST { text } -- what the staff member said. Returns the proposed quantity, price, buyer and the closest items (active items only).
// Nothing is recorded here: the Live Sale voice card shows the proposal and the staff member confirms.
export async function POST(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error
  try {
    const b = await req.json().catch(() => ({}))
    const text = String(b.text ?? '').trim().slice(0, 300)
    if (text.length < 2) return badRequest('Say or type what you sold.')
    const p = parseVoiceSale(text)
    const toks = queryTokens(p.query)
    let items: { id: number; name: string; selling_price: number; soh: number; score: number }[] = []
    if (toks.length) {
      const pats = toks.map(t => `%${t}%`)
      const rows = await sql`
        SELECT i.id, i.canonical_name AS name, COALESCE(i.selling_rate, 0)::float AS selling_price, COALESCE(s.calculated_soh, 0)::float AS soh
        FROM active_items i LEFT JOIN item_stock_summary s ON s.item_id = i.id
        WHERE i.canonical_name ILIKE ANY(${pats}) OR i.cf_group ILIKE ANY(${pats})
        LIMIT 60` as unknown as { id: number; name: string; selling_price: number; soh: number }[]
      items = rows.map(r => ({ ...r, score: toks.filter(t => r.name.toLowerCase().includes(t)).length / toks.length - r.name.length / 10000 }))
        .sort((a, c) => c.score - a.score).slice(0, 5)
    }
    return success({ ...p, items })
  } catch (e) { return handleError('sales voice-parse', e) }
}
