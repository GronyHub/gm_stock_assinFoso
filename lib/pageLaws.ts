import sql from '@/lib/db'
import { once } from '@/lib/once'

// One row per law, scoped to a page the same way custom_tasks/page_notes
// are (scope_key namespace) -- unlike Notes (PageLawsNote, still one
// freeform textarea per page), Law is a real list so PageToolIcons can
// badge the page with how many laws it actually has, not just whether the
// box is empty.
async function ensurePageLawsTableImpl() {
  await sql`
    CREATE TABLE IF NOT EXISTS page_laws (
      id SERIAL PRIMARY KEY,
      scope_key TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.catch(() => {})
}

export const ensurePageLawsTable = once(ensurePageLawsTableImpl)
