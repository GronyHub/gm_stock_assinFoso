import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST() {
  const session = await auth()
  if ((session?.user as any)?.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const results: string[] = []

  try {
    await sql`ALTER TABLE staff_times ADD COLUMN IF NOT EXISTS entered_by TEXT`
    results.push('entered_by column: OK')
  } catch (e: any) { results.push(`entered_by FAILED: ${e.message}`) }

  try {
    await sql`ALTER TABLE staff_times ADD COLUMN IF NOT EXISTS status TEXT`
    results.push('status column: OK')
  } catch (e: any) { results.push(`status FAILED: ${e.message}`) }

  // Verify columns now exist
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'staff_times'
    ORDER BY column_name
  `
  return NextResponse.json({ results, columns: cols.map((c: any) => c.column_name) })
}
