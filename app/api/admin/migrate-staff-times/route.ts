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
    const results: string[] = []

    try {
      await sql`ALTER TABLE staff_times ADD COLUMN IF NOT EXISTS entered_by TEXT`
      results.push('entered_by column: OK')
    } catch (e: any) { results.push(`entered_by FAILED: ${e.message}`) }

    try {
      await sql`ALTER TABLE staff_times ADD COLUMN IF NOT EXISTS status TEXT`
      results.push('status column: OK')
    } catch (e: any) { results.push(`status FAILED: ${e.message}`) }

    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'staff_times'
      ORDER BY column_name
    `
    return success({ results, columns: cols.map((c: any) => c.column_name) })
  } catch (e) {
    return handleError('admin/migrate-staff-times', e)
  }
}
