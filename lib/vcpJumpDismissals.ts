import sql from '@/lib/db'
import { once } from '@/lib/once'

// Confirms a specific VCP jump (one item, one bill) as a genuine price
// change rather than a data-entry error, so it stops being flagged --
// same "record it was reviewed, don't re-derive a fix for it" idea as
// dismissed_duplicates, just for this violation instead of that one.
async function ensureDismissedVcpJumpsTableImpl() {
  await sql`
    CREATE TABLE IF NOT EXISTS dismissed_vcp_jumps (
      id BIGSERIAL PRIMARY KEY,
      item_id INTEGER NOT NULL,
      bill_id INTEGER NOT NULL,
      dismissed_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (item_id, bill_id)
    )
  `.catch(() => {})
}

export const ensureDismissedVcpJumpsTable = once(ensureDismissedVcpJumpsTableImpl)
