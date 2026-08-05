import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  // Bills with a total but no item list at all (see the "No Items" flag on
  // the Bills page) have no real item name to resolve -- their line, if any,
  // is just a placeholder like "Goods from X = 5390". Excluded here so they
  // don't show up as unresolved names to match against inventory.
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
