import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// Resolves one ambiguous alias name either by keeping one candidate item
// (deleting the item_aliases rows for the rest) or, when keep_item_id is
// omitted, by deleting every row for the name -- for the case where no
// candidate has any sales/bill lines actually resolved to it, so there's
// nothing to pick between and the name is just orphaned old data.
// A kept name maps to exactly one item again afterward, so future confirms
// and /api/aliases/resweep can safely act on it. Doesn't touch
// sales_receipt_lines/bill_lines already resolved to the losing item(s);
// re-sweep afterward if those should move too.
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { norm_name, keep_item_id } = await req.json()
  if (!norm_name) return NextResponse.json({ error: 'norm_name required' }, { status: 400 })

  const deleted = keep_item_id
    ? await sql`
        DELETE FROM item_aliases
        WHERE LOWER(TRIM(alias_name)) = ${norm_name}
          AND item_id <> ${keep_item_id}
        RETURNING id
      `
    : await sql`
        DELETE FROM item_aliases
        WHERE LOWER(TRIM(alias_name)) = ${norm_name}
        RETURNING id
      `

  return NextResponse.json({ ok: true, deletedCount: deleted.length })
}
