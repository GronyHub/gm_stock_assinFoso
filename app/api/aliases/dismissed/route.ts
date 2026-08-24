import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensureDismissedAliasReviews } from '@/lib/dismissedAliasReviews'

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  try {
    await ensureDismissedAliasReviews()
    const rows = await sql`SELECT * FROM dismissed_alias_reviews ORDER BY created_at DESC`
    return success(rows)
  } catch (e) {
    return handleError('aliases/dismissed', e)
  }
}

export async function POST(req: Request) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const { review_type, review_key } = await req.json()
    if (!review_type || !review_key) return badRequest('review_type and review_key required')

    await ensureDismissedAliasReviews()
    await sql`
      INSERT INTO dismissed_alias_reviews (review_type, review_key)
      VALUES (${review_type}, ${review_key})
      ON CONFLICT (review_type, review_key) DO NOTHING
    `
    return success({ ok: true })
  } catch (e) {
    return handleError('aliases/dismissed', e)
  }
}
