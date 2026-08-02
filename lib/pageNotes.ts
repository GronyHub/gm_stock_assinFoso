import sql from '@/lib/db'

// Free-text notes/reminders scoped to one page (same scopeKey namespace as
// DynamicTasksSection's custom_tasks table) -- separate from the formal
// Company Laws content, just a place for staff to jot page-specific rules.
export async function ensurePageNotesTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS page_notes (
      scope_key TEXT PRIMARY KEY,
      notes TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.catch(() => {})
}
