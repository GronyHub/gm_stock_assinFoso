import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// "Keep as-is (dismiss)" on the Flagged/Ambiguous/Name Conflicts review
// screens (AliasesTab.tsx) used to only update local component state -- it
// looked like it saved, but reloading or navigating away brought every
// dismissal right back, since nothing was ever written to the database.
// This is the actual persistence layer: one row per (review_type, key)
// dismissed, permanent (no "un-dismiss" UI, matching dismissed_duplicates'
// existing behavior elsewhere in the app), so a review a person has already
// looked at and decided to leave alone stops resurfacing.
async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS dismissed_alias_reviews (
      review_type TEXT NOT NULL,
      review_key TEXT NOT NULL,
      dismissed_by TEXT,
      dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (review_type, review_key)
    )
  `.catch(() => {})
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({}, { status: 401 })
  await ensureTable()
  const rows = await sql`SELECT review_type, review_key FROM dismissed_alias_reviews`
  const byType: Record<string, string[]> = {}
  for (const r of rows as { review_type: string; review_key: string }[]) {
    if (!byType[r.review_type]) byType[r.review_type] = []
    byType[r.review_type].push(r.review_key)
  }
  return NextResponse.json(byType)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await ensureTable()

  const { review_type, review_key } = await req.json()
  if (!review_type || !review_key) {
    return NextResponse.json({ error: 'review_type and review_key required' }, { status: 400 })
  }
  const dismissedBy = (session.user as { username?: string } | undefined)?.username || session.user?.name || null

  await sql`
    INSERT INTO dismissed_alias_reviews (review_type, review_key, dismissed_by)
    VALUES (${review_type}, ${String(review_key)}, ${dismissedBy})
    ON CONFLICT (review_type, review_key) DO NOTHING
  `
  return NextResponse.json({ ok: true })
}
