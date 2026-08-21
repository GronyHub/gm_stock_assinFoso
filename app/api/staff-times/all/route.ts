import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'
import { once } from '@/lib/once'

const ensureSchema = once(async () => {
  await sql`ALTER TABLE staff_times ADD COLUMN IF NOT EXISTS entered_by TEXT`.catch(() => {})
  await sql`ALTER TABLE staff_times ADD COLUMN IF NOT EXISTS status TEXT`.catch(() => {})
  await sql`ALTER TABLE staff_times ADD COLUMN IF NOT EXISTS in_source TEXT`.catch(() => {})
  await sql`ALTER TABLE staff_times ADD COLUMN IF NOT EXISTS out_source TEXT`.catch(() => {})
})


export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Add missing columns if they don't exist yet
  await ensureSchema()

  try {
    const rows = await sql`
      SELECT id, staff_name, work_date::text, actual_in, actual_out, entered_by, status, in_source, out_source
      FROM staff_times
      ORDER BY work_date DESC, staff_name
      LIMIT 500
    `
    return NextResponse.json(rows)
  } catch (e: any) {
    console.error('[staff-times/all]', e?.message)
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
