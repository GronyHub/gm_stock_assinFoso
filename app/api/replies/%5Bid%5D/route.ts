import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pathId = req.nextUrl.pathname.split('/').pop()
  const id = parseInt(pathId || '0')
  if (!id) return NextResponse.json({ error: 'Reply ID required' }, { status: 400 })

  try {
    await sql`DELETE FROM item_replies WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('reply DELETE error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not delete reply: ${detail}` }, { status: 500 })
  }
}
