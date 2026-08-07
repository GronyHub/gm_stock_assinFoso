import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const rows = await sql`SELECT item_key, group_name, standalone FROM pane_groups`
    return NextResponse.json({ rows })
  } catch (e) {
    return NextResponse.json({ tmpError: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
