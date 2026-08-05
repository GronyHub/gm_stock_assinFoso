import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// Read-only preview of what the migration would do.
export async function GET() {
  const rows = await sql`SELECT scope_key, notes FROM page_notes WHERE kind = 'law' AND TRIM(COALESCE(notes, '')) <> ''`
  return NextResponse.json({ count: rows.length, rows })
}

// One-time migration: each existing page_notes 'law' row becomes exactly
// one page_laws entry, text preserved as-is (no splitting). Idempotent --
// skips a scope_key that already has a page_laws row matching that exact
// text, so a retry after a partial failure won't duplicate anything.
export async function POST() {
  await sql`
    CREATE TABLE IF NOT EXISTS page_laws (
      id SERIAL PRIMARY KEY,
      scope_key TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.catch(() => {})

  const rows = await sql`SELECT scope_key, notes FROM page_notes WHERE kind = 'law' AND TRIM(COALESCE(notes, '')) <> ''`
  const results = []
  for (const r of rows as { scope_key: string; notes: string }[]) {
    const [existing] = await sql`SELECT id FROM page_laws WHERE scope_key = ${r.scope_key} AND text = ${r.notes}`
    if (existing) { results.push({ scope_key: r.scope_key, skipped: true }); continue }
    const [inserted] = await sql`
      INSERT INTO page_laws (scope_key, text) VALUES (${r.scope_key}, ${r.notes})
      RETURNING id
    `
    results.push({ scope_key: r.scope_key, id: inserted.id })
  }
  return NextResponse.json({ migrated: results.length, results })
}
