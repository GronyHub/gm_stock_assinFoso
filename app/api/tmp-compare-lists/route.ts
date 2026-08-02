import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  // Alias Wide Table's source: every Active item (status filter, no
  // activity requirement)
  const aliasWideItems = await sql`
    SELECT id, canonical_name FROM active_items ORDER BY canonical_name
  ` as { id: number; canonical_name: string }[]

  // Main Items table's source: item_stock_summary joined to items, no
  // status filter at all, just an 'old stop' name exclusion
  const mainListItems = await sql`
    SELECT s.item_id AS id, COALESCE(i.canonical_name, s.item_name) AS canonical_name, i.status
    FROM item_stock_summary s
    LEFT JOIN items i ON i.id = s.item_id
    WHERE s.item_name NOT ILIKE 'old stop%' AND s.item_name NOT ILIKE 'old- stop%'
    ORDER BY s.item_name
  ` as { id: number; canonical_name: string; status: string | null }[]

  const aliasWideIds = new Set(aliasWideItems.map(r => r.id))
  const mainListIds = new Set(mainListItems.map(r => r.id))

  // In Alias Wide Table but NOT in main Items list (active items with no
  // stock_summary row -- e.g. brand new, never sold/bought/counted)
  const onlyInAliasWide = aliasWideItems.filter(r => !mainListIds.has(r.id))

  // In main Items list but NOT in Alias Wide Table (has activity but isn't
  // an Active item -- e.g. Inactive item with stray activity still attached)
  const onlyInMainList = mainListItems.filter(r => !aliasWideIds.has(r.id))

  return NextResponse.json({
    aliasWideCount: aliasWideItems.length,
    mainListCount: mainListItems.length,
    onlyInAliasWideCount: onlyInAliasWide.length,
    onlyInAliasWideSample: onlyInAliasWide.slice(0, 20),
    onlyInMainListCount: onlyInMainList.length,
    onlyInMainListSample: onlyInMainList.slice(0, 20),
  })
}
