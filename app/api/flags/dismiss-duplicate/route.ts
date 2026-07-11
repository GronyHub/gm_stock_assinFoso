import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const actor = (session.user as any)?.username || session.user?.name || 'Unknown'

  if (Array.isArray(body.pairs)) {
    const pairs = body.pairs.filter((p: any) => p.id1 && p.id2)
    if (!pairs.length) return NextResponse.json({ error: 'Missing pairs' }, { status: 400 })

    for (const p of pairs) {
      const [lo, hi] = [Math.min(p.id1, p.id2), Math.max(p.id1, p.id2)]
      await sql`
        INSERT INTO dismissed_duplicates (item_id1, item_id2, dismissed_by)
        VALUES (${lo}, ${hi}, ${actor})
        ON CONFLICT (item_id1, item_id2) DO NOTHING
      `
    }
    await logActivity(actor, 'marked all as different items', `${pairs.length} pair${pairs.length !== 1 ? 's' : ''}`)
    return NextResponse.json({ ok: true, count: pairs.length })
  }

  const { id1, id2, name1, name2 } = body
  if (!id1 || !id2) return NextResponse.json({ error: 'Missing ids' }, { status: 400 })

  const [lo, hi] = [Math.min(id1, id2), Math.max(id1, id2)]

  await sql`
    INSERT INTO dismissed_duplicates (item_id1, item_id2, dismissed_by)
    VALUES (${lo}, ${hi}, ${actor})
    ON CONFLICT (item_id1, item_id2) DO NOTHING
  `
  await logActivity(actor, 'marked as different items', `${name1} vs ${name2}`)
  return NextResponse.json({ ok: true })
}

export async function GET() {
  const rows = await sql`SELECT item_id1, item_id2 FROM dismissed_duplicates`
  return NextResponse.json(rows)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id1, id2 } = await req.json()
  const [lo, hi] = [Math.min(id1, id2), Math.max(id1, id2)]
  await sql`DELETE FROM dismissed_duplicates WHERE item_id1 = ${lo} AND item_id2 = ${hi}`
  return NextResponse.json({ ok: true })
}
