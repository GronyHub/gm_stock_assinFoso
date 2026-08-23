import { auth } from '@/lib/auth'
import { unmergeItems } from '@/lib/unmergeItems'
import { logActivity } from '@/lib/logger'
import { NextResponse } from 'next/server'

// POST { loser_id, winner_id }
// Reverses a merge operation, restoring the loser item as a canonical item
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { loser_id, winner_id } = await req.json()
  if (!loser_id || !winner_id || loser_id === winner_id)
    return NextResponse.json({ error: 'Invalid ids' }, { status: 400 })

  let result
  const actor = (session.user as any)?.username || session.user?.name || 'Unknown'
  try {
    result = await unmergeItems(loser_id, winner_id)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message.includes('not found')) {
      return NextResponse.json({ error: 'Merge not found or already reversed' }, { status: 404 })
    }
    return NextResponse.json({ error: message }, { status: 400 })
  }

  await logActivity(actor, 'unmerged items', `"${result.restored}" ← "${result.from}"`)

  return NextResponse.json({ ok: true, restored: result.restored, from: result.from })
}
