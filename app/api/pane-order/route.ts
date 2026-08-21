import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { NextRequest, NextResponse } from 'next/server'
import { once } from '@/lib/once'

const ensurePaneOrderTable = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS pane_order (kind TEXT PRIMARY KEY, order_json TEXT NOT NULL)`.catch(() => {})
})

// Any authenticated user can read the saved order -- everyone's pane needs
// it to render Grony Cash/Manage's rows in the right sequence. Only
// owner-level can change it, same as Roles & Permissions -- this reorders
// shared app structure, not a per-person grant.
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({}, { status: 401 })
  await ensurePaneOrderTable()
  const rows = await sql`SELECT kind, order_json FROM pane_order`
  const map: Record<string, string[]> = {}
  for (const r of rows) {
    try {
      const parsed = JSON.parse(r.order_json)
      if (Array.isArray(parsed)) map[r.kind] = parsed
    } catch { /* ignore malformed row, treat as unset */ }
  }
  return NextResponse.json(map)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!isOwnerLevel(session?.user as { role?: string; username?: string } | undefined)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { kind, order } = await req.json()
  if (kind !== 'cash' && kind !== 'manage') return NextResponse.json({ error: 'kind must be "cash" or "manage"' }, { status: 400 })
  if (!Array.isArray(order) || !order.every(k => typeof k === 'string')) {
    return NextResponse.json({ error: 'order must be an array of strings' }, { status: 400 })
  }
  await ensurePaneOrderTable()
  const orderJson = JSON.stringify(order)
  await sql`
    INSERT INTO pane_order (kind, order_json) VALUES (${kind}, ${orderJson})
    ON CONFLICT (kind) DO UPDATE SET order_json = ${orderJson}
  `
  return NextResponse.json({ ok: true })
}
