import sql from './db'
import { once } from './once'

// "Keep as-is (dismiss)" on the Flagged/Ambiguous/Name Conflicts review
// screens (AliasesTab.tsx) persists here: one row per (review_type, key)
// dismissed, permanent (no "un-dismiss" UI, matching dismissed_duplicates'
// existing behavior elsewhere in the app), so a review a person has already
// looked at and decided to leave alone stops resurfacing.
//
// Four routes read this table (aliases/dismissed, /audit, /leaks,
// /ambiguous) and each used to carry its own private copy of this CREATE
// TABLE, re-running it on every request. One shared once()-wrapped copy
// instead: same DDL, but at most one round trip per server process rather
// than one per request across four separate polled endpoints.
export const ensureDismissedAliasReviews = once(async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS dismissed_alias_reviews (
      review_type TEXT NOT NULL,
      review_key TEXT NOT NULL,
      dismissed_by TEXT,
      dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (review_type, review_key)
    )
  `.catch(() => {})
})
