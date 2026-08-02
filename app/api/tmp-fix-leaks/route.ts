import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// Retroactive fix for today's merges that predate the track_inventory
// change in lib/mergeItems.ts -- these already have their data correctly
// consolidated into the winner, they just still leak into the main Items
// list because track_inventory was never cleared.
const IDS = [76, 81, 82, 267, 276]

export async function POST() {
  const before = await sql`SELECT id, canonical_name, status, track_inventory FROM items WHERE id = ANY(${IDS})`
  await sql`UPDATE items SET track_inventory = false WHERE id = ANY(${IDS})`
  const after = await sql`SELECT id, canonical_name, status, track_inventory FROM items WHERE id = ANY(${IDS})`
  return NextResponse.json({ before, after })
}
