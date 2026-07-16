import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'

// Trade-off notes on the pack-chain table: when a user acts on an OMISSIONS
// suggestion (e.g. "traded the +1 pack gain off against the -15 loss of
// 30 Apr"), they record what they did here, stamped with their name.
// One note per item per row date.
async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS pack_tradeoffs (
      id SERIAL PRIMARY KEY,
      item_id INT NOT NULL,
      row_date DATE NOT NULL,
      note TEXT NOT NULL,
      done_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (item_id, row_date)
    )
  `.catch(() => {})
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const itemId = Number(req.nextUrl.searchParams.get('itemId'))
  if (!itemId) return NextResponse.json([])

  await ensureTable()
  try {
    const rows = await sql`
      SELECT row_date::text AS date, note, done_by
      FROM pack_tradeoffs WHERE item_id = ${itemId}
    `
    return NextResponse.json(rows)
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { itemId, date, note } = await req.json()
  if (!itemId || !date) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const [item] = await sql`SELECT canonical_name FROM items WHERE id = ${Number(itemId)}`
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  const doneBy = session.user?.name || (session.user as any)?.username || null
  const text = String(note ?? '').trim()

  await ensureTable()
  const [existing] = await sql`
    SELECT id FROM pack_tradeoffs WHERE item_id = ${Number(itemId)} AND row_date = ${date}
  `

  if (!text) {
    // An emptied note removes the trade-off record.
    if (existing) {
      await sql`DELETE FROM pack_tradeoffs WHERE id = ${existing.id}`
      await logActivity(doneBy ?? 'Unknown', 'removed trade-off note', `${item.canonical_name} · ${date}`)
    }
    return NextResponse.json({ ok: true, date, note: null, done_by: null })
  }

  if (existing) {
    await sql`UPDATE pack_tradeoffs SET note = ${text}, done_by = ${doneBy} WHERE id = ${existing.id}`
  } else {
    await sql`
      INSERT INTO pack_tradeoffs (item_id, row_date, note, done_by)
      VALUES (${Number(itemId)}, ${date}, ${text}, ${doneBy})
    `
  }
  await logActivity(doneBy ?? 'Unknown', 'recorded trade-off', `${item.canonical_name} · ${date} — ${text}`)
  return NextResponse.json({ ok: true, date, note: text, done_by: doneBy })
}
