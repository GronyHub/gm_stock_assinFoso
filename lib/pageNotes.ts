import sql from '@/lib/db'
import { once } from '@/lib/once'

// Free-text notes scoped to one page (same scope_key namespace as
// DynamicTasksSection's custom_tasks table) -- split into two rows per page
// via `kind` ('law' = the fixed rule for this page, 'note' = a day-to-day
// scratchpad), separate from the formal Company Laws content. Can also be
// law-specific when law_id is set.
async function ensurePageNotesTableImpl() {
  await sql`
    CREATE TABLE IF NOT EXISTS page_notes (
      scope_key TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'law',
      notes TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.catch(() => {})
  await sql`ALTER TABLE page_notes ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'law'`.catch(() => {})
  await sql`ALTER TABLE page_notes ADD COLUMN IF NOT EXISTS law_id INTEGER`.catch(() => {})
  await sql`ALTER TABLE page_notes ADD COLUMN IF NOT EXISTS flag_key TEXT`.catch(() => {})
  await sql`ALTER TABLE page_notes ADD COLUMN IF NOT EXISTS topic TEXT`.catch(() => {})
  await sql`ALTER TABLE page_notes ADD COLUMN IF NOT EXISTS note_date DATE`.catch(() => {})
  await sql`ALTER TABLE page_notes ADD COLUMN IF NOT EXISTS tagged_staff JSONB`.catch(() => {})
  // Older deployments had scope_key alone as the primary key (one merged
  // Notes/Laws row per page) -- dropping it lets a page hold both a 'law'
  // row and a 'note' row instead. This is a no-op once already applied.
  await sql`ALTER TABLE page_notes DROP CONSTRAINT IF EXISTS page_notes_pkey`.catch(() => {})
  // Drop the old partial unique indexes that were preventing multiple notes
  await sql`DROP INDEX IF EXISTS page_notes_scope_kind_idx`.catch(() => {})
  await sql`DROP INDEX IF EXISTS page_notes_law_notes_idx`.catch(() => {})
  await sql`DROP INDEX IF EXISTS page_notes_flag_notes_idx`.catch(() => {})
}

export const ensurePageNotesTable = once(ensurePageNotesTableImpl)
