import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { ensureAdvertStatusTable } from '@/lib/advertStatus'
import { NextRequest, NextResponse } from 'next/server'

// Every active item/service and whether it currently has an audio advert
// recorded -- items with no row (or has_advert = false) are what the
// "items missing audio adverts" flag surfaces.
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await ensureAdvertStatusTable()
    const rows = await sql`
      SELECT
        i.id AS item_id, i.canonical_name AS item_name, i.cf_group,
        COALESCE(i.product_type, 'goods') AS product_type,
        COALESCE(s.has_advert, false) AS has_advert,
        s.notes, s.updated_by, s.updated_at
      FROM items i
      LEFT JOIN item_audio_advert_status s ON s.item_id = i.id
      WHERE LOWER(i.status) != 'inactive'
      ORDER BY has_advert ASC, i.cf_group NULLS LAST, i.canonical_name
    `
    return NextResponse.json(rows)
  } catch (e) {
    console.error('advert-status GET error:', e)
    return NextResponse.json([])
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { item_id, has_advert, notes } = await req.json()
  if (!item_id) return NextResponse.json({ error: 'Missing item_id' }, { status: 400 })

  const updatedBy = (session.user as any)?.username || session.user?.name || 'Unknown'

  try {
    await ensureAdvertStatusTable()
    await sql`
      INSERT INTO item_audio_advert_status (item_id, has_advert, notes, updated_by, updated_at)
      VALUES (${item_id}, ${!!has_advert}, ${notes || null}, ${updatedBy}, now())
      ON CONFLICT (item_id) DO UPDATE
      SET has_advert = ${!!has_advert}, notes = ${notes || null}, updated_by = ${updatedBy}, updated_at = now()
    `
    await logActivity(updatedBy, has_advert ? 'marked advert recorded' : 'marked advert missing', `item #${item_id}`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('advert-status POST error:', e)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
