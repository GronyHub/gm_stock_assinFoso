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
        id,
        loser_id,
        winner_id,
        loser_original_name,
        sales_moved_count,
        bills_moved_count,
        counts_moved_count,
        merged_at,
        merged_by,
        reversed_at
      FROM merge_audit
      WHERE reversed_at IS NULL
        AND merged_at > NOW() - INTERVAL '7 days'
        AND (loser_id = ANY(${itemIds}) OR winner_id = ANY(${itemIds}))
      ORDER BY merged_at DESC
    `.catch(() => [])

    return NextResponse.json({ merges })
  } catch (err) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
