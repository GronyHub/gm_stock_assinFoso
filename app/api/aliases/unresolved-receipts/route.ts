import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// Same shape as /api/aliases/unresolved(-bills), for invoice_lines (the
// Receipts page) -- this table had no review/fix screen at all until now,
// unlike sales and bills.
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const rows = await sql`
    SELECT raw_item_name AS name, COUNT(*)::int AS cnt
    FROM invoice_lines
    WHERE item_id IS NULL OR unresolved = true
    GROUP BY raw_item_name
    ORDER BY COUNT(*) DESC
  ` as { name: string; cnt: number }[]

  const confirmed = await sql`SELECT alias_name FROM item_aliases` as { alias_name: string }[]
  const confirmedSet = new Set(confirmed.map(r => r.alias_name.toLowerCase().trim()))

  return NextResponse.json(
    rows.map(r => ({
      name: r.name,
      cnt: r.cnt,
      confirmed: confirmedSet.has(r.name.toLowerCase().trim()),
    }))
  )
}
