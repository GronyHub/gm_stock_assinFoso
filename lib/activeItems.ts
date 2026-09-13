import sql from '@/lib/db'
import { once } from '@/lib/once'

// The `active_items` view every item *picker* must read from instead of
// `items` directly -- see AGENTS.md. Merging a duplicate only flips the
// loser's status to 'Inactive' and leaves the row in place, so any endpoint
// listing items for a human to choose from has to filter it out or an
// already-merged duplicate can be re-selected.
//
// Definition is unchanged; this only moves it into one place and runs it
// once per process. CREATE OR REPLACE VIEW is not a cheap no-op the way
// CREATE TABLE IF NOT EXISTS is -- it rewrites the view definition and takes
// an exclusive lock on it every single time -- and it was running on every
// request to two of the app's hotter routes.
// 'Pending Review' is a stub item created from a not-yet-identified legacy
// name (see /api/aliases/wide) -- it isn't a confirmed real product yet, so
// it must stay out of every picker the same way an Inactive (merged-away)
// item does, even though it should still show up in the Alias Wide Table
// for review (that table filters status itself, separately from this view).
export const ensureActiveItemsView = once(async () => {
  await sql`CREATE OR REPLACE VIEW active_items AS SELECT * FROM items WHERE status IS NULL OR LOWER(status) NOT IN ('inactive', 'pending review')`.catch(() => {})
})
