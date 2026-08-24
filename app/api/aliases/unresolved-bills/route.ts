import { requireAuth, success, unauthorized } from '@/lib/api'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const { error } = await requireAuth()
  if (error) return unauthorized()

  const rows = await sql`
    SELECT bl.raw_item_name AS name, COUNT(*)::int AS cnt
    FROM bill_lines bl
    JOIN bills b ON b.id = bl.bill_id
    WHERE (bl.item_id IS NULL OR bl.unresolved = true)
      AND NOT (
        COALESCE(b.total, 0) > 0
        AND NOT EXISTS (SELECT 1 FROM bill_lines bl2 WHERE bl2.bill_id = b.id AND bl2.item_id IS NOT NULL)
      )
    GROUP BY bl.raw_item_name
    ORDER BY COUNT(*) DESC
  `

  const confirmed = await sql`SELECT alias_name FROM item_aliases`
  const confirmedSet = new Set(confirmed.map((r: any) => r.alias_name.toLowerCase().trim()))

  return NextResponse.json(
    rows.map((r: any) => ({
      name: r.name,
      cnt: r.cnt,
      confirmed: confirmedSet.has(r.name.toLowerCase().trim()),
    }))
  )
}
