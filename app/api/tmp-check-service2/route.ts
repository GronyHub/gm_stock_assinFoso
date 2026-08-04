import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const serviceItems = await sql`
    SELECT id, canonical_name, status FROM items
    WHERE canonical_name ILIKE 'service%'
    ORDER BY canonical_name
  `
  const allItems = await sql`SELECT id, canonical_name FROM items`
  const byLowerName = new Map<string, { id: number; canonical_name: string }[]>()
  for (const it of allItems as { id: number; canonical_name: string }[]) {
    const key = it.canonical_name.trim().toLowerCase()
    if (!byLowerName.has(key)) byLowerName.set(key, [])
    byLowerName.get(key)!.push(it)
  }

  const results = (serviceItems as { id: number; canonical_name: string; status: string | null }[]).map(it => {
    const stripped = it.canonical_name.replace(/^Service\s*[-:]?\s*/i, '').trim()
    const key = stripped.toLowerCase()
    const collisions = (byLowerName.get(key) ?? []).filter(other => other.id !== it.id)
    return { id: it.id, original: it.canonical_name, status: it.status, stripped, collisions }
  })

  // Also flag collisions among the 45 themselves (two Service items that
  // would strip down to the same name as each other, not just against an
  // existing non-Service item).
  const strippedCounts = new Map<string, number[]>()
  for (const r of results) {
    const key = r.stripped.toLowerCase()
    if (!strippedCounts.has(key)) strippedCounts.set(key, [])
    strippedCounts.get(key)!.push(r.id)
  }
  const internalDupes = Array.from(strippedCounts.entries()).filter(([, ids]) => ids.length > 1)

  return NextResponse.json({ count: results.length, results, internalDupes })
}
