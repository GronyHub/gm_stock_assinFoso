import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { ensureLiveSaleTapsTable } from '@/lib/liveSales'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: idStr } = await params
  const action = req.nextUrl.searchParams.get('action') || 'undo'
  const id = parseInt(idStr)

  if (!id) return NextResponse.json({ error: 'Invalid tap ID' }, { status: 400 })

  try {
    await ensureLiveSaleTapsTable()

    if (action === 'undo') {
      await sql`UPDATE live_sale_taps SET undone = true WHERE id = ${id}`
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    console.error('live-taps undo error:', e)
    return NextResponse.json({ error: 'Failed to undo tap' }, { status: 500 })
  }
}
