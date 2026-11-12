import { requireAuth, success, handleError } from '@/lib/api'
import { allDutiesForDate } from '@/lib/duties'
import { dutyViewer } from '@/lib/myDay'
import { NextRequest } from 'next/server'

// GET ?date=YYYY-MM-DD -- every duty due on that date for everyone (the viewer sees standing duties only of people they may look at): the one list Waiting for team shows.
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    const date = req.nextUrl.searchParams.get('date') ?? ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return success({ duties: [] })
    return success({ duties: await allDutiesForDate(date, dutyViewer(session.user as never)) })
  } catch (e) { return handleError('duties GET', e) }
}
