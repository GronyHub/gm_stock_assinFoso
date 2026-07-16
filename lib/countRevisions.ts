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
      changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.catch(() => {})
}

export async function recordCountRevision(params: {
  stockCountId: number | null
  itemId: number | null
  countDate: string | null
  oldQty: number | string | null
  oldCountedBy: string | null
  changedBy: string | null
}) {
  try {
    await ensureCountRevisions()
    await sql`
      INSERT INTO stock_count_revisions (stock_count_id, item_id, count_date, old_qty, old_counted_by, changed_by)
      VALUES (${params.stockCountId}, ${params.itemId}, ${params.countDate}, ${params.oldQty}, ${params.oldCountedBy}, ${params.changedBy})
    `
  } catch (e) {
    console.error('recordCountRevision failed (non-fatal):', e)
  }
}
