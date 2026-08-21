import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { ensureDismissedAliasReviews as ensureTable } from '@/lib/dismissedAliasReviews'
import { NextRequest, NextResponse } from 'next/server'

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
