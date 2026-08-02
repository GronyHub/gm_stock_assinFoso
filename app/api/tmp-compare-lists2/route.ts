import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const aliasWideItems = await sql`
    SELECT id, canonical_name FROM active_items ORDER BY canonical_name
  ` as { id: number; canonical_name: string }[]

  const mainListItems = await sql`
    SELECT s.item_id AS id, COALESCE(i.canonical_name, s.item_name) AS canonical_name, i.status
    FROM item_stock_summary s
    LEFT JOIN items i ON i.id = s.item_id
    WHERE s.item_name NOT ILIKE 'old stop%' AND s.item_name NOT ILIKE 'old- stop%'
    ORDER BY s.item_name
  ` as { id: number; canonical_name: string; status: string | null }[]

  const aliasWideIds = new Set(aliasWideItems.map(r => r.id))
  const mainListIds = new Set(mainListItems.map(r => r.id))

  const onlyInAliasWide = aliasWideItems.filter(r => !mainListIds.has(r.id))
  const onlyInMainList = mainListItems.filter(r => !aliasWideIds.has(r.id))

  return NextResponse.json({
    aliasWideCount: aliasWideItems.length,
    mainListCount: mainListItems.length,
    onlyInAliasWide,
    onlyInMainList,
  })
}
