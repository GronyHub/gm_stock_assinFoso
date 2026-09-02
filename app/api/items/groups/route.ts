import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextResponse } from 'next/server'

let cachedGroups: any = null
let cachedGroupsTime = 0
const CACHE_TTL = 2 * 60 * 60 * 1000 // 2 hours

// Every group name the Items table (LossTab) can actually show as a
// heading -- built from the exact same base/JOIN/COALESCE as
// /api/losses/summary, which is what that table renders. The Group filter
// dropdown (page.tsx) used to derive its options from /api/items instead,
// which is a different query (items as the base table, not
// item_stock_summary) -- any item that's in item_stock_summary but has no
// matching items row (or has one with a different/blank cf_group) could
// then show up as a heading in the table without ever being a selectable
// filter option. Deriving the list from this identical base guarantees the
// two can't diverge.
export async function GET() {
  const now = Date.now()
  if (cachedGroups && now - cachedGroupsTime < CACHE_TTL) {
    return NextResponse.json(cachedGroups)
  }

  try {
    const rows = await sql`
      SELECT DISTINCT COALESCE(i.cf_group, s.cf_group) AS cf_group
      FROM item_stock_summary s
      LEFT JOIN items i ON i.id = s.item_id
      WHERE s.item_name NOT ILIKE 'old stop%'
        AND s.item_name NOT ILIKE 'old- stop%'
      ORDER BY cf_group NULLS LAST
    `
    const result = rows.map((r: any) => r.cf_group)
    cachedGroups = result
    cachedGroupsTime = Date.now()
    return NextResponse.json(result)
  } catch (e) {
    console.error('items/groups GET error:', e)
    return NextResponse.json([])
  }
}

// Renames a group everywhere it can show up -- both items.cf_group (the
// column the app's edit forms actually write to) and
// item_stock_summary.cf_group (the external sync snapshot the table falls
// back to for any item with no matching items row, or whose items.cf_group
// is still null -- see the GET above and /api/losses/summary). Skipping
// either one would leave some items still showing the old name.
export async function PUT(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { from, to } = await req.json()
  const oldName = typeof from === 'string' ? from.trim() : ''
  const newName = typeof to === 'string' ? to.trim() : ''
  if (!oldName || !newName) return NextResponse.json({ error: 'Both the current and new group name are required' }, { status: 400 })
  if (oldName === newName) return NextResponse.json({ ok: true, count: 0 })

  const [itemRows] = await Promise.all([
    sql`
      UPDATE items SET cf_group = ${newName}
      WHERE cf_group = ${oldName}
         OR (cf_group IS NULL AND id IN (SELECT item_id FROM item_stock_summary WHERE cf_group = ${oldName}))
      RETURNING id
    `,
    sql`UPDATE item_stock_summary SET cf_group = ${newName} WHERE cf_group = ${oldName}`,
  ])

  const actor = (session.user as any)?.username || session.user?.name || 'Unknown'
  await logActivity(actor, 'renamed group', `"${oldName}" → "${newName}" (${itemRows.length} item${itemRows.length !== 1 ? 's' : ''})`)

  return NextResponse.json({ ok: true, count: itemRows.length })
}
