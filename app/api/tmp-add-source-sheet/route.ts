import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST() {
  await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS source_sheet TEXT`
  const updated = await sql`
    UPDATE expenses SET source_sheet = 'srv'
    WHERE source = 'bill_migration'
    RETURNING id, description, source_sheet
  `
  return NextResponse.json({ updatedCount: updated.length, updated })
}

export async function GET() {
  const [row] = await sql`
    SELECT COUNT(*)::int AS n FROM expenses WHERE source_sheet IS NOT NULL
  `
  return NextResponse.json(row)
}
