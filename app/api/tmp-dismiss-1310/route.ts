import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST() {
  await sql`
    INSERT INTO dismissed_alias_reviews (review_type, review_key, dismissed_by)
    VALUES ('name_conflict', '1310', 'Claude (automated cleanup)')
    ON CONFLICT (review_type, review_key) DO NOTHING
  `
  return NextResponse.json({ ok: true })
}
