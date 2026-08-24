import { requireAuth, success, unauthorized } from '@/lib/api'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const { error } = await requireAuth()
  if (error) return unauthorized()

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
