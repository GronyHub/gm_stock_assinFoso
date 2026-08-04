import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const serviceItems = await sql`
    SELECT id, canonical_name, status FROM items
    WHERE canonical_name ~* '^Service(\s|$|[-:])'
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
    // Strip a leading "Service" word plus whatever separator follows it
    // (-, :, or just whitespace) -- "Service - Pink Cardboard" -> "Pink
    // Cardboard", "Service Passport Printing" -> "Passport Printing".
    const stripped = it.canonical_name.replace(/^Service\s*[-:]?\s*/i, '').trim()
    const key = stripped.toLowerCase()
    const collisions = (byLowerName.get(key) ?? []).filter(other => other.id !== it.id)
    return { id: it.id, original: it.canonical_name, status: it.status, stripped, collisions }
  })

  return NextResponse.json({ count: results.length, results })
}
