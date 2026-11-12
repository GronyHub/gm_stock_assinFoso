import { requireAuth, success, handleError } from '@/lib/api'
import { dayKey } from '@/lib/dailyChecks'
import { getClockState } from '@/lib/clockState'
import { groupForTile, answersFor } from '@/lib/questionGroups'
import { NextRequest } from 'next/server'

// The questions of the group behind a checklist tile, with the day's answers so far (and who is at work, for "who" questions).
export async function GET(req: NextRequest, ctx: { params: Promise<{ tileId: string }> }) {
  const { error } = await requireAuth()
  if (error) return error
  try {
    const { tileId } = await ctx.params
    const day = /^\d{4}-\d{2}-\d{2}$/.test(req.nextUrl.searchParams.get('day') ?? '') ? req.nextUrl.searchParams.get('day')! : dayKey()
    const g = await groupForTile(Number(tileId))
    if (!g) return success({ group: null })
    return success({ group: g, answers: await answersFor(g.id, day), present: (await getClockState(day)).everIn })
  } catch (e) { return handleError('question group tile', e) }
}
