import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const before = await sql`SELECT item_key, group_name, standalone FROM pane_groups`
    await sql`DELETE FROM pane_groups WHERE item_key = 'purchaseOrders'`
    const after = await sql`SELECT item_key, group_name, standalone FROM pane_groups`
    return NextResponse.json({ before, after })
  } catch (e) {
    return NextResponse.json({ tmpError: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
