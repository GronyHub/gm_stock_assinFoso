import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import { isOwnerLevel } from '@/lib/roles'
import sql from '@/lib/db'

export async function POST() {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as any)) {
    return badRequest('Forbidden')
  }

  try {
    const results = await sql`
      UPDATE expenses
      SET description = CASE
        WHEN description IS NULL OR description = '' THEN cf_justify
        ELSE description || ' — ' || cf_justify
      END
      WHERE cf_justify IS NOT NULL AND cf_justify <> ''
        AND (description IS NULL OR description NOT LIKE '%' || cf_justify || '%')
      RETURNING id
    `
    return success({ merged: results.length })
  } catch (e) {
    return handleError('admin/merge-expense-justify', e)
  }
}
