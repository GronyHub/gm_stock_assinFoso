import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// Resolves one ambiguous alias name by deleting every item_aliases row for
// it except the chosen winner -- after this the name maps to exactly one
// item again, so future confirms and /api/aliases/resweep can safely act
// on it. Doesn't touch sales_receipt_lines/bill_lines already resolved to
// the losing item(s); re-sweep afterward if those should move too.
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { norm_name, keep_item_id } = await req.json()
  if (!norm_name || !keep_item_id) return NextResponse.json({ error: 'norm_name and keep_item_id required' }, { status: 400 })

  const deleted = await sql`
    DELETE FROM item_aliases
    WHERE LOWER(TRIM(alias_name)) = ${norm_name}
      AND item_id <> ${keep_item_id}
    RETURNING id
  `

  return NextResponse.json({ ok: true, deletedCount: deleted.length })
}
