import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { NextRequest } from 'next/server'
import { ensureDbInitialized } from '@/lib/api/dbInitCache'
import { once } from '@/lib/once'

const ensureTable = once(async () => {
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
})

export async function GET(req: NextRequest) {
  const itemType = req.nextUrl.searchParams.get('itemType')
  const itemId = req.nextUrl.searchParams.get('itemId')

  if (!itemType || !itemId) {
    return badRequest('itemType and itemId required')
  }

  await ensureDbInitialized()
  await ensureTable()
  try {
    const replies = await sql`
      SELECT id, item_type, item_id, reply_text, created_by, created_at
      FROM item_replies
      WHERE item_type = ${itemType} AND item_id = ${parseInt(itemId)}
      ORDER BY created_at ASC
    `
    return success(replies)
  } catch (e) {
    console.error('replies GET error:', e)
    return success([])
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  await ensureDbInitialized()
  await ensureTable()

  const { itemType, itemId, replyText } = await req.json()
  if (!itemType || !itemId || !replyText) {
    return badRequest('itemType, itemId, and replyText required')
  }

  const actor = (session!.user as any)?.username || session!.user?.name || 'Unknown'

  try {
    const [row] = await sql`
      INSERT INTO item_replies (item_type, item_id, reply_text, created_by)
      VALUES (${itemType}, ${parseInt(itemId)}, ${replyText.trim()}, ${actor})
      RETURNING id, item_type, item_id, reply_text, created_by, created_at
    `
    return success(row)
  } catch (e) {
    return handleError('replies POST', e)
  }
}
