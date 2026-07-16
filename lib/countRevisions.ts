import sql from '@/lib/db'

// Every change to an existing stock count keeps its previous value here, so
// the count cell can show what it was before and who counted/changed it.
// item_id/count_date are denormalized so history survives even if the count
// row itself is later deleted.
export async function ensureCountRevisions() {
  await sql`
    CREATE TABLE IF NOT EXISTS stock_count_revisions (
      id SERIAL PRIMARY KEY,
      stock_count_id INT,
      item_id INT,
      count_date DATE,
      old_qty NUMERIC,
      old_counted_by TEXT,
      changed_by TEXT,
      action TEXT NOT NULL DEFAULT 'changed',
      changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.catch(() => {})
  // Tables created before the action column existed.
  await sql`ALTER TABLE stock_count_revisions ADD COLUMN IF NOT EXISTS action TEXT NOT NULL DEFAULT 'changed'`.catch(() => {})
}

export async function recordCountRevision(params: {
  stockCountId: number | null
  itemId: number | null
  countDate: string | null
  oldQty: number | string | null
  oldCountedBy: string | null
  changedBy: string | null
  action?: 'changed' | 'deleted'
}) {
  try {
    await ensureCountRevisions()
    await sql`
      INSERT INTO stock_count_revisions (stock_count_id, item_id, count_date, old_qty, old_counted_by, changed_by, action)
      VALUES (${params.stockCountId}, ${params.itemId}, ${params.countDate}, ${params.oldQty}, ${params.oldCountedBy}, ${params.changedBy}, ${params.action ?? 'changed'})
    `
  } catch (e) {
    console.error('recordCountRevision failed (non-fatal):', e)
  }
}
