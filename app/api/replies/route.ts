import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS item_replies (
      id SERIAL PRIMARY KEY,
      item_type TEXT NOT NULL,
      item_id INTEGER NOT NULL,
      reply_text TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.catch(() => {})
  await sql`CREATE INDEX IF NOT EXISTS idx_item_replies ON item_replies (item_type, item_id)`.catch(() => {})
}

export async function GET(req: NextRequest) {
  const itemType = req.nextUrl.searchParams.get('itemType')
  const itemId = req.nextUrl.searchParams.get('itemId')

  if (!itemType || !itemId) {
    return NextResponse.json({ error: 'itemType and itemId required' }, { status: 400 })
  }

  await ensureTable()
  try {
    const replies = await sql`
      SELECT id, item_type, item_id, reply_text, created_by, created_at
      FROM item_replies
      WHERE item_type = ${itemType} AND item_id = ${parseInt(itemId)}
      ORDER BY created_at ASC
    `
    return NextResponse.json(replies)
  } catch (e) {
    console.error('replies GET error:', e)
    return NextResponse.json([])
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await ensureTable()

  const { itemType, itemId, replyText } = await req.json()
  if (!itemType || !itemId || !replyText) {
    return NextResponse.json({ error: 'itemType, itemId, and replyText required' }, { status: 400 })
  }

  const actor = (session.user as any)?.username || session.user?.name || 'Unknown'

  try {
    const [row] = await sql`
      INSERT INTO item_replies (item_type, item_id, reply_text, created_by)
      VALUES (${itemType}, ${parseInt(itemId)}, ${replyText.trim()}, ${actor})
      RETURNING id, item_type, item_id, reply_text, created_by, created_at
    `
    return NextResponse.json(row, { status: 201 })
  } catch (e) {
    console.error('replies POST error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not save reply: ${detail}` }, { status: 500 })
  }
}
