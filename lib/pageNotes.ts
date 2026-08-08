import sql from '@/lib/db'

// Free-text notes scoped to one page (same scope_key namespace as
// DynamicTasksSection's custom_tasks table) -- split into two rows per page
// via `kind` ('law' = the fixed rule for this page, 'note' = a day-to-day
// scratchpad), separate from the formal Company Laws content. Can also be
// law-specific when law_id is set.
export async function ensurePageNotesTable() {
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
  // row and a 'note' row instead. Both statements are no-ops once already
  // applied, so this stays cheap on every request after the first.
  await sql`ALTER TABLE page_notes DROP CONSTRAINT IF EXISTS page_notes_pkey`.catch(() => {})
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS page_notes_scope_kind_idx ON page_notes (scope_key, kind) WHERE law_id IS NULL AND flag_key IS NULL`.catch(() => {})
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS page_notes_scope_kind_flag_idx ON page_notes (scope_key, kind, flag_key) WHERE flag_key IS NOT NULL`.catch(() => {})
}
