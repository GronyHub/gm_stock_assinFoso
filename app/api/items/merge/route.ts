import { auth } from '@/lib/auth'
import { mergeItems } from '@/lib/mergeItems'
import { logActivity } from '@/lib/logger'
import { NextResponse } from 'next/server'

// POST { loser_id, winner_id, final_name? }
// See lib/mergeItems.ts for exactly what a merge moves.
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { loser_id, winner_id, final_name } = await req.json()
  if (!loser_id || !winner_id || loser_id === winner_id)
    return NextResponse.json({ error: 'Invalid ids' }, { status: 400 })

  let result
  try {
    result = await mergeItems(loser_id, winner_id, final_name)
  } catch {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }

  const actor = (session.user as any)?.username || session.user?.name || 'Unknown'
  await logActivity(actor, 'merged items', `"${result.merged}" → "${result.into}"`)

  return NextResponse.json({ ok: true, merged: result.merged, into: result.into })
}
