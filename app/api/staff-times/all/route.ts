import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse, NextRequest } from 'next/server'
import { once } from '@/lib/once'

const ensureSchema = once(async () => {
  await sql`ALTER TABLE staff_times ADD COLUMN IF NOT EXISTS entered_by TEXT`.catch(() => {})
  await sql`ALTER TABLE staff_times ADD COLUMN IF NOT EXISTS status TEXT`.catch(() => {})
  await sql`ALTER TABLE staff_times ADD COLUMN IF NOT EXISTS in_source TEXT`.catch(() => {})
  await sql`ALTER TABLE staff_times ADD COLUMN IF NOT EXISTS out_source TEXT`.catch(() => {})
  await sql`ALTER TABLE staff_times ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`.catch(() => {})
})

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  // Every caller (staff-times page, review page, StaffClient) fetches this
  // with no limit/offset -- they render it as the full shared history, so a
  // low default silently hid the older end of it. Only an explicit ?limit
  // caps the result now.
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50000, 50000)
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0)
  const since = url.searchParams.get('since')

  await ensureSchema()

  try {
    const rows = await sql`
      SELECT id, staff_name, work_date::text, actual_in, actual_out, entered_by, status, in_source, out_source, updated_at
      FROM staff_times
      ${since ? sql`WHERE updated_at > ${since}::timestamp` : sql``}
      ORDER BY work_date DESC, staff_name
      LIMIT ${limit}
      OFFSET ${offset}
    `
    if (rows.length === limit) {
      console.warn(`staff-times/all: hit the ${limit}-row cap -- results may be truncated, raise the cap`)
    }
    return NextResponse.json(rows)
  } catch (e: any) {
    console.error('[staff-times/all]', e?.message)
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
