import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const rows = await sql`
    SELECT raw_item_name AS name, COUNT(*)::int AS cnt,
           COUNT(*) FILTER (WHERE item_id IS NOT NULL)::int AS resolved_cnt
    FROM sales_receipt_lines
    WHERE item_id IS NULL OR unresolved = true
    GROUP BY raw_item_name
    ORDER BY COUNT(*) DESC
  `
  const aliases = await sql`SELECT alias_name, item_id FROM item_aliases`
  const aliasMap = new Map<string, number>()
  for (const a of aliases as { alias_name: string; item_id: number }[]) {
    aliasMap.set(a.alias_name.toLowerCase().trim(), a.item_id)
  }

  const done = (rows as { name: string; cnt: number; resolved_cnt: number }[])
    .filter(r => aliasMap.has(r.name.toLowerCase().trim()))
    .map(r => ({ ...r, aliased_to_item_id: aliasMap.get(r.name.toLowerCase().trim()) }))

  return NextResponse.json({ done, doneCount: done.length, totalUnresolvedNames: rows.length })
}
