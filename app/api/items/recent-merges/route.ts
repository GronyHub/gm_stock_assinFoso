import { NextResponse } from 'next/server'
import sql from '@/lib/db'

// GET /api/items/recent-merges?item_ids=1,2,3
// Returns recent merges (within 7 days) that haven't been reversed yet
export async function GET(req: Request) {
  const url = new URL(req.url)
  const itemIdsStr = url.searchParams.get('item_ids')
  if (!itemIdsStr) {
    return NextResponse.json({ error: 'item_ids required' }, { status: 400 })
  }

  const itemIds = itemIdsStr.split(',').map(id => parseInt(id)).filter(id => !isNaN(id))
  if (itemIds.length === 0) {
    return NextResponse.json({ error: 'No valid item_ids' }, { status: 400 })
  }

  try {
    // Create merge_audit table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS merge_audit (
        id SERIAL PRIMARY KEY,
        loser_id INTEGER NOT NULL,
        winner_id INTEGER NOT NULL,
        loser_original_name VARCHAR(255) NOT NULL,
        sales_moved_count INTEGER DEFAULT 0,
        bills_moved_count INTEGER DEFAULT 0,
        counts_moved_count INTEGER DEFAULT 0,
        merged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        merged_by VARCHAR(255),
        reversed_at TIMESTAMP,
        UNIQUE(loser_id, winner_id, merged_at)
      )
    `.catch(() => {})

    // Fetch recent merges (7 days) where either loser or winner is in the item list
    const merges = await sql`
      SELECT
        ma.id,
        ma.loser_id,
        ma.winner_id,
        ma.loser_original_name,
        i.canonical_name as winner_name,
        ma.sales_moved_count,
        ma.bills_moved_count,
        ma.counts_moved_count,
        ma.merged_at,
        ma.merged_by,
        ma.reversed_at
      FROM merge_audit ma
      LEFT JOIN items i ON i.id = ma.winner_id
      WHERE ma.reversed_at IS NULL
        AND ma.merged_at > NOW() - INTERVAL '7 days'
        AND (ma.loser_id = ANY(${itemIds}) OR ma.winner_id = ANY(${itemIds}))
      ORDER BY ma.merged_at DESC
    `.catch(() => [])

    return NextResponse.json({ merges })
  } catch (err) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
