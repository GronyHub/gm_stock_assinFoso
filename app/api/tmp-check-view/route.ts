import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const ids = [76, 81, 82, 267, 276, 371, 382]
  const mainList = await sql`
    SELECT s.item_id AS id, COALESCE(i.canonical_name, s.item_name) AS canonical_name, i.status, i.track_inventory, s.calculated_soh
    FROM item_stock_summary s LEFT JOIN items i ON i.id = s.item_id
    WHERE s.item_id = ANY(${ids})
  `
  const notInMainList = ids.filter(id => !(mainList as { id: number }[]).some(r => r.id === id))
  const trackInventory = await sql`SELECT id, canonical_name, track_inventory, status FROM items WHERE id = ANY(${ids})`

  // Every currently-Inactive item that still has track_inventory=true (and
  // thus still leaks into the main list) -- not just today's 6, the whole
  // backlog of past merges too.
  const allLeakingInactive = await sql`
    SELECT i.id, i.canonical_name, i.status, i.track_inventory
    FROM items i WHERE LOWER(i.status) = 'inactive' AND i.track_inventory = true
  `

  return NextResponse.json({ stillInMainList: mainList, notInMainList, trackInventory, allLeakingInactiveCount: allLeakingInactive.length, allLeakingInactiveSample: allLeakingInactive.slice(0, 30) })
}
