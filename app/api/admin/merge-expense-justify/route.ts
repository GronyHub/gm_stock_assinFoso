import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// One-time migration: the Expenses tab is dropping its separate Justify
// column (cf_justify) in favor of a single Description field. Existing
// cf_justify text is folded into description here so nothing already
// entered is lost -- cf_justify itself is left untouched (not cleared),
// consistent with not deleting data from a migration run blind.
export async function POST() {
  const session = await auth()
  if ((session?.user as any)?.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const results = await sql`
    UPDATE expenses
    SET description = CASE
      WHEN description IS NULL OR description = '' THEN cf_justify
      ELSE description || ' — ' || cf_justify
    END
    WHERE cf_justify IS NOT NULL AND cf_justify <> ''
    RETURNING id
  `

  return NextResponse.json({ merged: results.length })
}
